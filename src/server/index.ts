import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { stockService } from './services/stock_api';
import { GameLogic } from './services/game_logic';
import { ADMIN_USERNAMES } from '../shared/config';

const app = express();
const gameLogic = new GameLogic(redis);

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      console.error('API Init Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      const [count, username] = await Promise.all([
        redis.get('count'),
        reddit.getCurrentUsername(),
      ]);

      console.log('[DEVVIT] Init - userId:', context.userId, 'username:', username);

      // Store username if available, otherwise use userId as fallback
      if (context.userId) {
        // user: prefix is often stripped by frontend, but let's store clean username if possible
        const usernameToStore = username || context.username || context.userId;
        await gameLogic.setUsername(context.userId, usernameToStore);
        console.log('[DEVVIT] Init - Stored username:', usernameToStore, 'for userId:', context.userId);
      }

      res.json({
        type: 'init',
        postId: postId,
        count: count ? parseInt(count) : 0,
        username: username ?? context.userId ?? 'anonymous',
      });
    } catch (error) {
      console.error(`API Init Error for post ${postId}:`, error);
      let errorMessage = 'Unknown error during initialization';
      if (error instanceof Error) {
        errorMessage = `Initialization failed: ${error.message}`;
      }
      res.status(400).json({ status: 'error', message: errorMessage });
    }
  }
);

router.post<{ postId: string }, IncrementResponse | { status: string; message: string }, unknown>(
  '/api/increment',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', 1),
      postId,
      type: 'increment',
    });
  }
);

router.post<{ postId: string }, DecrementResponse | { status: string; message: string }, unknown>(
  '/api/decrement',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', -1),
      postId,
      type: 'decrement',
    });
  }
);

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

// DEBUG: Endpoint to manually fix username if needed
router.post('/api/debug/set-username', async (req, res) => {
  const { userId, username: contextUsername } = context;
  const { username } = req.body as { username: string };

  const effectiveUsername = contextUsername || userId || '';
  if (!ADMIN_USERNAMES.includes(effectiveUsername) && !ADMIN_USERNAMES.includes(userId || '')) {
    res.status(403).json({ error: 'Forbidden: Admin access only' });
    return;
  }

  if (!userId || !username) {
    res.status(400).json({ error: 'Missing userId or username' });
    return;
  }

  await gameLogic.setUsername(userId, username);
  console.log('[DEBUG] Manually set username:', username, 'for userId:', userId);
  res.json({ success: true, username });
});

// Endpoint to sync username from client context
router.post('/api/username/sync', async (req, res) => {
  const { userId } = context;
  const { username } = req.body as { username: string };

  if (!userId || !username) {
    res.status(400).json({ error: 'Missing userId or username' });
    return;
  }

  await gameLogic.setUsername(userId, username);
  console.log('[DEVVIT] Synced username from client:', username, 'for userId:', userId);
  res.json({ success: true });
});

// DEBUG: Set last reset date to YESTERDAY (Time Travel)
router.post('/api/debug/time-travel', async (req, res) => {
  const { userId, username } = context;

  const effectiveUsername = username || userId || '';
  if (!userId || (!ADMIN_USERNAMES.includes(effectiveUsername) && !ADMIN_USERNAMES.includes(userId))) {
    return res.status(403).json({ error: 'Forbidden: Admin access only' });
  }

  // Force portfolio lastResetDate to be yesterday
  const portfolio = await gameLogic.getPortfolio(userId);

  // Calculate "yesterday" in ET
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  portfolio.lastResetDate = formatter.format(yesterday);

  // Save state - simulating "yesterday's" state
  await redis.set(`user:${userId}:portfolio`, JSON.stringify(portfolio));

  console.log(`[DEBUG] Time Traveled user ${userId} back to ${portfolio.lastResetDate}`);
  res.json({ success: true, message: 'Welcome to yesterday! Refresh the app to trigger a daily reset.' });
});

// DEBUG: Trigger Scheduler Logic Manually
router.post('/api/debug/trigger-scheduler', async (req, res) => {
  const { userId, username } = context;

  const effectiveUsername = username || userId || '';
  if (!ADMIN_USERNAMES.includes(effectiveUsername) && !ADMIN_USERNAMES.includes(userId || '')) {
    return res.status(403).json({ error: 'Forbidden: Admin access only' });
  }

  console.log('[DEBUG] Manually triggering Daily Reset Scheduler...');

  // Save current leaderboard as "yesterday's winners"
  await gameLogic.savePreviousDayWinners();

  // Clear current leaderboard
  await redis.del('leaderboard');

  // Mark system as reset for today (optional, but good for consistency)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayStr = formatter.format(new Date());
  await redis.set('system:last_daily_reset', todayStr);

  console.log('[DEBUG] Daily Reset Triggered Successfully');
  res.json({ success: true, message: 'Daily Reset Triggered! Leaderboard archived and cleared.' });
});

router.get('/api/stocks', async (req, res) => {
  const type = (req.query.type as 'stocks' | 'crypto' | 'all' | 'auto') || 'auto';
  const validTypes = ['stocks', 'crypto', 'all', 'auto'];
  const requestType = validTypes.includes(type) ? type : 'auto';

  console.log('[API /stocks] Request received, type:', requestType);
  const stocks = await stockService.getMemeStocks(requestType);
  console.log('[API /stocks] Returning', stocks.length, 'stocks. First stock:', stocks[0]?.symbol, '@', stocks[0]?.price);
  res.json({ stocks });
});

router.get('/api/portfolio', async (_req, res) => {
  const { userId } = context;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' });
    return;
  }
  console.log('[API /portfolio] Request for userId:', userId);
  const portfolio = await gameLogic.getPortfolio(userId);
  console.log('[API /portfolio] Portfolio cash:', portfolio.cash, 'assets:', Object.keys(portfolio.assets).length);

  // Sync Leaderboard & Calculate Total Value
  let totalValue = portfolio.cash;
  try {
    const allStocks = await stockService.getMemeStocks('all');
    const priceMap: Record<string, number> = {};
    for (const s of allStocks) {
      priceMap[s.symbol] = s.price;
    }
    totalValue = gameLogic.calculateTotalValue(portfolio, priceMap);
    console.log('[API /portfolio] Total value calculated:', totalValue);

    // Update leaderboard in background to not block response too long? 
    // Actually we already awaited the stocks, so the update is fast (Redis).
    gameLogic.updateLeaderboard(userId, totalValue).catch(console.error);
  } catch (e) {
    console.error('Failed to calculate total value', e);
  }

  res.json({ portfolio, totalValue, userId });
});

router.get('/api/history', async (_req, res) => {
  const { userId } = context;
  console.log('[DEVVIT] GET /api/history - userId:', userId);
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' });
    return;
  }
  const history = await gameLogic.getTradeHistory(userId);
  console.log('[DEVVIT] Trade history for', userId, ':', history.length, 'entries');
  res.json({ history });
});

router.get('/api/users/:userId/history', async (req, res) => {
  const { userId } = req.params;
  console.log('[DEVVIT] GET /api/users/:userId/history - userId:', userId);
  const history = await gameLogic.getTradeHistory(userId);
  console.log('[DEVVIT] Trade history for', userId, ':', history.length, 'entries');
  res.json({ history });
});

router.post('/api/trade', async (req, res) => {
  const { userId } = context;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' });
    return;
  }
  const { ticker, amount, type } = req.body as { ticker: string; amount: number; type: 'buy' | 'sell' };

  // Fetch current price
  const stock = await stockService.getStockPrice(ticker);
  if (!stock) {
    res.status(400).json({ success: false, message: 'Invalid ticker' });
    return;
  }


  // Enforce Market Hours for Stocks (Crypto is 24/7)
  const isCrypto = ticker.endsWith('-USD');
  const isMarketOpen = stockService.isMarketOpen();

  // Only enforce market hours for stocks, not crypto
  if (!isCrypto && !isMarketOpen) {
    res.status(400).json({ success: false, message: 'Stock Market Closed! Market hours: Mon-Fri 9:30 AM - 4 PM ET. Try crypto instead!' });
    return;
  }


  let result;
  if (type === 'buy') {
    result = await gameLogic.buyStock(userId, ticker, stock.price, amount);
  } else if (type === 'sell') {
    result = await gameLogic.sellStock(userId, ticker, stock.price, amount);
  } else {
    res.status(400).json({ success: false, message: 'Invalid trade type' });
    return;
  }

  // Update leaderboard asynchronously & Log History
  if (result.success) {
    // Log history
    const tradeEntry = {
      ticker,
      amount,
      price: stock.price,
      type,
      timestamp: Date.now()
    };
    console.log('[DEVVIT] Logging trade for userId:', userId, tradeEntry);
    gameLogic.logTrade(userId, tradeEntry).catch(console.error);

    if (result.portfolio) {
      // We need current prices for all assets to calculate total value accurately.
      // Ideally, we'd fetch only assets in portfolio, but getMemeStocks is cached/fast enough or valid fallback.
      const allStocks = await stockService.getMemeStocks('all');
      const priceMap: Record<string, number> = {};
      for (const s of allStocks) {
        priceMap[s.symbol] = s.price;
      }
      const totalValue = gameLogic.calculateTotalValue(result.portfolio, priceMap);
      // Fire and forget
      gameLogic.updateLeaderboard(userId, totalValue).catch(console.error);
    }
  }

  res.json(result);
});

router.get('/api/leaderboard', async (_req, res) => {
  const leaderboard = await gameLogic.getLeaderboard(10);
  res.json({ leaderboard });
});

router.get('/api/leaderboard/previous', async (req, res) => {
  const daysAgo = parseInt(req.query.daysAgo as string) || 1;
  const previousWinners = await gameLogic.getPreviousDayWinners(daysAgo);
  res.json({ leaderboard: previousWinners });
});

router.get('/api/leaderboard/history', async (_req, res) => {
  const history = await gameLogic.getAllHistoricalWinners();
  res.json({ history });
});

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port, () => {
  console.log(`[SERVER] Listening on port: ${port}`);
});

// Internal Scheduler for Daily Resets (12:01 AM ET)
setInterval(async () => {
  try {
    // Get current time in ET
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });

    // Format: "YYYY-MM-DD, HH:MM"
    const parts = formatter.formatToParts(new Date());
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;

    const hour = parseInt(getPart('hour') || '0');
    const minute = parseInt(getPart('minute') || '0');
    const todayStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;

    // Target: 00:01 (12:01 AM)
    if (hour === 0 && minute === 1) {
      const lastReset = await redis.get('system:last_daily_reset');

      if (lastReset !== todayStr) {
        console.log(`[SCHEDULER] Triggering Daily Reset for ${todayStr}...`);
        await gameLogic.savePreviousDayWinners();
        await redis.del('leaderboard');
        await redis.set('system:last_daily_reset', todayStr);
        console.log('[SCHEDULER] Daily Reset Complete.');
      }
    }
  } catch (e) {
    console.error('[SCHEDULER] Error:', e);
  }
}, 60000); // Check every minute

import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { stockService } from './services/stock_api';
import { GameLogic } from './services/game_logic';

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
        const usernameToStore = username || context.userId;
        await gameLogic.setUsername(context.userId, usernameToStore);
        console.log('[DEVVIT] Stored username:', usernameToStore, 'for userId:', context.userId);
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

router.get('/api/stocks', async (req, res) => {
  const type = (req.query.type as 'stocks' | 'crypto' | 'all' | 'auto') || 'auto';
  const validTypes = ['stocks', 'crypto', 'all', 'auto'];
  const requestType = validTypes.includes(type) ? type : 'auto';

  const stocks = await stockService.getMemeStocks(requestType);
  res.json({ stocks });
});

router.get('/api/portfolio', async (_req, res) => {
  const { userId } = context;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' });
    return;
  }
  const portfolio = await gameLogic.getPortfolio(userId);

  // Sync Leaderboard & Calculate Total Value
  let totalValue = portfolio.cash;
  try {
    const allStocks = await stockService.getMemeStocks('all');
    const priceMap: Record<string, number> = {};
    for (const s of allStocks) {
      priceMap[s.symbol] = s.price;
    }
    totalValue = gameLogic.calculateTotalValue(portfolio, priceMap);

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

  // Enforce Market Hours / Weekend Rules
  const isWeekend = stockService.isWeekend();
  const isCrypto = ticker.endsWith('-USD');

  if (isWeekend && !isCrypto) {
    res.status(400).json({ success: false, message: 'Market Closed! Only Crypto trades on weekends.' });
    return;
  }

  if (!isWeekend && isCrypto) {
    res.status(400).json({ success: false, message: 'Crypto Market Closed! Only Stocks trade on weekdays.' });
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

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);

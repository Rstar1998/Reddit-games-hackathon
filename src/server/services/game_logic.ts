

export interface Portfolio {
    cash: number;
    assets: Record<string, number>; // ticker -> quantity
    lastUpdated: number;
    lastResetDate?: string | undefined; // YYYY-MM-DD
}

export interface HistoryEntry {
    ticker: string;
    amount: number;
    price: number;
    type: 'buy' | 'sell';
    timestamp: number;
}

export const INITIAL_CASH = 10000;

export class GameLogic {
    constructor(private redis: any) { }

    private getUserKey(userId: string): string {
        return `user:${userId}:portfolio`;
    }

    private getCurrentDateET(): string {
        // en-CA locale returns YYYY-MM-DD format
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        return formatter.format(new Date());
    }

    /**
     * Get user portfolio or initialize if not exists
     */
    async getPortfolio(userId: string): Promise<Portfolio> {
        const key = this.getUserKey(userId);
        const data = await this.redis.get(key);

        let portfolio: Portfolio;

        const today = this.getCurrentDateET();

        if (!data) {
            portfolio = {
                cash: INITIAL_CASH,
                assets: {},
                lastUpdated: Date.now(),
                lastResetDate: today
            };
            await this.redis.set(key, JSON.stringify(portfolio));
        } else {
            portfolio = JSON.parse(data);
        }

        // Check for Daily Reset
        // Reset if date changed AND it's a weekday (Mon=1 ... Fri=5)
        // We need day of week in ET too.
        const etDateString = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
        const etDate = new Date(etDateString);
        const dayOfWeek = etDate.getDay();
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

        if (portfolio.lastResetDate !== today && isWeekday) {
            portfolio.cash = INITIAL_CASH;
            portfolio.assets = {};
            portfolio.lastResetDate = today;
            portfolio.lastUpdated = Date.now();
            await this.redis.set(key, JSON.stringify(portfolio));

            // Clear trade history on daily reset
            const historyKey = `user:${userId}:history`;
            await this.redis.del(historyKey);
            console.log('[GAME_LOGIC] Daily reset: Portfolio and history cleared for user:', userId);
        }

        return portfolio;
    }

    /**
     * Log a trade to history
     */
    async logTrade(userId: string, entry: HistoryEntry): Promise<void> {
        const key = `user:${userId}:history`;
        console.log('[GAME_LOGIC] Logging trade to key:', key, 'entry:', entry);

        // Get existing history
        const existingData = await this.redis.get(key);
        const history: HistoryEntry[] = existingData ? JSON.parse(existingData) : [];

        // Add new entry at the beginning
        history.unshift(entry);

        // Keep last 50 trades
        const trimmedHistory = history.slice(0, 50);

        // Save back to Redis
        await this.redis.set(key, JSON.stringify(trimmedHistory));
        console.log('[GAME_LOGIC] Trade logged successfully, total trades:', trimmedHistory.length);
    }

    /**
     * Get trade history
     */
    async getTradeHistory(userId: string): Promise<HistoryEntry[]> {
        const key = `user:${userId}:history`;
        console.log('[GAME_LOGIC] Getting trade history for key:', key);
        const data = await this.redis.get(key);
        const history: HistoryEntry[] = data ? JSON.parse(data) : [];
        console.log('[GAME_LOGIC] Retrieved', history.length, 'trade entries');
        return history;
    }

    /**
     * Set Username
     */
    async setUsername(userId: string, username: string): Promise<void> {
        await this.redis.hSet('users:metadata', userId, username);
    }

    /**
     * Get Username
     */
    async getUsername(userId: string): Promise<string> {
        const username = await this.redis.hGet('users:metadata', userId);
        return username || userId;
    }

    /**
     * Buy stock
     */
    async buyStock(userId: string, ticker: string, price: number, quantity: number): Promise<{ success: boolean; message: string; portfolio?: Portfolio }> {
        const portfolio = await this.getPortfolio(userId);
        const cost = price * quantity;

        if (portfolio.cash < cost) {
            return { success: false, message: 'Not enough cash!' };
        }

        // Update portfolio
        // Round cash to 2 decimals (currency)
        portfolio.cash = Math.max(0, parseFloat((portfolio.cash - cost).toFixed(2)));

        // Round assets to 8 decimals (crypto standard) to avoid floating point errors
        const newQty = (portfolio.assets[ticker] || 0) + quantity;
        portfolio.assets[ticker] = parseFloat(newQty.toFixed(8));

        portfolio.lastUpdated = Date.now();

        await this.redis.set(this.getUserKey(userId), JSON.stringify(portfolio));
        return { success: true, message: `Bought ${quantity} ${ticker} @ $${price}`, portfolio };
    }

    /**
     * Sell stock
     */
    async sellStock(userId: string, ticker: string, price: number, quantity: number): Promise<{ success: boolean; message: string; portfolio?: Portfolio }> {
        const portfolio = await this.getPortfolio(userId);
        const currentQty = portfolio.assets[ticker] || 0;

        if (currentQty < quantity) {
            return { success: false, message: 'Not enough shares!' };
        }

        // Update portfolio
        const revenue = price * quantity;
        portfolio.cash = parseFloat((portfolio.cash + revenue).toFixed(2));

        const newQty = currentQty - quantity;
        const roundedQty = parseFloat(newQty.toFixed(8));

        if (roundedQty <= 0) {
            delete portfolio.assets[ticker];
        } else {
            portfolio.assets[ticker] = roundedQty;
        }

        portfolio.lastUpdated = Date.now();

        await this.redis.set(this.getUserKey(userId), JSON.stringify(portfolio));
        return { success: true, message: `Sold ${quantity} ${ticker} @ $${price}`, portfolio };
    }

    /**
     * Calculate total portfolio value (Cash + Asset Value)
     */
    calculateTotalValue(portfolio: Portfolio, currentPrices: Record<string, number>): number {
        let total = portfolio.cash;
        for (const [ticker, qty] of Object.entries(portfolio.assets)) {
            if (currentPrices[ticker]) {
                total += qty * currentPrices[ticker];
            }
        }
        return total;
    }

    async updateLeaderboard(userId: string, totalValue: number): Promise<void> {
        try {
            await this.redis.zAdd('leaderboard', { member: userId, score: totalValue });
        } catch (e) {
            console.error('Failed to update leaderboard', e);
        }
    }

    async getLeaderboard(limit: number = 10): Promise<{ userId: string; username: string; value: number }[]> {
        try {
            // Get top users (highest score first)
            const result = await this.redis.zRange('leaderboard', 0, limit - 1, { by: 'rank', reverse: true });

            // Resolve usernames
            const leaderboard = await Promise.all(result.map(async (item: { member: string; score: number }) => {
                const username = await this.getUsername(item.member);
                return {
                    userId: item.member,
                    username: username,
                    value: item.score
                };
            }));

            return leaderboard;
        } catch (e) {
            console.error('Failed to get leaderboard', e);
            return [];
        }
    }

    /**
     * Save previous day's winners (top 10) - should be called at 11:59 PM ET
     */
    /**
     * Save previous day's winners (top 10) - should be called at 12:01 AM ET
     */
    async savePreviousDayWinners(): Promise<void> {
        try {
            // Calculate "yesterday" in ET
            // If we run at 12:01 AM ET, subtracting 12 hours safely puts us in the previous day
            const now = new Date();
            const past = new Date(now.getTime() - 12 * 60 * 60 * 1000);

            const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            const dateKey = formatter.format(past);

            // Get current top 10
            const winners = await this.getLeaderboard(10);

            if (winners.length > 0) {
                // Save to Redis with date key
                await this.redis.set(`leaderboard:history:${dateKey}`, JSON.stringify(winners));
                console.log(`[GAME_LOGIC] Saved previous day winners for ${dateKey}`);
            }
        } catch (e) {
            console.error('Failed to save previous day winners', e);
        }
    }

    /**
     * Get previous day's winners
     */
    async getPreviousDayWinners(daysAgo: number = 1): Promise<{ userId: string; username: string; value: number; date: string }[]> {
        try {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - daysAgo);
            const dateKey = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

            const data = await this.redis.get(`leaderboard:history:${dateKey}`);
            if (!data) {
                return [];
            }

            const winners = JSON.parse(data);
            // Add date to each winner
            return winners.map((w: any) => ({ ...w, date: dateKey }));
        } catch (e) {
            console.error('Failed to get previous day winners', e);
            return [];
        }
    }
}

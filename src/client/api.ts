
import { StockListResponse, PortfolioResponse, TradeResponse } from '../shared/types/api';
import { StockData } from '../shared/types/models';

export class ApiClient {
    async getStocks(type: 'stocks' | 'crypto' | 'all' | 'auto' = 'auto'): Promise<{ stocks: StockData[] }> {
        const res = await fetch(`/api/stocks?type=${type}&_t=${Date.now()}`);
        return res.json();
    }

    async getPortfolio(): Promise<PortfolioResponse> {
        const res = await fetch(`/api/portfolio?_t=${Date.now()}`);
        return res.json();
    }

    async trade(ticker: string, amount: number, type: 'buy' | 'sell'): Promise<TradeResponse> {
        const res = await fetch('/api/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker, amount, type }),
        });
        return res.json();
    }

    async getLeaderboard(): Promise<{ leaderboard: { userId: string; username: string; value: number }[] }> {
        const res = await fetch('/api/leaderboard');
        return res.json();
    }

    async getUserHistory(userId: string): Promise<{ history: any[] }> {
        const res = await fetch(`/api/users/${userId}/history`);
        return res.json();
    }

    async getMyHistory(): Promise<{ history: any[] }> {
        const res = await fetch('/api/history');
        return res.json();
    }
}

export const api = new ApiClient();

export interface StockData {
    symbol: string;
    price: number;
    changePercent: number;
    name: string;
}

export interface Portfolio {
    cash: number;
    assets: Record<string, number>; // ticker -> quantity
    lastUpdated: number;
}

export const INITIAL_CASH = 10000;

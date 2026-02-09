import { Portfolio, StockData } from './models';

export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
  portfolio?: Portfolio;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

export type StockListResponse = {
  stocks: StockData[];
};

export type PortfolioResponse = {
  portfolio: Portfolio;
  totalValue?: number;
  userId?: string;
};

export type TradeResponse = {
  success: boolean;
  message: string;
  portfolio?: Portfolio;
};


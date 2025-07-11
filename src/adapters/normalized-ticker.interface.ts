/**
 * Нормализованный интерфейс для данных тикера с любой биржи
 */
export interface NormalizedTicker {
  ticker: string;
  price: number;
  fundingRate: number;
  nextFundingTime: number;
}

/**
 * Агрегированные данные со всех бирж
 */
export interface AggregatedData {
  binance: { [ticker: string]: NormalizedTicker };
  bybit: { [ticker: string]: NormalizedTicker };
  bitget: { [ticker: string]: NormalizedTicker };
  bingx: { [ticker: string]: NormalizedTicker };
  bitmex: { [ticker: string]: NormalizedTicker };
  okx: { [ticker: string]: NormalizedTicker };
}

/**
 * Сводная информация по тикеру
 */
export interface TickerSummary {
  ticker: string;
  exchanges: {
    [exchangeName: string]: {
      price: number;
      fundingRate: number;
      nextFundingTime: number;
    } | null;
  };
  minFundingRate: number | null;
  maxFundingRate: number | null;
  fundingRateDiff: number | null;
}

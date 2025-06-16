export interface TickerData {
  price: number;
  fundingRate: number;
  nextFundingTime: number;
  exchange: string;
}

export interface Exchange {
  [ticker: string]: TickerData;
}

export interface GetDataResponse {
  binance: Exchange;
  bybit: Exchange;
  bitget: Exchange;
  bingx: Exchange;
  bitmex: Exchange;
  okx: Exchange;
}

export interface ExchangeFundingData {
  fundingRate: number;
  nextFundingTime: number;
}

export interface LiveSpreadsResponse {
  ticker: string;
  
  // Поля для каждой биржи (опциональные)
  binance?: ExchangeFundingData;
  bybit?: ExchangeFundingData;
  bitget?: ExchangeFundingData;
  bingx?: ExchangeFundingData;
  mexc?: ExchangeFundingData;
  bitmex?: ExchangeFundingData;
  okx?: ExchangeFundingData;
  
  // Расчетные поля
  minFundingRate: number;
  maxFundingRate: number;
  spread: number;
}

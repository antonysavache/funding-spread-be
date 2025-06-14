import { NormalizedTicker } from './normalized-ticker.interface';

export interface BybitTickerResponse {
  retCode: number;
  retMsg: string;
  result: {
    category: string;
    list: BybitTickerData[];
  };
  time: number;
}

export interface BybitTickerData {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastPrice: string;
  nextFundingTime: string;
  fundingRate: string;
  price24hPcnt: string;
  volume24h: string;
  turnover24h: string;
}

export class BybitAdapter {

  /**
   * Нормализует данные Bybit к общему формату
   */
  static normalize(tickerData: BybitTickerData[]): { [ticker: string]: NormalizedTicker } {
    const normalized: { [ticker: string]: NormalizedTicker } = {};

    tickerData.forEach(tickerItem => {
      if (this.isValidUsdtPerpetual(tickerItem.symbol) && 
          tickerItem.fundingRate && 
          tickerItem.nextFundingTime) {
        
        const ticker = this.extractBaseCurrency(tickerItem.symbol);
        
        if (ticker) {
          normalized[ticker] = {
            ticker: ticker,
            price: parseFloat(tickerItem.markPrice),
            fundingRate: parseFloat(tickerItem.fundingRate),
            nextFundingTime: parseInt(tickerItem.nextFundingTime, 10)
          };
        }
      }
    });

    return normalized;
  }

  /**
   * Извлекает базовую валюту из символа Bybit
   */
  private static extractBaseCurrency(symbol: string): string | null {
    if (symbol.endsWith('USDT')) {
      return symbol.replace('USDT', '');
    }
    return null;
  }

  /**
   * Проверяет, является ли символ валидным USDT перпетуалом
   */
  private static isValidUsdtPerpetual(symbol: string): boolean {
    return symbol.endsWith('USDT') && symbol.length > 4;
  }

  /**
   * Проверяет валидность ответа Bybit API
   */
  static isValidResponse(response: BybitTickerResponse): boolean {
    return response && response.retCode === 0 && response.result && Array.isArray(response.result.list);
  }

  /**
   * Фильтрует только USDT перпетуальные контракты
   */
  static filterUsdtPerpetuals<T extends { symbol: string }>(data: T[]): T[] {
    return data.filter(item => this.isValidUsdtPerpetual(item.symbol));
  }
}

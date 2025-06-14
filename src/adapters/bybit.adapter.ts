import { NormalizedTicker } from './normalized-ticker.interface';

export interface BybitFundingResponse {
  retCode: number;
  retMsg: string;
  result: {
    category: string;
    list: BybitFundingData[];
  };
  time: number;
}

export interface BybitFundingData {
  symbol: string;
  fundingRate: string;
  fundingRateTimestamp: string;
}

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
}

export class BybitAdapter {

  /**
   * Нормализует данные Bybit к общему формату
   */
  static normalize(
    fundingData: BybitFundingData[],
    tickerData: BybitTickerData[]
  ): { [ticker: string]: NormalizedTicker } {
    const normalized: { [ticker: string]: NormalizedTicker } = {};

    // Создаем Map для быстрого поиска ticker данных
    const tickerMap = new Map(
      tickerData.map(item => [item.symbol, item])
    );

    fundingData.forEach(fundingItem => {
      const tickerItem = tickerMap.get(fundingItem.symbol);
      
      if (tickerItem && this.isValidUsdtPerpetual(fundingItem.symbol)) {
        const ticker = this.extractBaseCurrency(fundingItem.symbol);
        
        if (ticker) {
          normalized[ticker] = {
            ticker: ticker,
            price: parseFloat(tickerItem.markPrice),
            fundingRate: parseFloat(fundingItem.fundingRate),
            nextFundingTime: parseInt(tickerItem.nextFundingTime, 10)
          };
        }
      }
    });

    console.log(`Bybit адаптер: обработано ${Object.keys(normalized).length} тикеров`);
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
  static isValidResponse(response: BybitFundingResponse | BybitTickerResponse): boolean {
    return response && response.retCode === 0 && response.result && Array.isArray(response.result.list);
  }

  /**
   * Фильтрует только USDT перпетуальные контракты
   */
  static filterUsdtPerpetuals<T extends { symbol: string }>(data: T[]): T[] {
    return data.filter(item => this.isValidUsdtPerpetual(item.symbol));
  }
}

import { NormalizedTicker } from './normalized-ticker.interface';

export interface BitGetFundingResponse {
  code: string;
  msg: string;
  requestTime: number;
  data: BitGetFundingData[];
}

export interface BitGetFundingData {
  symbol: string;
  fundingRate: string;
  settleTime: string;
}

export interface BitGetTickerResponse {
  code: string;
  msg: string;
  requestTime: number;
  data: BitGetTickerData[];
}

export interface BitGetTickerData {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastPr: string;
  fundingTime: string;
}

export class BitGetAdapter {

  /**
   * Нормализует данные BitGet к общему формату
   */
  static normalize(
    fundingData: BitGetFundingData[],
    tickerData: BitGetTickerData[]
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
            nextFundingTime: parseInt(fundingItem.settleTime, 10)
          };
        }
      }
    });

    console.log(`BitGet адаптер: обработано ${Object.keys(normalized).length} тикеров`);
    return normalized;
  }

  /**
   * Извлекает базовую валюту из символа BitGet
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
   * Проверяет валидность ответа BitGet API
   */
  static isValidResponse(response: BitGetFundingResponse | BitGetTickerResponse): boolean {
    return response && response.code === '00000' && Array.isArray(response.data);
  }

  /**
   * Фильтрует только USDT перпетуальные контракты
   */
  static filterUsdtPerpetuals<T extends { symbol: string }>(data: T[]): T[] {
    return data.filter(item => this.isValidUsdtPerpetual(item.symbol));
  }
}

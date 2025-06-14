import { NormalizedTicker } from './normalized-ticker.interface';

export interface OkxFundingResponse {
  code: string;
  msg: string;
  data: OkxFundingData[];
}

export interface OkxFundingData {
  instType: string;
  instId: string;
  fundingRate: string;
  nextFundingTime: string;
  fundingTime: string;
  markPx?: string;
}

export interface OkxMarkPriceResponse {
  code: string;
  msg: string;
  data: OkxMarkPriceData[];
}

export interface OkxMarkPriceData {
  instType: string;
  instId: string;
  markPx: string;
  ts: string;
}

export class OkxAdapter {
  
  /**
   * Нормализует ответ OKX к общему формату
   */
  static normalize(
    fundingData: OkxFundingData[], 
    markPriceData: OkxMarkPriceData[]
  ): { [ticker: string]: NormalizedTicker } {
    const normalized: { [ticker: string]: NormalizedTicker } = {};

    // Создаем Map для быстрого поиска mark price
    const markPriceMap = new Map(
      markPriceData.map(item => [item.instId, parseFloat(item.markPx)])
    );

    fundingData.forEach(item => {
      // Извлекаем базовую валюту из символа (например, BTC-USDT-SWAP -> BTC)
      const ticker = this.extractBaseCurrency(item.instId);
      const markPrice = markPriceMap.get(item.instId);
      
      if (ticker && markPrice && markPrice > 0) {
        normalized[ticker] = {
          ticker: ticker,
          price: markPrice,
          fundingRate: parseFloat(item.fundingRate),
          nextFundingTime: parseInt(item.nextFundingTime, 10)
        };
      }
    });

    console.log(`OKX адаптер: обработано ${Object.keys(normalized).length} тикеров`);
    return normalized;
  }

  /**
   * Извлекает базовую валюту из символа OKX
   */
  private static extractBaseCurrency(instId: string): string | null {
    // OKX использует формат BASE-USDT-SWAP для USDT перпетуалов
    if (instId.includes('-USDT-SWAP')) {
      return instId.split('-')[0];
    }
    
    if (instId.includes('-USDC-SWAP')) {
      return instId.split('-')[0];
    }

    if (instId.includes('-USD-SWAP')) {
      return instId.split('-')[0];
    }

    console.warn(`OKX: Неизвестный формат инструмента: ${instId}`);
    return null;
  }

  /**
   * Проверяет, является ли инструмент валидным USDT перпетуалом
   */
  static isValidUsdtSwap(instId: string): boolean {
    if (!instId || instId.length === 0) {
      return false;
    }
    
    return instId.endsWith('-USDT-SWAP') && 
           instId.split('-').length === 3 &&
           instId.split('-')[0].length > 0;
  }

  /**
   * Фильтрует только USDT перпетуальные свопы
   */
  static filterUsdtSwaps(fundingData: OkxFundingData[]): OkxFundingData[] {
    return fundingData.filter(item => 
      item.instType === 'SWAP' &&
      this.isValidUsdtSwap(item.instId) &&
      parseFloat(item.fundingRate) !== 0 &&
      parseInt(item.nextFundingTime, 10) > 0
    );
  }

  /**
   * Проверяет валидность ответа OKX API
   */
  static isValidResponse(response: OkxFundingResponse | OkxMarkPriceResponse): boolean {
    return response && response.code === '0' && Array.isArray(response.data);
  }

  /**
   * Форматирует символ для запроса к OKX API
   */
  static formatSymbolForApi(baseSymbol: string): string {
    return `${baseSymbol}-USDT-SWAP`;
  }
}

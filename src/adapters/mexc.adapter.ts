import { NormalizedTicker } from './normalized-ticker.interface';

/**
 * Интерфейс для ответа MEXC Contracts API v1
 */
export interface MexcContractTicker {
  symbol: string;           // "BTC_USDT"
  lastPrice: number;        // последняя цена
  fairPrice: number;        // справедливая цена
  markPrice?: number;       // mark price (может отсутствовать)
  indexPrice: number;       // индексная цена  
  fundingRate: number;      // текущий funding rate
  nextSettleTime: number;   // время следующего funding (timestamp)
  maxFundingRate: number;   // максимальный funding rate
  minFundingRate: number;   // минимальный funding rate
  timestamp: number;        // timestamp данных
}

export interface MexcContractTickersResponse {
  success: boolean;
  code: number;
  data: MexcContractTicker[];
}

/**
 * Интерфейс для funding rate endpoint
 */
export interface MexcFundingRate {
  symbol: string;           // "BTC_USDT" 
  fundingRate: number;      // текущий funding rate
  maxFundingRate: number;   // максимальный funding rate
  minFundingRate: number;   // минимальный funding rate
  collectCycle: number;     // цикл сбора (обычно 8 часов)
  nextSettleTime: number;   // время следующего расчета
  timestamp: number;        // timestamp
}

export interface MexcFundingRateResponse {
  success: boolean;
  code: number;
  data: MexcFundingRate;
}

/**
 * Адаптер для нормализации данных MEXC к общему формату
 */
export class MexcAdapter {

  /**
   * Нормализует ответ MEXC contract tickers к общему формату
   */
  static normalize(mexcData: MexcContractTickersResponse): { [ticker: string]: NormalizedTicker } {
    if (!mexcData.success || !mexcData.data || !Array.isArray(mexcData.data)) {
      console.warn('MEXC: некорректный ответ API:', mexcData);
      return {};
    }

    const normalized: { [ticker: string]: NormalizedTicker } = {};

    mexcData.data.forEach(item => {
      // Конвертируем MEXC формат BTC_USDT в стандартный BTCUSDT
      const standardTicker = this.convertMexcSymbol(item.symbol);

      if (standardTicker && this.isValidSymbol(item.symbol)) {
        normalized[standardTicker] = {
          ticker: standardTicker,
          price: item.markPrice || item.fairPrice || item.lastPrice,
          fundingRate: item.fundingRate,
          nextFundingTime: item.nextSettleTime
        };
      }
    });

    console.log(`MEXC адаптер: обработано ${Object.keys(normalized).length} тикеров`);
    return normalized;
  }

  /**
   * Нормализует отдельные funding rate данные  
   */
  static normalizeFundingRate(
    fundingData: MexcFundingRateResponse,
    price: number
  ): NormalizedTicker | null {
    if (!fundingData.success || !fundingData.data) {
      return null;
    }

    const data = fundingData.data;
    const standardTicker = this.convertMexcSymbol(data.symbol);

    if (!standardTicker) return null;

    return {
      ticker: standardTicker,
      price: price,
      fundingRate: data.fundingRate,
      nextFundingTime: data.nextSettleTime
    };
  }

  /**
   * Конвертирует MEXC формат символа в стандартный
   * BTC_USDT -> BTCUSDT
   * ETH_USDT -> ETHUSDT  
   */
  private static convertMexcSymbol(mexcSymbol: string): string | null {
    if (!mexcSymbol) return null;

    // MEXC использует формат BASE_QUOTE для контraktов
    const parts = mexcSymbol.split('_');
    if (parts.length === 2 && parts[1] === 'USDT') {
      return parts[0] + 'USDT';
    }

    // Если уже в стандартном формате
    if (mexcSymbol.endsWith('USDT') && !mexcSymbol.includes('_')) {
      return mexcSymbol;
    }

    return null;
  }

  /**
   * Проверяет, является ли символ валидным для MEXC
   */
  static isValidSymbol(symbol: string): boolean {
    if (!symbol || symbol.length === 0) {
      return false;
    }

    // MEXC контракты используют формат BASE_USDT
    return symbol.endsWith('_USDT') || symbol.endsWith('USDT');
  }

  /**
   * Фильтрует только USDT контракты
   */
  static filterUsdtContracts(mexcData: MexcContractTickersResponse): MexcContractTicker[] {
    if (!mexcData.success || !mexcData.data) {
      return [];
    }

    return mexcData.data.filter(item =>
      this.isValidSymbol(item.symbol) &&
      item.lastPrice > 0 &&
      item.nextSettleTime > 0 &&
      typeof item.fundingRate === 'number'
    );
  }

  /**
   * Вычисляет время следующего funding для MEXC (каждые 8 часов)
   */
  private static calculateNextFundingTime(): number {
    const now = new Date();
    const currentHour = now.getUTCHours();
    let nextFundingHour: number;

    if (currentHour < 8) {
      nextFundingHour = 8;
    } else if (currentHour < 16) {
      nextFundingHour = 16;
    } else {
      nextFundingHour = 24; // 00:00 следующего дня
    }

    const nextFundingTime = new Date(now);
    nextFundingTime.setUTCHours(nextFundingHour % 24, 0, 0, 0);
    if (nextFundingHour === 24) {
      nextFundingTime.setUTCDate(nextFundingTime.getUTCDate() + 1);
    }

    return nextFundingTime.getTime();
  }
}

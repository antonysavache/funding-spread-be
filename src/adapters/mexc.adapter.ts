import { NormalizedTicker } from './normalized-ticker.interface';

export interface MexcFundingResponse {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  estimatedSettlePrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
  interestRate: string;
  time: number;
}

export class MexcAdapter {
  
  /**
   * Нормализует ответ MEXC к общему формату
   */
  static normalize(mexcData: MexcFundingResponse[]): { [ticker: string]: NormalizedTicker } {
    const normalized: { [ticker: string]: NormalizedTicker } = {};

    mexcData.forEach(item => {
      // Извлекаем базовую валюту из символа (например, BTCUSDT -> BTC)
      const ticker = this.extractBaseCurrency(item.symbol);
      
      if (ticker) {
        normalized[ticker] = {
          ticker: ticker,
          price: parseFloat(item.markPrice),
          fundingRate: parseFloat(item.lastFundingRate),
          nextFundingTime: item.nextFundingTime
        };
      }
    });

    console.log(`MEXC адаптер: обработано ${Object.keys(normalized).length} тикеров`);
    return normalized;
  }

  /**
   * Извлекаем базовую валюту из символа MEXC
   */
  private static extractBaseCurrency(symbol: string): string | null {
    // MEXC использует формат BASEUSDT для USDT пар
    if (symbol.endsWith('USDT')) {
      return symbol.replace('USDT', '');
    }
    
    if (symbol.endsWith('USDC')) {
      return symbol.replace('USDC', '');
    }
    
    if (symbol.endsWith('BUSD')) {
      return symbol.replace('BUSD', '');
    }

    console.warn(`MEXC: Неизвестный формат символа: ${symbol}`);
    return symbol;
  }

  /**
   * Проверяет, является ли символ валидным для MEXC
   */
  static isValidSymbol(symbol: string): boolean {
    if (!symbol || symbol.length === 0) {
      return false;
    }
    
    return symbol.endsWith('USDT') ||
           symbol.endsWith('USDC') ||
           symbol.endsWith('BUSD');
  }

  /**
   * Фильтрует только USDT перпетуалы
   */
  static filterUsdtPerpetuals(mexcData: MexcFundingResponse[]): MexcFundingResponse[] {
    return mexcData.filter(item => 
      this.isValidSymbol(item.symbol) && 
      parseFloat(item.markPrice) > 0 &&
      item.nextFundingTime > 0
    );
  }
}

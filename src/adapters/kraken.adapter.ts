import { NormalizedTicker } from './normalized-ticker.interface';

// Контракты Kraken Futures API
interface KrakenTicker {
  symbol: string;
  tag: string;
  pair: string;
  markPrice: number;
  fundingRate: number;
  fundingRatePrediction?: number;
  last: number;
  lastTime: string;
  suspended: boolean;
  postOnly: boolean;
  openInterest?: number;
  indexPrice?: number;
  bid?: number;
  ask?: number;
  vol24h?: number;
}

interface KrakenTickersResponse {
  result: string;
  tickers: KrakenTicker[];
  serverTime: string;
}

export class KrakenAdapter {
  
  /**
   * Нормализует данные Kraken Futures в единый формат
   */
  static normalize(tickersResponse: KrakenTickersResponse): { [ticker: string]: NormalizedTicker } {
    
    if (!tickersResponse.tickers || !Array.isArray(tickersResponse.tickers)) {
      console.error('Kraken: Некорректная структура ответа API');
      return {};
    }

    // Фильтруем только активные perpetual контракты с USD
    const activeSymbols = tickersResponse.tickers.filter(
      ticker => 
        ticker.tag === 'perpetual' && 
        !ticker.suspended &&
        !ticker.postOnly &&
        ticker.symbol &&
        this.isValidPerpetualTicker(ticker.symbol, ticker.pair) &&
        ticker.fundingRate !== undefined &&
        ticker.markPrice !== undefined
    );

    const result: { [ticker: string]: NormalizedTicker } = {};

    activeSymbols.forEach(ticker => {
      // Нормализуем символ для совместимости с другими биржами
      const normalizedSymbol = this.normalizeSymbol(ticker.symbol, ticker.pair);
      
      if (normalizedSymbol) {
        // Вычисляем следующее время выплаты funding rate (каждый час в UTC)
        const nextFundingTime = this.getNextFundingTime();

        result[normalizedSymbol] = {
          ticker: normalizedSymbol,
          price: ticker.markPrice,
          fundingRate: ticker.fundingRate,
          nextFundingTime: nextFundingTime
        };
      }
    });

    return result;
  }

  /**
   * Проверяет что тикер является perpetual контрактом с USD
   */
  private static isValidPerpetualTicker(symbol: string, pair: string): boolean {
    // Kraken использует символы типа PF_XBTUSD, PF_ETHUSD для perpetual futures
    // или PI_XBTUSD для inverse perpetual contracts
    const validPrefixes = ['PF_', 'PI_'];
    const hasValidPrefix = validPrefixes.some(prefix => symbol.toUpperCase().startsWith(prefix));
    
    // Проверяем что пара содержит USD
    const isUsdPair = Boolean(pair && pair.toUpperCase().includes('USD'));
    
    return hasValidPrefix && isUsdPair;
  }

  /**
   * Нормализует символ Kraken в формат XXXUSDT для совместимости с другими биржами
   */
  private static normalizeSymbol(symbol: string, pair: string): string | null {
    try {
      // Убираем префиксы PF_ или PI_
      let cleanSymbol = symbol.replace(/^(PF_|PI_)/i, '');
      
      // Если символ уже содержит USD, преобразуем в USDT формат
      if (cleanSymbol.toUpperCase().endsWith('USD')) {
        // Заменяем USD на USDT для совместимости
        cleanSymbol = cleanSymbol.replace(/USD$/i, 'USDT');
      } else if (pair) {
        // Используем информацию из pair для создания правильного символа
        const pairParts = pair.split(':');
        if (pairParts.length === 2) {
          const baseAsset = pairParts[0];
          cleanSymbol = baseAsset + 'USDT';
        }
      }

      // Дополнительная проверка и очистка
      cleanSymbol = cleanSymbol.toUpperCase();
      
      // Заменяем XBT на BTC для стандартизации
      cleanSymbol = cleanSymbol.replace('XBTUSDT', 'BTCUSDT');

      // Проверяем что получился корректный формат
      if (cleanSymbol.endsWith('USDT') && cleanSymbol.length > 4) {
        return cleanSymbol;
      }

      return null;
    } catch (error) {
      console.error(`Kraken: Ошибка нормализации символа ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Вычисляет следующее время выплаты funding rate
   * Kraken выплачивает funding каждый час по UTC
   */
  private static getNextFundingTime(): number {
    const now = new Date();
    const nextHour = new Date(now);
    
    // Устанавливаем следующий час, минуты и секунды в 0
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    
    return nextHour.getTime();
  }

  /**
   * Проверяет валидность ответа API
   */
  static isValidResponse(response: any): response is KrakenTickersResponse {
    return (
      response &&
      typeof response === 'object' &&
      response.result === 'success' &&
      Array.isArray(response.tickers)
    );
  }
}

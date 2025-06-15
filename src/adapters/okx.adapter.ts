// Контракты OKX API v5
interface OKXFundingRate {
  instId: string;          // Instrument ID - символ
  fundingRate: string;     // Current funding rate
  nextFundingRate?: string; // Next funding rate
  fundingTime: string;     // Next funding time timestamp
}

interface OKXMarkPrice {
  instId: string;     // Instrument ID
  markPx: string;     // Mark price
  ts: string;         // Timestamp
}

interface OKXTicker {
  instId: string;     // Instrument ID
  last: string;       // Last traded price
  markPx?: string;    // Mark price (может отсутствовать)
  idxPx?: string;     // Index price  
  fundingRate?: string; // может отсутствовать
  nextFundingRate?: string; // может отсутствовать
  fundingTime?: string; // может отсутствовать
  ts: string;         // Timestamp
  // Дополнительные поля из реального API
  lastSz?: string;
  askPx?: string;
  askSz?: string;
  bidPx?: string;
  bidSz?: string;
  open24h?: string;
  high24h?: string;
  low24h?: string;
  volCcy24h?: string;
  vol24h?: string;
  sodUtc0?: string;
  sodUtc8?: string;
}

interface OKXFundingResponse {
  code: string;
  msg: string;
  data: OKXFundingRate[];
}

interface OKXMarkPriceResponse {
  code: string;
  msg: string;
  data: OKXMarkPrice[];
}

interface OKXTickersResponse {
  code: string;
  msg: string;
  data: OKXTicker[];
}

// Импортируем интерфейс
import { NormalizedTicker } from './normalized-ticker.interface';

export class OKXAdapter {

  /**
   * Нормализует данные OKX v5 API в единый формат
   * Использует tickers endpoint который МОЖЕТ содержать funding rates
   */
  static normalize(tickersResponse: OKXTickersResponse): { [ticker: string]: NormalizedTicker } {

    if (!tickersResponse.data || !Array.isArray(tickersResponse.data)) {
      console.warn('OKX: пустой ответ от API');
      return {};
    }

    const result: { [ticker: string]: NormalizedTicker } = {};
    console.log(`🔍 OKX адаптер: анализируем ${tickersResponse.data.length} элементов...`);

    // Проверим первые 3 элемента на наличие funding rates
    const sampleElements = tickersResponse.data.slice(0, 3);
    sampleElements.forEach((ticker, index) => {
      console.log(`🔍 OKX sample ${index + 1}:`, {
        instId: ticker.instId,
        last: ticker.last,
        markPx: ticker.markPx,
        fundingRate: ticker.fundingRate,
        fundingTime: ticker.fundingTime,
        nextFundingRate: ticker.nextFundingRate,
        allFields: Object.keys(ticker)
      });
    });

    tickersResponse.data.forEach((ticker, index) => {
      const standardSymbol = this.convertOKXSymbol(ticker.instId);
      
      // Фильтруем только USDT перпетуалы с валидными данными
      if (
        standardSymbol &&
        standardSymbol.endsWith('USDT') &&
        this.isValidTicker(standardSymbol) &&
        (ticker.markPx || ticker.last)
      ) {
        // Если есть funding rate из tickers - используем его, иначе 0
        const fundingRate = ticker.fundingRate ? parseFloat(ticker.fundingRate) : 0;
        const price = parseFloat(ticker.markPx || ticker.last);
        const nextFundingTime = ticker.fundingTime ? 
          this.parseOKXTimestamp(ticker.fundingTime) : 
          this.calculateNextFundingTime();

        result[standardSymbol] = {
          ticker: standardSymbol,
          price: price,
          fundingRate: fundingRate,
          nextFundingTime: nextFundingTime
        };

        if (index < 5) {
          console.log(`✅ OKX адаптер: добавили ${standardSymbol}:`, {
            price,
            fundingRate: (fundingRate * 100).toFixed(6) + '%',
            hasFundingInSource: !!ticker.fundingRate,
            nextFunding: new Date(nextFundingTime).toLocaleTimeString()
          });
        }
      }
    });

    console.log(`OKX адаптер: обработано ${Object.keys(result).length} тикеров`);
    return result;
  }

  /**
   * Альтернативная нормализация с отдельными endpoints
   */
  static normalizeFundingRates(
    fundingResponse: OKXFundingResponse,
    tickersResponse: OKXTickersResponse
  ): { [ticker: string]: NormalizedTicker } {
    
    if (!fundingResponse.data || !tickersResponse.data) {
      console.warn('OKX: пустые данные от API');
      return {};
    }

    console.log(`🔍 OKX адаптер: анализируем ${fundingResponse.data.length} funding rates и ${tickersResponse.data.length} тикеров...`);

    // Создаем карту цен по стандартным символам
    const priceMap = new Map<string, OKXTicker>();
    tickersResponse.data.forEach((ticker, index) => {
      const standardSymbol = this.convertOKXSymbol(ticker.instId);
      if (standardSymbol) {
        priceMap.set(standardSymbol, ticker);
        if (index < 3) {
          console.log(`🔍 OKX цены: ${ticker.instId} -> ${standardSymbol}, цена: ${ticker.last}`);
        }
      }
    });

    // Создаем карту funding rates по стандартным символам
    const fundingMap = new Map<string, OKXFundingRate>();
    fundingResponse.data.forEach((funding, index) => {
      const standardSymbol = this.convertOKXSymbol(funding.instId);
      if (standardSymbol) {
        fundingMap.set(standardSymbol, funding);
        if (index < 3) {
          console.log(`🔍 OKX funding: ${funding.instId} -> ${standardSymbol}, rate: ${funding.fundingRate}, time: ${funding.fundingTime}`);
        }
      }
    });

    const result: { [ticker: string]: NormalizedTicker } = {};

    fundingResponse.data.forEach((funding, index) => {
      const standardSymbol = this.convertOKXSymbol(funding.instId);
      const ticker = priceMap.get(standardSymbol || '');
      
      if (index < 3) {
        console.log(`🔍 OKX адаптер: элемент ${index + 1}:`, {
          instId: funding.instId,
          standardSymbol: standardSymbol,
          hasStandardSymbol: !!standardSymbol,
          endsWithUSDT: standardSymbol?.endsWith('USDT'),
          hasFundingRate: !!funding.fundingRate,
          hasTicker: !!ticker,
          hasPrice: !!(ticker?.last),
          fundingRateValue: funding.fundingRate,
          priceValue: ticker?.last
        });
      }
      
      if (
        standardSymbol &&
        ticker &&
        standardSymbol.endsWith('USDT') &&
        this.isValidTicker(standardSymbol) &&
        funding.fundingRate !== undefined &&
        ticker.last
      ) {
        const fundingRate = parseFloat(funding.fundingRate) || 0;
        const price = parseFloat(ticker.last);
        const nextFundingTime = funding.fundingTime ? 
          this.parseOKXTimestamp(funding.fundingTime) : 
          this.calculateNextFundingTime();

        result[standardSymbol] = {
          ticker: standardSymbol,
          price: price,
          fundingRate: fundingRate,
          nextFundingTime: nextFundingTime
        };

        if (index < 10) {
          console.log(`✅ OKX адаптер: добавили ${standardSymbol}:`, {
            price,
            fundingRate: (fundingRate * 100).toFixed(4) + '%',
            nextFunding: new Date(nextFundingTime).toLocaleTimeString()
          });
        }
      } else if (index < 3) {
        console.log(`❌ OKX адаптер: пропускаем ${funding.instId} -> ${standardSymbol} - не прошел фильтрацию`);
      }
    });

    console.log(`OKX адаптер (funding): обработано ${Object.keys(result).length} тикеров`);
    return result;
  }

  /**
   * Конвертирует OKX формат символа в стандартный
   * BTC-USDT-SWAP -> BTCUSDT
   * ETH-USDT-SWAP -> ETHUSDT
   */
  private static convertOKXSymbol(okxSymbol: string): string | null {
    if (!okxSymbol) return null;

    // Удаляем суффикс -SWAP и заменяем - на пустую строку
    const cleaned = okxSymbol.replace('-SWAP', '').replace('-', '');
    
    // Проверяем что получился валидный символ
    if (cleaned.endsWith('USDT') && cleaned.length > 4) {
      return cleaned;
    }

    return null;
  }

  /**
   * Проверяет что тикер в правильном формате XXXUSDT
   */
  private static isValidTicker(ticker: string): boolean {
    const regex = /^[A-Z0-9]+USDT$/;
    return regex.test(ticker) && ticker.length > 4;
  }

  /**
   * Парсит timestamp OKX (обычно в миллисекундах)
   */
  private static parseOKXTimestamp(timestamp: string): number {
    if (!timestamp) {
      return this.calculateNextFundingTime();
    }

    const ts = parseInt(timestamp);
    if (!isNaN(ts)) {
      // OKX возвращает timestamp в миллисекундах
      return ts;
    }

    return this.calculateNextFundingTime();
  }

  /**
   * Нормализует данные mark-price endpoint с учетом funding rates
   */
  static normalizeMarkPriceWithFunding(
    markPriceResponse: OKXMarkPriceResponse, 
    fundingData: {[instId: string]: any}
  ): { [ticker: string]: NormalizedTicker } {
    
    if (!markPriceResponse.data || !Array.isArray(markPriceResponse.data)) {
      console.warn('OKX: пустой ответ от mark-price API');
      return {};
    }

    console.log(`🔍 OKX адаптер: анализируем ${markPriceResponse.data.length} mark prices с funding data...`);
    console.log('🔍 OKX адаптер: funding data keys:', Object.keys(fundingData));

    const result: { [ticker: string]: NormalizedTicker } = {};

    markPriceResponse.data.forEach((markPrice, index) => {
      const standardSymbol = this.convertOKXSymbol(markPrice.instId);
      
      // Добавляем отладочные логи для первых элементов
      if (index < 3) {
        console.log(`🔍 OKX mark-price+funding: элемент ${index + 1}:`, {
          instId: markPrice.instId,
          standardSymbol: standardSymbol,
          hasInstId: !!markPrice.instId,
          endsWithUSDT: standardSymbol?.endsWith('USDT'),
          hasMarkPx: !!markPrice.markPx,
          markPxValue: markPrice.markPx,
          hasFundingData: !!fundingData[markPrice.instId]
        });

        if (fundingData[markPrice.instId]) {
          console.log(`🔍 OKX funding info for ${markPrice.instId}:`, fundingData[markPrice.instId]);
        }
      }
      
      // Фильтруем только USDT перпетуалы с валидными данными
      if (
        standardSymbol &&
        standardSymbol.endsWith('USDT') &&
        this.isValidTicker(standardSymbol) &&
        markPrice.markPx
      ) {
        const price = parseFloat(markPrice.markPx);
        
        // Получаем funding rate из отдельного запроса или используем 0
        const fundingInfo = fundingData[markPrice.instId];
        let fundingRate = 0;
        let nextFundingTime = this.calculateNextFundingTime();
        
        if (fundingInfo && fundingInfo.fundingRate) {
          fundingRate = parseFloat(fundingInfo.fundingRate) || 0;
        }
        
        if (fundingInfo && fundingInfo.fundingTime) {
          nextFundingTime = parseInt(fundingInfo.fundingTime) || this.calculateNextFundingTime();
        }

        result[standardSymbol] = {
          ticker: standardSymbol,
          price: price,
          fundingRate: fundingRate,
          nextFundingTime: nextFundingTime
        };

        if (index < 10) {
          console.log(`✅ OKX mark-price+funding: добавили ${standardSymbol}:`, {
            price,
            fundingRate: (fundingRate * 100).toFixed(4) + '%',
            nextFunding: new Date(nextFundingTime).toLocaleTimeString()
          });
        }
      } else if (index < 3) {
        console.log(`❌ OKX mark-price+funding: пропускаем ${markPrice.instId} -> ${standardSymbol} - не прошел фильтрацию`);
      }
    });

    console.log(`OKX адаптер (mark-price+funding): обработано ${Object.keys(result).length} тикеров`);
    return result;
  }

  /**
   * Нормализует данные mark-price endpoint
   * Mark price endpoint может содержать только цены, без funding rates
   * В этом случае используем нулевые funding rates
   */
  static normalizeMarkPrice(markPriceResponse: OKXMarkPriceResponse): { [ticker: string]: NormalizedTicker } {
    
    if (!markPriceResponse.data || !Array.isArray(markPriceResponse.data)) {
      console.warn('OKX: пустой ответ от mark-price API');
      return {};
    }

    console.log(`🔍 OKX адаптер: анализируем ${markPriceResponse.data.length} mark prices...`);

    const result: { [ticker: string]: NormalizedTicker } = {};

    markPriceResponse.data.forEach((markPrice, index) => {
      const standardSymbol = this.convertOKXSymbol(markPrice.instId);
      
      // Добавляем отладочные логи для первых элементов
      if (index < 3) {
        console.log(`🔍 OKX mark-price: элемент ${index + 1}:`, {
          instId: markPrice.instId,
          standardSymbol: standardSymbol,
          hasInstId: !!markPrice.instId,
          endsWithUSDT: standardSymbol?.endsWith('USDT'),
          hasMarkPx: !!markPrice.markPx,
          markPxValue: markPrice.markPx
        });
      }
      
      // Фильтруем только USDT перпетуалы с валидными данными
      if (
        standardSymbol &&
        standardSymbol.endsWith('USDT') &&
        this.isValidTicker(standardSymbol) &&
        markPrice.markPx
      ) {
        const price = parseFloat(markPrice.markPx);
        const fundingRate = 0; // Mark price endpoint не содержит funding rate, используем 0
        const nextFundingTime = this.calculateNextFundingTime();

        result[standardSymbol] = {
          ticker: standardSymbol,
          price: price,
          fundingRate: fundingRate,
          nextFundingTime: nextFundingTime
        };

        if (index < 10) {
          console.log(`✅ OKX mark-price: добавили ${standardSymbol}:`, {
            price,
            fundingRate: (fundingRate * 100).toFixed(4) + '%',
            nextFunding: new Date(nextFundingTime).toLocaleTimeString()
          });
        }
      } else if (index < 3) {
        console.log(`❌ OKX mark-price: пропускаем ${markPrice.instId} -> ${standardSymbol} - не прошел фильтрацию`);
      }
    });

    console.log(`OKX адаптер (mark-price): обработано ${Object.keys(result).length} тикеров`);
    return result;
  }

  /**
   * Вычисляет время следующего funding для OKX (каждые 8 часов: 00:00, 08:00, 16:00 UTC)
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

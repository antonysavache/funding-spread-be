// Контракты BingX API
interface BingXTicker {
  symbol: string;           // "BTC-USDT"
  lastPrice: string;        // последняя цена
  markPrice?: string;       // mark цена (может отсутствовать)
  indexPrice?: string;      // индексная цена
  fundingRate?: string;     // текущий funding rate  
  nextFundingTime?: number; // время следующего funding
  openInterest?: string;    // открытый интерес
  volume?: string;          // объем за 24ч
  time?: number;            // timestamp
}

interface BingXTickersResponse {
  code: number;
  msg: string;
  data: BingXTicker[];
}

// Импортируем интерфейс
import { NormalizedTicker } from './normalized-ticker.interface';

export class BingXAdapter {

  /**
   * Нормализует данные BingX в единый формат с учетом funding rates
   */
  static normalizeWithFunding(
    tickersResponse: BingXTickersResponse, 
    fundingData: {[symbol: string]: any}
  ): { [ticker: string]: NormalizedTicker } {
    console.log('🔍 BingX адаптер: анализируем структуру данных с funding rates...');

    if (tickersResponse.code !== 0 || !tickersResponse.data || !Array.isArray(tickersResponse.data)) {
      console.warn('BingX: некорректный ответ от API:', tickersResponse);
      return {};
    }

    const result: { [ticker: string]: NormalizedTicker } = {};

    // Логируем первый элемент для анализа структуры
    if (tickersResponse.data.length > 0) {
      const firstItem = tickersResponse.data[0];
      console.log('🔍 BingX адаптер: поля первого элемента:', Object.keys(firstItem));
      console.log('🔍 BingX адаптер: пример данных:', firstItem);
    }

    console.log('🔍 BingX адаптер: funding data keys:', Object.keys(fundingData));

    tickersResponse.data.forEach((ticker, index) => {
      // Конвертируем BingX формат BTC-USDT в стандартный BTCUSDT
      const standardSymbol = this.convertBingXSymbol(ticker.symbol);
      
      if (index < 3) {
        console.log(`🔍 BingX адаптер: обрабатываем ${ticker.symbol} -> ${standardSymbol}`);
        
        // Ищем funding rate для этого символа
        const fundingInfo = fundingData[ticker.symbol];
        if (fundingInfo) {
          console.log(`🔍 BingX адаптер: найден funding для ${ticker.symbol}:`, fundingInfo);
        } else {
          console.log(`🔍 BingX адаптер: funding не найден для ${ticker.symbol}`);
        }
      }
      
      // Фильтруем только USDT пары с валидными данными
      if (
        standardSymbol &&
        standardSymbol.endsWith('USDT') &&
        this.isValidTicker(standardSymbol) &&
        ticker.lastPrice
      ) {
        
        // Получаем funding rate из отдельного запроса или используем 0
        const fundingInfo = fundingData[ticker.symbol];
        let fundingRate = 0;
        let nextFundingTime = this.calculateNextFundingTime();
        
        if (fundingInfo && fundingInfo.lastFundingRate) {
          fundingRate = parseFloat(fundingInfo.lastFundingRate) || 0;
        }
        
        if (fundingInfo && fundingInfo.nextFundingTime) {
          nextFundingTime = parseInt(fundingInfo.nextFundingTime) || this.calculateNextFundingTime();
        }
        
        const price = parseFloat(ticker.markPrice || ticker.lastPrice);
        
        if (index < 3) {
          console.log(`✅ BingX адаптер: добавляем ${standardSymbol} с fundingRate=${fundingRate}`);
        }
        
        result[standardSymbol] = {
          ticker: standardSymbol,
          price: price,
          fundingRate: fundingRate,
          nextFundingTime: nextFundingTime
        };
      } else if (index < 3) {
        console.log(`❌ BingX адаптер: пропускаем ${ticker.symbol} - не подходит`);
      }
    });

    console.log(`BingX адаптер с funding: обработано ${Object.keys(result).length} тикеров`);
    return result;
  }

  /**
   * Нормализует данные BingX в единый формат
   */
  static normalize(tickersResponse: BingXTickersResponse): { [ticker: string]: NormalizedTicker } {
    console.log('🔍 BingX адаптер: анализируем структуру данных...');

    if (tickersResponse.code !== 0 || !tickersResponse.data || !Array.isArray(tickersResponse.data)) {
      console.warn('BingX: некорректный ответ от API:', tickersResponse);
      return {};
    }

    const result: { [ticker: string]: NormalizedTicker } = {};

    // Логируем первый элемент для анализа структуры
    if (tickersResponse.data.length > 0) {
      const firstItem = tickersResponse.data[0];
      console.log('🔍 BingX адаптер: поля первого элемента:', Object.keys(firstItem));
      console.log('🔍 BingX адаптер: пример данных:', firstItem);
    }

    tickersResponse.data.forEach((ticker, index) => {
      // Конвертируем BingX формат BTC-USDT в стандартный BTCUSDT
      const standardSymbol = this.convertBingXSymbol(ticker.symbol);
      
      if (index < 3) {
        console.log(`🔍 BingX адаптер: обрабатываем ${ticker.symbol} -> ${standardSymbol}`);
        console.log(`🔍 BingX адаптер: fundingRate = ${ticker.fundingRate}, nextFundingTime = ${ticker.nextFundingTime}`);
      }
      
      // Фильтруем только USDT пары с валидными данными
      if (
        standardSymbol &&
        standardSymbol.endsWith('USDT') &&
        this.isValidTicker(standardSymbol) &&
        ticker.lastPrice
      ) {
        
        // Если нет fundingRate, используем 0 и вычисляем время
        const fundingRate = ticker.fundingRate ? parseFloat(ticker.fundingRate) : 0;
        const nextFundingTime = ticker.nextFundingTime || this.calculateNextFundingTime();
        const price = parseFloat(ticker.markPrice || ticker.lastPrice);
        
        if (index < 3) {
          console.log(`✅ BingX адаптер: добавляем ${standardSymbol} с fundingRate=${fundingRate}`);
        }
        
        result[standardSymbol] = {
          ticker: standardSymbol,
          price: price,
          fundingRate: fundingRate,
          nextFundingTime: nextFundingTime
        };
      } else if (index < 3) {
        console.log(`❌ BingX адаптер: пропускаем ${ticker.symbol} - не подходит`);
      }
    });

    console.log(`BingX адаптер: обработано ${Object.keys(result).length} тикеров`);
    return result;
  }

  /**
   * Конвертирует BingX формат символа в стандартный
   * BTC-USDT -> BTCUSDT
   * ETH-USDT -> ETHUSDT
   */
  private static convertBingXSymbol(bingxSymbol: string): string | null {
    if (!bingxSymbol) return null;

    // BingX использует формат BASE-QUOTE
    const cleaned = bingxSymbol.replace('-', '');
    
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
   * Вычисляет время следующего funding для BingX (каждые 8 часов: 00:00, 08:00, 16:00 UTC)
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
      nextFundingHour = 24;
    }

    const nextFundingTime = new Date(now);
    nextFundingTime.setUTCHours(nextFundingHour % 24, 0, 0, 0);
    if (nextFundingHour === 24) {
      nextFundingTime.setUTCDate(nextFundingTime.getUTCDate() + 1);
    }

    return nextFundingTime.getTime();
  }
}

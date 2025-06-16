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

// Новые интерфейсы для премиум индекса (funding rate endpoint)
interface BingXPremiumIndex {
  symbol: string;           // "BTC-USDT"
  markPrice: string;        // mark цена
  indexPrice: string;       // индексная цена
  fundingRate: string;      // текущий funding rate
  nextFundingTime: number;  // время следующего funding в миллисекундах
  time: number;             // timestamp
}

interface BingXPremiumIndexResponse {
  code: number;
  msg: string;
  data: BingXPremiumIndex;
}

// Контракты информация
interface BingXContract {
  symbol: string;           // "BTC-USDT"
  status: string;           // статус торгов
  baseAsset: string;        // базовый актив "BTC"
  quoteAsset: string;       // котируемый актив "USDT"
  settlementAsset: string;  // актив расчетов "USDT"
  contractSize: string;     // размер контракта
  tickSize: string;         // минимальный шаг цены
  timeInForce: string[];    // типы времени действия ордера
}

interface BingXContractsResponse {
  code: number;
  msg: string;
  data: BingXContract[];
}

// Импортируем интерфейс
import { NormalizedTicker } from './normalized-ticker.interface';

export class BingXAdapter {

  /**
   * Нормализует данные BingX в единый формат (старый метод)
   */
  static normalize(tickersResponse: BingXTickersResponse): { [ticker: string]: NormalizedTicker } {
    console.log('🔍 BingX адаптер (старый): анализируем структуру данных...');

    if (tickersResponse.code !== 0 || !tickersResponse.data || !Array.isArray(tickersResponse.data)) {
      console.warn('BingX: некорректный ответ от API:', tickersResponse);
      return {};
    }

    const result: { [ticker: string]: NormalizedTicker } = {};

    // Логируем первый элемент для анализа структуры
    if (tickersResponse.data.length > 0) {
      const firstItem = tickersResponse.data[0];
      console.log('🔍 BingX адаптер (старый): поля первого элемента:', Object.keys(firstItem));
      console.log('🔍 BingX адаптер (старый): пример данных:', firstItem);
    }

    tickersResponse.data.forEach((ticker, index) => {
      // Конвертируем BingX формат BTC-USDT в стандартный BTCUSDT
      const standardSymbol = this.convertBingXSymbol(ticker.symbol);
      
      if (index < 3) {
        console.log(`🔍 BingX адаптер (старый): обрабатываем ${ticker.symbol} -> ${standardSymbol}`);
        console.log(`🔍 BingX адаптер (старый): fundingRate = ${ticker.fundingRate}, nextFundingTime = ${ticker.nextFundingTime}`);
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
          console.log(`✅ BingX адаптер (старый): добавляем ${standardSymbol} с fundingRate=${fundingRate}`);
        }
        
        result[standardSymbol] = {
          ticker: standardSymbol,
          price: price,
          fundingRate: fundingRate,
          nextFundingTime: nextFundingTime
        };
      } else if (index < 3) {
        console.log(`❌ BingX адаптер (старый): пропускаем ${ticker.symbol} - не подходит`);
      }
    });

    console.log(`BingX адаптер (старый): обработано ${Object.keys(result).length} тикеров`);
    return result;
  }

  /**
   * Нормализует данные премиум индекса (новый метод для funding rates)
   */
  static normalizePremiumIndex(premiumResponse: BingXPremiumIndexResponse): NormalizedTicker | null {
    if (premiumResponse.code !== 0 || !premiumResponse.data) {
      console.warn('BingX: некорректный ответ премиум индекса:', premiumResponse);
      return null;
    }

    const data = premiumResponse.data;
    const standardSymbol = this.convertBingXSymbol(data.symbol);

    if (!standardSymbol || !standardSymbol.endsWith('USDT')) {
      return null;
    }

    return {
      ticker: standardSymbol,
      price: parseFloat(data.markPrice),
      fundingRate: parseFloat(data.fundingRate),
      nextFundingTime: data.nextFundingTime
    };
  }

  /**
   * Нормализует список контрактов
   */
  static normalizeContracts(contractsResponse: BingXContractsResponse): string[] {
    if (contractsResponse.code !== 0 || !contractsResponse.data || !Array.isArray(contractsResponse.data)) {
      console.warn('BingX: некорректный ответ контрактов:', contractsResponse);
      return [];
    }

    return contractsResponse.data
      .filter(contract => 
        contract.symbol && 
        contract.symbol.includes('-USDT') &&
        contract.status === 'TRADING'
      )
      .map(contract => contract.symbol);
  }

  /**
   * Объединяет funding rates и price data (используется в новом сервисе)
   */
  static combineFundingAndPrice(
    symbol: string,
    fundingData: any,
    priceData: any
  ): NormalizedTicker | null {
    const standardSymbol = this.convertBingXSymbol(symbol);

    if (!standardSymbol || !standardSymbol.endsWith('USDT')) {
      return null;
    }

    if (!fundingData || !priceData) {
      return null;
    }

    const fundingRate = fundingData.fundingRate ? parseFloat(fundingData.fundingRate) : 0;
    const price = parseFloat(priceData.lastPrice || priceData.markPrice || '0');
    const nextFundingTime = fundingData.nextFundingTime || this.calculateNextFundingTime();

    if (price <= 0) {
      return null;
    }

    return {
      ticker: standardSymbol,
      price: price,
      fundingRate: fundingRate,
      nextFundingTime: nextFundingTime
    };
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

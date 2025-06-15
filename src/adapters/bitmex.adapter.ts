// Контракты BitMEX API
interface BitMEXInstrument {
  symbol: string;           // "XBTUSD", "ETHUSD"
  typ: string;              // "FFWCSX" для perpetual contracts
  lastPrice?: number;       // последняя цена
  markPrice?: number;       // mark цена
  indicativePrice?: number; // индексная цена
  fundingRate?: number;     // текущий funding rate
  fundingTimestamp?: string; // время следующего funding
  state: string;            // "Open", "Closed"
  listing?: string;         // дата листинга
  settle?: string;          // дата расчета
}

interface BitMEXFunding {
  timestamp: string;        // время funding
  symbol: string;           // символ
  fundingInterval: string;  // интервал
  fundingRate: number;      // ставка funding
  fundingRateDaily: number; // дневная ставка
}

interface BitMEXInstrumentsResponse {
  data?: BitMEXInstrument[];
}

interface BitMEXFundingResponse {
  data?: BitMEXFunding[];
}

// Импортируем интерфейс
import { NormalizedTicker } from './normalized-ticker.interface';

export class BitMEXAdapter {

  /**
   * Нормализует данные BitMEX в единый формат с funding rates
   */
  static normalizeWithFunding(
    instrumentsData: BitMEXInstrument[],
    fundingData: {[symbol: string]: BitMEXFunding}
  ): { [ticker: string]: NormalizedTicker } {
    console.log('🔍 BitMEX адаптер: анализируем структуру данных с funding rates...');

    if (!instrumentsData || !Array.isArray(instrumentsData)) {
      console.warn('BitMEX: некорректные данные инструментов:', instrumentsData);
      return {};
    }

    const result: { [ticker: string]: NormalizedTicker } = {};

    console.log('🔍 BitMEX адаптер: funding data keys:', Object.keys(fundingData));

    instrumentsData.forEach((instrument, index) => {
      // Конвертируем BitMEX формат в стандартный
      const standardSymbol = this.convertBitMEXSymbol(instrument.symbol);
      
      if (index < 3) {
        console.log(`🔍 BitMEX адаптер: обрабатываем ${instrument.symbol} -> ${standardSymbol}`);
        console.log(`🔍 BitMEX адаптер: typ = ${instrument.typ}, state = ${instrument.state}`);
        
        // Ищем funding rate для этого символа
        const fundingInfo = fundingData[instrument.symbol];
        if (fundingInfo) {
          console.log(`🔍 BitMEX адаптер: найден funding для ${instrument.symbol}:`, fundingInfo);
        } else {
          console.log(`🔍 BitMEX адаптер: funding не найден для ${instrument.symbol}`);
        }
      }
      
      // Фильтруем только USDT perpetual contracts с валидными данными
      if (
        standardSymbol &&
        standardSymbol.endsWith('USDT') &&
        this.isValidTicker(standardSymbol) &&
        this.isPerpetualContract(instrument) &&
        instrument.state === 'Open' &&
        (instrument.lastPrice || instrument.markPrice)
      ) {
        
        // Получаем funding rate из отдельного запроса или используем 0
        const fundingInfo = fundingData[instrument.symbol];
        let fundingRate = 0;
        let nextFundingTime = this.calculateNextFundingTime();
        
        if (fundingInfo && fundingInfo.fundingRate !== undefined) {
          fundingRate = fundingInfo.fundingRate;
        }
        
        const price = instrument.markPrice || instrument.lastPrice || 0;
        
        if (index < 10) {
          console.log(`✅ BitMEX адаптер: добавляем ${standardSymbol} с fundingRate=${fundingRate}`);
        }
        
        result[standardSymbol] = {
          ticker: standardSymbol,
          price: price,
          fundingRate: fundingRate,
          nextFundingTime: nextFundingTime
        };
      } else if (index < 3) {
        console.log(`❌ BitMEX адаптер: пропускаем ${instrument.symbol} -> ${standardSymbol} - не подходит`);
      }
    });

    console.log(`BitMEX адаптер с funding: обработано ${Object.keys(result).length} тикеров`);
    return result;
  }

  /**
   * Нормализует данные BitMEX в единый формат (без funding rates)
   */
  static normalize(instrumentsData: BitMEXInstrument[]): { [ticker: string]: NormalizedTicker } {
    console.log('🔍 BitMEX адаптер: анализируем структуру данных...');

    if (!instrumentsData || !Array.isArray(instrumentsData)) {
      console.warn('BitMEX: некорректные данные инструментов:', instrumentsData);
      return {};
    }

    const result: { [ticker: string]: NormalizedTicker } = {};

    instrumentsData.forEach((instrument, index) => {
      const standardSymbol = this.convertBitMEXSymbol(instrument.symbol);
      
      if (index < 3) {
        console.log(`🔍 BitMEX адаптер: обрабатываем ${instrument.symbol} -> ${standardSymbol}`);
      }
      
      // Фильтруем только USDT perpetual contracts с валидными данными
      if (
        standardSymbol &&
        standardSymbol.endsWith('USDT') &&
        this.isValidTicker(standardSymbol) &&
        this.isPerpetualContract(instrument) &&
        instrument.state === 'Open' &&
        (instrument.lastPrice || instrument.markPrice)
      ) {
        
        const fundingRate = instrument.fundingRate || 0;
        const nextFundingTime = this.calculateNextFundingTime();
        const price = instrument.markPrice || instrument.lastPrice || 0;
        
        if (index < 3) {
          console.log(`✅ BitMEX адаптер: добавляем ${standardSymbol} с fundingRate=${fundingRate}`);
        }
        
        result[standardSymbol] = {
          ticker: standardSymbol,
          price: price,
          fundingRate: fundingRate,
          nextFundingTime: nextFundingTime
        };
      } else if (index < 3) {
        console.log(`❌ BitMEX адаптер: пропускаем ${instrument.symbol} - не подходит`);
      }
    });

    console.log(`BitMEX адаптер: обработано ${Object.keys(result).length} тикеров`);
    return result;
  }

  /**
   * Конвертирует BitMEX формат символа в стандартный
   * XBTUSD -> BTCUSDT
   * ETHUSD -> ETHUSDT
   * SOLUSD -> SOLUSDT
   */
  private static convertBitMEXSymbol(bitmexSymbol: string): string | null {
    if (!bitmexSymbol) return null;

    // BitMEX использует особые форматы
    const symbolMap: { [key: string]: string } = {
      'XBTUSD': 'BTCUSDT',
      'ETHUSD': 'ETHUSDT', 
      'SOLUSD': 'SOLUSDT',
      'ADAUSD': 'ADAUSDT',
      'XRPUSD': 'XRPUSDT',
      'LTCUSD': 'LTCUSDT',
      'LINKUSD': 'LINKUSDT',
      'DOGEUSD': 'DOGEUSDT',
      'AVAXUSD': 'AVAXUSDT',
      'DOTUSD': 'DOTUSDT'
    };

    // Прямое сопоставление
    if (symbolMap[bitmexSymbol]) {
      return symbolMap[bitmexSymbol];
    }

    // Для других символов, если они заканчиваются на USD, заменяем на USDT
    if (bitmexSymbol.endsWith('USD') && bitmexSymbol.length > 3) {
      const base = bitmexSymbol.slice(0, -3);
      return base + 'USDT';
    }

    return null;
  }

  /**
   * Проверяет что инструмент является perpetual contract
   */
  private static isPerpetualContract(instrument: BitMEXInstrument): boolean {
    // BitMEX perpetual contracts имеют typ = "FFWCSX"
    return instrument.typ === 'FFWCSX' || 
           instrument.symbol.includes('USD') && !instrument.settle;
  }

  /**
   * Проверяет что тикер в правильном формате XXXUSDT
   */
  private static isValidTicker(ticker: string): boolean {
    const regex = /^[A-Z0-9]+USDT$/;
    return regex.test(ticker) && ticker.length > 4;
  }

  /**
   * Вычисляет время следующего funding для BitMEX (каждые 8 часов: 00:00, 08:00, 16:00 UTC)
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

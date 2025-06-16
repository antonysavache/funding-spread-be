/**
 * BitMEX Adapter для нормализации данных
 * 
 * ВАЖНО: BitMEX имеет два типа контрактов:
 * 1. USDT контракты - расчеты в USDT (settlCurrency: "USDt") 
 *    Примеры: XRPUSDT, ADAUSDT, SOLUSDT
 * 2. USD контракты - расчеты в Bitcoin (settlCurrency: "XBt")
 *    Примеры: XBTUSD, ETHUSD, SOLUSD
 * 
 * Для корректного анализа funding rates мы берем ТОЛЬКО USDT контракты!
 */

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
  settlCurrency?: string;   // валюта расчетов: "USDt" для USDT контрактов, "XBt" для USD контрактов
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
    console.log(`📊 BitMEX адаптер: получено ${instrumentsData?.length || 0} инструментов`);

    if (!instrumentsData || !Array.isArray(instrumentsData)) {
      console.warn('BitMEX: некорректные данные инструментов:', instrumentsData);
      return {};
    }

    const result: { [ticker: string]: NormalizedTicker } = {};
    const stats = {
      total: instrumentsData.length,
      perpetual: 0,
      open: 0,
      withPrice: 0,
      usdt: 0,
      usdtSettlement: 0,
      validTicker: 0,
      final: 0
    };

    console.log('🔍 BitMEX адаптер: funding data keys:', Object.keys(fundingData).length);

    instrumentsData.forEach((instrument, index) => {
      const isPerpetual = this.isPerpetualContract(instrument);
      const isOpen = instrument.state === 'Open';
      const hasPrice = !!(instrument.lastPrice || instrument.markPrice);
      const standardSymbol = this.convertBitMEXSymbol(instrument.symbol);
      const isUSDT = standardSymbol && standardSymbol.endsWith('USDT');
      const isUSDTSettlement = instrument.settlCurrency === 'USDt'; // Фильтр по валюте расчетов
      const isValidTicker = standardSymbol && this.isValidTicker(standardSymbol);

      // Статистика
      if (isPerpetual) stats.perpetual++;
      if (isOpen) stats.open++;
      if (hasPrice) stats.withPrice++;
      if (isUSDT) stats.usdt++;
      if (isUSDTSettlement) stats.usdtSettlement++;
      if (isValidTicker) stats.validTicker++;

      if (index < 5) {
        console.log(`🔍 BitMEX адаптер [${index}]: ${instrument.symbol} -> ${standardSymbol}`);
        console.log(`   perpetual: ${isPerpetual}, open: ${isOpen}, price: ${hasPrice}, usdt: ${isUSDT}, settlCurrency: ${instrument.settlCurrency}, valid: ${isValidTicker}`);
        console.log(`   typ: ${instrument.typ}, state: ${instrument.state}, price: ${instrument.lastPrice || instrument.markPrice}`);
      }
      
      // Проверяем все условия - только USDT контракты с settlCurrency: "USDt"
      if (
        standardSymbol &&
        standardSymbol.endsWith('USDT') &&
        this.isValidTicker(standardSymbol) &&
        this.isPerpetualContract(instrument) &&
        instrument.state === 'Open' &&
        instrument.settlCurrency === 'USDt' && // ВАЖНО: только USDT расчеты
        (instrument.lastPrice || instrument.markPrice)
      ) {
        
        // Получаем funding rate из отдельного запроса или используем значение из инструмента
        const fundingInfo = fundingData[instrument.symbol];
        let fundingRate = instrument.fundingRate || 0;
        
        if (fundingInfo && fundingInfo.fundingRate !== undefined) {
          fundingRate = fundingInfo.fundingRate;
        }
        
        // Используем fundingTimestamp из инструмента если доступен
        let nextFundingTime = this.calculateNextFundingTime();
        if (instrument.fundingTimestamp) {
          // Конвертируем строку формата "2025-06-16T20:00:00.000Z" в UNIX timestamp
          const fundingDate = new Date(instrument.fundingTimestamp);
          if (!isNaN(fundingDate.getTime())) {
            nextFundingTime = fundingDate.getTime();
          }
        }
        
        const price = instrument.markPrice || instrument.lastPrice || 0;
        
        result[standardSymbol] = {
          ticker: standardSymbol,
          price: price,
          fundingRate: fundingRate,
          nextFundingTime: nextFundingTime
        };

        stats.final++;
        
        if (stats.final <= 5) {
          console.log(`✅ BitMEX адаптер: добавлен ${standardSymbol} с fundingRate=${fundingRate}, price=${price}, settlCurrency=${instrument.settlCurrency}`);
        }
      }
    });

    console.log(`📊 BitMEX адаптер статистика:`);
    console.log(`   Всего инструментов: ${stats.total}`);
    console.log(`   Perpetual контрактов: ${stats.perpetual}`);
    console.log(`   Открытых: ${stats.open}`);
    console.log(`   С ценами: ${stats.withPrice}`);
    console.log(`   USDT символов: ${stats.usdt}`);
    console.log(`   USDT расчетов (settlCurrency=USDt): ${stats.usdtSettlement}`);
    console.log(`   Валидных тикеров: ${stats.validTicker}`);
    console.log(`   ФИНАЛЬНЫЙ РЕЗУЛЬТАТ: ${stats.final}`);

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
        console.log(`🔍 BitMEX адаптер: обрабатываем ${instrument.symbol} -> ${standardSymbol}, settlCurrency: ${instrument.settlCurrency}`);
      }
      
      // Фильтруем только USDT perpetual contracts с валидными данными и settlCurrency: "USDt"
      if (
        standardSymbol &&
        standardSymbol.endsWith('USDT') &&
        this.isValidTicker(standardSymbol) &&
        this.isPerpetualContract(instrument) &&
        instrument.state === 'Open' &&
        instrument.settlCurrency === 'USDt' && // ВАЖНО: только USDT расчеты
        (instrument.lastPrice || instrument.markPrice)
      ) {
        
        const fundingRate = instrument.fundingRate || 0;
        
        // Используем fundingTimestamp из инструмента если доступен
        let nextFundingTime = this.calculateNextFundingTime();
        if (instrument.fundingTimestamp) {
          // Конвертируем строку формата "2025-06-16T20:00:00.000Z" в UNIX timestamp
          const fundingDate = new Date(instrument.fundingTimestamp);
          if (!isNaN(fundingDate.getTime())) {
            nextFundingTime = fundingDate.getTime();
          }
        }
        
        const price = instrument.markPrice || instrument.lastPrice || 0;
        
        if (index < 3) {
          console.log(`✅ BitMEX адаптер: добавляем ${standardSymbol} с fundingRate=${fundingRate}, settlCurrency=${instrument.settlCurrency}`);
        }
        
        result[standardSymbol] = {
          ticker: standardSymbol,
          price: price,
          fundingRate: fundingRate,
          nextFundingTime: nextFundingTime
        };
      } else if (index < 3) {
        console.log(`❌ BitMEX адаптер: пропускаем ${instrument.symbol} - не подходит (settlCurrency: ${instrument.settlCurrency})`);
      }
    });

    console.log(`BitMEX адаптер: обработано ${Object.keys(result).length} тикеров`);
    return result;
  }

  /**
   * Конвертирует BitMEX формат символа в стандартный USDT формат
   * XBTUSDT -> BTCUSDT (конвертируем XBT в BTC)
   * XBTUSD -> BTCUSDT (конвертируем USD в USDT) 
   * ETHUSD -> ETHUSDT (конвертируем USD в USDT)
   * XRPUSDT -> XRPUSDT (уже правильный формат!)
   */
  private static convertBitMEXSymbol(bitmexSymbol: string): string | null {
    if (!bitmexSymbol) return null;

    // Специальные случаи для BitMEX символов с XBT
    const specialMap: { [key: string]: string } = {
      'XBTUSDT': 'BTCUSDT',  // USDT версия Bitcoin
      'XBTUSD': 'BTCUSDT',   // USD версия Bitcoin, конвертируем в USDT
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

    // Прямое сопоставление для известных символов
    if (specialMap[bitmexSymbol]) {
      return specialMap[bitmexSymbol];
    }

    // Если символ уже заканчивается на USDT и не требует конвертации
    if (bitmexSymbol.endsWith('USDT') && bitmexSymbol.length > 4 && !bitmexSymbol.startsWith('XBT')) {
      return bitmexSymbol;
    }

    // Для других символов, если они заканчиваются на USD, конвертируем в USDT
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

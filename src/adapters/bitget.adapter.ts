// Контракты BitGet API v2
interface BitGetFundingRate {
  symbol: string;
  fundingRate: string;
  fundingTime: string;
}

interface BitGetTicker {
  symbol: string;
  lastPr: string;        // последняя цена
  indexPrice: string;    // индексная цена  
  markPrice: string;     // mark цена
  openUtc: string;
  chgUtc: string;
  fundingRate: string;   // текущий funding rate
  nextFundingTime?: string; // может отсутствовать
  // Дополнительные поля из реального API
  askPr?: string;
  bidPr?: string;
  high24h?: string;
  low24h?: string;
  ts?: string;
  change24h?: string;
  baseVolume?: string;
  quoteVolume?: string;
  usdtVolume?: string;
  changeUtc24h?: string;
  holdingAmount?: string;
  deliveryStartTime?: any;
  deliveryTime?: any;
  deliveryStatus?: string;
  open24h?: string;
}

interface BitGetFundingResponse {
  code: string;
  msg: string; 
  requestTime: number;
  data: BitGetFundingRate[];
}

interface BitGetTickersResponse {
  code: string;
  msg: string;
  requestTime: number;
  data: BitGetTicker[];
}

// Импортируем интерфейс
import { NormalizedTicker } from './normalized-ticker.interface';

export class BitGetAdapter {

  /**
   * Нормализует данные BitGet v2 API в единый формат  
   * Использует новый API v2 endpoint для funding rates
   */
  static normalize(tickersResponse: BitGetTickersResponse): { [ticker: string]: NormalizedTicker } {

    if (!tickersResponse.data || !Array.isArray(tickersResponse.data)) {
      console.warn('BitGet: пустой ответ от API');
      return {};
    }

    const result: { [ticker: string]: NormalizedTicker } = {};
    console.log(`🔍 BitGet адаптер: анализируем ${tickersResponse.data.length} элементов...`);

    tickersResponse.data.forEach((ticker, index) => {
      // Добавляем отладочные логи
      if (index < 3) {
        console.log(`🔍 BitGet адаптер: элемент ${index + 1}:`, {
          symbol: ticker.symbol,
          hasSymbol: !!ticker.symbol,
          endsWithUSDT: ticker.symbol?.endsWith('USDT'),
          hasFundingRate: !!ticker.fundingRate,
          hasMarkPrice: !!ticker.markPrice,
          hasLastPr: !!ticker.lastPr,
          hasNextFundingTime: !!ticker.nextFundingTime,
          fundingRateValue: ticker.fundingRate,
          markPriceValue: ticker.markPrice,
          lastPrValue: ticker.lastPr
        });
      }

      // Фильтруем только USDT пары с валидными данными
      if (
        ticker.symbol &&
        ticker.symbol.endsWith('USDT') &&
        this.isValidTicker(ticker.symbol) &&
        ticker.fundingRate !== undefined &&
        (ticker.markPrice || ticker.lastPr)
      ) {
        const fundingRate = parseFloat(ticker.fundingRate) || 0;
        const price = parseFloat(ticker.markPrice || ticker.lastPr);
        const nextFundingTime = ticker.nextFundingTime ? 
          this.parseNextFundingTime(ticker.nextFundingTime) : 
          this.calculateNextFundingTime();

        result[ticker.symbol] = {
          ticker: ticker.symbol,
          price: price,
          fundingRate: fundingRate,
          nextFundingTime: nextFundingTime
        };

        if (index < 3) {
          console.log(`✅ BitGet адаптер: добавили ${ticker.symbol}:`, {
            price,
            fundingRate: (fundingRate * 100).toFixed(4) + '%',
            nextFunding: new Date(nextFundingTime).toLocaleTimeString()
          });
        }
      } else if (index < 3) {
        console.log(`❌ BitGet адаптер: пропускаем ${ticker.symbol} - не прошел фильтрацию`);
      }
    });

    console.log(`BitGet адаптер: обработано ${Object.keys(result).length} тикеров`);
    return result;
  }

  /**
   * Альтернативный метод нормализации для funding rate endpoint
   */
  static normalizeFundingRates(
    fundingResponse: BitGetFundingResponse,
    tickersResponse: BitGetTickersResponse
  ): { [ticker: string]: NormalizedTicker } {
    
    if (!fundingResponse.data || !tickersResponse.data) {
      console.warn('BitGet: пустые данные от API');
      return {};
    }

    // Создаем карту funding rates
    const fundingMap = new Map(
      fundingResponse.data.map(item => [item.symbol, item])
    );

    // Создаем карту цен
    const priceMap = new Map(
      tickersResponse.data.map(item => [item.symbol, item])
    );

    const result: { [ticker: string]: NormalizedTicker } = {};

    fundingResponse.data.forEach(funding => {
      const ticker = priceMap.get(funding.symbol);
      
      if (
        ticker &&
        funding.symbol.endsWith('USDT') &&
        this.isValidTicker(funding.symbol) &&
        funding.fundingRate &&
        ticker.markPrice
      ) {
        result[funding.symbol] = {
          ticker: funding.symbol,
          price: parseFloat(ticker.markPrice || ticker.lastPr),
          fundingRate: parseFloat(funding.fundingRate),
          nextFundingTime: this.parseNextFundingTime(funding.fundingTime)
        };
      }
    });

    console.log(`BitGet адаптер (funding): обработано ${Object.keys(result).length} тикеров`);
    return result;
  }

  /**
   * Проверяет что тикер в правильном формате XXXUSDT
   */
  private static isValidTicker(ticker: string): boolean {
    // Должен заканчиваться на USDT и иметь минимум 1 символ до USDT
    const regex = /^[A-Z0-9]+USDT$/;
    return regex.test(ticker) && ticker.length > 4; // более 4 символов (минимум 1 + USDT)
  }

  /**
   * Парсит время следующего funding из строки BitGet
   */
  private static parseNextFundingTime(timeString: string): number {
    if (!timeString) {
      return this.calculateNextFundingTime();
    }

    // Пробуем парсить timestamp
    const timestamp = parseInt(timeString);
    if (!isNaN(timestamp)) {
      return timestamp;
    }

    // Если не получилось - вычисляем стандартное время
    return this.calculateNextFundingTime();
  }

  /**
   * Вычисляет время следующего funding для BitGet (каждые 8 часов: 00:00, 08:00, 16:00 UTC)
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

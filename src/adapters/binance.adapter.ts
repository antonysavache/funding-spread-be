import { NormalizedTicker } from './normalized-ticker.interface';

// Контракты Binance API
interface BinanceSymbolInfo {
  symbol: string;
  status: string;
  contractType: string;
  baseAsset: string;
  quoteAsset: string;
}

interface BinancePremiumIndex {
  symbol: string;
  markPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
}

interface BinanceExchangeInfo {
  symbols: BinanceSymbolInfo[];
}

export class BinanceAdapter {
  
  /**
   * Нормализует данные Binance в единый формат
   */
  static normalize(
    exchangeInfo: BinanceExchangeInfo, 
    premiumIndex: BinancePremiumIndex[]
  ): { [ticker: string]: NormalizedTicker } {
    
    // Фильтруем только активные PERPETUAL контракты с USDT
    const activeSymbols = exchangeInfo.symbols.filter(
      symbol => 
        symbol.status === 'TRADING' && 
        symbol.contractType === 'PERPETUAL' &&
        symbol.symbol.endsWith('USDT') &&
        this.isValidTicker(symbol.symbol)
    );

    // Создаем Map для быстрого поиска premium data
    const premiumMap = new Map(
      premiumIndex.map(item => [item.symbol, item])
    );

    const result: { [ticker: string]: NormalizedTicker } = {};

    activeSymbols.forEach(symbolInfo => {
      const premiumData = premiumMap.get(symbolInfo.symbol);
      
      if (premiumData) {
        result[symbolInfo.symbol] = {
          ticker: symbolInfo.symbol,
          price: parseFloat(premiumData.markPrice),
          fundingRate: parseFloat(premiumData.lastFundingRate),
          nextFundingTime: premiumData.nextFundingTime
        };
      }
    });

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
}

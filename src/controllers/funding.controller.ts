import { Controller, Get, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import axios from 'axios';
import { ExchangeAggregatorService } from '../services/exchange-aggregator.service';
import { AggregatedNormalizedData } from '../services/exchange-aggregator.service';
import { GetDataResponse, Exchange, TickerData } from '../interfaces/get-data-response.interface';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';
import { OKXService } from '../services/okx.service';
import { KrakenService } from '../services/kraken.service';
import { BingXService } from '../services/bingx.service';
import { BitMEXService } from '../services/bitmex.service';

@Controller('api/funding')
export class FundingController {

  constructor(
    private readonly exchangeAggregatorService: ExchangeAggregatorService,
    private readonly okxService: OKXService,
    private readonly krakenService: KrakenService,
    private readonly bingxService: BingXService,
    private readonly bitmexService: BitMEXService,
  ) {}

  /**
   * GET /api/funding/getData
   * Получает данные со всех бирж в новом формате включая OKX и Kraken
   */
  @Get('getData')
  getData(): Observable<GetDataResponse> {
    return this.exchangeAggregatorService.getAllNormalizedData().pipe(
      map(data => {
        console.log('🔍 getData: полученные данные от агрегатора:', Object.keys(data));
        console.log('🔍 getData: OKX тикеров:', Object.keys(data.okx || {}).length);
        console.log('🔍 getData: Kraken тикеров:', Object.keys(data.kraken || {}).length);
        
        const result: GetDataResponse = {
          binance: {},
          bybit: {},
          bitget: {},
          bingx: {},
          mexc: {},
          bitmex: {},
          okx: {},
          // kraken: {}
        };

        // Трансформируем данные в нужный формат
        Object.entries(data).forEach(([exchangeName, exchangeData]) => {
          console.log(`🔍 getData: обрабатываем ${exchangeName}, тикеров: ${Object.keys(exchangeData).length}`);
          
          const exchange: Exchange = {};
          
          Object.entries(exchangeData).forEach(([ticker, tickerData]: [string, NormalizedTicker]) => {
            exchange[ticker] = {
              price: tickerData.price,
              fundingRate: tickerData.fundingRate,
              nextFundingTime: tickerData.nextFundingTime,
              exchange: exchangeName
            };
          });

          // Присваиваем данные соответствующей бирже
          if (exchangeName === 'binance') result.binance = exchange;
          else if (exchangeName === 'bybit') result.bybit = exchange;
          else if (exchangeName === 'bitget') result.bitget = exchange;
          else if (exchangeName === 'bingx') result.bingx = exchange;
          else if (exchangeName === 'mexc') result.mexc = exchange;
          else if (exchangeName === 'bitmex') result.bitmex = exchange;
          else if (exchangeName === 'okx') {
            console.log('✅ getData: Добавляем OKX данные:', Object.keys(exchange).length, 'тикеров');
            result.okx = exchange;
          }
          else if (exchangeName === 'kraken') {
            console.log('✅ getData: Добавляем Kraken данные:', Object.keys(exchange).length, 'тикеров');
            // result.kraken = exchange;
          }
        });

        console.log('🎯 getData: финальный результат:', {
          binance: Object.keys(result.binance).length,
          bybit: Object.keys(result.bybit).length,
          bitget: Object.keys(result.bitget).length,
          bingx: Object.keys(result.bingx).length,
          mexc: Object.keys(result.mexc).length,
          bitmex: Object.keys(result.bitmex).length,
          okx: Object.keys(result.okx).length,
          // kraken: Object.keys(result.kraken).length
        });

        return result;
      })
    );
  }

  /**
   * GET /api/funding/getDashboard
   * Получает данные в формате: { тикер: { биржа: данные } }
   */
  @Get('getDashboard')
  getDashboard(): Observable<{ [ticker: string]: { [exchange: string]: TickerData | null } }> {
    return this.exchangeAggregatorService.getAllNormalizedData().pipe(
      map(data => {
        console.log('🔍 getDashboard: начинаем трансформацию данных...');
        
        // Собираем все уникальные тикеры
        const allTickers = new Set<string>();
        const exchanges = ['binance', 'bybit', 'bitget', 'bingx', 'mexc', 'bitmex', 'okx'];
        
        exchanges.forEach(exchange => {
          const exchangeData = data[exchange as keyof typeof data];
          if (exchangeData) {
            Object.keys(exchangeData).forEach(ticker => allTickers.add(ticker));
          }
        });

        console.log(`🔍 getDashboard: найдено ${allTickers.size} уникальных тикеров`);

        // Создаем результат в новом формате
        const result: { [ticker: string]: { [exchange: string]: TickerData | null } } = {};

        allTickers.forEach(ticker => {
          result[ticker] = {};
          
          exchanges.forEach(exchange => {
            const exchangeData = data[exchange as keyof typeof data];
            
            if (exchangeData && exchangeData[ticker]) {
              const tickerData = exchangeData[ticker];
              result[ticker][exchange] = {
                price: tickerData.price,
                fundingRate: tickerData.fundingRate,
                nextFundingTime: tickerData.nextFundingTime,
                exchange: exchange
              };
            } else {
              result[ticker][exchange] = null;
            }
          });
        });

        console.log('🎯 getDashboard: результат готов, тикеров:', Object.keys(result).length);
        
        // Логируем статистику
        const stats: { [exchange: string]: number } = {};
        exchanges.forEach(exchange => {
          stats[exchange] = Object.values(result).filter(ticker => ticker[exchange] !== null).length;
        });
        console.log('📊 getDashboard: статистика по биржам:', stats);

        return result;
      })
    );
  }

  /**
   * GET /api/funding/all
   * Получает данные со всех бирж
   */
  @Get('all')
  getAllFundingData(): Observable<AggregatedNormalizedData> {
    return this.exchangeAggregatorService.getAllNormalizedData();
  }

  /**
   * GET /api/funding/okx-test
   * Тестирует только OKX API
   */
  @Get('okx-test')
  async testOKX(): Promise<any> {
    try {
      const data = await this.okxService.getFundingData();
      return {
        success: true,
        timestamp: new Date().toISOString(),
        tickersCount: Object.keys(data).length,
        sampleTickers: Object.keys(data).slice(0, 10),
        data: Object.fromEntries(Object.entries(data).slice(0, 5)) // Показать первые 5 для примера
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GET /api/funding/kraken-test
   * Тестирует только Kraken API
   */
  @Get('kraken-test')
  async testKraken(): Promise<any> {
    try {
      const data = await this.krakenService.getFundingData().toPromise();
      const safeData = data || {};
      return {
        success: true,
        timestamp: new Date().toISOString(),
        tickersCount: Object.keys(safeData).length,
        sampleTickers: Object.keys(safeData).slice(0, 10),
        data: Object.fromEntries(Object.entries(safeData).slice(0, 5)) // Показать первые 5 для примера
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GET /api/funding/bingx-test
   * Тестирует только BingX API с детальным логированием
   */
  @Get('bingx-test')
  async testBingX(): Promise<any> {
    try {
      console.log('🧪 Тестируем BingX API...');
      const data = await this.bingxService.getFundingData();
      const tickers = Object.keys(data);
      
      // Анализируем funding rates
      const nonZeroFunding = tickers.filter(ticker => data[ticker].fundingRate !== 0);
      const fundingStats = {
        total: tickers.length,
        withNonZeroFunding: nonZeroFunding.length,
        withZeroFunding: tickers.length - nonZeroFunding.length,
        percentage: tickers.length > 0 ? ((nonZeroFunding.length / tickers.length) * 100).toFixed(2) + '%' : '0%'
      };
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        statistics: fundingStats,
        sampleTickers: tickers.slice(0, 10),
        nonZeroFundingExamples: nonZeroFunding.slice(0, 5).map(ticker => ({
          ticker,
          price: data[ticker].price,
          fundingRate: data[ticker].fundingRate, // ЧИСЛО без процента
          fundingRatePercent: (data[ticker].fundingRate * 100).toFixed(4) + '%', // Для читаемости
          nextFundingTime: data[ticker].nextFundingTime, // ЧИСЛО в миллисекундах
          nextFundingTimeISO: new Date(data[ticker].nextFundingTime).toISOString() // Для читаемости
        })),
        zeroFundingExamples: tickers.filter(ticker => data[ticker].fundingRate === 0).slice(0, 5).map(ticker => ({
          ticker,
          price: data[ticker].price,
          fundingRate: '0.0000%'
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GET /api/funding/bingx-single-test?symbol=BTC-USDT
   * Тестирует один запрос к BingX funding rate API
   */
  @Get('bingx-single-test')
  async testBingXSingle(@Query('symbol') symbol: string = 'BTC-USDT'): Promise<any> {
    try {
      console.log(`🧪 Тестируем BingX единичный запрос для ${symbol}...`);
      
      const baseUrl = 'https://open-api.bingx.com';
      
      // Тестируем разные endpoints
      const endpoints = [
        {
          name: 'premiumIndex',
          url: `${baseUrl}/openApi/swap/v2/quote/premiumIndex?symbol=${symbol}`,
          description: 'Премиум индекс (должен содержать funding rate)'
        },
        {
          name: 'ticker',
          url: `${baseUrl}/openApi/swap/v2/quote/ticker`,
          description: 'Обычные тикеры (может не содержать funding rate)'
        },
        {
          name: 'fundingRate',
          url: `${baseUrl}/openApi/swap/v2/quote/fundingRate?symbol=${symbol}`,
          description: 'Исторические funding rates'
        }
      ];
      
      const results: any = {};
      
      for (const endpoint of endpoints) {
        try {
          console.log(`🔍 Тестируем ${endpoint.name}: ${endpoint.url}`);
          
          const response = await axios.get(endpoint.url, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          results[endpoint.name] = {
            success: true,
            status: response.status,
            description: endpoint.description,
            code: response.data.code,
            msg: response.data.msg,
            dataStructure: response.data.data ? Object.keys(response.data.data) : 'null',
            sampleData: response.data.data,
            url: endpoint.url
          };
          
          console.log(`✅ ${endpoint.name}: успешно, код ${response.data.code}`);
          
        } catch (error) {
          results[endpoint.name] = {
            success: false,
            error: error.message,
            status: error.response?.status,
            description: endpoint.description,
            url: endpoint.url
          };
          
          console.log(`❌ ${endpoint.name}: ошибка ${error.message}`);
        }
      }
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        testedSymbol: symbol,
        endpoints: results,
        summary: {
          premiumIndexWorks: results.premiumIndex?.success || false,
          tickerWorks: results.ticker?.success || false,
          fundingRateWorks: results.fundingRate?.success || false
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GET /api/funding/bitmex-debug
   * Дебаг для анализа структуры данных BitMEX
   */
  @Get('bitmex-debug')
  async testBitMEXDebug(): Promise<any> {
    try {
      console.log('🧪 Дебаг BitMEX API...');
      
      const baseUrl = 'https://www.bitmex.com/api/v1';
      const instrumentsUrl = `${baseUrl}/instrument/active`;
      
      const response = await axios.get(instrumentsUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.data || !Array.isArray(response.data)) {
        return { error: 'Неправильный формат ответа' };
      }
      
      const instruments = response.data;
      
      // Анализируем структуру
      const analysis = {
        total: instruments.length,
        perpetualContracts: instruments.filter(i => i.typ === 'FFWCSX').length,
        usdContracts: instruments.filter(i => i.symbol && i.symbol.includes('USD')).length,
        usdtContracts: instruments.filter(i => i.symbol && i.symbol.includes('USDT')).length,
        openContracts: instruments.filter(i => i.state === 'Open').length,
        sampleSymbols: instruments.slice(0, 20).map(i => ({
          symbol: i.symbol,
          typ: i.typ,
          state: i.state,
          lastPrice: i.lastPrice,
          settle: i.settle
        })),
        uniqueTypes: [...new Set(instruments.map(i => i.typ))],
        uniqueStates: [...new Set(instruments.map(i => i.state))]
      };
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        analysis,
        recommendation: analysis.usdtContracts === 0 
          ? 'BitMEX не имеет USDT контрактов. Рекомендуется включить USD контракты.'
          : `Найдено ${analysis.usdtContracts} USDT контрактов`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GET /api/funding/bitmex-test
   * Тестирует только BitMEX API с детальным логированием
   */
  @Get('bitmex-test')
  async testBitMEX(): Promise<any> {
    try {
      console.log('🧪 Тестируем BitMEX API...');
      console.log('📞 Вызываем bitmexService.getFundingData()...');
      
      const data = await this.bitmexService.getFundingData();
      const tickers = Object.keys(data);
      
      console.log(`✅ BitMEX тест: получили ${tickers.length} тикеров`);
      
      // Анализируем funding rates
      const nonZeroFunding = tickers.filter(ticker => data[ticker].fundingRate !== 0);
      const fundingStats = {
        total: tickers.length,
        withNonZeroFunding: nonZeroFunding.length,
        withZeroFunding: tickers.length - nonZeroFunding.length,
        percentage: tickers.length > 0 ? ((nonZeroFunding.length / tickers.length) * 100).toFixed(2) + '%' : '0%'
      };
      
      console.log('📊 BitMEX статистика:', fundingStats);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        statistics: fundingStats,
        sampleTickers: tickers.slice(0, 10),
        nonZeroFundingExamples: nonZeroFunding.slice(0, 5).map(ticker => ({
          ticker,
          price: data[ticker].price,
          fundingRate: data[ticker].fundingRate,
          fundingRatePercent: (data[ticker].fundingRate * 100).toFixed(4) + '%',
          nextFundingTime: data[ticker].nextFundingTime,
          nextFundingTimeISO: new Date(data[ticker].nextFundingTime).toISOString()
        })),
        allTickers: tickers // Показываем все тикеры для анализа
      };
    } catch (error) {
      console.error('❌ BitMEX тест ошибка:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GET /api/funding/bitmex-bitcoin-debug
   * Специальный дебаг для поиска Bitcoin на BitMEX
   */
  @Get('bitmex-bitcoin-debug')
  async testBitMEXBitcoin(): Promise<any> {
    try {
      console.log('🧪 Дебаг Bitcoin на BitMEX...');
      
      const baseUrl = 'https://www.bitmex.com/api/v1';
      const instrumentsUrl = `${baseUrl}/instrument/active`;
      
      const response = await axios.get(instrumentsUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.data || !Array.isArray(response.data)) {
        return { error: 'Неправильный формат ответа' };
      }
      
      const instruments = response.data;
      
      // Ищем все инструменты связанные с Bitcoin
      const bitcoinInstruments = instruments.filter(i => 
        i.symbol && (
          i.symbol.includes('XBT') || 
          i.symbol.includes('BTC') ||
          i.symbol.toLowerCase().includes('bitcoin')
        )
      );
      
      console.log('🔍 Найдено Bitcoin инструментов:', bitcoinInstruments.length);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        totalInstruments: instruments.length,
        bitcoinInstruments: bitcoinInstruments.map(i => ({
          symbol: i.symbol,
          typ: i.typ,
          state: i.state,
          settlCurrency: i.settlCurrency,
          lastPrice: i.lastPrice,
          markPrice: i.markPrice,
          fundingRate: i.fundingRate,
          listing: i.listing,
          settle: i.settle
        })),
        analysis: {
          xbtInstruments: instruments.filter(i => i.symbol?.includes('XBT')).length,
          btcInstruments: instruments.filter(i => i.symbol?.includes('BTC')).length,
          openInstruments: instruments.filter(i => i.state === 'Open').length,
          perpetualContracts: instruments.filter(i => i.typ === 'FFWCSX').length,
          usdtContracts: instruments.filter(i => i.settlCurrency === 'USDt').length,
          xbtContracts: instruments.filter(i => i.settlCurrency === 'XBt').length
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GET /api/funding/arbitrage?minDelta=0.001
   * Получает арбитражные возможности
   */
  @Get('arbitrage')
  getArbitrageOpportunities(@Query('minDelta') minDelta?: string): Observable<any[]> {
    const minDeltaValue = minDelta ? parseFloat(minDelta) : 0.001;
    return this.exchangeAggregatorService.getArbitrageOpportunities(minDeltaValue);
  }

  /**
   * GET /api/funding/health
   * Проверяет здоровье всех API бирж
   */
  @Get('health')
  checkApisHealth(): Observable<{[exchange: string]: boolean}> {
    return this.exchangeAggregatorService.getAllNormalizedData().pipe(
      map(data => ({
        binance: Object.keys(data.binance).length > 0,
        bybit: Object.keys(data.bybit).length > 0,
        bitget: Object.keys(data.bitget).length > 0,
        mexc: Object.keys(data.mexc).length > 0,
        bingx: Object.keys(data.bingx).length > 0,
        bitmex: Object.keys(data.bitmex).length > 0,
        okx: Object.keys(data.okx).length > 0,
        kraken: Object.keys(data.kraken).length > 0,
      }))
    );
  }

  /**
   * GET /api/funding/stats
   * Получает статистику по биржам
   */
  @Get('stats')
  getStats(): Observable<any> {
    return this.exchangeAggregatorService.getAllNormalizedData().pipe(
      map(data => ({
        timestamp: new Date().toISOString(),
        exchanges: {
          binance: {
            name: 'Binance',
            tickersCount: Object.keys(data.binance).length,
            status: 'active'
          },
          bybit: {
            name: 'Bybit', 
            tickersCount: Object.keys(data.bybit).length,
            status: 'active'
          },
          bitget: {
            name: 'BitGet',
            tickersCount: Object.keys(data.bitget).length,
            status: 'active'
          },
          mexc: {
            name: 'MEXC',
            tickersCount: Object.keys(data.mexc).length,
            status: 'active'
          },
          bingx: {
            name: 'BingX',
            tickersCount: Object.keys(data.bingx).length,
            status: 'active'
          },
          bitmex: {
            name: 'BitMEX',
            tickersCount: Object.keys(data.bitmex).length,
            status: 'active'
          },
          okx: {
            name: 'OKX',
            tickersCount: Object.keys(data.okx).length,
            status: 'active'
          },
          kraken: {
            name: 'Kraken',
            tickersCount: Object.keys(data.kraken).length,
            status: 'active'
          }
        },
        totalUniqueTokens: new Set([
          ...Object.keys(data.binance),
          ...Object.keys(data.bybit),
          ...Object.keys(data.bitget),
          ...Object.keys(data.mexc),
          ...Object.keys(data.bingx),
          ...Object.keys(data.bitmex),
          ...Object.keys(data.okx),
          ...Object.keys(data.kraken)
        ]).size
      }))
    );
  }
}

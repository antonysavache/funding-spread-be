import { Controller, Get, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExchangeAggregatorService } from '../services/exchange-aggregator.service';
import { AggregatedNormalizedData } from '../services/exchange-aggregator.service';
import { GetDataResponse, Exchange, TickerData } from '../interfaces/get-data-response.interface';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';
import { OKXService } from '../services/okx.service';

@Controller('api/funding')
export class FundingController {

  constructor(
    private readonly exchangeAggregatorService: ExchangeAggregatorService,
    private readonly okxService: OKXService,
  ) {}

  /**
   * GET /api/funding/getData
   * Получает данные со всех бирж в новом формате включая OKX
   */
  @Get('getData')
  getData(): Observable<GetDataResponse> {
    return this.exchangeAggregatorService.getAllNormalizedData().pipe(
      map(data => {
        console.log('🔍 getData: полученные данные от агрегатора:', Object.keys(data));
        console.log('🔍 getData: OKX тикеров:', Object.keys(data.okx || {}).length);
        
        const result: GetDataResponse = {
          binance: {},
          bybit: {},
          bitget: {},
          bingx: {},
          mexc: {},
          bitmex: {},
          okx: {}
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
        });

        console.log('🎯 getData: финальный результат:', {
          binance: Object.keys(result.binance).length,
          bybit: Object.keys(result.bybit).length,
          bitget: Object.keys(result.bitget).length,
          bingx: Object.keys(result.bingx).length,
          mexc: Object.keys(result.mexc).length,
          bitmex: Object.keys(result.bitmex).length,
          okx: Object.keys(result.okx).length
        });

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
          }
        },
        totalUniqueTokens: new Set([
          ...Object.keys(data.binance),
          ...Object.keys(data.bybit),
          ...Object.keys(data.bitget),
          ...Object.keys(data.mexc),
          ...Object.keys(data.bingx),
          ...Object.keys(data.bitmex),
          ...Object.keys(data.okx)
        ]).size
      }))
    );
  }
}

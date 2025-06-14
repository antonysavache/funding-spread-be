import { Controller, Get, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExchangeAggregatorService } from '../services/exchange-aggregator.service';
import { AggregatedNormalizedData } from '../services/exchange-aggregator.service';
import { GetDataResponse, Exchange, TickerData } from '../interfaces/get-data-response.interface';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Controller('api/funding')
export class FundingController {

  constructor(
    private readonly exchangeAggregatorService: ExchangeAggregatorService,
  ) {}

  /**
   * GET /api/funding/getData
   * Получает данные со всех бирж в новом формате
   */
  @Get('getData')
  getData(): Observable<GetDataResponse> {
    return this.exchangeAggregatorService.getAllNormalizedData().pipe(
      map(data => {
        const result: GetDataResponse = {
          binance: {},
          bybit: {},
          bitget: {},
          bingx: {},
          mexc: {}
        };

        // Трансформируем данные в нужный формат
        Object.entries(data).forEach(([exchangeName, exchangeData]) => {
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
   * GET /api/funding/summaries
   * Получает сводную таблицу по всем тикерам
   */
  @Get('summaries')
  getTickerSummaries(): Observable<any[]> {
    return this.exchangeAggregatorService.getAllNormalizedData().pipe(
      map(data => {
        // Создаем сводку тикеров
        const allTickers = new Set<string>();
        Object.values(data).forEach(exchangeData => {
          Object.keys(exchangeData).forEach(ticker => allTickers.add(ticker));
        });

        const summaries = Array.from(allTickers).map(ticker => {
          const summary: any = {
            ticker,
            exchanges: {}
          };

          Object.entries(data).forEach(([exchange, exchangeData]) => {
            if (exchangeData[ticker]) {
              summary.exchanges[exchange] = {
                price: exchangeData[ticker].price,
                fundingRate: exchangeData[ticker].fundingRate,
                nextFundingTime: exchangeData[ticker].nextFundingTime
              };
            }
          });

          return summary;
        });

        return summaries.sort((a, b) => a.ticker.localeCompare(b.ticker));
      })
    );
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
   * GET /api/funding/different-payout-times
   * Получает тикеры с разным временем выплат
   */
  @Get('different-payout-times')
  getDifferentPayoutTimes(): Observable<any[]> {
    return this.exchangeAggregatorService.getDifferentPayoutTimes();
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
          }
        },
        totalUniqueTokens: new Set([
          ...Object.keys(data.binance),
          ...Object.keys(data.bybit),
          ...Object.keys(data.bitget),
          ...Object.keys(data.mexc),
          ...Object.keys(data.bingx)
        ]).size
      }))
    );
  }
}

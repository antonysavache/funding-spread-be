import { Controller, Get, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExchangeAggregatorService } from '../services/exchange-aggregator.service';
import { AggregatedData, TickerSummary } from '../adapters/normalized-ticker.interface';

@Controller('api/funding')
export class FundingController {

  constructor(
    private readonly exchangeAggregatorService: ExchangeAggregatorService,
  ) {}

  /**
   * GET /api/funding/all
   * Получает данные со всех бирж
   */
  @Get('all')
  getAllFundingData(): Observable<AggregatedData> {
    return this.exchangeAggregatorService.getAllNormalizedData();
  }

  /**
   * GET /api/funding/summaries
   * Получает сводную таблицу по всем тикерам
   */
  @Get('summaries')
  getTickerSummaries(): Observable<TickerSummary[]> {
    return this.exchangeAggregatorService.getTickerSummaries();
  }

  /**
   * GET /api/funding/arbitrage?minDelta=0.001
   * Получает арбитражные возможности
   */
  @Get('arbitrage')
  getArbitrageOpportunities(@Query('minDelta') minDelta?: string): Observable<TickerSummary[]> {
    const minDeltaValue = minDelta ? parseFloat(minDelta) : 0;
    return this.exchangeAggregatorService.getArbitrageOpportunities(minDeltaValue);
  }

  /**
   * GET /api/funding/different-payout-times?fundingAbsFilter=0.2
   * Получает тикеры с разным временем выплат
   */
  @Get('different-payout-times')
  getDifferentPayoutTimes(@Query('fundingAbsFilter') fundingAbsFilter?: string): Observable<TickerSummary[]> {
    const fundingAbsValue = fundingAbsFilter ? parseFloat(fundingAbsFilter) : 0;
    return this.exchangeAggregatorService.getDifferentPayoutTimes(fundingAbsValue);
  }

  /**
   * GET /api/funding/health
   * Проверяет здоровье всех API бирж
   */
  @Get('health')
  checkApisHealth(): Observable<{[exchange: string]: boolean}> {
    return this.exchangeAggregatorService.checkAllApisHealth();
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
          ...Object.keys(data.okx)
        ]).size
      }))
    );
  }
}

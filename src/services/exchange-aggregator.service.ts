import { Injectable } from '@nestjs/common';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { BinanceService } from './binance.service';
import { BybitService } from './bybit.service';
import { BitgetService } from './bitget.service';
import { MexcService } from './mexc.service';
import { OkxService } from './okx.service';
import { AggregatedData, NormalizedTicker, TickerSummary } from '../adapters/normalized-ticker.interface';

@Injectable()
export class ExchangeAggregatorService {

  constructor(
    private readonly binanceService: BinanceService,
    private readonly bybitService: BybitService,
    private readonly bitgetService: BitgetService,
    private readonly mexcService: MexcService,
    private readonly okxService: OkxService,
  ) {}

  /**
   * Получает нормализованные данные со всех бирж
   */
  getAllNormalizedData(): Observable<AggregatedData> {
    return forkJoin({
      binance: this.binanceService.getFundingData().pipe(
        catchError(error => {
          console.error('Binance error:', error);
          return of({});
        })
      ),
      bybit: this.bybitService.getFundingData().pipe(
        catchError(error => {
          console.error('Bybit error:', error);
          return of({});
        })
      ),
      bitget: this.bitgetService.getFundingData().pipe(
        catchError(error => {
          console.error('BitGet error:', error);
          return of({});
        })
      ),
      mexc: this.mexcService.getFundingData().pipe(
        catchError(error => {
          console.error('MEXC error:', error);
          return of({});
        })
      ),
      okx: this.okxService.getFundingData().pipe(
        catchError(error => {
          console.error('OKX error:', error);
          return of({});
        })
      )
    }).pipe(
      map(results => {
        console.log('=== РЕЗУЛЬТАТЫ АДАПТЕРОВ ===');
        console.log('Binance тикеров:', Object.keys(results.binance).length);
        console.log('Bybit тикеров:', Object.keys(results.bybit).length);
        console.log('BitGet тикеров:', Object.keys(results.bitget).length);
        console.log('MEXC тикеров:', Object.keys(results.mexc).length);
        console.log('OKX тикеров:', Object.keys(results.okx).length);
        console.log('=============================');

        return results;
      })
    );
  }

  /**
   * Создает сводную таблицу по тикерам
   */
  getTickerSummaries(): Observable<TickerSummary[]> {
    return this.getAllNormalizedData().pipe(
      map(data => this.createTickerSummaries(data))
    );
  }

  /**
   * Получает тикеры с арбитражными возможностями
   */
  getArbitrageOpportunities(minDelta: number = 0): Observable<TickerSummary[]> {
    return this.getTickerSummaries().pipe(
      map(summaries => {
        const minDeltaThreshold = minDelta / 100; // Конвертируем проценты в доли
        
        return summaries
          .filter(summary => {
            const diff = summary.fundingRateDiff;
            return diff !== null && diff > 0 && diff >= minDeltaThreshold;
          })
          .sort((a, b) => (b.fundingRateDiff || 0) - (a.fundingRateDiff || 0));
      })
    );
  }

  /**
   * Получает тикеры с разным временем выплат
   */
  getDifferentPayoutTimes(fundingAbsFilter: number = 0): Observable<TickerSummary[]> {
    return this.getTickerSummaries().pipe(
      map(summaries => {
        const fundingThreshold = fundingAbsFilter / 100;
        
        return summaries.filter(summary => {
          const times = Object.values(summary.exchanges)
            .filter(exchange => exchange !== null)
            .map(exchange => exchange!.nextFundingTime);

          if (times.length < 2) return false;

          const uniqueTimes = new Set(times.map(time => Math.floor(time / (60 * 60 * 1000))));
          const hasDifferentTimes = uniqueTimes.size > 1;

          if (fundingThreshold === 0) return hasDifferentTimes;

          const hasSufficientFunding = Object.values(summary.exchanges)
            .filter(exchange => exchange !== null)
            .some(exchange => Math.abs(exchange!.fundingRate) >= fundingThreshold);

          return hasDifferentTimes && hasSufficientFunding;
        });
      })
    );
  }

  /**
   * Создает сводную таблицу по тикерам
   */
  private createTickerSummaries(data: AggregatedData): TickerSummary[] {
    // Собираем все уникальные тикеры
    const allTickers = new Set<string>();

    Object.keys(data.binance).forEach(ticker => allTickers.add(ticker));
    Object.keys(data.bybit).forEach(ticker => allTickers.add(ticker));
    Object.keys(data.bitget).forEach(ticker => allTickers.add(ticker));
    Object.keys(data.mexc).forEach(ticker => allTickers.add(ticker));
    Object.keys(data.okx).forEach(ticker => allTickers.add(ticker));

    // Создаем сводку для каждого тикера
    const summaries: TickerSummary[] = [];

    allTickers.forEach(ticker => {
      const exchanges = {
        binance: data.binance[ticker] ? {
          price: data.binance[ticker].price,
          fundingRate: data.binance[ticker].fundingRate,
          nextFundingTime: data.binance[ticker].nextFundingTime
        } : null,
        bybit: data.bybit[ticker] ? {
          price: data.bybit[ticker].price,
          fundingRate: data.bybit[ticker].fundingRate,
          nextFundingTime: data.bybit[ticker].nextFundingTime
        } : null,
        bitget: data.bitget[ticker] ? {
          price: data.bitget[ticker].price,
          fundingRate: data.bitget[ticker].fundingRate,
          nextFundingTime: data.bitget[ticker].nextFundingTime
        } : null,
        mexc: data.mexc[ticker] ? {
          price: data.mexc[ticker].price,
          fundingRate: data.mexc[ticker].fundingRate,
          nextFundingTime: data.mexc[ticker].nextFundingTime
        } : null,
        okx: data.okx[ticker] ? {
          price: data.okx[ticker].price,
          fundingRate: data.okx[ticker].fundingRate,
          nextFundingTime: data.okx[ticker].nextFundingTime
        } : null
      };

      const rates = Object.values(exchanges)
        .filter(exchange => exchange !== null)
        .map(exchange => exchange!.fundingRate);

      const minFundingRate = rates.length > 0 ? Math.min(...rates) : null;
      const maxFundingRate = rates.length > 0 ? Math.max(...rates) : null;
      const fundingRateDiff = (minFundingRate !== null && maxFundingRate !== null) ? maxFundingRate - minFundingRate : null;

      summaries.push({
        ticker,
        exchanges,
        minFundingRate,
        maxFundingRate,
        fundingRateDiff
      });
    });

    // Сортируем по названию тикера
    return summaries.sort((a, b) => a.ticker.localeCompare(b.ticker));
  }

  /**
   * Проверяет здоровье всех API
   */
  checkAllApisHealth(): Observable<{[exchange: string]: boolean}> {
    return forkJoin({
      binance: this.binanceService.checkApiHealth(),
      bybit: this.bybitService.checkApiHealth(),
      bitget: this.bitgetService.checkApiHealth(),
      mexc: this.mexcService.checkApiHealth(),
      okx: this.okxService.checkApiHealth(),
    });
  }
}

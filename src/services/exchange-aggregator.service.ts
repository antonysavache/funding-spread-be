import { Injectable, Logger } from '@nestjs/common';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { BinanceService } from './binance.service';
import { BybitService } from './bybit.service';
import { BitGetService } from './bitget.service';
import { BingXService } from './bingx.service';
import { BitMEXService } from './bitmex.service';
import { OKXService } from './okx.service';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

export interface AggregatedNormalizedData {
  binance: { [ticker: string]: NormalizedTicker };
  bybit: { [ticker: string]: NormalizedTicker };
  bitget: { [ticker: string]: NormalizedTicker };
  bingx: { [ticker: string]: NormalizedTicker };
  bitmex: { [ticker: string]: NormalizedTicker };
  okx: { [ticker: string]: NormalizedTicker };
}

@Injectable()
export class ExchangeAggregatorService {
  private readonly logger = new Logger(ExchangeAggregatorService.name);

  constructor(
    private binanceService: BinanceService,
    private bybitService: BybitService,
    private bitgetService: BitGetService,
    private bingxService: BingXService,
    private bitmexService: BitMEXService,
    private okxService: OKXService,
  ) {}

  /**
   * Получает нормализованные данные со всех бирж
   */
  getAllNormalizedData(): Observable<AggregatedNormalizedData> {
    return forkJoin({
      binance: this.binanceService.getFundingData().pipe(
        catchError(error => {
          return of({});
        })
      ),
      bybit: this.bybitService.getFundingData().pipe(
        catchError(error => {
          return of({});
        })
      ),
      bitget: this.convertToObservable(this.bitgetService.getFundingData()).pipe(
        catchError(error => {
          return of({});
        })
      ),
      bingx: this.convertToObservable(this.bingxService.getFundingData()).pipe(
        catchError(error => {
          return of({});
        })
      ),
      bitmex: this.convertToObservable(this.bitmexService.getFundingData()).pipe(
        catchError(error => {
          return of({});
        })
      ),
      okx: this.convertToObservable(this.okxService.getFundingData()).pipe(
        catchError(error => {
          return of({});
        })
      )
    }).pipe(
      map(results => {
        this.logger.log('=== РЕЗУЛЬТАТЫ АДАПТЕРОВ ===');
        this.logger.log(`Binance тикеров: ${Object.keys(results.binance).length}`);
        this.logger.log(`Bybit тикеров: ${Object.keys(results.bybit).length}`);
        this.logger.log(`BitGet тикеров: ${Object.keys(results.bitget).length}`);
        this.logger.log(`BingX тикеров: ${Object.keys(results.bingx).length}`);
        this.logger.log(`BitMEX тикеров: ${Object.keys(results.bitmex).length}`);
        this.logger.log(`OKX тикеров: ${Object.keys(results.okx).length}`);
        this.logger.log('=============================');

        return results;
      })
    );
  }

  /**
   * Получает арбитражные возможности
   */
  getArbitrageOpportunities(minDelta: number = 0.001): Observable<any[]> {
    return this.getAllNormalizedData().pipe(
      map(data => {
        const opportunities: any[] = [];
        
        // Собираем все уникальные тикеры
        const allTickers = new Set<string>();
        Object.values(data).forEach(exchangeData => {
          Object.keys(exchangeData).forEach(ticker => allTickers.add(ticker));
        });

        // Анализируем каждый тикер на арбитражные возможности
        allTickers.forEach(ticker => {
          const rates: { exchange: string; rate: number }[] = [];
          
          Object.entries(data).forEach(([exchange, exchangeData]) => {
            if (exchangeData[ticker]) {
              rates.push({
                exchange,
                rate: exchangeData[ticker].fundingRate
              });
            }
          });

          if (rates.length >= 2) {
            const minRate = Math.min(...rates.map(r => r.rate));
            const maxRate = Math.max(...rates.map(r => r.rate));
            const delta = maxRate - minRate;

            if (delta >= minDelta) {
              opportunities.push({
                ticker,
                delta,
                longExchange: rates.find(r => r.rate === minRate)!.exchange,
                shortExchange: rates.find(r => r.rate === maxRate)!.exchange,
                longRate: minRate,
                shortRate: maxRate,
                exchanges: rates.length
              });
            }
          }
        });

        // Сортируем по убыванию дельты
        return opportunities.sort((a, b) => b.delta - a.delta);
      })
    );
  }

  /**
   * Получает тикеры с разным временем выплат
   */
  getDifferentPayoutTimes(): Observable<any[]> {
    return this.getAllNormalizedData().pipe(
      map(data => {
        const result: any[] = [];

        // Собираем все уникальные тикеры
        const allTickers = new Set<string>();
        Object.values(data).forEach(exchangeData => {
          Object.keys(exchangeData).forEach(ticker => allTickers.add(ticker));
        });

        allTickers.forEach(ticker => {
          const times: { exchange: string; time: number }[] = [];
          
          Object.entries(data).forEach(([exchange, exchangeData]) => {
            if (exchangeData[ticker]) {
              times.push({
                exchange,
                time: exchangeData[ticker].nextFundingTime
              });
            }
          });

          if (times.length >= 2) {
            // Проверяем есть ли отличия во времени больше чем на 1 час
            const uniqueTimes = new Set(times.map(t => Math.floor(t.time / (60 * 60 * 1000))));
            if (uniqueTimes.size > 1) {
              result.push({
                ticker,
                exchanges: times.map(t => ({
                  exchange: t.exchange,
                  nextFundingTime: t.time
                }))
              });
            }
          }
        });

        return result;
      })
    );
  }

  /**
   * Конвертирует Promise в Observable для совместимости
   */
  private convertToObservable<T>(promise: Promise<T>): Observable<T> {
    return new Observable(subscriber => {
      promise
        .then(value => {
          subscriber.next(value);
          subscriber.complete();
        })
        .catch(error => {
          subscriber.error(error);
        });
    });
  }
}

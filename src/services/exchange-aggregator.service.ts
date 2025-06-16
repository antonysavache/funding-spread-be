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
    console.log('🚀 ExchangeAggregator: Начинаем сбор данных со всех бирж...');
    
    return forkJoin({
      binance: this.binanceService.getFundingData().pipe(
        catchError(error => {
          console.error('❌ ExchangeAggregator: Binance ошибка:', error.message);
          return of({});
        })
      ),
      bybit: this.bybitService.getFundingData().pipe(
        catchError(error => {
          console.error('❌ ExchangeAggregator: Bybit ошибка:', error.message);
          return of({});
        })
      ),
      bitget: this.convertToObservable(this.bitgetService.getFundingData()).pipe(
        catchError(error => {
          console.error('❌ ExchangeAggregator: BitGet ошибка:', error.message);
          return of({});
        })
      ),
      bingx: this.convertToObservable(this.bingxService.getFundingData()).pipe(
        catchError(error => {
          console.error('❌ ExchangeAggregator: BingX ошибка:', error.message);
          return of({});
        })
      ),
      bitmex: this.convertToObservable(this.bitmexService.getFundingData()).pipe(
        catchError(error => {
          console.error('❌ ExchangeAggregator: BitMEX ошибка:', error.message);
          return of({});
        })
      ),
      okx: this.convertToObservable(this.okxService.getFundingData()).pipe(
        catchError(error => {
          console.error('❌ ExchangeAggregator: OKX ошибка:', error.message);
          return of({});
        })
      )
    }).pipe(
      map(results => {
        console.log('📊 ДЕТАЛЬНАЯ СТАТИСТИКА ПО БИРЖАМ:');
        console.log(`🔵 Binance: ${Object.keys(results.binance).length} тикеров`, Object.keys(results.binance).slice(0, 3));
        console.log(`🟡 Bybit: ${Object.keys(results.bybit).length} тикеров`, Object.keys(results.bybit).slice(0, 3));
        console.log(`🟢 BitGet: ${Object.keys(results.bitget).length} тикеров`, Object.keys(results.bitget).slice(0, 3));
        console.log(`🟠 BingX: ${Object.keys(results.bingx).length} тикеров`, Object.keys(results.bingx).slice(0, 3));
        console.log(`🔴 BitMEX: ${Object.keys(results.bitmex).length} тикеров`, Object.keys(results.bitmex).slice(0, 3));
        console.log(`🟣 OKX: ${Object.keys(results.okx).length} тикеров`, Object.keys(results.okx).slice(0, 3));
        console.log('===========================================');

        // Логируем примеры данных от каждой биржи
        if (Object.keys(results.binance).length > 0) {
          const sampleTicker = Object.keys(results.binance)[0];
          console.log(`💎 Binance sample (${sampleTicker}):`, results.binance[sampleTicker]);
        } else {
          console.log('⚠️ Binance: НЕТ ДАННЫХ - проверяем почему...');
        }

        if (Object.keys(results.bybit).length > 0) {
          const sampleTicker = Object.keys(results.bybit)[0];
          console.log(`💎 Bybit sample (${sampleTicker}):`, results.bybit[sampleTicker]);
        } else {
          console.log('⚠️ Bybit: НЕТ ДАННЫХ - проверяем почему...');
        }

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

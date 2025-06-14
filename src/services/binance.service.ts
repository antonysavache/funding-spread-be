import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, forkJoin, of, from } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import axios from 'axios';
import { BinanceAdapter } from '../adapters/binance.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class BinanceService {
  private readonly baseUrl = 'https://fapi.binance.com';
  private readonly exchangeInfoEndpoint = '/fapi/v1/exchangeInfo';
  private readonly premiumIndexEndpoint = '/fapi/v1/premiumIndex';

  /**
   * Получает данные о funding rates с Binance
   */
  getFundingData(): Observable<{ [ticker: string]: NormalizedTicker }> {

    // Получаем данные параллельно
    const exchangeInfo$ = this.getExchangeInfo();
    const premiumIndex$ = this.getPremiumIndex();

    return forkJoin({
      exchangeInfo: exchangeInfo$,
      premiumIndex: premiumIndex$
    }).pipe(
      map(({ exchangeInfo, premiumIndex }) => {

        // Нормализуем данные
        const normalized = BinanceAdapter.normalize(exchangeInfo, premiumIndex);
        const tickers = Object.keys(normalized);
        

        // Логируем несколько примеров для отладки
        tickers.slice(0, 3).forEach(ticker => {
          const data = normalized[ticker];

        });

        return normalized;
      }),
      catchError(error => {
        console.error('❌ Binance: Ошибка при получении данных:', error);
        return of({});
      })
    );
  }

  /**
   * Получает информацию о всех символах
   */
  private getExchangeInfo(): Observable<any> {
    const url = `${this.baseUrl}${this.exchangeInfoEndpoint}`;

    return from(axios.get(url)).pipe(
      timeout(10000),
      map(response => response.data),
      catchError(error => {
        console.error('Binance: Ошибка получения exchange info:', error);
        return of({ symbols: [] });
      })
    );
  }

  /**
   * Получает premium index для всех символов
   */
  private getPremiumIndex(): Observable<any> {
    const url = `${this.baseUrl}${this.premiumIndexEndpoint}`;

    return from(axios.get(url)).pipe(
      timeout(10000),
      map(response => response.data),
      catchError(error => {
        console.error('Binance: Ошибка получения premium index:', error);
        return of([]);
      })
    );
  }

  /**
   * Проверяет доступность API Binance
   */
  checkApiHealth(): Observable<boolean> {

    const url = `${this.baseUrl}${this.exchangeInfoEndpoint}`;

    return from(axios.get(url)).pipe(
      timeout(5000),
      map(() => {
        return true;
      }),
      catchError(error => {
        console.error('❌ Binance: API недоступен:', error);
        return of(false);
      })
    );
  }
}

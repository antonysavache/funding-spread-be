import { Injectable } from '@nestjs/common';
import { Observable, of, from } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import axios from 'axios';
import { BybitAdapter, BybitTickerResponse } from '../adapters/bybit.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class BybitService {
  private readonly baseUrl = 'https://api.bybit.com';
  private readonly tickerEndpoint = '/v5/market/tickers';

  /**
   * Получает данные о funding rates с Bybit
   */
  getFundingData(): Observable<{ [ticker: string]: NormalizedTicker }> {

    // Получаем только ticker данные, которые содержат funding rate
    return this.getTickerData().pipe(
      map(ticker => {

        // Фильтруем только USDT перпетуалы
        const filteredTickers = BybitAdapter.filterUsdtPerpetuals(ticker);
        

        // Нормализуем данные
        const normalized = BybitAdapter.normalize(filteredTickers);
        const tickers = Object.keys(normalized);
        

        return normalized;
      }),
      catchError(error => {
        console.error('❌ Bybit: Ошибка при получении данных:', error);
        return of({});
      })
    );
  }

  /**
   * Получает ticker данные для всех символов
   */
  private getTickerData(): Observable<any[]> {
    const url = `${this.baseUrl}${this.tickerEndpoint}?category=linear`;

    return from(axios.get<BybitTickerResponse>(url)).pipe(
      timeout(10000),
      map(response => {
        if (BybitAdapter.isValidResponse(response.data)) {
          return response.data.result.list;
        } else {
          console.warn('Bybit: Некорректный ответ ticker API:', response.data);
          return [];
        }
      }),
      catchError(error => {
        console.error('Bybit: Ошибка получения ticker данных:', error);
        return of([]);
      })
    );
  }

  /**
   * Проверяет доступность API Bybit
   */
  checkApiHealth(): Observable<boolean> {

    const url = `${this.baseUrl}${this.tickerEndpoint}?category=linear&symbol=BTCUSDT`;

    return from(axios.get(url)).pipe(
      timeout(5000),
      map(() => {
        return true;
      }),
      catchError(error => {
        console.error('❌ Bybit: API недоступен:', error);
        return of(false);
      })
    );
  }
}

import { Injectable } from '@nestjs/common';
import { Observable, forkJoin, of, from } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import axios from 'axios';
import { BybitAdapter, BybitFundingResponse, BybitTickerResponse } from '../adapters/bybit.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class BybitService {
  private readonly baseUrl = 'https://api.bybit.com';
  private readonly fundingEndpoint = '/v5/market/funding/history';
  private readonly tickerEndpoint = '/v5/market/tickers';

  /**
   * Получает данные о funding rates с Bybit
   */
  getFundingData(): Observable<{ [ticker: string]: NormalizedTicker }> {
    console.log('🔄 Bybit: Начинаем загрузку funding данных...');

    // Получаем данные параллельно
    const funding$ = this.getFundingRates();
    const ticker$ = this.getTickerData();

    return forkJoin({
      funding: funding$,
      ticker: ticker$
    }).pipe(
      map(({ funding, ticker }) => {
        console.log(`✅ Bybit: Получено ${funding.length} funding rates и ${ticker.length} tickers`);

        // Фильтруем только USDT перпетуалы
        const filteredFunding = BybitAdapter.filterUsdtPerpetuals(funding);
        const filteredTickers = BybitAdapter.filterUsdtPerpetuals(ticker);
        
        console.log(`🔍 Bybit: После фильтрации USDT перпетуалов: ${filteredFunding.length} funding, ${filteredTickers.length} tickers`);

        // Нормализуем данные
        const normalized = BybitAdapter.normalize(filteredFunding, filteredTickers);
        const tickers = Object.keys(normalized);
        
        console.log(`🎯 Bybit: Успешно обработано ${tickers.length} тикеров:`, tickers.slice(0, 10));
        
        return normalized;
      }),
      catchError(error => {
        console.error('❌ Bybit: Ошибка при получении данных:', error);
        return of({});
      })
    );
  }

  /**
   * Получает funding rates для всех символов
   */
  private getFundingRates(): Observable<any[]> {
    const url = `${this.baseUrl}${this.fundingEndpoint}?category=linear&limit=200`;

    return from(axios.get<BybitFundingResponse>(url)).pipe(
      timeout(10000),
      map(response => {
        if (BybitAdapter.isValidResponse(response.data)) {
          return response.data.result.list;
        } else {
          console.warn('Bybit: Некорректный ответ funding API:', response.data);
          return [];
        }
      }),
      catchError(error => {
        console.error('Bybit: Ошибка получения funding rates:', error);
        return of([]);
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
    console.log('🏥 Bybit: Проверяем здоровье API...');

    const url = `${this.baseUrl}${this.tickerEndpoint}?category=linear&symbol=BTCUSDT`;

    return from(axios.get(url)).pipe(
      timeout(5000),
      map(() => {
        console.log('✅ Bybit: API доступен');
        return true;
      }),
      catchError(error => {
        console.error('❌ Bybit: API недоступен:', error);
        return of(false);
      })
    );
  }
}

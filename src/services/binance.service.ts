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
    console.log('🔄 Binance: Начинаем загрузку funding данных...');

    // Получаем данные параллельно
    const exchangeInfo$ = this.getExchangeInfo();
    const premiumIndex$ = this.getPremiumIndex();

    return forkJoin({
      exchangeInfo: exchangeInfo$,
      premiumIndex: premiumIndex$
    }).pipe(
      map(({ exchangeInfo, premiumIndex }) => {
        console.log(`✅ Binance: Получено ${exchangeInfo.symbols.length} символов и ${premiumIndex.length} premium indices`);

        // Нормализуем данные
        const normalized = BinanceAdapter.normalize(exchangeInfo, premiumIndex);
        const tickers = Object.keys(normalized);
        
        console.log(`🎯 Binance: Успешно обработано ${tickers.length} тикеров:`, tickers.slice(0, 10));
        
        // Логируем несколько примеров для отладки
        tickers.slice(0, 3).forEach(ticker => {
          const data = normalized[ticker];
          console.log(`📊 Binance ${ticker}:`, {
            price: data.price,
            fundingRate: (data.fundingRate * 100).toFixed(4) + '%',
            nextFunding: new Date(data.nextFundingTime).toLocaleTimeString()
          });
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
    console.log('🏥 Binance: Проверяем здоровье API...');

    const url = `${this.baseUrl}${this.exchangeInfoEndpoint}`;

    return from(axios.get(url)).pipe(
      timeout(5000),
      map(() => {
        console.log('✅ Binance: API доступен');
        return true;
      }),
      catchError(error => {
        console.error('❌ Binance: API недоступен:', error);
        return of(false);
      })
    );
  }
}

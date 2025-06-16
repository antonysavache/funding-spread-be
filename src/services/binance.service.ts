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
    console.log('🔄 Binance: Начинаем загрузку данных...');

    // Получаем данные параллельно
    const exchangeInfo$ = this.getExchangeInfo();
    const premiumIndex$ = this.getPremiumIndex();

    return forkJoin({
      exchangeInfo: exchangeInfo$,
      premiumIndex: premiumIndex$
    }).pipe(
      map(({ exchangeInfo, premiumIndex }) => {
        console.log('📥 Binance: Получены данные:', {
          symbols: exchangeInfo?.symbols?.length || 0,
          premiumIndex: Array.isArray(premiumIndex) ? premiumIndex.length : 0
        });

        // Нормализуем данные
        const normalized = BinanceAdapter.normalize(exchangeInfo, premiumIndex);
        const tickers = Object.keys(normalized);
        
        console.log(`✅ Binance: Обработано ${tickers.length} тикеров`);

        // Логируем несколько примеров для отладки
        tickers.slice(0, 3).forEach(ticker => {
          const data = normalized[ticker];
          console.log(`📊 Binance ${ticker}: rate=${(data.fundingRate * 100).toFixed(4)}%, price=${data.price}`);
        });

        return normalized;
      }),
      catchError(error => {
        console.error('❌ Binance: Ошибка при получении данных:', error.message);
        return of({});
      })
    );
  }

  /**
   * Получает информацию о всех символах
   */
  private getExchangeInfo(): Observable<any> {
    const url = `${this.baseUrl}${this.exchangeInfoEndpoint}`;
    console.log('🌐 Binance: Запрашиваем exchange info:', url);

    return from(axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    })).pipe(
      timeout(15000),
      map(response => {
        console.log('📥 Binance: Exchange info получен, статус:', response.status);
        return response.data;
      }),
      catchError(error => {
        console.error('❌ Binance: Ошибка получения exchange info:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          code: error.code
        });
        return of({ symbols: [] });
      })
    );
  }

  /**
   * Получает premium index для всех символов
   */
  private getPremiumIndex(): Observable<any> {
    const url = `${this.baseUrl}${this.premiumIndexEndpoint}`;
    console.log('🌐 Binance: Запрашиваем premium index:', url);

    return from(axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    })).pipe(
      timeout(15000),
      map(response => {
        console.log('📥 Binance: Premium index получен, статус:', response.status);
        console.log('📊 Binance: Premium записей:', Array.isArray(response.data) ? response.data.length : 'не массив');
        return response.data;
      }),
      catchError(error => {
        console.error('❌ Binance: Ошибка получения premium index:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          code: error.code
        });
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

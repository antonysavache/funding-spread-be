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
    console.log('🔄 Bybit: Начинаем загрузку данных...');

    // Получаем только ticker данные, которые содержат funding rate
    return this.getTickerData().pipe(
      map(ticker => {
        console.log('📥 Bybit: Получены ticker данные, количество:', ticker.length);

        // Фильтруем только USDT перпетуалы
        const filteredTickers = BybitAdapter.filterUsdtPerpetuals(ticker);
        console.log('🔍 Bybit: После фильтрации USDT:', filteredTickers.length);

        // Нормализуем данные
        const normalized = BybitAdapter.normalize(filteredTickers);
        const tickers = Object.keys(normalized);
        console.log(`✅ Bybit: Обработано ${tickers.length} тикеров`);

        // Логируем несколько примеров
        tickers.slice(0, 3).forEach(ticker => {
          const data = normalized[ticker];
          console.log(`📊 Bybit ${ticker}: rate=${(data.fundingRate * 100).toFixed(4)}%, price=${data.price}`);
        });

        return normalized;
      }),
      catchError(error => {
        console.error('❌ Bybit: Ошибка при получении данных:', error.message);
        return of({});
      })
    );
  }

  /**
   * Получает ticker данные для всех символов
   */
  private getTickerData(): Observable<any[]> {
    const url = `${this.baseUrl}${this.tickerEndpoint}?category=linear`;
    console.log('🌐 Bybit: Запрашиваем ticker данные:', url);

    return from(axios.get<BybitTickerResponse>(url, {
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
        console.log('📥 Bybit: Получен ответ, статус:', response.status);
        console.log('📊 Bybit: Код ответа:', response.data.retCode, 'Сообщение:', response.data.retMsg);
        
        if (BybitAdapter.isValidResponse(response.data)) {
          console.log('✅ Bybit: Валидный ответ, тикеров:', response.data.result.list.length);
          return response.data.result.list;
        } else {
          console.warn('⚠️ Bybit: Некорректный ответ ticker API:', response.data);
          return [];
        }
      }),
      catchError(error => {
        console.error('❌ Bybit: Ошибка получения ticker данных:', {
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

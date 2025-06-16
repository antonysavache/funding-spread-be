import { Injectable, Logger } from '@nestjs/common';
import { Observable, from, of } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import axios from 'axios';
import { KrakenAdapter } from '../adapters/kraken.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class KrakenService {
  private readonly logger = new Logger(KrakenService.name);
  private readonly baseUrl = 'https://futures.kraken.com';
  private readonly tickersEndpoint = '/derivatives/api/v3/tickers';

  /**
   * Получает данные о funding rates с Kraken Futures
   */
  getFundingData(): Observable<{ [ticker: string]: NormalizedTicker }> {
    this.logger.log('🔄 Kraken: Запрос данных о funding rates...');

    const url = `${this.baseUrl}${this.tickersEndpoint}`;

    return from(axios.get(url)).pipe(
      timeout(15000), // Увеличенный таймаут для Kraken
      map(response => {
        const data = response.data;
        
        // Проверяем валидность ответа
        if (!KrakenAdapter.isValidResponse(data)) {
          this.logger.error('❌ Kraken: Некорректный ответ API', data);
          return {};
        }

        // Нормализуем данные
        const normalized = KrakenAdapter.normalize(data);
        const tickers = Object.keys(normalized);
        
        this.logger.log(`✅ Kraken: Получено ${tickers.length} perpetual контрактов`);

        // Логируем несколько примеров для отладки
        if (tickers.length > 0) {
          tickers.slice(0, 3).forEach(ticker => {
            const tickerData = normalized[ticker];
            this.logger.log(
              `📊 Kraken: ${ticker} | Цена: $${tickerData.price.toFixed(2)} | ` +
              `Funding: ${(tickerData.fundingRate * 100).toFixed(6)}% | ` +
              `Следующая выплата: ${new Date(tickerData.nextFundingTime).toISOString()}`
            );
          });
        }

        return normalized;
      }),
      catchError(error => {
        this.logger.error('❌ Kraken: Ошибка при получении данных:', error.message);
        
        // Логируем дополнительную информацию об ошибке
        if (error.response) {
          this.logger.error(`HTTP ${error.response.status}: ${error.response.statusText}`);
          if (error.response.data) {
            this.logger.error('Данные ошибки:', error.response.data);
          }
        }
        
        return of({});
      })
    );
  }

  /**
   * Получает информацию о доступных инструментах (для отладки)
   */
  getInstruments(): Observable<any> {
    const url = `${this.baseUrl}/derivatives/api/v3/instruments`;

    return from(axios.get(url)).pipe(
      timeout(10000),
      map(response => response.data),
      catchError(error => {
        this.logger.error('Kraken: Ошибка получения инструментов:', error);
        return of({ instruments: [] });
      })
    );
  }

  /**
   * Проверяет доступность API Kraken Futures
   */
  checkApiHealth(): Observable<boolean> {
    this.logger.log('🔍 Kraken: Проверка доступности API...');

    const url = `${this.baseUrl}${this.tickersEndpoint}`;

    return from(axios.get(url)).pipe(
      timeout(10000),
      map(response => {
        const isHealthy = response.status === 200 && 
                         response.data && 
                         KrakenAdapter.isValidResponse(response.data);
        
        if (isHealthy) {
          this.logger.log('✅ Kraken: API доступен');
        } else {
          this.logger.warn('⚠️ Kraken: API отвечает, но данные некорректны');
        }
        
        return isHealthy;
      }),
      catchError(error => {
        this.logger.error('❌ Kraken: API недоступен:', error.message);
        return of(false);
      })
    );
  }

  /**
   * Получает исторические данные funding rates для конкретного символа
   */
  getHistoricalFundingRates(symbol: string): Observable<any> {
    // Конвертируем символ обратно в формат Kraken
    const krakenSymbol = this.convertToKrakenSymbol(symbol);
    const url = `${this.baseUrl}/derivatives/api/v3/historicalfundingrates`;

    return from(axios.get(url, { 
      params: { symbol: krakenSymbol } 
    })).pipe(
      timeout(10000),
      map(response => response.data),
      catchError(error => {
        this.logger.error(`Kraken: Ошибка получения исторических данных для ${symbol}:`, error);
        return of({ rates: [] });
      })
    );
  }

  /**
   * Конвертирует стандартный символ в формат Kraken
   */
  private convertToKrakenSymbol(symbol: string): string {
    if (symbol.endsWith('USDT')) {
      const base = symbol.replace('USDT', '');
      // Конвертируем BTC в XBT для Kraken
      const krakenBase = base === 'BTC' ? 'XBT' : base;
      return `PF_${krakenBase}USD`;
    }
    return symbol;
  }
}

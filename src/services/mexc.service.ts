import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Observable, of } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { MexcAdapter, MexcFundingResponse } from '../adapters/mexc.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class MexcService {
  private readonly baseUrl = 'https://api.mexc.com';
  private readonly fundingEndpoint = '/api/v3/premiumIndex';

  constructor(private readonly httpService: HttpService) {}

  getFundingData(): Observable<{ [ticker: string]: NormalizedTicker }> {
    console.log('🔄 MEXC: Начинаем загрузку funding данных...');

    const url = `${this.baseUrl}${this.fundingEndpoint}`;

    return this.httpService.get<MexcFundingResponse[]>(url).pipe(
      timeout(10000),
      map(response => {
        console.log(`✅ MEXC: Получено ${response.data.length} инструментов`);

        const filteredData = MexcAdapter.filterUsdtPerpetuals(response.data);
        console.log(`🔍 MEXC: После фильтрации USDT перпетуалов: ${filteredData.length} инструментов`);

        const normalized = MexcAdapter.normalize(filteredData);
        const tickers = Object.keys(normalized);
        
        console.log(`🎯 MEXC: Успешно обработано ${tickers.length} тикеров`);
        
        tickers.slice(0, 3).forEach(ticker => {
          const data = normalized[ticker];
          console.log(`📊 MEXC ${ticker}:`, {
            price: data.price,
            fundingRate: (data.fundingRate * 100).toFixed(4) + '%',
            nextFunding: new Date(data.nextFundingTime).toLocaleTimeString()
          });
        });

        return normalized;
      }),
      catchError(error => {
        console.error('❌ MEXC: Ошибка при получении данных:', error);
        return of({});
      })
    );
  }

  checkApiHealth(): Observable<boolean> {
    console.log('🏥 MEXC: Проверяем здоровье API...');

    const url = `${this.baseUrl}${this.fundingEndpoint}?symbol=BTCUSDT`;

    return this.httpService.get(url).pipe(
      timeout(5000),
      map(() => {
        console.log('✅ MEXC: API доступен');
        return true;
      }),
      catchError(error => {
        console.error('❌ MEXC: API недоступен:', error);
        return of(false);
      })
    );
  }
}

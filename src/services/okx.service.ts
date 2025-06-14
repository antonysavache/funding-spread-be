import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { OkxAdapter, OkxFundingResponse, OkxMarkPriceResponse } from '../adapters/okx.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class OkxService {
  private readonly baseUrl = 'https://www.okx.com';
  private readonly fundingEndpoint = '/api/v5/public/funding-rate';
  private readonly markPriceEndpoint = '/api/v5/market/mark-price';

  constructor(private readonly httpService: HttpService) {}

  getFundingData(): Observable<{ [ticker: string]: NormalizedTicker }> {
    console.log('🔄 OKX: Начинаем загрузку funding данных...');

    const funding$ = this.getFundingRates();
    const markPrice$ = this.getMarkPrices();

    return forkJoin({ funding: funding$, markPrice: markPrice$ }).pipe(
      map(({ funding, markPrice }) => {
        console.log(`✅ OKX: Получено ${funding.length} funding rates и ${markPrice.length} mark prices`);

        const filteredFunding = OkxAdapter.filterUsdtSwaps(funding);
        console.log(`🔍 OKX: После фильтрации USDT свопов: ${filteredFunding.length} инструментов`);

        const normalized = OkxAdapter.normalize(filteredFunding, markPrice);
        const tickers = Object.keys(normalized);
        
        console.log(`🎯 OKX: Успешно обработано ${tickers.length} тикеров`);
        
        tickers.slice(0, 3).forEach(ticker => {
          const data = normalized[ticker];
          console.log(`📊 OKX ${ticker}:`, {
            price: data.price,
            fundingRate: (data.fundingRate * 100).toFixed(4) + '%',
            nextFunding: new Date(data.nextFundingTime).toLocaleTimeString()
          });
        });

        return normalized;
      }),
      catchError(error => {
        console.error('❌ OKX: Ошибка при получении данных:', error);
        return of({});
      })
    );
  }

  private getFundingRates(): Observable<any[]> {
    const url = `${this.baseUrl}${this.fundingEndpoint}?instType=SWAP`;

    return this.httpService.get<OkxFundingResponse>(url).pipe(
      timeout(10000),
      map(response => OkxAdapter.isValidResponse(response.data) ? response.data.data : []),
      catchError(() => of([]))
    );
  }

  private getMarkPrices(): Observable<any[]> {
    const url = `${this.baseUrl}${this.markPriceEndpoint}?instType=SWAP`;

    return this.httpService.get<OkxMarkPriceResponse>(url).pipe(
      timeout(10000),
      map(response => OkxAdapter.isValidResponse(response.data) ? response.data.data : []),
      catchError(() => of([]))
    );
  }

  checkApiHealth(): Observable<boolean> {
    const url = `${this.baseUrl}${this.fundingEndpoint}?instId=BTC-USDT-SWAP`;
    return this.httpService.get(url).pipe(
      timeout(5000),
      map(() => true),
      catchError(() => of(false))
    );
  }
}

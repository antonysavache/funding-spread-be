import { Injectable } from '@nestjs/common';
import { Observable, forkJoin, of, from } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import axios from 'axios';
import { BitGetAdapter, BitGetFundingResponse, BitGetTickerResponse } from '../adapters/bitget.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class BitgetService {
  private readonly baseUrl = 'https://api.bitget.com';
  private readonly fundingEndpoint = '/api/mix/v1/market/current-fundRate';
  private readonly tickerEndpoint = '/api/mix/v1/market/ticker';

  getFundingData(): Observable<{ [ticker: string]: NormalizedTicker }> {
    console.log('🔄 BitGet: Начинаем загрузку funding данных...');

    const funding$ = this.getFundingRates();
    const ticker$ = this.getTickerData();

    return forkJoin({ funding: funding$, ticker: ticker$ }).pipe(
      map(({ funding, ticker }) => {
        console.log(`✅ BitGet: Получено ${funding.length} funding rates и ${ticker.length} tickers`);

        const filteredFunding = BitGetAdapter.filterUsdtPerpetuals(funding);
        const filteredTickers = BitGetAdapter.filterUsdtPerpetuals(ticker);
        
        const normalized = BitGetAdapter.normalize(filteredFunding, filteredTickers);
        const tickers = Object.keys(normalized);
        
        console.log(`🎯 BitGet: Успешно обработано ${tickers.length} тикеров`);
        return normalized;
      }),
      catchError(error => {
        console.error('❌ BitGet: Ошибка при получении данных:', error);
        return of({});
      })
    );
  }

  private getFundingRates(): Observable<any[]> {
    const url = `${this.baseUrl}${this.fundingEndpoint}?productType=umcbl`;

    return from(axios.get<BitGetFundingResponse>(url)).pipe(
      timeout(10000),
      map(response => BitGetAdapter.isValidResponse(response.data) ? response.data.data : []),
      catchError(() => of([]))
    );
  }

  private getTickerData(): Observable<any[]> {
    const url = `${this.baseUrl}${this.tickerEndpoint}?productType=umcbl`;

    return from(axios.get<BitGetTickerResponse>(url)).pipe(
      timeout(10000),
      map(response => BitGetAdapter.isValidResponse(response.data) ? response.data.data : []),
      catchError(() => of([]))
    );
  }

  checkApiHealth(): Observable<boolean> {
    const url = `${this.baseUrl}${this.tickerEndpoint}?productType=umcbl`;
    return from(axios.get(url)).pipe(
      timeout(5000),
      map(() => true),
      catchError(() => of(false))
    );
  }
}

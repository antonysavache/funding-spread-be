import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { MexcAdapter, MexcContractTickersResponse } from '../adapters/mexc.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

interface Exchange {
  [ticker: string] : {
    ticker: string;
    price: number;
    fundingRate: number;
    nextFundingTime: number;
    exchange: string;
  }
}

interface Response {
  binance: Exchange;
  bybit: Exchange;
  bitget: Exchange;
  bingx: Exchange;
  okx: Exchange;
  mexc: Exchange;
}


@Injectable()
export class MexcService {
  private readonly logger = new Logger(MexcService.name);
  private readonly baseUrl = 'https://contract.mexc.com';
  private readonly contractTickersEndpoint = '/api/v1/contract/ticker';

  /**
   * Получает данные о funding rates с MEXC используя правильный contract API
   */
  async getFundingData(): Promise<{ [ticker: string]: NormalizedTicker }> {

    try {
      // Используем правильный contract API endpoint
      const url = `${this.baseUrl}${this.contractTickersEndpoint}`;

      const response = await axios.get<MexcContractTickersResponse>(url, { timeout: 10000 });
      

      if (!response.data.success) {
        throw new Error(`MEXC Contract API error: ${response.data.code}`);
      }


      // Фильтруем только USDT контракты
      const filteredData = MexcAdapter.filterUsdtContracts(response.data);

      // Нормализуем данные
      const normalized = MexcAdapter.normalize(response.data);
      const tickers = Object.keys(normalized);
      

      // Логируем несколько примеров для отладки
      tickers.slice(0, 3).forEach(ticker => {
        const data = normalized[ticker];

      });

      return normalized;
    } catch (error) {

      // Возвращаем пустой объект вместо ошибки, чтобы не ломать общую загрузку
      return {};
    }
  }
}

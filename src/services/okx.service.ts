import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { OKXAdapter } from '../adapters/okx.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class OKXService {
  private readonly logger = new Logger(OKXService.name);
  private readonly baseUrl = 'https://www.okx.com';

  /**
   * Получает нормализованные данные с OKX используя API v5
   * Сначала получает все инструменты, затем funding rates для всех USDT-SWAP
   */
  async getFundingData(): Promise<{ [ticker: string]: NormalizedTicker }> {
    this.logger.log('🔄 OKX: Начинаем загрузку funding данных...');

    try {
      // Сначала получаем все инструменты SWAP
      const instrumentsUrl = `${this.baseUrl}/api/v5/public/instruments?instType=SWAP`;
      
      this.logger.log(`🌐 OKX: Получаем список инструментов от ${instrumentsUrl}`);
      
      const instrumentsResponse = await axios.get(instrumentsUrl, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (instrumentsResponse.data.code !== '0') {
        throw new Error(`OKX Instruments API error: ${instrumentsResponse.data.msg}`);
      }

      // Фильтруем только USDT SWAP инструменты
      const usdtInstruments = instrumentsResponse.data.data.filter((inst: any) => 
        inst.instId && inst.instId.includes('USDT-SWAP')
      );

      this.logger.log(`✅ OKX: Найдено ${usdtInstruments.length} USDT-SWAP инструментов`);

      // Получаем mark prices для всех инструментов
      const markPriceUrl = `${this.baseUrl}/api/v5/public/mark-price?instType=SWAP`;
      const markPriceResponse = await axios.get(markPriceUrl, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (markPriceResponse.data.code !== '0') {
        throw new Error(`OKX Mark Price API error: ${markPriceResponse.data.msg}`);
      }

      this.logger.log(`✅ OKX: Получено ${markPriceResponse.data.data?.length || 0} mark prices`);

      // Получаем funding rates для всех USDT инструментов порциями
      const fundingData = await this.getFundingRatesForAll(usdtInstruments.map((inst: any) => inst.instId));

      const normalizedData = OKXAdapter.normalizeMarkPriceWithFunding(markPriceResponse.data, fundingData);
      const tickers = Object.keys(normalizedData);
      
      this.logger.log(`🎯 OKX: Успешно обработано ${tickers.length} тикеров`);
      
      // Логируем несколько примеров для отладки
      if (tickers.length > 0) {
        tickers.slice(0, 3).forEach(ticker => {
          const data = normalizedData[ticker];
          this.logger.log(`📊 OKX ${ticker}:`, {
            price: data.price,
            fundingRate: (data.fundingRate * 100).toFixed(4) + '%',
            nextFunding: new Date(data.nextFundingTime).toLocaleTimeString()
          });
        });
      }

      return normalizedData;
    } catch (error) {
      this.logger.error('❌ OKX: Детальная ошибка:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
      
      // В случае ошибки возвращаем пустой объект
      this.logger.error('❌ OKX: Не удалось получить данные');
      return {};
    }
  }

  /**
   * Получает funding rates для всех USDT инструментов
   */
  private async getFundingRatesForAll(allInstIds: string[]): Promise<{[instId: string]: any}> {
    const fundingData: {[instId: string]: any} = {};
    const batchSize = 5; // Максимум 5 инструментов за раз
    const totalBatches = Math.ceil(allInstIds.length / batchSize);

    this.logger.log(`📊 OKX: Получаем funding rates для ${allInstIds.length} инструментов в ${totalBatches} батчах`);

    for (let i = 0; i < allInstIds.length; i += batchSize) {
      try {
        const batch = allInstIds.slice(i, i + batchSize);
        const instIds = batch.join(',');
        
        const fundingUrl = `${this.baseUrl}/api/v5/public/funding-rate?instId=${instIds}`;

        const response = await axios.get(fundingUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (response.data.code === '0' && response.data.data) {
          response.data.data.forEach((item: any) => {
            fundingData[item.instId] = item;
          });
        }

        // Прогресс-бар
        if ((i / batchSize + 1) % 10 === 0) {
          this.logger.log(`📈 OKX: Обработано ${i / batchSize + 1}/${totalBatches} батчей`);
        }

        // Задержка между запросами для избежания rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.warn(`⚠️ OKX: Ошибка для batch ${i/batchSize + 1}: ${error.message}`);
      }
    }

    this.logger.log(`✅ OKX: Получено funding rates для ${Object.keys(fundingData).length} инструментов`);
    return fundingData;
  }
}

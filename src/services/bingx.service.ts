import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { BingXAdapter } from '../adapters/bingx.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class BingXService {
  private readonly logger = new Logger(BingXService.name);
  private readonly baseUrl = 'https://open-api.bingx.com';

  /**
   * Получает нормализованные данные с BingX используя два endpoint:
   * - ticker для цен
   * - premiumIndex для funding rates
   */
  async getFundingData(): Promise<{ [ticker: string]: NormalizedTicker }> {
    this.logger.log('🔄 BingX: Начинаем загрузку funding данных...');

    try {
      // BingX API endpoints
      const tickersUrl = `${this.baseUrl}/openApi/swap/v2/quote/ticker`;
      
      this.logger.log(`🌐 BingX: Делаем запрос к ${tickersUrl}`);
      
      // Получаем тикеры для цен
      const tickersResponse = await axios.get(tickersUrl, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      this.logger.log(`📥 BingX: Получен статус ${tickersResponse.status}`);
      this.logger.log(`📄 BingX: Структура ответа:`, {
        keys: Object.keys(tickersResponse.data),
        code: tickersResponse.data.code,
        msg: tickersResponse.data.msg,
        dataLength: tickersResponse.data.data?.length || 0
      });
      
      if (tickersResponse.data.code !== 0) {
        this.logger.error(`❌ BingX: API ошибка - код: ${tickersResponse.data.code}, сообщение: ${tickersResponse.data.msg}`);
        throw new Error(`BingX API error: ${tickersResponse.data.msg}`);
      }

      this.logger.log(`✅ BingX: Получено ${tickersResponse.data.data?.length || 0} инструментов`);
      
      // Логируем первые несколько элементов для анализа структуры
      if (tickersResponse.data.data && tickersResponse.data.data.length > 0) {
        this.logger.log('🔍 BingX: Первые 3 инструмента:', tickersResponse.data.data.slice(0, 3));
      }

      // Получаем funding rates для популярных пар
      const fundingData = await this.getFundingRates();

      // Объединяем данные
      const normalizedData = BingXAdapter.normalizeWithFunding(tickersResponse.data, fundingData);
      const tickers = Object.keys(normalizedData);
      
      this.logger.log(`🔍 BingX: После фильтрации USDT перпетуалов: ${tickers.length} инструментов`);
      this.logger.log(`🎯 BingX: Успешно обработано ${tickers.length} тикеров:`, tickers.slice(0, 10));
      
      // Логируем несколько примеров для отладки
      if (tickers.length > 0) {
        tickers.slice(0, 3).forEach(ticker => {
          const data = normalizedData[ticker];
          this.logger.log(`📊 BingX ${ticker}:`, {
            price: data.price,
            fundingRate: (data.fundingRate * 100).toFixed(4) + '%',
            nextFunding: new Date(data.nextFundingTime).toLocaleTimeString()
          });
        });
      }

      return normalizedData;
    } catch (error) {
      this.logger.error('❌ BingX: Детальная ошибка:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
      
      // В случае ошибки возвращаем пустой объект
      this.logger.error('❌ BingX: Не удалось получить данные');
      return {};
    }
  }

  /**
   * Получает funding rates для популярных валютных пар параллельно
   */
  private async getFundingRates(): Promise<{[symbol: string]: any}> {
    const popularSymbols = [
      'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'AVAX-USDT', 'ADA-USDT',
      'DOT-USDT', 'LINK-USDT', 'UNI-USDT', 'LTC-USDT', 'BCH-USDT',
      'XRP-USDT', 'TRX-USDT', 'ETC-USDT', 'ATOM-USDT', 'AAVE-USDT',
      'SUI-USDT', 'WIF-USDT', 'INJ-USDT', 'DOGE-USDT', 'NEAR-USDT',
      'FIL-USDT', 'MATIC-USDT', 'SHIB-USDT', 'ICP-USDT', 'APT-USDT',
      'OP-USDT', 'ARB-USDT', 'BNB-USDT', 'PEPE-USDT', 'FLOKI-USDT'
    ];

    this.logger.log(`📊 BingX: Получаем funding rates для ${popularSymbols.length} популярных символов`);

    const fundingData: {[symbol: string]: any} = {};

    // Создаем массив промисов для параллельных запросов
    const fundingPromises = popularSymbols.map(async (symbol) => {
      try {
        const fundingUrl = `${this.baseUrl}/openApi/swap/v2/quote/premiumIndex?symbol=${symbol}`;
        
        const response = await axios.get(fundingUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (response.data.code === 0 && response.data.data) {
          return { symbol, data: response.data.data };
        }
        return null;
      } catch (error) {
        this.logger.warn(`⚠️ BingX: Не удалось получить funding rate для ${symbol}: ${error.message}`);
        return null;
      }
    });

    // Выполняем все запросы параллельно
    const results = await Promise.allSettled(fundingPromises);
    
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        fundingData[result.value.symbol] = result.value.data;
      }
    });

    this.logger.log(`✅ BingX: Получено funding rates для ${Object.keys(fundingData).length} символов`);
    return fundingData;
  }
}

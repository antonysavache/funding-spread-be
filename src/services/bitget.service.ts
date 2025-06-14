import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { BitGetAdapter } from '../adapters/bitget.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class BitGetService {
  private readonly logger = new Logger(BitGetService.name);
  private readonly baseUrl = 'https://api.bitget.com';

  /**
   * Получает нормализованные данные с BitGet используя API v2
   */
  async getFundingData(): Promise<{ [ticker: string]: NormalizedTicker }> {
    this.logger.log('🔄 BitGet: Начинаем загрузку funding данных...');

    try {
      // BitGet API v2 endpoints
      const tickersUrl = `${this.baseUrl}/api/v2/mix/market/tickers?productType=usdt-futures`;

      this.logger.log(`🌐 BitGet: Делаем запрос к ${tickersUrl}`);

      // Пробуем получить данные из tickers endpoint (содержит все нужные данные)
      const response = await axios.get(tickersUrl, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      this.logger.log(`📥 BitGet: Получен статус ${response.status}`);
      this.logger.log(`📄 BitGet: Структура ответа:`, {
        keys: Object.keys(response.data),
        code: response.data.code,
        msg: response.data.msg,
        dataLength: response.data.data?.length || 0
      });
      
      if (response.data.code !== '00000') {
        this.logger.error(`❌ BitGet: API ошибка - код: ${response.data.code}, сообщение: ${response.data.msg}`);
        throw new Error(`BitGet API error: ${response.data.msg}`);
      }

      this.logger.log(`✅ BitGet: Получено ${response.data.data?.length || 0} инструментов`);
      
      // Логируем первые несколько элементов для анализа
      if (response.data.data && response.data.data.length > 0) {
        this.logger.log('🔍 BitGet: Первые 3 инструмента:', response.data.data.slice(0, 3));
      }

      // Преобразуем response в ожидаемый формат
      const tickersResponse = {
        code: response.data.code,
        msg: response.data.msg,
        requestTime: response.data.requestTime,
        data: response.data.data || []
      };

      const normalizedData = BitGetAdapter.normalize(tickersResponse);
      const tickers = Object.keys(normalizedData);
      
      this.logger.log(`🎯 BitGet: Успешно обработано ${tickers.length} тикеров:`, tickers.slice(0, 10));
      
      // Логируем несколько примеров для отладки
      if (tickers.length > 0) {
        tickers.slice(0, 3).forEach(ticker => {
          const data = normalizedData[ticker];
          this.logger.log(`📊 BitGet ${ticker}:`, {
            price: data.price,
            fundingRate: (data.fundingRate * 100).toFixed(4) + '%',
            nextFunding: new Date(data.nextFundingTime).toLocaleTimeString()
          });
        });
      } else {
        this.logger.warn('⚠️ BitGet: Не удалось обработать ни одного тикера');
      }

      return normalizedData;
    } catch (error) {
      this.logger.error('❌ BitGet: Детальная ошибка:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
      
      // В случае ошибки возвращаем пустой объект
      this.logger.error('❌ BitGet: Не удалось получить данные');
      return {};
    }
    }
  }

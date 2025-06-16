import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class BitGetService {
  private readonly logger = new Logger(BitGetService.name);
  private readonly baseUrl = 'https://api.bitget.com';

  /**
   * Получает нормализованные данные с BitGet используя новый funding rate API
   */
  async getFundingData(): Promise<{ [ticker: string]: NormalizedTicker }> {
    this.logger.log('🔄 BitGet: Начинаем загрузку funding данных через новый API...');

    try {
      // Новый endpoint с правильными данными funding
      const fundingUrl = `${this.baseUrl}/api/v2/mix/market/current-fund-rate?productType=usdt-futures`;

      this.logger.log(`🌐 BitGet: Делаем запрос к ${fundingUrl}`);

      const response = await axios.get(fundingUrl, { 
        timeout: 15000,
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

      const fundingData = response.data.data;
      if (!Array.isArray(fundingData)) {
        this.logger.warn('⚠️ BitGet: Неожиданный формат данных funding');
        return {};
      }

      this.logger.log(`✅ BitGet: Получено ${fundingData.length} funding записей`);
      
      // Логируем первые несколько элементов для анализа
      if (fundingData.length > 0) {
        this.logger.log('🔍 BitGet: Первые 3 funding записи:', fundingData.slice(0, 3));
      }

      // Нормализуем данные
      const normalizedData = this.normalizeFundingData(fundingData);
      const tickers = Object.keys(normalizedData);
      
      this.logger.log(`🎯 BitGet: Успешно обработано ${tickers.length} тикеров:`, tickers.slice(0, 10));
      
      // Логируем несколько примеров для отладки
      if (tickers.length > 0) {
        tickers.slice(0, 3).forEach(ticker => {
          const data = normalizedData[ticker];
          this.logger.log(`📊 BitGet ${ticker}:`, {
            fundingRate: (data.fundingRate * 100).toFixed(4) + '%',
            nextFunding: new Date(data.nextFundingTime).toLocaleString(),
            price: data.price // будет 1 как placeholder
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

  /**
   * Нормализует данные funding rate API
   */
  private normalizeFundingData(fundingData: any[]): { [ticker: string]: NormalizedTicker } {
    const result: { [ticker: string]: NormalizedTicker } = {};

    fundingData.forEach((item, index) => {
      try {
        // Конвертируем символ в стандартный формат
        const standardSymbol = this.convertBitgetSymbol(item.symbol);
        
        if (index < 3) {
          this.logger.log(`🔍 BitGet: обрабатываем ${item.symbol} -> ${standardSymbol}`);
          this.logger.log(`🔍 BitGet: данные:`, {
            fundingRate: item.fundingRate,
            nextUpdate: item.nextUpdate,
            fundingRateInterval: item.fundingRateInterval
          });
        }
        
        // Фильтруем только USDT символы с валидными данными
        if (
          standardSymbol &&
          standardSymbol.endsWith('USDT') &&
          this.isValidTicker(standardSymbol) &&
          item.fundingRate !== undefined &&
          item.nextUpdate
        ) {
          
          const fundingRate = parseFloat(item.fundingRate) || 0;
          const nextFundingTime = parseInt(item.nextUpdate);
          
          if (index < 3) {
            this.logger.log(`✅ BitGet: добавляем ${standardSymbol} с fundingRate=${fundingRate}, nextUpdate=${nextFundingTime}`);
          }
          
          result[standardSymbol] = {
            ticker: standardSymbol,
            price: 1, // Placeholder - цена не используется в основной логике
            fundingRate: fundingRate,
            nextFundingTime: nextFundingTime
          };
        } else if (index < 3) {
          this.logger.log(`❌ BitGet: пропускаем ${item.symbol} - не подходит`);
        }
      } catch (error) {
        this.logger.warn(`⚠️ BitGet: Ошибка обработки элемента ${index}:`, error.message);
      }
    });

    this.logger.log(`📊 BitGet: Найдено ${Object.keys(result).length} валидных funding записей`);
    
    return result;
  }

  /**
   * Конвертирует Bitget символ в стандартный формат
   * XUSDT -> XUSDT (уже правильный)
   * BTCUSDT -> BTCUSDT
   */
  private convertBitgetSymbol(bitgetSymbol: string): string | null {
    if (!bitgetSymbol) return null;

    // Bitget в новом API использует стандартные символы
    if (bitgetSymbol.endsWith('USDT') && bitgetSymbol.length > 4) {
      return bitgetSymbol;
    }

    return null;
  }

  /**
   * Проверяет что тикер в правильном формате XXXUSDT
   */
  private isValidTicker(ticker: string): boolean {
    const regex = /^[A-Z0-9]+USDT$/;
    return regex.test(ticker) && ticker.length > 4;
  }
}

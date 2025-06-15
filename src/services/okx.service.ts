import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { OKXAdapter } from '../adapters/okx.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class OKXService {
  private readonly logger = new Logger(OKXService.name);
  private readonly baseUrl = 'https://www.okx.com';

  /**
   * Получает нормализованные данные с OKX для всех USDT-SWAP контрактов
   * Получает funding rates для каждого тикера отдельно
   */
  async getFundingData(): Promise<{ [ticker: string]: NormalizedTicker }> {
    this.logger.log('🔄 OKX: Начинаем загрузку funding данных для всех тикеров...');

    try {
      // Шаг 1: Получаем все SWAP инструменты
      const allInstruments = await this.getAllSwapInstruments();
      
      if (allInstruments.length === 0) {
        this.logger.warn('⚠️ OKX: Не найдено SWAP инструментов');
        return {};
      }

      this.logger.log(`📊 OKX: Найдено ${allInstruments.length} SWAP инструментов`);

      // Шаг 2: Получаем funding rates для всех инструментов
      const fundingData = await this.getFundingRatesForAll(allInstruments);

      // Шаг 3: Получаем mark prices для всех инструментов
      const markPrices = await this.getMarkPrices();

      // Шаг 4: Нормализуем данные
      const normalizedData = OKXAdapter.normalizeMarkPriceWithFunding(
        { code: '0', msg: '', data: markPrices },
        fundingData
      );

      const tickers = Object.keys(normalizedData);
      this.logger.log(`🎯 OKX: Успешно обработано ${tickers.length} тикеров с реальными funding rates`);
      
      // Показать примеры с реальными funding rates
      if (tickers.length > 0) {
        tickers.slice(0, 5).forEach(ticker => {
          const data = normalizedData[ticker];
          this.logger.log(`📊 OKX ${ticker}: rate=${(data.fundingRate * 100).toFixed(4)}%, price=${data.price}`);
        });
      }

      return normalizedData;

    } catch (error) {
      this.logger.error('❌ OKX: Ошибка при получении данных:', error.message);
      return {};
    }
  }

  /**
   * Получает все SWAP инструменты
   */
  private async getAllSwapInstruments(): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/api/v5/public/instruments?instType=SWAP`;
      
      this.logger.log('🌐 OKX: Получаем список всех SWAP инструментов...');
      
      const response = await axios.get(url, { 
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.data.code !== '0') {
        throw new Error(`OKX Instruments API error: ${response.data.msg}`);
      }

      // Фильтруем только USDT SWAP инструменты
      const usdtInstruments = response.data.data
        .filter((inst: any) => inst.instId && inst.instId.includes('USDT-SWAP'))
        .map((inst: any) => inst.instId);

      this.logger.log(`✅ OKX: Найдено ${usdtInstruments.length} USDT-SWAP инструментов`);
      
      return usdtInstruments;

    } catch (error) {
      this.logger.error('❌ OKX: Ошибка при получении инструментов:', error.message);
      throw error;
    }
  }

  /**
   * Получает funding rates для всех инструментов по одному
   */
  private async getFundingRatesForAll(allInstIds: string[]): Promise<{[instId: string]: any}> {
    const fundingData: {[instId: string]: any} = {};
    const total = allInstIds.length;
    const delay = 50; // 50ms между запросами (20 req/sec - в пределах лимита 20 req/2sec)

    this.logger.log(`📦 OKX: Получаем funding rates для ${total} инструментов по одному...`);

    for (let i = 0; i < allInstIds.length; i++) {
      const instId = allInstIds[i];
      const progress = Math.round((i / total) * 100);
      
      try {
        const url = `${this.baseUrl}/api/v5/public/funding-rate?instId=${instId}`;

        if (i % 20 === 0) {
          this.logger.log(`🔄 OKX: ${progress}% - Обрабатываем ${instId} (${i + 1}/${total})`);
        }

        const response = await axios.get(url, {
          timeout: 8000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (response.data.code === '0' && response.data.data && response.data.data.length > 0) {
          fundingData[instId] = response.data.data[0];
        } else {
          this.logger.warn(`⚠️ OKX: ${instId} - код ${response.data.code}: ${response.data.msg}`);
        }

        // Задержка между запросами
        if (i < total - 1) {
          await this.delay(delay);
        }

      } catch (error) {
        this.logger.warn(`⚠️ OKX: Ошибка для ${instId}: ${error.message}`);
        
        // Увеличиваем задержку при ошибке rate limit
        if (error.response?.status === 429) {
          this.logger.warn(`🚫 OKX: Rate limit для ${instId}, увеличиваем задержку...`);
          await this.delay(500);
        }
      }
    }

    const totalReceived = Object.keys(fundingData).length;
    this.logger.log(`📊 OKX: Итого получено funding rates для ${totalReceived} из ${total} инструментов`);
    
    return fundingData;
  }

  /**
   * Получает mark prices для всех SWAP инструментов
   */
  private async getMarkPrices(): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/api/v5/public/mark-price?instType=SWAP`;
      
      this.logger.log('🌐 OKX: Получаем mark prices для всех SWAP...');
      
      const response = await axios.get(url, { 
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.data.code !== '0') {
        throw new Error(`OKX Mark Price API error: ${response.data.msg}`);
      }

      const markPrices = response.data.data || [];
      this.logger.log(`✅ OKX: Получено ${markPrices.length} mark prices`);
      
      return markPrices;

    } catch (error) {
      this.logger.error('❌ OKX: Ошибка при получении mark prices:', error.message);
      return [];
    }
  }

  /**
   * Простая задержка
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Альтернативный метод - получение данных через tickers endpoint (быстрый, но funding rates = 0)
   */
  async getFundingDataAlternative(): Promise<{ [ticker: string]: NormalizedTicker }> {
    this.logger.log('🔄 OKX Alternative: Получаем данные через tickers endpoint...');

    try {
      const url = `${this.baseUrl}/api/v5/market/tickers?instType=SWAP`;
      
      const response = await axios.get(url, { 
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.data.code !== '0') {
        throw new Error(`OKX Tickers API error: ${response.data.msg}`);
      }

      this.logger.log(`📊 OKX Alternative: Получено ${response.data.data?.length || 0} тикеров`);

      const normalizedData = OKXAdapter.normalize(response.data);
      const tickers = Object.keys(normalizedData);
      
      this.logger.log(`🎯 OKX Alternative: Обработано ${tickers.length} тикеров`);
      
      return normalizedData;

    } catch (error) {
      this.logger.error('❌ OKX Alternative: Ошибка:', error.message);
      return {};
    }
  }

  /**
   * Вычисляет время следующего funding для OKX (каждые 8 часов: 00:00, 08:00, 16:00 UTC)
   */
  private static calculateNextFundingTime(): number {
    const now = new Date();
    const currentHour = now.getUTCHours();
    let nextFundingHour: number;

    if (currentHour < 8) {
      nextFundingHour = 8;
    } else if (currentHour < 16) {
      nextFundingHour = 16;
    } else {
      nextFundingHour = 24; // 00:00 следующего дня
    }

    const nextFundingTime = new Date(now);
    nextFundingTime.setUTCHours(nextFundingHour % 24, 0, 0, 0);
    if (nextFundingHour === 24) {
      nextFundingTime.setUTCDate(nextFundingTime.getUTCDate() + 1);
    }

    return nextFundingTime.getTime();
  }
}

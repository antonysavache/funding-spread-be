import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { OKXAdapter } from '../adapters/okx.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class OKXService {
  private readonly logger = new Logger(OKXService.name);
  private readonly baseUrl = 'https://www.okx.com';

  /**
   * Получает нормализованные данные с OKX используя один запрос к funding-rate endpoint с instId=ANY
   */
  async getFundingData(): Promise<{ [ticker: string]: NormalizedTicker }> {
    this.logger.log('🔄 OKX: Получаем данные через funding-rate endpoint с instId=ANY...');

    try {
      // Используем funding-rate endpoint с instId=ANY для получения всех данных сразу
      const url = `${this.baseUrl}/api/v5/public/funding-rate?instId=ANY`;
      
      this.logger.log(`🌐 OKX: Запрашиваем данные с ${url}`);
      
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.data.code !== '0') {
        throw new Error(`OKX API error: ${response.data.msg}`);
      }

      if (!response.data.data || !Array.isArray(response.data.data)) {
        this.logger.warn('⚠️ OKX: Получен неожиданный формат данных:', response.data);
        return {};
      }

      this.logger.log(`📊 OKX: Получено ${response.data.data.length} записей от API`);

      // Нормализуем данные
      const fundingData = this.normalizeAllFundingData(response.data.data);
      
      // Обогащаем ценами
      const normalized = await this.enrichWithPrices(fundingData);
      
      const tickers = Object.keys(normalized);
      this.logger.log(`🎯 OKX: Успешно обработано ${tickers.length} тикеров`);
      
      // Показать примеры с реальными funding rates
      if (tickers.length > 0) {
        const sampleTickers = tickers.slice(0, 5);
        sampleTickers.forEach(ticker => {
          const data = normalized[ticker];
          this.logger.log(`📊 OKX ${ticker}: rate=${(data.fundingRate * 100).toFixed(4)}%, price=${data.price}`);
        });
      }

      // Подсчитываем статистику по funding rates
      const nonZeroFunding = tickers.filter(ticker => normalized[ticker].fundingRate !== 0);
      this.logger.log(`📈 OKX: Инструментов с ненулевым funding rate: ${nonZeroFunding.length} из ${tickers.length}`);

      return normalized;

    } catch (error) {
      this.logger.error('❌ OKX: Ошибка при получении данных:', error.message);
      return {};
    }
  }

  /**
   * Нормализует все данные из funding-rate endpoint
   */
  private normalizeAllFundingData(data: any[]): { [ticker: string]: NormalizedTicker } {
    const result: { [ticker: string]: NormalizedTicker } = {};

    data.forEach((item, index) => {
      try {
        // Конвертируем символ в стандартный формат
        const standardSymbol = this.convertOKXSymbol(item.instId);
        
        if (index < 3) {
          this.logger.log(`🔍 OKX: обрабатываем ${item.instId} -> ${standardSymbol}`);
          this.logger.log(`🔍 OKX: данные:`, {
            fundingRate: item.fundingRate,
            nextFundingTime: item.nextFundingTime,
            instType: item.instType
          });
        }
        
        // Фильтруем только USDT SWAP инструменты с валидными данными
        if (
          standardSymbol &&
          standardSymbol.endsWith('USDT') &&
          this.isValidTicker(standardSymbol) &&
          item.instType === 'SWAP' &&
          item.fundingRate !== undefined
        ) {
          
          const fundingRate = parseFloat(item.fundingRate) || 0;
          const nextFundingTime = item.fundingTime ? 
            parseInt(item.fundingTime) : 
            this.calculateNextFundingTime();
          
          // Для получения цены нужно сделать дополнительный запрос
          // Пока используем placeholder, позже добавим mark price
          const price = 0; // Будет заполнено позже через mark price endpoint
          
          if (index < 3) {
            this.logger.log(`✅ OKX: добавляем ${standardSymbol} с fundingRate=${fundingRate}`);
          }
          
          result[standardSymbol] = {
            ticker: standardSymbol,
            price: price, // Временно 0, будет обновлено
            fundingRate: fundingRate,
            nextFundingTime: nextFundingTime
          };
        } else if (index < 3) {
          this.logger.log(`❌ OKX: пропускаем ${item.instId} - не подходит (type: ${item.instType})`);
        }
      } catch (error) {
        this.logger.warn(`⚠️ OKX: Ошибка обработки элемента ${index}:`, error.message);
      }
    });

    // Логируем результат
    this.logger.log(`📊 OKX: Найдено ${Object.keys(result).length} SWAP инструментов для обогащения ценами`);
    
    return result;
  }

  /**
   * Обогащает данные ценами из mark-price endpoint
   */
  private async enrichWithPrices(fundingData: { [ticker: string]: NormalizedTicker }): Promise<{ [ticker: string]: NormalizedTicker }> {
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
        this.logger.warn(`⚠️ OKX: Ошибка получения цен: ${response.data.msg}`);
        return fundingData;
      }

      if (!response.data.data || !Array.isArray(response.data.data)) {
        this.logger.warn('⚠️ OKX: Неожиданный формат ответа mark-price');
        return fundingData;
      }

      this.logger.log(`📊 OKX: Получено ${response.data.data.length} mark prices`);

      // Обновляем цены в funding data
      let pricesUpdated = 0;
      response.data.data.forEach(markPrice => {
        const standardSymbol = this.convertOKXSymbol(markPrice.instId);
        
        if (standardSymbol && fundingData[standardSymbol] && markPrice.markPx) {
          fundingData[standardSymbol].price = parseFloat(markPrice.markPx);
          pricesUpdated++;
        }
      });

      this.logger.log(`✅ OKX: Обновлено цен: ${pricesUpdated} из ${Object.keys(fundingData).length}`);

      // Удаляем тикеры без цены
      const result: { [ticker: string]: NormalizedTicker } = {};
      Object.entries(fundingData).forEach(([ticker, data]) => {
        if (data.price > 0) {
          result[ticker] = data;
        }
      });

      return result;

    } catch (error) {
      this.logger.error('❌ OKX: Ошибка при получении цен:', error.message);
      return fundingData;
    }
  }

  /**
   * Конвертирует OKX формат символа в стандартный
   * BTC-USDT-SWAP -> BTCUSDT
   */
  private convertOKXSymbol(okxSymbol: string): string | null {
    if (!okxSymbol) return null;

    // Удаляем суффикс -SWAP и заменяем - на пустую строку
    const cleaned = okxSymbol.replace('-SWAP', '').replace('-', '');
    
    if (cleaned.endsWith('USDT') && cleaned.length > 4) {
      return cleaned;
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

  /**
   * Вычисляет время следующего funding для OKX (каждые 8 часов: 00:00, 08:00, 16:00 UTC)
   */
  private calculateNextFundingTime(): number {
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

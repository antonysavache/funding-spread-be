import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { BingXAdapter } from '../adapters/bingx.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class BingXService {
  private readonly logger = new Logger(BingXService.name);
  private readonly baseUrl = 'https://open-api.bingx.com';

  /**
   * Получает нормализованные данные с BingX используя премиум индекс endpoint
   * Использует endpoint без symbol параметра для получения всех данных сразу
   */
  async getFundingData(): Promise<{ [ticker: string]: NormalizedTicker }> {
    this.logger.log('🔄 BingX: Получаем данные через premiumIndex endpoint...');

    try {
      // Используем premiumIndex endpoint без symbol параметра для получения всех данных
      const url = `${this.baseUrl}/openApi/swap/v2/quote/premiumIndex`;
      
      this.logger.log(`🌐 BingX: Запрашиваем данные с ${url}`);
      
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.data.code !== 0) {
        throw new Error(`BingX API error: ${response.data.msg}`);
      }

      if (!response.data.data || !Array.isArray(response.data.data)) {
        this.logger.warn('⚠️ BingX: Получен неожиданный формат данных:', response.data);
        return {};
      }

      this.logger.log(`📊 BingX: Получено ${response.data.data.length} записей от API`);

      // Нормализуем данные
      const normalized = this.normalizeAllData(response.data.data);
      
      const tickers = Object.keys(normalized);
      this.logger.log(`🎯 BingX: Успешно обработано ${tickers.length} тикеров`);
      
      // Показать примеры с реальными funding rates
      if (tickers.length > 0) {
        const sampeTickers = tickers.slice(0, 5);
        sampeTickers.forEach(ticker => {
          const data = normalized[ticker];
          this.logger.log(`📊 BingX ${ticker}: rate=${(data.fundingRate * 100).toFixed(4)}%, price=${data.price}`);
        });
      }

      // Подсчитываем статистику по funding rates
      const nonZeroFunding = tickers.filter(ticker => normalized[ticker].fundingRate !== 0);
      this.logger.log(`📈 BingX: Инструментов с ненулевым funding rate: ${nonZeroFunding.length} из ${tickers.length}`);

      return normalized;

    } catch (error) {
      this.logger.error('❌ BingX: Ошибка при получении данных:', error.message);
      return {};
    }
  }

  /**
   * Нормализует все данные из премиум индекса
   */
  private normalizeAllData(data: any[]): { [ticker: string]: NormalizedTicker } {
    const result: { [ticker: string]: NormalizedTicker } = {};

    data.forEach((item, index) => {
      try {
        // Конвертируем символ в стандартный формат
        const standardSymbol = this.convertBingXSymbol(item.symbol);
        
        if (index < 3) {
          this.logger.log(`🔍 BingX: обрабатываем ${item.symbol} -> ${standardSymbol}`);
          this.logger.log(`🔍 BingX: данные:`, {
            markPrice: item.markPrice,
            lastFundingRate: item.lastFundingRate,
            nextFundingTime: item.nextFundingTime
          });
        }
        
        // Фильтруем только USDT пары с валидными данными
        if (
          standardSymbol &&
          standardSymbol.endsWith('USDT') &&
          this.isValidTicker(standardSymbol) &&
          item.markPrice
        ) {
          
          const fundingRate = item.lastFundingRate ? parseFloat(item.lastFundingRate) : 0;
          const price = parseFloat(item.markPrice);
          const nextFundingTime = item.nextFundingTime || this.calculateNextFundingTime();
          
          if (index < 3) {
            this.logger.log(`✅ BingX: добавляем ${standardSymbol} с fundingRate=${fundingRate}`);
          }
          
          if (price > 0) {
            result[standardSymbol] = {
              ticker: standardSymbol,
              price: price,
              fundingRate: fundingRate,
              nextFundingTime: nextFundingTime
            };
          }
        } else if (index < 3) {
          this.logger.log(`❌ BingX: пропускаем ${item.symbol} - не подходит`);
        }
      } catch (error) {
        this.logger.warn(`⚠️ BingX: Ошибка обработки элемента ${index}:`, error.message);
      }
    });

    return result;
  }

  /**
   * Конвертирует BingX формат символа в стандартный
   * BTC-USDT -> BTCUSDT
   */
  private convertBingXSymbol(bingxSymbol: string): string | null {
    if (!bingxSymbol) return null;

    const cleaned = bingxSymbol.replace('-', '');
    
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
   * Вычисляет время следующего funding для BingX (каждые 8 часов: 00:00, 08:00, 16:00 UTC)
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

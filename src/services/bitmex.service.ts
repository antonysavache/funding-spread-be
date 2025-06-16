import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { BitMEXAdapter } from '../adapters/bitmex.adapter';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';

@Injectable()
export class BitMEXService {
  private readonly logger = new Logger(BitMEXService.name);
  private readonly baseUrl = 'https://www.bitmex.com/api/v1';

  /**
   * Получает нормализованные данные с BitMEX используя два endpoint:
   * - instrument/active для активных инструментов и цен
   * - funding для текущих funding rates
   */
  async getFundingData(): Promise<{ [ticker: string]: NormalizedTicker }> {
    this.logger.log('🔄 BitMEX: Начинаем загрузку funding данных...');

    try {
      // BitMEX API endpoints
      const instrumentsUrl = `${this.baseUrl}/instrument/active`;
      
      this.logger.log(`🌐 BitMEX: Получаем активные инструменты от ${instrumentsUrl}`);
      
      // Получаем активные инструменты для цен
      const instrumentsResponse = await axios.get(instrumentsUrl, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      this.logger.log(`📥 BitMEX: Получен статус ${instrumentsResponse.status}`);
      this.logger.log(`✅ BitMEX: Получено ${instrumentsResponse.data?.length || 0} активных инструментов`);
      
      // Логируем первые несколько элементов для анализа структуры
      if (instrumentsResponse.data && instrumentsResponse.data.length > 0) {
        this.logger.log('🔍 BitMEX: Первые 3 инструмента:', instrumentsResponse.data.slice(0, 3).map(inst => ({
          symbol: inst.symbol,
          typ: inst.typ,
          state: inst.state,
          settlCurrency: inst.settlCurrency,
          lastPrice: inst.lastPrice,
          markPrice: inst.markPrice
        })));
      }

      // Получаем funding rates для инструментов
      const fundingData = await this.getFundingRates();

      // Объединяем данные
      const normalizedData = BitMEXAdapter.normalizeWithFunding(instrumentsResponse.data, fundingData);
      const tickers = Object.keys(normalizedData);
      
      this.logger.log(`🔍 BitMEX: После фильтрации perpetual contracts: ${tickers.length} инструментов`);
      this.logger.log(`🎯 BitMEX: Успешно обработано ${tickers.length} тикеров:`, tickers.slice(0, 10));
      
      // Логируем несколько примеров для отладки
      if (tickers.length > 0) {
        tickers.slice(0, 3).forEach(ticker => {
          const data = normalizedData[ticker];
          this.logger.log(`📊 BitMEX ${ticker}:`, {
            price: data.price,
            fundingRate: (data.fundingRate * 100).toFixed(4) + '%',
            nextFunding: new Date(data.nextFundingTime).toLocaleTimeString()
          });
        });
      }

      return normalizedData;
    } catch (error) {
      this.logger.error('❌ BitMEX: Детальная ошибка:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
      
      // В случае ошибки возвращаем пустой объект
      this.logger.error('❌ BitMEX: Не удалось получить данные');
      return {};
    }
  }

  /**
   * Получает текущие funding rates для ВСЕХ активных perpetual инструментов
   */
  private async getFundingRates(): Promise<{[symbol: string]: any}> {
    try {
      // Получаем funding rates для всех инструментов сразу
      this.logger.log(`📊 BitMEX: Получаем funding rates для всех активных инструментов`);
      
      const fundingUrl = `${this.baseUrl}/funding?reverse=true&count=500`;
      
      const response = await axios.get(fundingUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const fundingData: {[symbol: string]: any} = {};
      
      if (response.data && Array.isArray(response.data)) {
        // Группируем по символам и берем последний funding rate для каждого
        const fundingBySymbol = new Map();
        
        response.data.forEach(fundingEntry => {
          const symbol = fundingEntry.symbol;
          if (!fundingBySymbol.has(symbol) || 
              new Date(fundingEntry.timestamp) > new Date(fundingBySymbol.get(symbol).timestamp)) {
            fundingBySymbol.set(symbol, fundingEntry);
          }
        });
        
        // Конвертируем Map в обычный объект
        fundingBySymbol.forEach((value, key) => {
          fundingData[key] = value;
        });
        
        this.logger.log(`✅ BitMEX: Получено funding rates для ${Object.keys(fundingData).length} символов`);
        
        // Логируем первые несколько для отладки
        const symbols = Object.keys(fundingData).slice(0, 5);
        symbols.forEach(symbol => {
          const funding = fundingData[symbol];
          this.logger.log(`📈 BitMEX funding ${symbol}: rate=${(funding.fundingRate * 100).toFixed(4)}%, time=${funding.timestamp}`);
        });
      }

      return fundingData;
    } catch (error) {
      this.logger.error(`❌ BitMEX: Ошибка при получении funding rates: ${error.message}`);
      return {};
    }
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExchangeAggregatorService } from '../services/exchange-aggregator.service';
import { AggregatedNormalizedData } from '../services/exchange-aggregator.service';
import { GetDataResponse, Exchange, TickerData } from '../interfaces/get-data-response.interface';
import { NormalizedTicker } from '../adapters/normalized-ticker.interface';
import { OKXService } from '../services/okx.service';

@Controller('api/funding')
export class FundingController {

  constructor(
    private readonly exchangeAggregatorService: ExchangeAggregatorService,
    private readonly okxService: OKXService,
  ) {}

  /**
   * GET /api/funding/getData
   * Получает данные со всех бирж в новом формате включая OKX
   */
  @Get('getData')
  getData(): Observable<GetDataResponse> {
    return this.exchangeAggregatorService.getAllNormalizedData().pipe(
      map(data => {
        console.log('🔍 getData: полученные данные от агрегатора:', Object.keys(data));
        console.log('🔍 getData: OKX тикеров:', Object.keys(data.okx || {}).length);
        
        const result: GetDataResponse = {
          binance: {},
          bybit: {},
          bitget: {},
          bingx: {},
          bitmex: {},
          okx: {}
        };

        // Трансформируем данные в нужный формат
        Object.entries(data).forEach(([exchangeName, exchangeData]) => {
          console.log(`🔍 getData: обрабатываем ${exchangeName}, тикеров: ${Object.keys(exchangeData).length}`);
          
          const exchange: Exchange = {};
          
          Object.entries(exchangeData).forEach(([ticker, tickerData]: [string, NormalizedTicker]) => {
            exchange[ticker] = {
              price: tickerData.price,
              fundingRate: tickerData.fundingRate,
              nextFundingTime: tickerData.nextFundingTime,
              exchange: exchangeName
            };
          });

          // Присваиваем данные соответствующей бирже
          if (exchangeName === 'binance') result.binance = exchange;
          else if (exchangeName === 'bybit') result.bybit = exchange;
          else if (exchangeName === 'bitget') result.bitget = exchange;
          else if (exchangeName === 'bingx') result.bingx = exchange;
          else if (exchangeName === 'bitmex') result.bitmex = exchange;
          else if (exchangeName === 'okx') {
            console.log('✅ getData: Добавляем OKX данные:', Object.keys(exchange).length, 'тикеров');
            result.okx = exchange;
          }
        });

        console.log('🎯 getData: финальный результат:', {
          binance: Object.keys(result.binance).length,
          bybit: Object.keys(result.bybit).length,
          bitget: Object.keys(result.bitget).length,
          bingx: Object.keys(result.bingx).length,
          bitmex: Object.keys(result.bitmex).length,
          okx: Object.keys(result.okx).length,
        });

        return result;
      })
    );
  }

  @Get('getDashboard')
  getDashboard(): Observable<{ [ticker: string]: { [exchange: string]: TickerData | null } }> {
    return this.exchangeAggregatorService.getAllNormalizedData().pipe(
        map(data => {
          console.log('🔍 getDashboard: начинаем трансформацию данных...');

          // Собираем все уникальные тикеры
          const allTickers = new Set<string>();
          const exchanges = ['binance', 'bybit', 'bitget', 'bingx', 'mexc', 'bitmex', 'okx'];

          exchanges.forEach(exchange => {
            const exchangeData = data[exchange as keyof typeof data];
            if (exchangeData) {
              Object.keys(exchangeData).forEach(ticker => allTickers.add(ticker));
            }
          });

          console.log(`🔍 getDashboard: найдено ${allTickers.size} уникальных тикеров`);

          // Создаем результат в новом формате
          const result: { [ticker: string]: { [exchange: string]: TickerData | null } } = {};

          allTickers.forEach(ticker => {
            result[ticker] = {};

            exchanges.forEach(exchange => {
              const exchangeData = data[exchange as keyof typeof data];

              if (exchangeData && exchangeData[ticker]) {
                const tickerData = exchangeData[ticker];
                result[ticker][exchange] = {
                  price: tickerData.price,
                  fundingRate: tickerData.fundingRate,
                  nextFundingTime: tickerData.nextFundingTime,
                  exchange: exchange
                };
              } else {
                result[ticker][exchange] = null;
              }
            });
          });

          console.log('🎯 getDashboard: результат готов, тикеров:', Object.keys(result).length);

          // Логируем статистику
          const stats: { [exchange: string]: number } = {};
          exchanges.forEach(exchange => {
            stats[exchange] = Object.values(result).filter(ticker => ticker[exchange] !== null).length;
          });
          console.log('📊 getDashboard: статистика по биржам:', stats);

          return result;
        })
    );
  }

  /**
   * GET /api/funding/all
   * Получает данные со всех бирж
   */
  @Get('all')
  getAllFundingData(): Observable<AggregatedNormalizedData> {
    return this.exchangeAggregatorService.getAllNormalizedData();
  }

  /**
   * GET /api/funding/okx-test
   * Тестирует только OKX API
   */
  @Get('okx-test')
  async testOKX(): Promise<any> {
    try {
      const data = await this.okxService.getFundingData();
      return {
        success: true,
        timestamp: new Date().toISOString(),
        tickersCount: Object.keys(data).length,
        sampleTickers: Object.keys(data).slice(0, 10),
        data: Object.fromEntries(Object.entries(data).slice(0, 5))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GET /api/funding/arbitrage?minDelta=0.001
   * Получает арбитражные возможности
   */
  @Get('arbitrage')
  getArbitrageOpportunities(@Query('minDelta') minDelta?: string): Observable<any[]> {
    const minDeltaValue = minDelta ? parseFloat(minDelta) : 0.001;
    return this.exchangeAggregatorService.getArbitrageOpportunities(minDeltaValue);
  }

  /**
   * GET /api/funding/health
   * Проверяет здоровье всех API бирж
   */
  @Get('health')
  checkApisHealth(): Observable<{[exchange: string]: boolean}> {
    return this.exchangeAggregatorService.getAllNormalizedData().pipe(
      map(data => ({
        binance: Object.keys(data.binance).length > 0,
        bybit: Object.keys(data.bybit).length > 0,
        bitget: Object.keys(data.bitget).length > 0,
        bingx: Object.keys(data.bingx).length > 0,
        bitmex: Object.keys(data.bitmex).length > 0,
        okx: Object.keys(data.okx).length > 0,
      }))
    );
  }

  /**
   * GET /api/funding/stats
   * Получает статистику по биржам
   */
  @Get('stats')
  getStats(): Observable<any> {
    return this.exchangeAggregatorService.getAllNormalizedData().pipe(
      map(data => ({
        timestamp: new Date().toISOString(),
        exchanges: {
          binance: {
            name: 'Binance',
            tickersCount: Object.keys(data.binance).length,
            status: 'active'
          },
          bybit: {
            name: 'Bybit', 
            tickersCount: Object.keys(data.bybit).length,
            status: 'active'
          },
          bitget: {
            name: 'BitGet',
            tickersCount: Object.keys(data.bitget).length,
            status: 'active'
          },
          bingx: {
            name: 'BingX',
            tickersCount: Object.keys(data.bingx).length,
            status: 'active'
          },
          bitmex: {
            name: 'BitMEX',
            tickersCount: Object.keys(data.bitmex).length,
            status: 'active'
          },
          okx: {
            name: 'OKX',
            tickersCount: Object.keys(data.okx).length,
            status: 'active'
          }
        },
        totalUniqueTokens: new Set([
          ...Object.keys(data.binance),
          ...Object.keys(data.bybit),
          ...Object.keys(data.bitget),
          ...Object.keys(data.bingx),
          ...Object.keys(data.bitmex),
          ...Object.keys(data.okx)
        ]).size
      }))
    );
  }

  /**
   * GET /api/funding/deltaPotentialDeals?minDelta=0.001
   * Поиск арбитражных возможностей на основе разницы funding rates
   */
  @Get('deltaPotentialDeals')
  getDeltaPotentialDeals(@Query('minDelta') minDelta?: string): Observable<any[]> {
    const minDeltaValue = minDelta ? parseFloat(minDelta) : 0.001;
    
    return this.exchangeAggregatorService.getAllNormalizedData().pipe(
      map(data => {
        console.log('🔍 deltaPotentialDeals: начинаем поиск потенциальных сделок, minDelta:', minDeltaValue);
        
        // Преобразуем данные в формат { тикер: { биржа: данные } }
        const tickersByExchange: {[ticker: string]: {[exchange: string]: any}} = {};
        
        Object.entries(data).forEach(([exchangeName, exchangeData]) => {
          Object.entries(exchangeData).forEach(([ticker, tickerData]: [string, any]) => {
            if (!tickersByExchange[ticker]) {
              tickersByExchange[ticker] = {};
            }
            tickersByExchange[ticker][exchangeName] = tickerData;
          });
        });
        
        const potentialDeals: any[] = [];
        
        // Ищем дельту между funding rates
        Object.entries(tickersByExchange).forEach(([ticker, exchanges]) => {
          const exchangeNames = Object.keys(exchanges);
          
          // Нужно минимум 2 биржи для сравнения
          if (exchangeNames.length < 2) return;
          
          const fundingRates = exchangeNames.map(exchangeName => ({
            exchange: exchangeName,
            rate: exchanges[exchangeName].fundingRate,
            data: exchanges[exchangeName]
          })).filter(item => item.rate !== null && item.rate !== undefined);
          
          if (fundingRates.length < 2) return;
          
          // Находим min и max funding rates
          const sortedRates = fundingRates.sort((a, b) => a.rate - b.rate);
          const minFunding = sortedRates[0];
          const maxFunding = sortedRates[sortedRates.length - 1];
          
          const delta = Math.abs(maxFunding.rate - minFunding.rate);
          
          // Фильтруем по минимальной дельте
          if (delta >= minDeltaValue) {
            potentialDeals.push({
              ticker,
              delta,
              deltaPercent: (delta * 100).toFixed(4) + '%',
              exchangesCount: exchangeNames.length,
              minFunding: {
                exchange: minFunding.exchange,
                rate: minFunding.rate,
                ratePercent: (minFunding.rate * 100).toFixed(4) + '%',
                price: minFunding.data.price,
                nextFundingTime: minFunding.data.nextFundingTime
              },
              maxFunding: {
                exchange: maxFunding.exchange,
                rate: maxFunding.rate,
                ratePercent: (maxFunding.rate * 100).toFixed(4) + '%',
                price: maxFunding.data.price,
                nextFundingTime: maxFunding.data.nextFundingTime
              },
              allExchanges: Object.fromEntries(
                exchangeNames.map(name => [name, exchanges[name] || null])
              ),
              strategy: {
                action: 'Арбитраж funding rates',
                longExchange: minFunding.exchange,
                shortExchange: maxFunding.exchange,
                expectedProfit: (delta * 100).toFixed(4) + '% за период funding',
                riskLevel: delta > 0.01 ? 'Высокий' : delta > 0.005 ? 'Средний' : 'Низкий'
              }
            });
          }
        });
        
        // Сортируем по убыванию дельты
        const sortedDeals = potentialDeals.sort((a, b) => b.delta - a.delta);
        
        console.log('✅ deltaPotentialDeals: найдено сделок:', sortedDeals.length);
        return sortedDeals;
      })
    );
  }

  /**
   * GET /api/funding/timeShiftPotentialDeals?minDelta=0.001
   * Поиск арбитражных возможностей на основе разного времени выплат
   */
  @Get('timeShiftPotentialDeals')
  getTimeShiftPotentialDeals(@Query('minDelta') minDelta?: string): Observable<any[]> {
    const minDeltaValue = minDelta ? parseFloat(minDelta) : 0.001;
    
    return this.exchangeAggregatorService.getAllNormalizedData().pipe(
      map(data => {
        console.log('🕒 timeShiftPotentialDeals: начинаем поиск временных арбитражей, minDelta:', minDeltaValue);
        
        // Преобразуем данные в формат { тикер: { биржа: данные } }
        const tickersByExchange: {[ticker: string]: {[exchange: string]: any}} = {};
        
        Object.entries(data).forEach(([exchangeName, exchangeData]) => {
          Object.entries(exchangeData).forEach(([ticker, tickerData]: [string, any]) => {
            if (!tickersByExchange[ticker]) {
              tickersByExchange[ticker] = {};
            }
            tickersByExchange[ticker][exchangeName] = tickerData;
          });
        });
        
        const timeShiftDeals: any[] = [];
        
        // Ищем разницу во времени выплат
        Object.entries(tickersByExchange).forEach(([ticker, exchanges]) => {
          const exchangeNames = Object.keys(exchanges);
          
          // Нужно минимум 2 биржи для сравнения
          if (exchangeNames.length < 2) return;
          
          const fundingTimes = exchangeNames.map(exchangeName => ({
            exchange: exchangeName,
            time: exchanges[exchangeName].nextFundingTime,
            rate: exchanges[exchangeName].fundingRate,
            data: exchanges[exchangeName]
          })).filter(item => 
            item.time !== null && 
            item.time !== undefined && 
            item.rate !== null && 
            item.rate !== undefined
          );
          
          if (fundingTimes.length < 2) return;
          
          // Сортируем по времени
          const sortedTimes = fundingTimes.sort((a, b) => a.time - b.time);
          const earliestPayout = sortedTimes[0];
          const latestPayout = sortedTimes[sortedTimes.length - 1];
          
          // Вычисляем разность времени в минутах
          const timeDifferenceMs = latestPayout.time - earliestPayout.time;
          const timeDifferenceMinutes = timeDifferenceMs / (1000 * 60);
          
          // Фильтруем по времени (минимум 30 минут разности)
          if (timeDifferenceMinutes < 30) return;
          
          // Вычисляем дельту funding rates
          const fundingRates = fundingTimes.map(item => item.rate);
          const minRate = Math.min(...fundingRates);
          const maxRate = Math.max(...fundingRates);
          const delta = Math.abs(maxRate - minRate);
          
          // Фильтруем по минимальной дельте
          if (delta >= minDeltaValue) {
            timeShiftDeals.push({
              ticker,
              delta,
              deltaPercent: (delta * 100).toFixed(4) + '%',
              exchangesCount: exchangeNames.length,
              timeDifference: {
                minutes: Math.round(timeDifferenceMinutes),
                hours: (timeDifferenceMinutes / 60).toFixed(2),
                earliestPayout: {
                  exchange: earliestPayout.exchange,
                  time: earliestPayout.time,
                  timeFormatted: new Date(earliestPayout.time).toLocaleString('ru-RU'),
                  fundingRate: earliestPayout.rate,
                  fundingRatePercent: (earliestPayout.rate * 100).toFixed(4) + '%'
                },
                latestPayout: {
                  exchange: latestPayout.exchange,
                  time: latestPayout.time,
                  timeFormatted: new Date(latestPayout.time).toLocaleString('ru-RU'),
                  fundingRate: latestPayout.rate,
                  fundingRatePercent: (latestPayout.rate * 100).toFixed(4) + '%'
                }
              },
              fundingRates: {
                min: {
                  exchange: fundingTimes.find(item => item.rate === minRate)?.exchange,
                  rate: minRate,
                  ratePercent: (minRate * 100).toFixed(4) + '%'
                },
                max: {
                  exchange: fundingTimes.find(item => item.rate === maxRate)?.exchange,
                  rate: maxRate,
                  ratePercent: (maxRate * 100).toFixed(4) + '%'
                }
              },
              allExchanges: Object.fromEntries(
                exchangeNames.map(name => [name, exchanges[name] || null])
              ),
              strategy: {
                action: 'Арбитраж по времени выплат',
                description: 'Разные времена выплат позволяют получить funding несколько раз',
                opportunity: `${Math.round(timeDifferenceMinutes)} минут между выплатами`,
                expectedProfit: `${(delta * 100).toFixed(4)}% разница в funding rates`,
                riskLevel: delta > 0.01 ? 'Высокий' : delta > 0.005 ? 'Средний' : 'Низкий',
                timeWindow: `${(timeDifferenceMinutes / 60).toFixed(1)} часов между выплатами`
              }
            });
          }
        });
        
        // Сортируем по убыванию временной дельты
        const sortedDeals = timeShiftDeals.sort((a, b) => b.timeDifference.minutes - a.timeDifference.minutes);
        
        console.log('✅ timeShiftPotentialDeals: найдено временных арбитражей:', sortedDeals.length);
        return sortedDeals;
      })
    );
  }
}

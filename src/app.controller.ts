import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getApiInfo() {
    return {
      name: 'Funding Rates Aggregator API',
      version: '1.0.0',
      description: 'API для агрегации funding rates с криптовалютных бирж',
      endpoints: {
        'GET /': 'Информация об API',
        'GET /api/funding/all': 'Данные со всех бирж',
        'GET /api/funding/summaries': 'Сводная таблица по тикерам',
        'GET /api/funding/arbitrage?minDelta=0.001': 'Арбитражные возможности',
        'GET /api/funding/different-payout-times?fundingAbsFilter=0.2': 'Разное время выплат',
        'GET /api/funding/health': 'Здоровье API всех бирж',
        'GET /api/funding/stats': 'Статистика по биржам'
      },
      exchanges: ['Binance', 'Bybit', 'BitGet', 'MEXC', 'OKX'],
      timestamp: new Date().toISOString()
    };
  }

  @Get('hello')
  getHello(): string {
    return this.appService.getHello();
  }
}

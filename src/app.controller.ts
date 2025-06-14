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
        'GET /health': 'Проверка здоровья сервиса',
        'GET /api/funding/getData': 'Данные со всех бирж в структурированном формате',
        'GET /api/funding/all': 'Данные со всех бирж (старый формат)',
        'GET /api/funding/summaries': 'Сводная таблица по тикерам',
        'GET /api/funding/arbitrage?minDelta=0.001': 'Арбитражные возможности',
        'GET /api/funding/different-payout-times?fundingAbsFilter=0.2': 'Разное время выплат',
        'GET /api/funding/health': 'Здоровье API всех бирж',
        'GET /api/funding/stats': 'Статистика по биржам'
      },
      exchanges: ['Binance', 'Bybit', 'BitGet', 'MEXC', 'BingX'],
      timestamp: new Date().toISOString()
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    };
  }

  @Get('hello')
  getHello(): string {
    return this.appService.getHello();
  }
}

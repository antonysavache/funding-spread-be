import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Включаем CORS для фронтенда
  app.enableCors({
    origin: ['http://localhost:4200', 'http://localhost:4201', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Включаем валидацию
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  // Добавляем глобальный префикс для API
  app.setGlobalPrefix('');

  const port = process.env.PORT ?? 3001;
  
  await app.listen(port);
  
  console.log(`🚀 Funding Rates API запущен на порту ${port}`);
  console.log(`📊 Доступные эндпоинты:`);
  console.log(`   GET http://localhost:${port}/ - Информация об API`);
  console.log(`   GET http://localhost:${port}/api/funding/all - Все данные`);
  console.log(`   GET http://localhost:${port}/api/funding/summaries - Сводная таблица`);
  console.log(`   GET http://localhost:${port}/api/funding/arbitrage - Арбитражные возможности`);
  console.log(`   GET http://localhost:${port}/api/funding/different-payout-times - Разное время выплат`);
  console.log(`   GET http://localhost:${port}/api/funding/health - Здоровье API`);
  console.log(`   GET http://localhost:${port}/api/funding/stats - Статистика`);
}
bootstrap();

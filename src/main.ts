import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });
  
  // Включаем CORS
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Включаем валидацию
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  const port = process.env.PORT || 3020;
  
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 Funding Rates API запущен на порту ${port}`);
  console.log(`🌐 Health check: http://localhost:${port}/health`);
}

bootstrap().catch(err => {
  console.error('❌ Ошибка запуска приложения:', err);
  process.exit(1);
});

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Включаем CORS для фронтенда
  app.enableCors({
    origin: true, // Разрешаем все домены для Vercel
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Включаем валидацию
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  const port = process.env.PORT || 3000;
  
  await app.listen(port);
  
  console.log(`🚀 Funding Rates API запущен на порту ${port}`);
}

// Для Vercel экспортируем приложение
if (process.env.VERCEL) {
  module.exports = bootstrap;
} else {
  bootstrap();
}

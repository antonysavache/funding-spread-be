import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

export async function createApp() {
  try {
    const server = express();
    
    const app = await NestFactory.create(
      AppModule, 
      new ExpressAdapter(server),
      {
        logger: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['log', 'error', 'warn', 'debug'],
        abortOnError: false, // Не останавливаем при ошибках инициализации
      }
    );
    
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
      forbidNonWhitelisted: false,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }));

    await app.init();
    return server;
  } catch (error) {
    console.error('❌ Ошибка создания приложения:', error);
    throw error;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Включаем CORS для фронтенда
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

  const port = process.env.PORT || 3006;
  
  await app.listen(port);
  
  console.log(`🚀 Funding Rates API запущен на порту ${port}`);
}

// Для локальной разработки
if (require.main === module) {
  bootstrap();
}

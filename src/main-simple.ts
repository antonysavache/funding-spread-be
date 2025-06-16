import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    console.log('🚀 Запускаем приложение...');
    
    const app = await NestFactory.create(AppModule, {
      logger: ['log', 'error', 'warn'],
    });
    
    app.enableCors();
    
    const port = process.env.PORT || 3000;
    console.log(`📡 Слушаем порт: ${port}`);
    
    await app.listen(port, '0.0.0.0');
    
    console.log(`✅ Приложение запущено на порту ${port}`);
  } catch (error) {
    console.error('❌ Ошибка запуска:', error);
    process.exit(1);
  }
}

bootstrap();

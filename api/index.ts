import { createApp } from '../src/main';

let cachedApp: any = null;

export default async function handler(req: any, res: any) {
  try {
    // Используем кешированное приложение для уменьшения cold start
    if (!cachedApp) {
      console.log('🚀 Инициализация NestJS приложения...');
      cachedApp = await createApp();
      console.log('✅ NestJS приложение инициализировано');
    }
    
    // Устанавливаем CORS заголовки для preflight запросов
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');
      return res.status(200).end();
    }

    return cachedApp(req, res);
  } catch (error) {
    console.error('❌ Ошибка в обработчике Vercel:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

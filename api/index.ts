// Простая тестовая версия без NestJS
export default async function handler(req: any, res: any) {
  try {
    console.log('🚀 API вызван:', req.method, req.url);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Простые роуты
    if (req.url === '/' || req.url === '/api') {
      return res.status(200).json({
        name: 'Funding Rates API',
        message: 'API работает на Vercel!',
        timestamp: new Date().toISOString(),
        endpoints: [
          'GET /',
          'GET /health', 
          'GET /test'
        ]
      });
    }
    
    if (req.url === '/health') {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        platform: 'vercel'
      });
    }

    if (req.url === '/test') {
      return res.status(200).json({
        message: 'Test endpoint works!',
        timestamp: new Date().toISOString()
      });
    }

    // 404 для остальных
    return res.status(404).json({
      error: 'Endpoint not found',
      url: req.url,
      availableEndpoints: ['/', '/health', '/test']
    });
    
  } catch (error) {
    console.error('❌ Ошибка в API:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

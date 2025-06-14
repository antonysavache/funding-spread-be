const axios = require('axios');

async function testAPI() {
  try {
    console.log('🧪 Тестируем API...');

    // Тест корневого эндпоинта
    const rootResponse = await axios.get('http://localhost:3000');
    console.log('✅ Корневой эндпоинт:', rootResponse.data);

    // Тест health check
    const healthResponse = await axios.get('http://localhost:3000/health');
    console.log('✅ Health check:', healthResponse.data);

    // Тест funding stats
    const statsResponse = await axios.get('http://localhost:3000/api/funding/stats');
    console.log('✅ Funding stats:', statsResponse.data);

    // Тест health эндпоинта funding API
    const fundingHealthResponse = await axios.get('http://localhost:3000/api/funding/health');
    console.log('✅ Funding health:', fundingHealthResponse.data);

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    }
  }
}

testAPI();

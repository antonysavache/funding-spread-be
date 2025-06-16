import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ProxyService {
  // Альтернативные endpoint'ы для обхода блокировок Vercel
  
  async getBinanceDataViaProxy(endpoint: string): Promise<any> {
    // Можно использовать CORS-anywhere или другие прокси сервисы
    const proxyUrl = `https://cors-anywhere.herokuapp.com/https://fapi.binance.com${endpoint}`;
    
    try {
      const response = await axios.get(proxyUrl, {
        timeout: 15000,
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://your-app.vercel.app'
        }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Proxy Binance error:', error.message);
      throw error;
    }
  }

  async getBybitDataViaProxy(endpoint: string): Promise<any> {
    const proxyUrl = `https://cors-anywhere.herokuapp.com/https://api.bybit.com${endpoint}`;
    
    try {
      const response = await axios.get(proxyUrl, {
        timeout: 15000,
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://your-app.vercel.app'
        }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Proxy Bybit error:', error.message);
      throw error;
    }
  }
}

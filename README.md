# 🚀 Funding Rates Aggregator API

Мощный NestJS API для агрегации funding rates с 5 крупнейших криптовалютных бирж.

## 🔥 Возможности

- **5 бирж**: Binance, Bybit, BitGet, MEXC, OKX
- **Реальное время**: Живые данные о funding rates
- **Арбитраж**: Поиск возможностей для арбитража
- **Фильтрация**: Настраиваемые фильтры по дельте и времени
- **REST API**: Простые HTTP endpoints
- **CORS**: Поддержка фронтенда

## 📊 API Endpoints

### Основные данные
```bash
GET /                              # Информация об API
GET /api/funding/all              # Данные со всех бирж
GET /api/funding/summaries        # Сводная таблица по тикерам
```

### Арбитражные возможности
```bash
GET /api/funding/arbitrage                    # Все арбитражные возможности
GET /api/funding/arbitrage?minDelta=0.001    # Фильтр по минимальной дельте (%)
```

### Разное время выплат
```bash
GET /api/funding/different-payout-times                         # Все с разным временем
GET /api/funding/different-payout-times?fundingAbsFilter=0.2   # Фильтр по абс. значению фандинга (%)
```

### Мониторинг
```bash
GET /api/funding/health          # Здоровье API всех бирж
GET /api/funding/stats           # Статистика по биржам
```

## 🛠 Установка и запуск

### 1. Установка зависимостей
```bash
npm install
```

### 2. Запуск в режиме разработки
```bash
npm run start:dev
```

### 3. Запуск в продакшене
```bash
npm run build
npm run start:prod
```

## 📝 Примеры использования

### JavaScript/TypeScript
```javascript
// Получить все арбитражные возможности с дельтой больше 0.01%
const response = await fetch('http://localhost:3000/api/funding/arbitrage?minDelta=0.01');
const arbitrage = await response.json();

console.log(`Найдено ${arbitrage.length} арбитражных возможностей`);
arbitrage.forEach(ticker => {
  console.log(`${ticker.ticker}: дельта ${(ticker.fundingRateDiff * 100).toFixed(4)}%`);
});
```

### curl
```bash
# Проверить здоровье API
curl http://localhost:3000/api/funding/health

# Получить статистику
curl http://localhost:3000/api/funding/stats

# Арбитражные возможности с минимальной дельтой 0.005%
curl "http://localhost:3000/api/funding/arbitrage?minDelta=0.005"
```

## 🏗 Архитектура

```
src/
├── adapters/           # Нормализация данных бирж
│   ├── binance.adapter.ts
│   ├── bybit.adapter.ts
│   ├── bitget.adapter.ts
│   ├── mexc.adapter.ts
│   ├── okx.adapter.ts
│   └── normalized-ticker.interface.ts
├── services/           # Сервисы для работы с API бирж
│   ├── binance.service.ts
│   ├── bybit.service.ts
│   ├── bitget.service.ts
│   ├── mexc.service.ts
│   ├── okx.service.ts
│   └── exchange-aggregator.service.ts
├── controllers/        # REST API контроллеры
│   └── funding.controller.ts
├── dto/               # Data Transfer Objects
│   └── funding.dto.ts
└── main.ts            # Точка входа
```

## 🔧 Конфигурация

### Переменные окружения
```env
PORT=3000                    # Порт сервера (по умолчанию 3000)
NODE_ENV=development         # Окружение (development/production)
```

### CORS
API настроен для работы с фронтендами на портах:
- `http://localhost:4200` (Angular)
- `http://localhost:4201` 
- `http://localhost:3000`

## 📈 Форматы данных

### TickerSummary
```typescript
{
  ticker: string;                    // Название тикера (например, "BTC")
  exchanges: {
    binance: {
      price: number;                 // Цена mark price
      fundingRate: number;           // Funding rate в долях (0.0001 = 0.01%)
      nextFundingTime: number;       // Timestamp следующей выплаты
    } | null,
    // ... другие биржи
  };
  minFundingRate: number | null;     // Минимальный funding rate
  maxFundingRate: number | null;     // Максимальный funding rate  
  fundingRateDiff: number | null;    // Разность (макс - мин)
}
```

## 🚀 Фичи

- **Параллельная загрузка**: Данные с всех бирж загружаются одновременно
- **Обработка ошибок**: Если одна биржа недоступна, остальные продолжают работать
- **Фильтрация**: Настраиваемые фильтры по всем параметрам
- **Логирование**: Подробные логи для отладки
- **Типизация**: Полная типизация TypeScript
- **Валидация**: Автоматическая валидация входных параметров

## 🔗 Интеграция с фронтендом

API готов для интеграции с любым фронтендом (React, Vue, Angular, etc.):

```javascript
// Подключение к WebSocket (для будущих обновлений)
const ws = new WebSocket('ws://localhost:3000/ws/funding');

// REST API запросы
const api = {
  getAllData: () => fetch('/api/funding/all').then(r => r.json()),
  getArbitrage: (minDelta) => fetch(`/api/funding/arbitrage?minDelta=${minDelta}`).then(r => r.json()),
  getStats: () => fetch('/api/funding/stats').then(r => r.json())
};
```

## 🤝 Contributing

1. Fork репозиторий
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Создайте Pull Request

## 📄 Лицензия

MIT License. См. [LICENSE](LICENSE) для деталей.

---

**🎯 Готово к продакшену!** Запускайте и получайте данные о funding rates в реальном времени! 🚀
# funding-spread-be

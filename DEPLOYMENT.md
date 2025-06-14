# 🚀 Деплой на Vercel

## Проблемы, которые были решены:

### 1. ❌ EADDRINUSE: address already in use :::3000
**Проблема:** NestJS пытался слушать порт 3000 в serverless окружении
**Решение:** Создали отдельный файл `api/index.ts` для Vercel с правильной структурой

### 2. ❌ Vercel Runtime Timeout Error: Task timed out after 60 seconds
**Проблема:** Долгая инициализация приложения
**Решение:** 
- Кеширование приложения между запросами
- Оптимизация логирования для production
- Увеличение памяти до 1024MB

## 📁 Структура файлов для Vercel:

```
├── api/
│   └── index.ts          # Entry point для Vercel
├── src/
│   ├── main.ts           # Основной файл NestJS
│   └── ...              # Остальные файлы приложения
├── vercel.json          # Конфигурация Vercel
└── package.json         # Зависимости
```

## 🛠 Команды для деплоя:

1. **Установка Vercel CLI** (если не установлен):
   ```bash
   npm i -g vercel
   ```

2. **Локальная разработка с Vercel**:
   ```bash
   npm run vercel:dev
   ```

3. **Деплой на Vercel**:
   ```bash
   vercel --prod
   ```

## 🔧 Настройки в vercel.json:

- **maxDuration**: 30 секунд (максимум для serverless функций)
- **memory**: 1024MB (для быстрой инициализации)
- **regions**: ["iad1"] (США, восточное побережье)

## 📊 Endpoints после деплоя:

- `GET /` - Информация об API
- `GET /health` - Проверка здоровья
- `GET /api/funding/all` - Все данные
- `GET /api/funding/summaries` - Сводка
- `GET /api/funding/arbitrage` - Арбитраж
- `GET /api/funding/stats` - Статистика

## 🐛 Отладка:

1. **Проверьте логи Vercel**:
   ```bash
   vercel logs [deployment-url]
   ```

2. **Тест локально**:
   ```bash
   npm run start:dev
   curl http://localhost:3000/health
   ```

3. **Тест на Vercel**:
   ```bash
   curl https://your-deployment.vercel.app/health
   ```

## ⚡ Оптимизации:

- ✅ Кеширование приложения между запросами
- ✅ Минимальное логирование в production
- ✅ Обработка ошибок CORS
- ✅ Graceful error handling
- ✅ Исключение тестовых файлов из сборки

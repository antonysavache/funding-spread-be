import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FundingController } from './controllers/funding.controller';
import { BinanceService } from './services/binance.service';
import { BybitService } from './services/bybit.service';
import { BitGetService } from './services/bitget.service';
import { BingXService } from './services/bingx.service';
import { BitMEXService } from './services/bitmex.service';
import { OKXService } from './services/okx.service';
import { ExchangeAggregatorService } from './services/exchange-aggregator.service';

@Module({
  imports: [],
  controllers: [AppController, FundingController],
  providers: [
    AppService,
    BinanceService,
    BybitService,
    BitGetService,
    BingXService,
    BitMEXService,
    OKXService,
    ExchangeAggregatorService,
  ],
})
export class AppModule {}

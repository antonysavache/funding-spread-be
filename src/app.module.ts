import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FundingController } from './controllers/funding.controller';
import { BinanceService } from './services/binance.service';
import { BybitService } from './services/bybit.service';
import { BitGetService } from './services/bitget.service';
import { MexcService } from './services/mexc.service';
import { BingXService } from './services/bingx.service';
import { ExchangeAggregatorService } from './services/exchange-aggregator.service';

@Module({
  imports: [],
  controllers: [AppController, FundingController],
  providers: [
    AppService,
    BinanceService,
    BybitService,
    BitGetService,
    MexcService,
    BingXService,
    ExchangeAggregatorService,
  ],
})
export class AppModule {}

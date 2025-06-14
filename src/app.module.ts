import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FundingController } from './controllers/funding.controller';
import { BinanceService } from './services/binance.service';
import { BybitService } from './services/bybit.service';
import { BitgetService } from './services/bitget.service';
import { MexcService } from './services/mexc.service';
import { OkxService } from './services/okx.service';
import { ExchangeAggregatorService } from './services/exchange-aggregator.service';

@Module({
  imports: [],
  controllers: [AppController, FundingController],
  providers: [
    AppService,
    BinanceService,
    BybitService,
    BitgetService,
    MexcService,
    OkxService,
    ExchangeAggregatorService,
  ],
})
export class AppModule {}

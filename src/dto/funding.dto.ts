import { IsOptional, IsString, IsNumber } from 'class-validator';

export class ArbitrageQueryDto {
  @IsOptional()
  @IsString()
  minDelta?: string;
}

export class PayoutTimesQueryDto {
  @IsOptional()
  @IsString()
  fundingAbsFilter?: string;
}

export class ExchangeDataDto {
  price: number;
  fundingRate: number;
  nextFundingTime: number;
}

export class TickerSummaryDto {
  ticker: string;
  exchanges: {
    [exchangeName: string]: ExchangeDataDto | null;
  };
  minFundingRate: number | null;
  maxFundingRate: number | null;
  fundingRateDiff: number | null;
}

export class AggregatedDataDto {
  binance: { [ticker: string]: ExchangeDataDto };
  bybit: { [ticker: string]: ExchangeDataDto };
  bitget: { [ticker: string]: ExchangeDataDto };
  bingx: { [ticker: string]: ExchangeDataDto };
  bitmex: { [ticker: string]: ExchangeDataDto };
  okx: { [ticker: string]: ExchangeDataDto };
}

export class StatsDto {
  timestamp: string;
  exchanges: {
    [exchangeName: string]: {
      name: string;
      tickersCount: number;
      status: string;
    };
  };
  totalUniqueTokens: number;
}

export class HealthCheckDto {
  [exchange: string]: boolean;
}

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ExchangeClient, InfoClient } from '@nktkas/hyperliquid';
import type { SymbolConverter } from '@nktkas/hyperliquid/utils';
import { TradeExecutor } from './executor.js';
import type { AccountSummary, PositionInfo, TradeDecision } from './types.js';

const SLIPPAGE = 0.03;
const BTC_MID = 50_000;
const BTC_ASSET_ID = 3;
const SZ_DECIMALS = 3;

type ExchangeMock = {
  order: ReturnType<typeof vi.fn>;
  updateLeverage: ReturnType<typeof vi.fn>;
};
type InfoMock = { allMids: ReturnType<typeof vi.fn> };
type ConverterMock = {
  getAssetId: ReturnType<typeof vi.fn>;
  getSzDecimals: ReturnType<typeof vi.fn>;
};

const successStatus = () => ({
  response: { data: { statuses: [{ resting: { oid: 1 } }] } },
});

const errorStatus = (error: string) => ({
  response: { data: { statuses: [{ error }] } },
});

const makeDecision = (overrides: Partial<TradeDecision> = {}): TradeDecision => ({
  coin: 'BTC',
  action: 'LONG',
  sizeUsd: 1000,
  leverage: 5,
  reasoning: 'test',
  tp: null,
  sl: null,
  ...overrides,
});

const makePosition = (overrides: Partial<PositionInfo> = {}): PositionInfo => ({
  coin: 'BTC',
  side: 'long',
  size: 0.02,
  entryPrice: 49_000,
  pnl: 0,
  leverage: 5,
  liquidationPx: null,
  ...overrides,
});

const makeAccount = (positions: PositionInfo[] = []): AccountSummary => ({
  spotBalances: [],
  accountValue: 10_000,
  marginUsed: 0,
  withdrawable: 10_000,
  positions,
});

describe('TradeExecutor', () => {
  let exchange: ExchangeMock;
  let info: InfoMock;
  let converter: ConverterMock;
  let executor: TradeExecutor;

  beforeEach(() => {
    exchange = {
      order: vi.fn().mockResolvedValue(successStatus()),
      updateLeverage: vi.fn().mockResolvedValue(undefined),
    };
    info = {
      allMids: vi.fn().mockResolvedValue({ BTC: String(BTC_MID) }),
    };
    converter = {
      getAssetId: vi.fn().mockReturnValue(BTC_ASSET_ID),
      getSzDecimals: vi.fn().mockReturnValue(SZ_DECIMALS),
    };
    executor = new TradeExecutor(
      exchange as unknown as ExchangeClient,
      info as unknown as InfoClient,
      converter as unknown as SymbolConverter,
    );
  });

  describe('executeMarketOpen', () => {
    it('returns failure when asset is unknown and does not call exchange', async () => {
      converter.getAssetId.mockReturnValue(undefined);

      const result = await executor.execute(makeDecision(), makeAccount());

      expect(result).toEqual({
        coin: 'BTC',
        action: 'LONG',
        success: false,
        details: 'Unknown asset',
      });
      expect(exchange.updateLeverage).not.toHaveBeenCalled();
      expect(exchange.order).not.toHaveBeenCalled();
    });

    it('returns failure when allMids is missing the coin', async () => {
      info.allMids.mockResolvedValue({ ETH: '2000' });

      const result = await executor.execute(makeDecision(), makeAccount());

      expect(result.success).toBe(false);
      expect(result.details).toBe('Failed to fetch order book');
      expect(exchange.order).not.toHaveBeenCalled();
    });

    it('returns failure when szDecimals is nil', async () => {
      converter.getSzDecimals.mockReturnValue(undefined);

      const result = await executor.execute(makeDecision(), makeAccount());

      expect(result.success).toBe(false);
      expect(result.details).toBe('Failed to fetch order book');
      expect(exchange.order).not.toHaveBeenCalled();
    });

    it('opens a LONG with no TP/SL: single market order, updates leverage', async () => {
      const decision = makeDecision({ action: 'LONG', sizeUsd: 1000, leverage: 5 });

      const result = await executor.execute(decision, makeAccount());

      expect(exchange.updateLeverage).toHaveBeenCalledWith({
        asset: BTC_ASSET_ID,
        isCross: true,
        leverage: 5,
      });
      expect(exchange.order).toHaveBeenCalledTimes(1);

      const payload = exchange.order.mock.calls[0][0];
      expect(payload.grouping).toBe('na');
      expect(payload.orders).toHaveLength(1);

      const [entry] = payload.orders;
      expect(entry.a).toBe(BTC_ASSET_ID);
      expect(entry.b).toBe(true);
      expect(entry.r).toBe(false);
      expect(entry.t).toEqual({ limit: { tif: 'FrontendMarket' } });

      const expectedEntry = BTC_MID * (1 + SLIPPAGE);
      expect(Number(entry.p)).toBeCloseTo(expectedEntry, 0);
      expect(Number(entry.s)).toBeCloseTo(1000 / expectedEntry, 3);

      expect(result.success).toBe(true);
      expect(result.action).toBe('LONG');
      expect(result.details).toContain('5x');
      expect(result.details).toContain('SL -');
      expect(result.details).toContain('TP -');
    });

    it('opens a SHORT with TP and SL: three orders, normalTpsl grouping, correct trigger sides', async () => {
      const decision = makeDecision({
        action: 'SHORT',
        sizeUsd: 1000,
        leverage: 10,
        sl: 20, // PnL %
        tp: 50, // PnL %
      });

      const result = await executor.execute(decision, makeAccount());

      expect(exchange.order).toHaveBeenCalledTimes(1);
      const payload = exchange.order.mock.calls[0][0];
      expect(payload.grouping).toBe('normalTpsl');
      expect(payload.orders).toHaveLength(3);

      const [entry, sl, tp] = payload.orders;

      // Entry: sell, market limit
      const expectedEntry = BTC_MID * (1 - SLIPPAGE);
      expect(entry.b).toBe(false);
      expect(entry.r).toBe(false);
      expect(entry.t).toEqual({ limit: { tif: 'FrontendMarket' } });
      expect(Number(entry.p)).toBeCloseTo(expectedEntry, 0);

      // SL: for a short, trigger is ABOVE entry; reduce-only buy
      const slMovePct = 20 / 10 / 100; // 0.02
      const expectedSlTrigger = expectedEntry * (1 + slMovePct);
      const expectedSlLimit = expectedSlTrigger * (1 + SLIPPAGE);
      expect(sl.b).toBe(true);
      expect(sl.r).toBe(true);
      expect(sl.t.trigger.isMarket).toBe(true);
      expect(sl.t.trigger.tpsl).toBe('sl');
      expect(Number(sl.t.trigger.triggerPx)).toBeCloseTo(expectedSlTrigger, 0);
      expect(Number(sl.p)).toBeCloseTo(expectedSlLimit, 0);

      // TP: for a short, trigger is BELOW entry; reduce-only buy
      const tpMovePct = 50 / 10 / 100; // 0.05
      const expectedTpTrigger = expectedEntry * (1 - tpMovePct);
      const expectedTpLimit = expectedTpTrigger * (1 + SLIPPAGE);
      expect(tp.b).toBe(true);
      expect(tp.r).toBe(true);
      expect(tp.t.trigger.tpsl).toBe('tp');
      expect(Number(tp.t.trigger.triggerPx)).toBeCloseTo(expectedTpTrigger, 0);
      expect(Number(tp.p)).toBeCloseTo(expectedTpLimit, 0);

      expect(result.success).toBe(true);
      expect(result.details).toContain('short');
    });

    it('places TP/SL on the correct sides for a LONG', async () => {
      const decision = makeDecision({
        action: 'LONG',
        leverage: 5,
        sl: 10,
        tp: 30,
      });

      await executor.execute(decision, makeAccount());

      const payload = exchange.order.mock.calls[0][0];
      const [, sl, tp] = payload.orders;
      const expectedEntry = BTC_MID * (1 + SLIPPAGE);

      // For a long, SL trigger is BELOW entry, TP trigger is ABOVE entry
      const slMovePct = 10 / 5 / 100;
      const tpMovePct = 30 / 5 / 100;
      expect(sl.b).toBe(false); // reduce by selling
      expect(tp.b).toBe(false);
      expect(Number(sl.t.trigger.triggerPx)).toBeCloseTo(expectedEntry * (1 - slMovePct), 0);
      expect(Number(tp.t.trigger.triggerPx)).toBeCloseTo(expectedEntry * (1 + tpMovePct), 0);
    });

    it('returns failure when exchange responds with an error status', async () => {
      exchange.order.mockResolvedValue(errorStatus('insufficient margin'));

      const result = await executor.execute(makeDecision(), makeAccount());

      expect(result).toEqual({
        coin: 'BTC',
        action: 'LONG',
        success: false,
        details: 'insufficient margin',
      });
    });

    it('catches thrown errors from exchange.order', async () => {
      exchange.order.mockRejectedValue(new Error('network down'));

      const result = await executor.execute(makeDecision(), makeAccount());

      expect(result.success).toBe(false);
      expect(result.action).toBe('LONG');
      expect(result.details).toContain('network down');
    });
  });

  describe('executeMarketClose', () => {
    it('returns failure when asset is unknown', async () => {
      converter.getAssetId.mockReturnValue(undefined);

      const result = await executor.execute(
        makeDecision({ action: 'CLOSE' }),
        makeAccount([makePosition()]),
      );

      expect(result).toEqual({
        coin: 'BTC',
        action: 'CLOSE',
        success: false,
        details: 'Unknown asset',
      });
      expect(exchange.order).not.toHaveBeenCalled();
    });

    it('returns failure when there is no matching position', async () => {
      const result = await executor.execute(makeDecision({ action: 'CLOSE' }), makeAccount([]));

      expect(result).toEqual({
        coin: 'BTC',
        action: 'CLOSE',
        success: false,
        details: 'No position to close',
      });
      expect(exchange.order).not.toHaveBeenCalled();
    });

    it('returns failure when allMids is missing the coin', async () => {
      info.allMids.mockResolvedValue({ ETH: '2000' });

      const result = await executor.execute(
        makeDecision({ action: 'CLOSE' }),
        makeAccount([makePosition()]),
      );

      expect(result.success).toBe(false);
      expect(result.action).toBe('CLOSE');
      expect(exchange.order).not.toHaveBeenCalled();
    });

    it('closes a LONG position by selling with reduce-only at slippage-adjusted price', async () => {
      const position = makePosition({ side: 'long', size: 0.02 });

      const result = await executor.execute(
        makeDecision({ action: 'CLOSE' }),
        makeAccount([position]),
      );

      expect(exchange.order).toHaveBeenCalledTimes(1);
      const payload = exchange.order.mock.calls[0][0];
      expect(payload.grouping).toBe('na');
      expect(payload.orders).toHaveLength(1);

      const [order] = payload.orders;
      expect(order.a).toBe(BTC_ASSET_ID);
      expect(order.b).toBe(false);
      expect(order.r).toBe(true);
      expect(order.t).toEqual({ limit: { tif: 'FrontendMarket' } });
      expect(Number(order.p)).toBeCloseTo(BTC_MID * (1 - SLIPPAGE), 0);
      expect(Number(order.s)).toBeCloseTo(0.02, 3);

      expect(result).toEqual({
        coin: 'BTC',
        action: 'CLOSE',
        success: true,
        details: 'Closed long position',
      });
    });

    it('closes a SHORT position by buying with reduce-only at slippage-adjusted price', async () => {
      const position = makePosition({ side: 'short', size: 0.05 });

      const result = await executor.execute(
        makeDecision({ action: 'CLOSE' }),
        makeAccount([position]),
      );

      const [order] = exchange.order.mock.calls[0][0].orders;
      expect(order.b).toBe(true);
      expect(order.r).toBe(true);
      expect(Number(order.p)).toBeCloseTo(BTC_MID * (1 + SLIPPAGE), 0);
      expect(Number(order.s)).toBeCloseTo(0.05, 3);

      expect(result.success).toBe(true);
      expect(result.details).toBe('Closed short position');
    });

    it('returns failure when exchange responds with an error status', async () => {
      exchange.order.mockResolvedValue(errorStatus('reduce-only rejected'));

      const result = await executor.execute(
        makeDecision({ action: 'CLOSE' }),
        makeAccount([makePosition()]),
      );

      expect(result).toEqual({
        coin: 'BTC',
        action: 'CLOSE',
        success: false,
        details: 'reduce-only rejected',
      });
    });

    it('catches thrown errors from exchange.order', async () => {
      exchange.order.mockRejectedValue(new Error('boom'));

      const result = await executor.execute(
        makeDecision({ action: 'CLOSE' }),
        makeAccount([makePosition()]),
      );

      expect(result.success).toBe(false);
      expect(result.action).toBe('CLOSE');
      expect(result.details).toContain('boom');
    });
  });
});

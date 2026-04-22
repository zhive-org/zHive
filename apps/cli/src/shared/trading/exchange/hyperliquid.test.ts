import type { ExchangeClient } from '@nktkas/hyperliquid';
import type { SymbolConverter } from '@nktkas/hyperliquid/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HyperliquidService } from '../../hyperliquid/service';
import { AccountSummary, PositionInfo, TradeDecision } from '../types';
import { PositionNotFound, UnSupportedAssetError } from './error';
import { HyperliquidExchange } from './hyperliquid';

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
  asset: 'BTC',
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

describe('HyperliquidExchange', () => {
  let exchange: ExchangeMock;
  let info: InfoMock;
  let converter: ConverterMock;
  let hyperliquid: HyperliquidExchange;

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
    hyperliquid = new HyperliquidExchange(
      '0x123',
      exchange as unknown as ExchangeClient,
      { info } as unknown as HyperliquidService,
      converter as unknown as SymbolConverter,
    );
  });

  describe('create market order', () => {
    it('returns failure when asset is unknown and does not call exchange', async () => {
      converter.getAssetId.mockReturnValue(undefined);

      await expect(hyperliquid.placeOrder(makeDecision())).rejects.toThrow(UnSupportedAssetError);

      expect(exchange.updateLeverage).not.toHaveBeenCalled();
      expect(exchange.order).not.toHaveBeenCalled();
    });

    it('returns failure when allMids is missing the coin', async () => {
      info.allMids.mockResolvedValue({ ETH: '2000' });

      await expect(hyperliquid.placeOrder(makeDecision())).rejects.toThrow(UnSupportedAssetError);
    });

    it('returns failure when szDecimals is nil', async () => {
      converter.getSzDecimals.mockReturnValue(undefined);

      await expect(hyperliquid.placeOrder(makeDecision())).rejects.toThrow(UnSupportedAssetError);
      expect(exchange.order).not.toHaveBeenCalled();
    });

    it('opens a LONG with no TP/SL: single market order, updates leverage', async () => {
      const decision = makeDecision({ action: 'LONG', sizeUsd: 1000, leverage: 5 });

      const result = await hyperliquid.placeOrder(decision);

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
      expect(result.action).toBe('LONG');
    });

    it('opens a SHORT with TP and SL: three orders, normalTpsl grouping, correct trigger sides', async () => {
      const decision = makeDecision({
        action: 'SHORT',
        sizeUsd: 1000,
        leverage: 10,
        sl: 20, // PnL %
        tp: 50, // PnL %
      });

      const result = await hyperliquid.placeOrder(decision);

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
      expect(result.action).toBe('SHORT');
    });

    it('places TP/SL on the correct sides for a LONG', async () => {
      const decision = makeDecision({
        action: 'LONG',
        leverage: 5,
        sl: 10,
        tp: 30,
      });

      await hyperliquid.placeOrder(decision);

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

      await expect(hyperliquid.placeOrder(makeDecision())).rejects.toThrow();
    });

    it('catches thrown errors from exchange.order', async () => {
      exchange.order.mockRejectedValue(new Error('network down'));

      await expect(hyperliquid.placeOrder(makeDecision())).rejects.toThrow();
    });
  });

  describe('close market', () => {
    it('returns failure when asset is unknown', async () => {
      converter.getAssetId.mockReturnValue(undefined);

      vi.spyOn(hyperliquid, 'fetchAccountState').mockResolvedValue(makeAccount([makePosition()]));

      await expect(hyperliquid.placeOrder(makeDecision({ action: 'CLOSE' }))).rejects.toThrow(
        UnSupportedAssetError,
      );

      expect(exchange.order).not.toHaveBeenCalled();
    });

    it('returns failure when there is no matching position', async () => {
      vi.spyOn(hyperliquid, 'fetchAccountState').mockResolvedValue(makeAccount([]));
      await expect(hyperliquid.placeOrder(makeDecision({ action: 'CLOSE' }))).rejects.toThrow(
        PositionNotFound,
      );
      expect(exchange.order).not.toHaveBeenCalled();
    });

    it('returns failure when allMids is missing the coin', async () => {
      info.allMids.mockResolvedValue({ ETH: '2000' });
      vi.spyOn(hyperliquid, 'fetchAccountState').mockResolvedValue(makeAccount([makePosition()]));

      await expect(hyperliquid.placeOrder(makeDecision({ action: 'CLOSE' }))).rejects.toThrow(
        UnSupportedAssetError,
      );
    });

    it('closes a LONG position by selling with reduce-only at slippage-adjusted price', async () => {
      const position = makePosition({ side: 'long', size: 0.02 });
      vi.spyOn(hyperliquid, 'fetchAccountState').mockResolvedValue(makeAccount([position]));

      const result = await hyperliquid.placeOrder(makeDecision({ action: 'CLOSE' }));

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

      expect(result).toMatchObject({
        coin: 'BTC',
        action: 'CLOSE',
        size: '0.02',
      });
    });

    it('closes a SHORT position by buying with reduce-only at slippage-adjusted price', async () => {
      const position = makePosition({ side: 'short', size: 0.05 });
      vi.spyOn(hyperliquid, 'fetchAccountState').mockResolvedValue(makeAccount([position]));

      await hyperliquid.placeOrder(makeDecision({ action: 'CLOSE' }));

      const [order] = exchange.order.mock.calls[0][0].orders;
      expect(order.b).toBe(true);
      expect(order.r).toBe(true);
      expect(Number(order.p)).toBeCloseTo(BTC_MID * (1 + SLIPPAGE), 0);
      expect(Number(order.s)).toBeCloseTo(0.05, 3);
    });

    it('returns failure when exchange responds with an error status', async () => {
      exchange.order.mockResolvedValue(errorStatus('reduce-only rejected'));
      vi.spyOn(hyperliquid, 'fetchAccountState').mockResolvedValue(makeAccount([makePosition()]));

      await expect(hyperliquid.placeOrder(makeDecision({ action: 'CLOSE' }))).rejects.toThrow();
    });

    it('catches thrown errors from exchange.order', async () => {
      exchange.order.mockRejectedValue(new Error('boom'));
      vi.spyOn(hyperliquid, 'fetchAccountState').mockResolvedValue(makeAccount([makePosition()]));

      await expect(hyperliquid.placeOrder(makeDecision({ action: 'CLOSE' }))).rejects.toThrow();
    });
  });
});

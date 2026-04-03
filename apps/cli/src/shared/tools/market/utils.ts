import type { BollingerBandsValue, IndicatorValue, MACDValue } from '../../ta/service';
import { truncateTimeseries, truncationLabel } from '../../agent/utils';
import type { OHLCPoint } from '@zhive/sdk';

export function formatOhlcData(data: OHLCPoint[]): string {
  const truncated = truncateTimeseries(data, {
    maxDisplay: 30,
    headCount: 10,
    tailCount: 10,
  });

  const lines: string[] = ['Date | Open | High | Low | Close'];

  for (const point of truncated) {
    if (point === null) {
      lines.push(truncationLabel(data.length, 20));
      continue;
    }

    const iso = new Date(point[0]).toISOString();
    const date = iso.slice(0, 13) + ':00';
    const open = point[1].toFixed(2);
    const high = point[2].toFixed(2);
    const low = point[3].toFixed(2);
    const close = point[4].toFixed(2);
    lines.push(`${date} | $${open} | $${high} | $${low} | $${close}`);
  }

  return lines.join('\n');
}

function formatDate(isoTimestamp: string): string {
  const iso = new Date(isoTimestamp).toISOString();
  const date = iso.slice(0, 13) + ':00';
  return date;
}

function formatNum(value: number): string {
  const formatted = `$${value.toFixed(2)}`;
  return formatted;
}

export function formatIndicatorData(data: IndicatorValue[]): string {
  const truncated = truncateTimeseries(data);

  const lines: string[] = ['Date | Value', '--- | ---'];

  for (const point of truncated) {
    if (point === null) {
      lines.push(truncationLabel(data.length, 15));
      continue;
    }

    lines.push(`${formatDate(point.timestamp)} | ${formatNum(point.value)}`);
  }

  const result = lines.join('\n');
  return result;
}

export function formatMACDData(data: MACDValue[]): string {
  const truncated = truncateTimeseries(data);

  const lines: string[] = ['Date | MACD | Signal | Histogram'];

  for (const point of truncated) {
    if (point === null) {
      lines.push(truncationLabel(data.length, 15));
      continue;
    }

    lines.push(
      `${formatDate(point.timestamp)} | ${formatNum(point.macd)} | ${formatNum(point.signal)} | ${formatNum(point.histogram)}`,
    );
  }

  const result = lines.join('\n');
  return result;
}

export function formatBollingerData(data: BollingerBandsValue[]): string {
  const truncated = truncateTimeseries(data);

  const lines: string[] = ['Date | Upper | Middle | Lower'];

  for (const point of truncated) {
    if (point === null) {
      lines.push(truncationLabel(data.length, 15));
      continue;
    }

    lines.push(
      `${formatDate(point.timestamp)} | ${formatNum(point.upper)} | ${formatNum(point.middle)} | ${formatNum(point.lower)}`,
    );
  }

  const result = lines.join('\n');
  return result;
}

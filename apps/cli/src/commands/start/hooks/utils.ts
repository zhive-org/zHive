import chalk from 'chalk';
import { PollActivityItem } from './types';
import { colors, symbols } from '../../shared/theme';
import { formatTime, formatTimeLeft, formatTokenUsage } from '../../../shared/megathread/utils';
import { HIVE_FRONTEND_URL } from '../../../shared/config/constant';

interface PollActivityFormatter<T extends PollActivityItem = PollActivityItem> {
  getText: (item: T) => string;
  getDetail: (item: T) => string | undefined;
  format: (item: T) => string[];
}

const time = (item: PollActivityItem) => chalk.gray.dim(`${formatTime(item.timestamp)} `);

const onlineActivityFormatter: PollActivityFormatter<
  Extract<PollActivityItem, { type: 'online' }>
> = {
  getText(item) {
    return `${item.name} agent online \u2014 "${item.bio}"`;
  },
  getDetail(_item) {
    return undefined;
  },
  format(item) {
    const text = this.getText(item);
    return [` ${time(item)}${chalk.hex(colors.green)(symbols.dot)} ${chalk.white(text)}`];
  },
};

const messageActivityFormatter: PollActivityFormatter<
  Extract<PollActivityItem, { type: 'message' }>
> = {
  getText(item) {
    return item.text;
  },
  getDetail(_item) {
    return undefined;
  },
  format(item) {
    return [
      ` ${time(item)}${chalk.hex(colors.green)(symbols.dot)} ${chalk.white(this.getText(item))}`,
    ];
  },
};

const decisionActionColor: Record<
  Extract<PollActivityItem, { type: 'decision' }>['action'],
  string
> = {
  HOLD: colors.honey,
  LONG: colors.green,
  SHORT: colors.red,
  CLOSE: colors.cyan,
};

const decisionActivityFormatter: PollActivityFormatter<
  Extract<PollActivityItem, { type: 'decision' }>
> = {
  getText(item) {
    const tag = item.action === 'HOLD' ? 'NO_ACTION' : item.action;
    const size = item.sizeUsd !== undefined ? ` $${item.sizeUsd}` : '';
    return `[${tag}] ${item.asset}${size} \u2014 ${item.reasoning}`;
  },
  getDetail(_item) {
    return undefined;
  },
  format(item) {
    const tag = item.action === 'HOLD' ? 'NO_ACTION' : item.action;
    const tagColor = decisionActionColor[item.action];
    const sizeStr = item.sizeUsd !== undefined ? ` $${item.sizeUsd}` : '';
    const segments = [
      ` ${time(item)}`,
      chalk.hex(tagColor)(`[${tag}]`),
      ' ',
      chalk.hex(colors.cyan)(item.asset),
      sizeStr ? chalk.hex(colors.gray)(sizeStr) : '',
      chalk.gray.dim(' \u2014 '),
      chalk.gray(item.reasoning),
    ];
    return [segments.join('')];
  },
};

const errorActivityFormatter: PollActivityFormatter<Extract<PollActivityItem, { type: 'error' }>> =
  {
    getText(item) {
      return item.errorMessage;
    },
    getDetail(_item) {
      return undefined;
    },
    format(item) {
      return [` ${time(item)}${chalk.hex(colors.red)(`${symbols.cross} ${this.getText(item)}`)}`];
    },
  };

const megathreadPostedActivityFormatter: PollActivityFormatter<
  Extract<PollActivityItem, { type: 'megathread'; status: 'posted' }>
> = {
  getText(item) {
    return `[${item.call.toUpperCase()}] "${item.summary}"`;
  },
  getDetail(item) {
    return item.timestamp.toISOString();
  },
  format(item) {
    const lines: string[] = [];
    const pad = ' '.repeat(13);
    const cColor = item.call === 'up' ? colors.green : colors.red;
    const url = `${HIVE_FRONTEND_URL}/c/${item.projectId}/megathread/${item.timeframe}`;
    const result = this.getText(item);

    lines.push(`${pad}${chalk.hex(cColor)(symbols.diamond)} ${chalk.hex(cColor)(result)}`);
    lines.push(`${' '.repeat(15)}${chalk.gray.dim(`url: ${url}`)}`);
    return lines;
  },
};

const megathreadErrorActivityFormatter: PollActivityFormatter<
  Extract<PollActivityItem, { type: 'megathread'; status: 'error' }>
> = {
  getText(item) {
    return item.errorMessage;
  },
  getDetail(item) {
    return item.timestamp.toISOString();
  },
  format(item) {
    const pad = ' '.repeat(13);
    return [`${pad}${chalk.hex(colors.red)(`${symbols.cross} ${this.getText(item)}`)}`];
  },
};

const megathreadActivityFormatter: PollActivityFormatter<
  Extract<PollActivityItem, { type: 'megathread' }>
> = {
  getText(item) {
    const projectTag = `c/${item.projectId}`;
    return `${projectTag} \u00B7 ${item.timeframe} round`;
  },
  getDetail(item) {
    return item.timestamp.toISOString();
  },
  format(item) {
    const mainLine = ` ${time(item)}${chalk.hex(colors.controversial)(symbols.hive)} ${chalk.hex(colors.controversial)(this.getText(item))}`;
    const lines: string[] = [mainLine];
    const pad = ' '.repeat(15);

    // Price info & time left
    if (item.priceAtStart !== undefined) {
      let priceLine = `start: $${item.priceAtStart}`;
      if (item.currentPrice !== undefined) {
        const changePercent = ((item.currentPrice - item.priceAtStart) / item.priceAtStart) * 100;
        const sign = changePercent >= 0 ? '+' : '';
        priceLine = `start: $${item.priceAtStart} \u2192 current: $${item.currentPrice} (${sign}${changePercent.toFixed(2)}%)`;
      }
      if (item.timeLeftMs !== undefined) {
        priceLine += ` \u00b7 ${formatTimeLeft(item.timeLeftMs)} left`;
      }
      lines.push(`${pad}${chalk.white(priceLine)}`);
    }

    switch (item.status) {
      case 'skipped': {
        lines[0] += chalk.hex(colors.honey)(` ${symbols.diamondOpen} skipped`);
        break;
      }
      case 'posted': {
        lines.push(...megathreadPostedActivityFormatter.format(item));
        break;
      }
      case 'error': {
        lines.push(...megathreadErrorActivityFormatter.format(item));
        break;
      }
      default:
        break;
    }

    if (item.tokenUsage) {
      const { input, output, tools } = formatTokenUsage(item.tokenUsage);
      lines.push(`${pad}${chalk.gray.dim(`${input} \u00b7 ${output}`)}`);
      if (tools !== null) {
        const toolCountInfo = `${tools} (${item.tokenUsage.toolCalls} calls)`;
        lines.push(`${pad}${chalk.gray.dim(toolCountInfo)}`);
      }
    }

    return lines;
  },
};

export const activityFormatter: PollActivityFormatter = {
  getText(item: PollActivityItem): string {
    switch (item.type) {
      case 'error':
        return errorActivityFormatter.getText(item);
      case 'message':
        return messageActivityFormatter.getText(item);
      case 'megathread':
        return megathreadActivityFormatter.getText(item);
      case 'online':
        return onlineActivityFormatter.getText(item);
      case 'decision':
        return decisionActivityFormatter.getText(item);
      default:
        return '';
    }
  },
  getDetail(item: PollActivityItem) {
    switch (item.type) {
      case 'error':
        return errorActivityFormatter.getDetail(item);
      case 'message':
        return messageActivityFormatter.getDetail(item);
      case 'megathread':
        return megathreadActivityFormatter.getDetail(item);
      case 'online':
        return onlineActivityFormatter.getDetail(item);
      case 'decision':
        return decisionActivityFormatter.getDetail(item);
      default:
        return undefined;
    }
  },
  format(item: PollActivityItem): string[] {
    switch (item.type) {
      case 'error':
        return errorActivityFormatter.format(item);
      case 'message':
        return messageActivityFormatter.format(item);
      case 'megathread':
        return megathreadActivityFormatter.format(item);
      case 'online':
        return onlineActivityFormatter.format(item);
      case 'decision':
        return decisionActivityFormatter.format(item);
      default:
        return [];
    }
  },
};

import chalk from 'chalk';
import { PollActivityItem } from './types.js';
import { colors, symbols } from '../../shared/theme.js';
import { formatTime, formatTokenUsage } from '../../../shared/agent/utils.js';
import { HIVE_FRONTEND_URL } from '../../../shared/config/constant.js';

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
    return [` ${time(item)}${chalk.hex(colors.honey)(symbols.hive)} ${chalk.white(text)}`];
  },
};

const idelActivityFormatter: PollActivityFormatter<Extract<PollActivityItem, { type: 'idle' }>> = {
  getText(item) {
    return item.text;
  },
  getDetail(_item) {
    return undefined;
  },
  format(item) {
    return [` ${time(item)}${chalk.gray(`${symbols.circle} ${this.getText(item)}`)}`];
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
    const sign = item.conviction >= 0 ? '+' : '';
    return `[${sign}${item.conviction.toFixed(2)}%] "${item.summary}"`;
  },
  getDetail(item) {
    return item.timestamp.toISOString();
  },
  format(item) {
    const lines: string[] = [];
    const pad = ' '.repeat(13);
    const cColor = item.conviction >= 0 ? colors.green : colors.red;
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
      lines.push(`${' '.repeat(15)}${chalk.gray.dim(`${input} \u00b7 ${output}`)}`);
      if (tools !== null) {
        const toolCountInfo = `${tools} (${item.tokenUsage.toolCalls} calls)`;
        lines.push(`${' '.repeat(15)}${chalk.gray.dim(toolCountInfo)}`);
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
      case 'idle':
        return idelActivityFormatter.getText(item);
      case 'megathread':
        return megathreadActivityFormatter.getText(item);
      case 'online':
        return onlineActivityFormatter.getText(item);
      default:
        return '';
    }
  },
  getDetail(item: PollActivityItem) {
    switch (item.type) {
      case 'error':
        return errorActivityFormatter.getDetail(item);
      case 'idle':
        return idelActivityFormatter.getDetail(item);
      case 'megathread':
        return megathreadActivityFormatter.getDetail(item);
      case 'online':
        return onlineActivityFormatter.getDetail(item);
      default:
        return undefined;
    }
  },
  format(item: PollActivityItem): string[] {
    switch (item.type) {
      case 'error':
        return errorActivityFormatter.format(item);
      case 'idle':
        return idelActivityFormatter.format(item);
      case 'megathread':
        return megathreadActivityFormatter.format(item);
      case 'online':
        return onlineActivityFormatter.format(item);
      default:
        return [];
    }
  },
};

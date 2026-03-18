import chalk from 'chalk';

export const colors = {
  honey: '#F5A623',
  honeyDark: '#D4891A',
  honeyBright: '#FFD700',
  white: '#FFFFFF',
  gray: '#A6A6A6',
  grayDim: '#555555',
  green: '#27C587',
  red: '#E14B4B',
  wax: '#C45C5C',
  cyan: '#22D3EE',
  hot: '#FB923C',
  controversial: '#C084FC',
  sprint: '#F472B6',
  purple: '#A855F7',
} as const;

export const symbols = {
  hive: '\u2B21', // ⬡
  diamond: '\u25C6', // ◆
  diamondOpen: '\u25C7', // ◇
  dot: '\u25CF', // ●
  spinner: ['\u25D0', '\u25D3', '\u25D1', '\u25D2'], // ◐ ◓ ◑ ◒
  check: '\u2713', // ✓
  arrow: '\u203A', // ›
  circle: '\u25CB', // ○
  cross: '\u2717', // ✗
} as const;

export const border = {
  horizontal: '\u2500', // ─
  vertical: '\u2502', // │
  topLeft: '\u250C', // ┌
  topRight: '\u2510', // ┐
  bottomLeft: '\u2514', // └
  bottomRight: '\u2518', // ┘
  teeLeft: '\u251C', // ├
  teeRight: '\u2524', // ┤
} as const;

export const animation = {
  DATA_CHARS: '01▪▫░▒',
  HEX_CHARS: '⬡⬢',
  TICK_MS: 120,
  HEX_W: 8,
  HEX_H: 4,
} as const;

export const styled = {
  honey: (text: string): string => chalk.hex(colors.honey)(text),
  honeyBold: (text: string): string => chalk.hex(colors.honey).bold(text),
  white: (text: string): string => chalk.white(text),
  whiteBold: (text: string): string => chalk.bold.white(text),
  gray: (text: string): string => chalk.gray(text),
  dim: (text: string): string => chalk.hex(colors.grayDim)(text),
  green: (text: string): string => chalk.hex(colors.green)(text),
  red: (text: string): string => chalk.hex(colors.red)(text),
  wax: (text: string): string => chalk.hex(colors.wax)(text),
  cyan: (text: string): string => chalk.hex(colors.cyan)(text),
  hot: (text: string): string => chalk.hex(colors.hot)(text),
  controversial: (text: string): string => chalk.hex(colors.controversial)(text),
  sprint: (text: string): string => chalk.hex(colors.sprint)(text),
  purple: (text: string): string => chalk.hex(colors.purple)(text),
} as const;

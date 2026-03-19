import chalk from 'chalk';
import { createRequire } from 'module';
import { animation, colors } from '../../shared/theme.js';

const require = createRequire(import.meta.url);
const { version } = require('../../../../package.json') as { version: string };

const BOOT_TOTAL_FRAMES = 58;
const BOOT_FRAME_MS = 80;
const DURATION_MS = BOOT_TOTAL_FRAMES * BOOT_FRAME_MS;
const NUM_BEES = 4;
const NUM_STREAMS = 5;
const SCRAMBLE_CHARS = '\u2B21\u2B22\u25C6\u25C7\u2591\u2592!@#$%01';

const BOOT_MESSAGES = [
  { prefix: '\u2B21', text: 'Initializing {name} agent...', frame: 30 },
  { prefix: '\u25C6', text: 'Loading personality matrix...', frame: 36 },
  { prefix: '\u25C7', text: 'Connecting to zHive...', frame: 42 },
  { prefix: '\u2713', text: 'Neural link established', frame: 48 },
];

// ─── Private types ───────────────────────────────────

interface Bee {
  r: number;
  c: number;
  vr: number;
  vc: number;
}

interface Pulse {
  r: number;
  c: number;
  ttl: number;
  color: string;
}

// ─── Private helpers ─────────────────────────────────

function isHexEdge(r: number, c: number): boolean {
  const rowInHex = ((r % animation.HEX_H) + animation.HEX_H) % animation.HEX_H;
  const isOddHex = Math.floor(r / animation.HEX_H) % 2 === 1;
  const colOffset = isOddHex ? animation.HEX_W / 2 : 0;
  const colInHex = (((c - colOffset) % animation.HEX_W) + animation.HEX_W) % animation.HEX_W;

  if (rowInHex === 0 || rowInHex === animation.HEX_H - 1) {
    return colInHex >= 2 && colInHex <= 5;
  }
  if (rowInHex === 1 || rowInHex === 2) {
    return colInHex === 1 || colInHex === 6;
  }
  return false;
}

// ─── Raw ANSI boot animation ────────────────────────

export function showHoneycombBoot(agentName: string): Promise<void> {
  return new Promise((resolve) => {
    const cols = process.stdout.columns || 60;
    const gridRows = process.stdout.rows || 24;
    let frame = 0;

    // Init bees
    const bees: Bee[] = [];
    for (let i = 0; i < NUM_BEES; i++) {
      bees.push({
        r: Math.floor(Math.random() * gridRows),
        c: Math.floor(Math.random() * cols),
        vr: Math.random() > 0.5 ? 1 : -1,
        vc: Math.random() > 0.5 ? 1 : -1,
      });
    }

    // Init stream columns
    const streamCols: number[] = [];
    const spacing = Math.floor(cols / (NUM_STREAMS + 1));
    for (let i = 1; i <= NUM_STREAMS; i++) {
      streamCols.push(spacing * i);
    }

    let pulses: Pulse[] = [];

    // Text positioning
    const centerR = Math.floor(gridRows / 2) - 2;
    const centerC = Math.floor(cols / 2);
    const nameText = `\u2B21  ${agentName} agent  \u2B21`;
    const versionText = `v${version}`;
    const nameStart = Math.max(0, centerC - Math.floor(nameText.length / 2));
    const versionCol = Math.max(0, centerC - Math.floor(versionText.length / 2));
    const versionRow = centerR + 2;
    const msgStartRow = centerR + 4;

    // Quiet zone around text: no animation renders here
    const PADDING_H = 3;
    const PADDING_V = 1;
    const longestMsg = BOOT_MESSAGES.reduce(
      (max, m) => Math.max(max, m.prefix.length + 1 + m.text.replace('{name}', agentName).length),
      0,
    );
    const msgLeftEdge = Math.floor((cols - longestMsg) / 2);
    const msgRightEdge = msgLeftEdge + longestMsg;
    const quietLeft = Math.min(nameStart, versionCol, msgLeftEdge) - PADDING_H;
    const quietRight =
      Math.max(nameStart + nameText.length, versionCol + versionText.length, msgRightEdge) +
      PADDING_H;
    const quietTop = centerR - 1 - PADDING_V;
    const quietBottom = msgStartRow + BOOT_MESSAGES.length + PADDING_V;

    // Hide cursor
    process.stdout.write('\x1b[?25l');
    // Clear screen
    process.stdout.write('\x1b[2J');

    function renderFrame(): void {
      // Move cursor to top-left
      process.stdout.write('\x1b[H');

      // Advance bees every other frame
      if (frame > 0 && frame % 2 === 0) {
        for (const bee of bees) {
          bee.r += bee.vr;
          bee.c += bee.vc;
          if (bee.r <= 0 || bee.r >= gridRows - 1) {
            bee.vr *= -1;
            bee.r = Math.max(0, Math.min(gridRows - 1, bee.r));
          }
          if (bee.c <= 0 || bee.c >= cols - 1) {
            bee.vc *= -1;
            bee.c = Math.max(0, Math.min(cols - 1, bee.c));
          }
          if (Math.random() > 0.3) {
            bee.vc = Math.random() > 0.5 ? 1 : -1;
          }
        }
      }

      // Spawn pulses
      if (frame % 4 === 0) {
        for (let i = 0; i < 3; i++) {
          const pr = Math.floor(Math.random() * gridRows);
          const pc = Math.floor(Math.random() * cols);
          if (isHexEdge(pr, pc)) {
            const pulseColors = [colors.green, colors.red, colors.honey];
            const color = pulseColors[Math.floor(Math.random() * pulseColors.length)];
            pulses.push({ r: pr, c: pc, ttl: 8, color });
          }
        }
        pulses = pulses.filter((p) => p.ttl > 0).map((p) => ({ ...p, ttl: p.ttl - 1 }));
      }

      // Build grid: char + color pairs
      const charGrid: string[][] = [];
      const colorGrid: string[][] = [];

      for (let r = 0; r < gridRows; r++) {
        const chars: string[] = [];
        const clrs: string[] = [];

        for (let c = 0; c < cols; c++) {
          // Skip animation in quiet zone around text
          const inQuietZone = r >= quietTop && r <= quietBottom && c >= quietLeft && c < quietRight;
          if (inQuietZone) {
            chars.push(' ');
            clrs.push(colors.grayDim);
            continue;
          }

          const hexEdge = isHexEdge(r, c);

          // Scanning wave
          const scanRow = frame % (gridRows + 6);
          const dist = Math.abs(r - scanRow);
          if (hexEdge && dist === 0) {
            chars.push('\u2B22');
            clrs.push(colors.honey);
            continue;
          }
          if (hexEdge && dist <= 1) {
            chars.push('\u2B21');
            clrs.push(colors.honey);
            continue;
          }

          // Data streams
          let isStream = false;
          if (frame >= 8) {
            for (const sc of streamCols) {
              if (c === sc) {
                const streamOffset = ((frame - 8) * 2 + sc) % (gridRows * 3);
                const streamDist = (((r - streamOffset) % gridRows) + gridRows) % gridRows;
                if (streamDist < 6) {
                  const charIdx = (frame + r) % animation.DATA_CHARS.length;
                  const streamChar = animation.DATA_CHARS[charIdx];
                  chars.push(streamChar);
                  if (streamDist === 0) {
                    clrs.push(colors.white);
                  } else if (streamDist < 3) {
                    clrs.push(colors.green);
                  } else {
                    clrs.push(colors.grayDim);
                  }
                  isStream = true;
                  break;
                }
              }
            }
          }
          if (isStream) continue;

          // Default
          if (hexEdge) {
            chars.push('\u00B7');
            clrs.push(colors.grayDim);
          } else {
            chars.push(' ');
            clrs.push(colors.grayDim);
          }
        }

        charGrid.push(chars);
        colorGrid.push(clrs);
      }

      // Overlay pulses (skip quiet zone)
      for (const pulse of pulses) {
        if (pulse.r >= 0 && pulse.r < gridRows && pulse.c >= 0 && pulse.c < cols) {
          const inQuietZone =
            pulse.r >= quietTop &&
            pulse.r <= quietBottom &&
            pulse.c >= quietLeft &&
            pulse.c < quietRight;
          if (inQuietZone) continue;
          const brightness = pulse.ttl / 8;
          const cell = charGrid[pulse.r][pulse.c];
          if (cell === '\u00B7' || cell === ' ') {
            charGrid[pulse.r][pulse.c] = brightness > 0.5 ? '\u2B21' : '\u00B7';
            colorGrid[pulse.r][pulse.c] = pulse.color;
          }
        }
      }

      // Overlay bees (skip quiet zone)
      for (const bee of bees) {
        const br = Math.max(0, Math.min(gridRows - 1, Math.round(bee.r)));
        const bc = Math.max(0, Math.min(cols - 1, Math.round(bee.c)));
        const inQuietZone =
          br >= quietTop && br <= quietBottom && bc >= quietLeft && bc < quietRight;
        if (!inQuietZone) {
          charGrid[br][bc] = '\u25C6';
          colorGrid[br][bc] = colors.honey;
        }
      }

      // Overlay agent name with scramble→reveal effect
      if (frame >= 22) {
        const scrambleProgress = Math.min(1, (frame - 22) / 8);

        // Top/bottom border lines around name
        for (let c = nameStart; c < nameStart + nameText.length && c < cols; c++) {
          if (centerR - 1 >= 0) {
            charGrid[centerR - 1][c] = '\u2500';
            colorGrid[centerR - 1][c] = colors.honey;
          }
          if (centerR + 1 < gridRows) {
            charGrid[centerR + 1][c] = '\u2500';
            colorGrid[centerR + 1][c] = colors.honey;
          }
        }

        // Name text with scramble effect
        for (let i = 0; i < nameText.length; i++) {
          const c = nameStart + i;
          if (c >= cols) break;

          const charThreshold = i / nameText.length;
          if (charThreshold <= scrambleProgress) {
            charGrid[centerR][c] = nameText[i];
            colorGrid[centerR][c] = colors.honey;
          } else {
            const scrambleIdx = Math.floor(Math.random() * SCRAMBLE_CHARS.length);
            charGrid[centerR][c] = SCRAMBLE_CHARS[scrambleIdx];
            colorGrid[centerR][c] = colors.gray;
          }
        }
      }

      // Overlay version with scramble→reveal (starts after name)
      const VER_START_FRAME = 26;
      const VER_REVEAL_FRAMES = 6;
      if (frame >= VER_START_FRAME && versionRow >= 0 && versionRow < gridRows) {
        const scrambleProgress = Math.min(1, (frame - VER_START_FRAME) / VER_REVEAL_FRAMES);
        for (let i = 0; i < versionText.length; i++) {
          const vc = versionCol + i;
          if (vc < 0 || vc >= cols) continue;
          const charThreshold = i / versionText.length;
          if (charThreshold <= scrambleProgress) {
            charGrid[versionRow][vc] = versionText[i];
            colorGrid[versionRow][vc] = colors.grayDim;
          } else {
            const scrambleIdx = Math.floor(Math.random() * SCRAMBLE_CHARS.length);
            charGrid[versionRow][vc] = SCRAMBLE_CHARS[scrambleIdx];
            colorGrid[versionRow][vc] = colors.grayDim;
          }
        }
      }

      // Overlay typewriter boot messages
      for (let idx = 0; idx < BOOT_MESSAGES.length; idx++) {
        const msg = BOOT_MESSAGES[idx];
        if (frame < msg.frame) continue;
        const r = msgStartRow + idx;
        if (r < 0 || r >= gridRows) continue;

        const fullText = `${msg.prefix} ${msg.text.replace('{name}', agentName)}`;
        const msgCol = Math.floor((cols - fullText.length) / 2);
        const visibleChars = Math.min(fullText.length, (frame - msg.frame) * 3);

        const isCheckmark = msg.prefix === '\u2713';
        const msgColor = isCheckmark ? colors.green : colors.honey;

        for (let i = 0; i < visibleChars; i++) {
          const c = msgCol + i;
          if (c < 0 || c >= cols) continue;
          charGrid[r][c] = fullText[i];
          colorGrid[r][c] = msgColor;
        }
      }

      // Render to stdout
      let output = '';
      for (let r = 0; r < gridRows; r++) {
        let line = '';
        let runColor = colorGrid[r][0];
        let runChars = '';

        for (let c = 0; c < cols; c++) {
          const curColor = colorGrid[r][c];
          const curChar = charGrid[r][c];

          if (curColor === runColor) {
            runChars += curChar;
          } else {
            line += chalk.hex(runColor)(runChars);
            runColor = curColor;
            runChars = curChar;
          }
        }
        if (runChars.length > 0) {
          line += chalk.hex(runColor)(runChars);
        }

        output += line;
        if (r < gridRows - 1) {
          output += '\n';
        }
      }

      process.stdout.write(output);
      frame++;
    }

    const timer = setInterval(renderFrame, BOOT_FRAME_MS);

    setTimeout(() => {
      clearInterval(timer);
      // Clear screen, show cursor, move to top
      process.stdout.write('\x1b[2J\x1b[H\x1b[?25h');
      resolve();
    }, DURATION_MS);
  });
}

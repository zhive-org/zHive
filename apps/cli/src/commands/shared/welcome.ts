import chalk from 'chalk';

const HEX_W = 8;
const HEX_H = 4;
const DATA_CHARS = '01▪▫░▒';
const TICK_MS = 80;
const DURATION_MS = 3200;
const NUM_BEES = 4;
const NUM_STREAMS = 5;
const HONEY = '#F5A623';
const GREEN = '#27C587';
const DIM = '#555555';
const WHITE = '#FFFFFF';
const RED = '#E14B4B';
const SCRAMBLE_CHARS = '⬡⬢◆◇░▒!@#$%01';

const BOOT_MESSAGES = [
  { prefix: '⬡', text: 'Initializing creation studio...', frame: 18, color: HONEY },
  { prefix: '◆', text: 'Loading agent templates...', frame: 24, color: HONEY },
  { prefix: '◇', text: 'Connecting to zHive network...', frame: 30, color: HONEY },
  { prefix: '✓', text: 'Ready', frame: 36, color: GREEN },
];

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

function isHexEdge(r: number, c: number): boolean {
  const rowInHex = ((r % HEX_H) + HEX_H) % HEX_H;
  const isOddHex = Math.floor(r / HEX_H) % 2 === 1;
  const colOffset = isOddHex ? HEX_W / 2 : 0;
  const colInHex = (((c - colOffset) % HEX_W) + HEX_W) % HEX_W;

  if (rowInHex === 0 || rowInHex === HEX_H - 1) {
    return colInHex >= 2 && colInHex <= 5;
  }
  if (rowInHex === 1 || rowInHex === 2) {
    return colInHex === 1 || colInHex === 6;
  }
  return false;
}

export function showWelcome(): Promise<void> {
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

    // Title positioning
    const title = '\u2B21 zHIVE';
    const subtitle = 'Agent Creation Studio';
    const titleRow = Math.floor(gridRows / 2) - 1;
    const subtitleRow = titleRow + 1;
    const titleCol = Math.floor((cols - title.length) / 2);
    const subtitleCol = Math.floor((cols - subtitle.length) / 2);

    // Boot message row positions
    const msgStartRow = subtitleRow + 2;

    // Quiet zone around title + boot messages: no animation renders here
    const PADDING_H = 3;
    const PADDING_V = 1;
    const longestMsg = BOOT_MESSAGES.reduce(
      (max, m) => Math.max(max, m.prefix.length + 1 + m.text.length),
      0,
    );
    const msgLeftEdge = Math.floor((cols - longestMsg) / 2);
    const msgRightEdge = msgLeftEdge + longestMsg;
    const quietLeft = Math.min(titleCol, subtitleCol, msgLeftEdge) - PADDING_H;
    const quietRight =
      Math.max(titleCol + title.length, subtitleCol + subtitle.length, msgRightEdge) + PADDING_H;
    const quietTop = titleRow - PADDING_V;
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
            const pulseColors = [GREEN, RED, HONEY];
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
          // Skip animation in quiet zone around title
          if (r >= quietTop && r <= quietBottom && c >= quietLeft && c < quietRight) {
            chars.push(' ');
            clrs.push(DIM);
            continue;
          }

          const hexEdge = isHexEdge(r, c);

          // Scanning wave
          const scanRow = frame % (gridRows + 6);
          const dist = Math.abs(r - scanRow);
          if (hexEdge && dist === 0) {
            chars.push('⬢');
            clrs.push(HONEY);
            continue;
          }
          if (hexEdge && dist <= 1) {
            chars.push('⬡');
            clrs.push(HONEY);
            continue;
          }

          // Data streams
          let isStream = false;
          for (const sc of streamCols) {
            if (c === sc) {
              const streamOffset = (frame * 2 + sc) % (gridRows * 3);
              const streamDist = (((r - streamOffset) % gridRows) + gridRows) % gridRows;
              if (streamDist < 6) {
                const charIdx = (frame + r) % DATA_CHARS.length;
                const streamChar = DATA_CHARS[charIdx];
                chars.push(streamChar);
                if (streamDist === 0) {
                  clrs.push(WHITE);
                } else if (streamDist < 3) {
                  clrs.push(GREEN);
                } else {
                  clrs.push(DIM);
                }
                isStream = true;
                break;
              }
            }
          }
          if (isStream) continue;

          // Default
          if (hexEdge) {
            chars.push('·');
            clrs.push(DIM);
          } else {
            chars.push(' ');
            clrs.push(DIM);
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
          if (cell === '·' || cell === ' ') {
            charGrid[pulse.r][pulse.c] = brightness > 0.5 ? '⬡' : '·';
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
          charGrid[br][bc] = '◆';
          colorGrid[br][bc] = HONEY;
        }
      }

      // Overlay title with scramble→reveal effect
      const TITLE_START_FRAME = 6;
      const TITLE_REVEAL_FRAMES = 8;
      if (frame >= TITLE_START_FRAME && titleRow >= 0 && titleRow < gridRows) {
        const scrambleProgress = Math.min(1, (frame - TITLE_START_FRAME) / TITLE_REVEAL_FRAMES);
        for (let i = 0; i < title.length; i++) {
          const tc = titleCol + i;
          if (tc < 0 || tc >= cols) continue;
          const charThreshold = i / title.length;
          if (charThreshold <= scrambleProgress) {
            charGrid[titleRow][tc] = title[i];
            colorGrid[titleRow][tc] = HONEY;
          } else {
            const scrambleIdx = Math.floor(Math.random() * SCRAMBLE_CHARS.length);
            charGrid[titleRow][tc] = SCRAMBLE_CHARS[scrambleIdx];
            colorGrid[titleRow][tc] = DIM;
          }
        }
      }

      // Overlay subtitle with scramble→reveal (starts a few frames after title)
      const SUB_START_FRAME = 10;
      const SUB_REVEAL_FRAMES = 8;
      if (frame >= SUB_START_FRAME && subtitleRow >= 0 && subtitleRow < gridRows) {
        const scrambleProgress = Math.min(1, (frame - SUB_START_FRAME) / SUB_REVEAL_FRAMES);
        for (let i = 0; i < subtitle.length; i++) {
          const sc = subtitleCol + i;
          if (sc < 0 || sc >= cols) continue;
          const charThreshold = i / subtitle.length;
          if (charThreshold <= scrambleProgress) {
            charGrid[subtitleRow][sc] = subtitle[i];
            colorGrid[subtitleRow][sc] = DIM;
          } else {
            const scrambleIdx = Math.floor(Math.random() * SCRAMBLE_CHARS.length);
            charGrid[subtitleRow][sc] = SCRAMBLE_CHARS[scrambleIdx];
            colorGrid[subtitleRow][sc] = DIM;
          }
        }
      }

      // Overlay typewriter boot messages
      for (let idx = 0; idx < BOOT_MESSAGES.length; idx++) {
        const msg = BOOT_MESSAGES[idx];
        if (frame < msg.frame) continue;
        const r = msgStartRow + idx;
        if (r < 0 || r >= gridRows) continue;

        const fullText = `${msg.prefix} ${msg.text}`;
        const msgCol = Math.floor((cols - fullText.length) / 2);
        const visibleChars = Math.min(fullText.length, (frame - msg.frame) * 3);

        for (let i = 0; i < visibleChars; i++) {
          const c = msgCol + i;
          if (c < 0 || c >= cols) continue;
          charGrid[r][c] = fullText[i];
          colorGrid[r][c] = msg.color;
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

    const timer = setInterval(renderFrame, TICK_MS);

    setTimeout(() => {
      clearInterval(timer);
      // Clear screen, show cursor, move to top
      process.stdout.write('\x1b[2J\x1b[H\x1b[?25h');
      resolve();
    }, DURATION_MS);
  });
}

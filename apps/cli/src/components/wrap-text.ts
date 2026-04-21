/**
 * Break a single source line into display segments that each fit within `width`.
 * Prefers word boundaries (last space ≤ width); hard-breaks mid-word only if
 * there is no space to break on.
 */
export function wrapLine(line: string, width: number): string[] {
  if (line.length === 0) return [''];
  if (width <= 0 || line.length <= width) return [line];

  const segments: string[] = [];
  let remaining = line;
  while (remaining.length > width) {
    const breakIdx = remaining.lastIndexOf(' ', width);
    if (breakIdx > 0) {
      segments.push(remaining.slice(0, breakIdx));
      remaining = remaining.slice(breakIdx + 1);
    } else {
      segments.push(remaining.slice(0, width));
      remaining = remaining.slice(width);
    }
  }
  segments.push(remaining);
  return segments;
}

/** Split text by newlines, then word-wrap each line to the given width. */
export function wrapText(text: string, width: number): string[] {
  return text.split('\n').flatMap((line) => wrapLine(line, width));
}

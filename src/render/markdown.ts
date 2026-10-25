// Small pieces of Markdown knowledge shared by the render steps.

export const FRONT_MATTER =
  /^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

// For each line, whether it is a code fence delimiter or sits inside a fence.
export function fencedLines(lines: string[]): boolean[] {
  let fence: { char: string; size: number } | undefined;

  return lines.map((text) => {
    if (fence) {
      const close = new RegExp(`^ {0,3}${fence.char}{${fence.size},}[ \\t]*$`);
      if (close.test(text)) fence = undefined;
      return true;
    }

    const open = FENCE_OPEN.exec(text);
    if (open?.[1]) {
      fence = { char: open[1].charAt(0), size: open[1].length };
      return true;
    }

    return false;
  });
}

const CODE_SPAN = /(`+)(?!`)(.+?)(?<!`)\1(?!`)/g;

export function mapOutsideCodeSpans(
  line: string,
  fn: (text: string) => string,
): string {
  let result = '';
  let last = 0;

  for (const span of line.matchAll(CODE_SPAN)) {
    result += fn(line.slice(last, span.index));
    result += span[0];
    last = span.index + span[0].length;
  }
  return result + fn(line.slice(last));
}

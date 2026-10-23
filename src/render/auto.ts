// Turns a note into Marp markdown.
//
// A note with `marp: true` in its front matter is a deck written for Marp and
// is passed through untouched. Any other note is split into slides here: before
// each section heading (the shallowest level that appears at least twice) and at
// every horizontal rule; the note's own front matter is left out.

const FRONT_MATTER =
  /^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
const MARP_FLAG = /^marp:[ \t]*["']?true["']?[ \t]*$/im;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]|$)/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

export function isMarpDeck(markdown: string): boolean {
  const match = FRONT_MATTER.exec(markdown);
  return match !== null && MARP_FLAG.test(match[1] ?? '');
}

export function toMarpMarkdown(markdown: string): string {
  if (isMarpDeck(markdown)) return markdown;
  return splitIntoSlides(stripFrontMatter(markdown)).join('\n\n---\n\n');
}

function stripFrontMatter(markdown: string): string {
  return markdown.replace(FRONT_MATTER, '');
}

interface Line {
  text: string;
  // Heading level, or 0 when the line is not a heading outside a code fence.
  heading: number;
  // True for a horizontal rule outside a code fence.
  rule: boolean;
}

function classify(lines: string[]): Line[] {
  let fence: { char: string; size: number } | undefined;

  return lines.map((text, i) => {
    const plain: Line = { text, heading: 0, rule: false };

    if (fence) {
      const close = new RegExp(`^ {0,3}${fence.char}{${fence.size},}[ \\t]*$`);
      if (close.test(text)) fence = undefined;
      return plain;
    }

    const open = FENCE_OPEN.exec(text);
    if (open?.[1]) {
      fence = { char: open[1].charAt(0), size: open[1].length };
      return plain;
    }

    const heading = HEADING.exec(text);
    if (heading?.[1]) return { text, heading: heading[1].length, rule: false };

    // `---` right under a line of text underlines a setext heading, not a rule.
    const previous = lines[i - 1];
    const underlinesText = previous !== undefined && previous.trim() !== '';
    if (
      RULE.test(text) &&
      !(text.trimStart().startsWith('-') && underlinesText)
    ) {
      return { text, heading: 0, rule: true };
    }

    return plain;
  });
}

// The shallowest heading level used at least twice, or 0 when none repeats.
function sectionLevel(lines: Line[]): number {
  const counts = new Map<number, number>();
  for (const { heading } of lines) {
    if (heading > 0) counts.set(heading, (counts.get(heading) ?? 0) + 1);
  }
  const repeated = [...counts]
    .filter(([, count]) => count >= 2)
    .map(([level]) => level);
  return repeated.length > 0 ? Math.min(...repeated) : 0;
}

export function splitIntoSlides(markdown: string): string[] {
  const lines = classify(markdown.split(/\r?\n/));
  const level = sectionLevel(lines);

  const slides: string[] = [];
  let current: string[] = [];
  const flush = () => {
    const slide = current.join('\n').trim();
    if (slide !== '') slides.push(slide);
    current = [];
  };

  for (const line of lines) {
    if (line.rule) {
      flush();
    } else {
      if (level > 0 && line.heading === level) flush();
      current.push(line.text);
    }
  }
  flush();

  return slides;
}

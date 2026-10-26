import { fencedLines, FRONT_MATTER } from './markdown';

const MARP_FLAG = /^marp:[ \t]*["']?true["']?[ \t]*$/im;
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
  const fenced = fencedLines(lines);

  return lines.map((text, i) => {
    const plain: Line = { text, heading: 0, rule: false };
    if (fenced[i]) return plain;

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

interface Slice {
  text: string;
  start: number;
}

function sliceSlides(markdown: string): Slice[] {
  const lines = classify(markdown.split(/\r?\n/));
  const level = sectionLevel(lines);

  const slices: Slice[] = [];
  let current: string[] = [];
  let first: number | undefined;
  const flush = () => {
    const text = current.join('\n').trim();
    if (text !== '') slices.push({ text, start: first ?? 0 });
    current = [];
    first = undefined;
  };

  lines.forEach((line, index) => {
    if (line.rule) {
      flush();
      return;
    }
    if (level > 0 && line.heading === level) flush();
    current.push(line.text);
    if (first === undefined && line.text.trim() !== '') first = index;
  });
  flush();

  return slices;
}

export function splitIntoSlides(markdown: string): string[] {
  return sliceSlides(markdown).map((slice) => slice.text);
}

// The line of the note each slide starts at, for a note in automatic mode (the
// first line of the note is 0). A Marp deck has none: Marp knows its own.
export function autoSlideStarts(markdown: string): number[] {
  if (isMarpDeck(markdown)) return [];

  const frontMatter = FRONT_MATTER.exec(markdown)?.[0] ?? '';
  const offset = frontMatter.split('\n').length - 1;
  return sliceSlides(stripFrontMatter(markdown)).map(
    (slice) => slice.start + offset,
  );
}

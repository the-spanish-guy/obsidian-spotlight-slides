import { fencedLines, FRONT_MATTER } from './markdown';

export interface ExtractedCallouts {
  markdown: string;
  // The Markdown of each callout, as written in the note.
  callouts: string[];
}

// Matches a paragraph that holds nothing but a token, capturing its index.
export const CALLOUT_TOKEN = /^SpotlightCallout(\d+)End$/;

const CALLOUT_START = /^ {0,3}>[ \t]*\[![\w-]+\][+-]?/;
const QUOTE_LINE = /^ {0,3}>/;

export function extractCallouts(markdown: string): ExtractedCallouts {
  const frontMatter = FRONT_MATTER.exec(markdown)?.[0] ?? '';
  const lines = markdown.slice(frontMatter.length).split('\n');
  const fenced = fencedLines(lines.map((line) => line.replace(/\r$/, '')));

  const callouts: string[] = [];
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (fenced[i] || !CALLOUT_START.test(line)) {
      out.push(line);
      continue;
    }

    const block = [line];
    while (
      i + 1 < lines.length &&
      !fenced[i + 1] &&
      QUOTE_LINE.test(lines[i + 1] ?? '')
    ) {
      block.push(lines[i + 1] ?? '');
      i++;
    }
    callouts.push(block.map((l) => l.replace(/\r$/, '')).join('\n'));

    // Blank lines keep the token a paragraph of its own.
    out.push('', `SpotlightCallout${callouts.length - 1}End`, '');
  }

  return { markdown: frontMatter + out.join('\n'), callouts };
}

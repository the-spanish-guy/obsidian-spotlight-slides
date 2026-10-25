import { codeSpanEnd, fencedLines, FRONT_MATTER } from './markdown';

export interface ExtractedInline {
  markdown: string;
  // The syntax as written, e.g. `[[nota|alias]]`, `#tag` or `==texto==`.
  inline: string[];
}

// Matches a token and captures the index of its source.
export const INLINE_TOKEN = /SpotlightInline(\d+)End/g;

const WIKILINK = /\[\[[^\]\n]+?\]\]/y;
const HIGHLIGHT = /==(?!=)(?=\S)[^\n]+?(?<=\S)==(?!=)/y;
const TAG = /#([\p{L}\p{N}_/-]+)/uy;
const NOT_BEFORE_TAG = /[\w&#/\\(]/;

export function extractInline(markdown: string): ExtractedInline {
  const frontMatter = FRONT_MATTER.exec(markdown)?.[0] ?? '';
  const lines = markdown.slice(frontMatter.length).split('\n');
  const fenced = fencedLines(lines.map((line) => line.replace(/\r$/, '')));

  const inline: string[] = [];
  const out: string[] = [];
  let chunk: string[] = [];
  const flush = () => {
    if (chunk.length === 0) return;
    out.push(replaceInline(chunk.join('\n'), inline));
    chunk = [];
  };

  lines.forEach((line, i) => {
    if (fenced[i]) {
      flush();
      out.push(line);
    } else {
      chunk.push(line);
    }
  });
  flush();

  return { markdown: frontMatter + out.join('\n'), inline };
}

function replaceInline(text: string, inline: string[]): string {
  const add = (source: string) => {
    inline.push(source);
    return `SpotlightInline${inline.length - 1}End`;
  };
  const match = (pattern: RegExp, at: number) => {
    pattern.lastIndex = at;
    return pattern.exec(text)?.[0];
  };

  let result = '';
  let i = 0;
  while (i < text.length) {
    const char = text.charAt(i);
    let piece: string | undefined;

    if (char === '\\') {
      result += text.slice(i, i + 2);
      i += 2;
    } else if (char === '`') {
      const end = codeSpanEnd(text, i);
      result += text.slice(i, end);
      i = end;
    } else if (text.startsWith('<!--', i)) {
      const close = text.indexOf('-->', i + 4);
      const end = close === -1 ? text.length : close + 3;
      result += text.slice(i, end);
      i = end;
    } else if (text.startsWith('%%', i)) {
      const close = text.indexOf('%%', i + 2);
      if (close === -1) {
        result += '%%';
        i += 2;
      } else {
        i = close + 2;
      }
    } else if (
      char === '[' &&
      text.charAt(i - 1) !== '!' &&
      (piece = match(WIKILINK, i))
    ) {
      result += add(piece);
      i += piece.length;
    } else if (
      char === '=' &&
      text.charAt(i - 1) !== '=' &&
      (piece = match(HIGHLIGHT, i))
    ) {
      result += add(piece);
      i += piece.length;
    } else if (
      char === '#' &&
      !NOT_BEFORE_TAG.test(text.charAt(i - 1)) &&
      (piece = match(TAG, i)) &&
      /\D/.test(piece.slice(1))
    ) {
      result += add(piece);
      i += piece.length;
    } else {
      result += char;
      i += 1;
    }
  }
  return result;
}

import { fencedLines, FRONT_MATTER } from './markdown';

export interface Formula {
  source: string;
  display: boolean;
}

export interface ExtractedMath {
  markdown: string;
  formulas: Formula[];
}

// Matches a token and captures the index of its formula.
export const MATH_TOKEN = /SpotlightMath(\d+)End/g;

const token = (index: number) => `SpotlightMath${index}End`;

export function extractMath(markdown: string): ExtractedMath {
  const frontMatter = FRONT_MATTER.exec(markdown)?.[0] ?? '';
  const lines = markdown.slice(frontMatter.length).split('\n');
  const fenced = fencedLines(lines.map((line) => line.replace(/\r$/, '')));

  const formulas: Formula[] = [];
  const out: string[] = [];
  let chunk: string[] = [];
  const flush = () => {
    if (chunk.length === 0) return;
    out.push(replaceMath(chunk.join('\n'), formulas));
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

  return { markdown: frontMatter + out.join('\n'), formulas };
}

function replaceMath(text: string, formulas: Formula[]): string {
  const add = (source: string, display: boolean) => {
    formulas.push({ source, display });
    return token(formulas.length - 1);
  };

  let result = '';
  let i = 0;
  while (i < text.length) {
    const char = text.charAt(i);

    if (char === '\\') {
      result += text.slice(i, i + 2);
      i += 2;
    } else if (char === '`') {
      const end = codeSpanEnd(text, i);
      result += text.slice(i, end);
      i = end;
    } else if (char === '$' && text.charAt(i + 1) === '$') {
      const close = displayEnd(text, i + 2);
      const source = close === -1 ? '' : text.slice(i + 2, close).trim();
      if (source === '') {
        result += '$$';
        i += 2;
      } else {
        result += add(source, true);
        i = close + 2;
      }
    } else if (char === '$') {
      const close = inlineEnd(text, i);
      if (close === -1) {
        result += '$';
        i += 1;
      } else {
        result += add(text.slice(i + 1, close), false);
        i = close + 1;
      }
    } else {
      result += char;
      i += 1;
    }
  }
  return result;
}

// Index just past a code span that opens at `start`, or past the opening
// backticks alone when it never closes.
function codeSpanEnd(text: string, start: number): number {
  let size = 0;
  while (text.charAt(start + size) === '`') size++;
  const marks = '`'.repeat(size);

  for (
    let at = text.indexOf(marks, start + size);
    at !== -1;
    at = text.indexOf(marks, at + 1)
  ) {
    if (text.charAt(at - 1) !== '`' && text.charAt(at + size) !== '`') {
      return at + size;
    }
  }
  return start + size;
}

// Index of the `$$` that closes display math, or -1.
function displayEnd(text: string, from: number): number {
  for (let at = from; at < text.length; ) {
    if (text.charAt(at) === '\\') at += 2;
    else if (text.startsWith('$$', at)) return at;
    else at += 1;
  }
  return -1;
}

// Index of the `$` that closes the inline math opened at `open`, or -1.
function inlineEnd(text: string, open: number): number {
  const next = text.charAt(open + 1);
  if (next === '' || /\s/.test(next)) return -1;

  for (let at = open + 1; at < text.length; ) {
    const char = text.charAt(at);
    if (char === '\n') return -1;
    if (char === '\\') {
      at += 2;
    } else if (char === '$') {
      const closes =
        !/\s/.test(text.charAt(at - 1)) && !/\d/.test(text.charAt(at + 1));
      return closes ? at : -1;
    } else {
      at += 1;
    }
  }
  return -1;
}

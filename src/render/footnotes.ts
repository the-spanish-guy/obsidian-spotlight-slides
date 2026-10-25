import { codeSpanEnd, fencedLines, FRONT_MATTER } from './markdown';

export interface Footnote {
  // Two references with the same key are the same note.
  key: string;
  // The Markdown of the note, rendered by Obsidian.
  text: string;
}

export interface ExtractedFootnotes {
  markdown: string;
  // One entry per reference in the text, in the order they appear.
  footnotes: Footnote[];
}

// Matches a token and captures the index of its footnote.
export const NOTE_TOKEN = /SpotlightNote(\d+)End/g;

const DEFINITION = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]*(.*)$/;
const CONTINUATION = /^(?: {2,}|\t)(.*)$/;
const REFERENCE = /\[\^([^\]\s]+)\]/y;
const INLINE_NOTE = /\^\[([^\]\n]+)\]/y;

export function extractFootnotes(markdown: string): ExtractedFootnotes {
  const frontMatter = FRONT_MATTER.exec(markdown)?.[0] ?? '';
  const lines = markdown.slice(frontMatter.length).split('\n');
  const text = lines.map((line) => line.replace(/\r$/, ''));
  const fenced = fencedLines(text);

  // First, the definitions: they may come after the references that use them.
  const definitions = new Map<string, string>();
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const definition = fenced[i] ? null : DEFINITION.exec(text[i] ?? '');
    if (!definition) {
      kept.push(lines[i] ?? '');
      continue;
    }

    const parts = [definition[2] ?? ''];
    while (i + 1 < lines.length && !fenced[i + 1]) {
      const more = CONTINUATION.exec(text[i + 1] ?? '');
      if (!more) break;
      parts.push(more[1] ?? '');
      i++;
    }
    const id = definition[1] ?? '';
    if (!definitions.has(id)) definitions.set(id, parts.join('\n').trim());
  }

  // Then the references, in the lines that are left.
  const keptFenced = fencedLines(kept.map((line) => line.replace(/\r$/, '')));
  const footnotes: Footnote[] = [];
  const out: string[] = [];
  let chunk: string[] = [];
  const flush = () => {
    if (chunk.length === 0) return;
    out.push(replaceReferences(chunk.join('\n'), definitions, footnotes));
    chunk = [];
  };
  kept.forEach((line, i) => {
    if (keptFenced[i]) {
      flush();
      out.push(line);
    } else {
      chunk.push(line);
    }
  });
  flush();

  return { markdown: frontMatter + out.join('\n'), footnotes };
}

function replaceReferences(
  text: string,
  definitions: Map<string, string>,
  footnotes: Footnote[],
): string {
  const add = (key: string, note: string) => {
    footnotes.push({ key, text: note });
    return `SpotlightNote${footnotes.length - 1}End`;
  };
  const match = (pattern: RegExp, at: number) => {
    pattern.lastIndex = at;
    return pattern.exec(text) ?? undefined;
  };

  let result = '';
  let i = 0;
  while (i < text.length) {
    const char = text.charAt(i);
    let found: RegExpExecArray | undefined;

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
    } else if (
      char === '[' &&
      (found = match(REFERENCE, i)) &&
      definitions.has(found[1] ?? '')
    ) {
      const id = found[1] ?? '';
      result += add(id, definitions.get(id) ?? '');
      i += found[0].length;
    } else if (char === '^' && (found = match(INLINE_NOTE, i))) {
      result += add(`inline-${footnotes.length}`, found[1] ?? '');
      i += found[0].length;
    } else {
      result += char;
      i += 1;
    }
  }
  return result;
}

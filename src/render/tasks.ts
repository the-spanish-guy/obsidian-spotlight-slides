import { fencedLines, FRONT_MATTER } from './markdown';

export interface ExtractedTasks {
  markdown: string;
  // The Markdown of each list, as written in the note.
  tasks: string[];
}

// Matches a paragraph that holds nothing but a token, capturing its index.
export const TASKS_TOKEN = /^SpotlightTasks(\d+)End$/;

const LIST_ITEM = /^ {0,3}(?:[-*+]|\d+[.)])(?:[ \t]|$)/;
const TASK_ITEM = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[.\](?:[ \t]|$)/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const INDENTED = /^[ \t]+\S/;

export function extractTasks(markdown: string): ExtractedTasks {
  const frontMatter = FRONT_MATTER.exec(markdown)?.[0] ?? '';
  const lines = markdown.slice(frontMatter.length).split('\n');
  const text = lines.map((line) => line.replace(/\r$/, ''));
  const fenced = fencedLines(text);

  const isItem = (i: number) =>
    !fenced[i] && LIST_ITEM.test(text[i] ?? '') && !RULE.test(text[i] ?? '');
  const continues = (i: number) =>
    !fenced[i] && (isItem(i) || INDENTED.test(text[i] ?? ''));

  const tasks: string[] = [];
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!isItem(i)) {
      out.push(lines[i] ?? '');
      continue;
    }

    // Take the whole list, blank lines included while it goes on.
    let end = i;
    for (let next = i + 1; next < lines.length; next++) {
      if (continues(next)) {
        end = next;
      } else if ((text[next] ?? '').trim() !== '') {
        break;
      }
    }

    const block = text.slice(i, end + 1);
    if (block.some((line) => TASK_ITEM.test(line))) {
      tasks.push(block.join('\n'));
      // Blank lines keep the token a paragraph of its own.
      out.push('', `SpotlightTasks${tasks.length - 1}End`, '');
    } else {
      out.push(...lines.slice(i, end + 1));
    }
    i = end;
  }

  return { markdown: frontMatter + out.join('\n'), tasks };
}

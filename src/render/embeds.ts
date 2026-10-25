import { IMAGE_EXTENSIONS } from './images';
import { fencedLines, FRONT_MATTER, mapOutsideCodeSpans } from './markdown';

export interface ExtractedEmbeds {
  markdown: string;
  // The embed as written in the note, e.g. `![[nota#Seção]]`.
  embeds: string[];
}

// Matches a token and captures the index of its embed.
export const EMBED_TOKEN = /SpotlightEmbed(\d+)End/g;

const WIKI_EMBED = /!\[\[([^\]|\n]+?)(?:\|([^\]\n]*))?\]\]/g;

export function extractEmbeds(markdown: string): ExtractedEmbeds {
  const frontMatter = FRONT_MATTER.exec(markdown)?.[0] ?? '';
  const lines = markdown.slice(frontMatter.length).split('\n');
  const fenced = fencedLines(lines.map((line) => line.replace(/\r$/, '')));

  const embeds: string[] = [];
  const replace = (text: string) =>
    text.replace(WIKI_EMBED, (match, target: string) => {
      if (isImage(target) || isSameNote(target)) return match;
      embeds.push(match);
      return `SpotlightEmbed${embeds.length - 1}End`;
    });

  const body = lines.map((line, i) =>
    fenced[i] ? line : mapOutsideCodeSpans(line, replace),
  );
  return { markdown: frontMatter + body.join('\n'), embeds };
}

function isImage(target: string): boolean {
  const path = (target.split(/[#^]/)[0] ?? '').trim();
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(extension);
}

// `![[#Seção]]` points into the note itself, which the slide is not.
function isSameNote(target: string): boolean {
  return (target.split(/[#^]/)[0] ?? '').trim() === '';
}

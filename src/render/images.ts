// Rewrites the images of a note into plain Markdown images that Marp can use,
// with the URL the app serves the file from.
//
// Handles Obsidian embeds (`![[foto.png|300]]`) and Markdown images pointing to
// vault files (`![alt](pasta/foto.png)`). The Obsidian alias becomes Marp's alt,
// so Marp keywords work in it: `![[foto.png|bg left:40%]]`, `|h:200`. A bare
// `|300` or `|300x200` is Obsidian's size and becomes `w:300` / `w:300 h:200`.
// Images that cannot be resolved, external URLs, code fences and code spans are
// left as they are.

import { fencedLines, FRONT_MATTER } from './markdown';

// Maps a link path to the URL of the vault file, or null when there is none.
export type ImageResolver = (linkpath: string) => string | null;

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'svg',
  'webp',
  'avif',
]);

const WIKI_EMBED = /!\[\[([^\]|\n]+?)(?:\|([^\]\n]*))?\]\]/g;
const MARKDOWN_IMAGE =
  /!\[([^\]\n]*)\]\(\s*(<[^>\n]*>|[^)\s]*)(\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
const CODE_SPAN = /(`+)(?!`)(.+?)(?<!`)\1(?!`)/g;
const URL_SCHEME = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;

export function rewriteImages(
  markdown: string,
  resolve: ImageResolver,
): string {
  const frontMatter = FRONT_MATTER.exec(markdown)?.[0] ?? '';
  const lines = markdown.slice(frontMatter.length).split('\n');
  const fenced = fencedLines(lines.map((line) => line.replace(/\r$/, '')));

  const body = lines.map((line, i) =>
    fenced[i] ? line : rewriteLine(line, resolve),
  );
  return frontMatter + body.join('\n');
}

// Joins a link written relative to a note's folder, resolving `.` and `..`.
export function resolveRelative(dir: string, path: string): string {
  const parts: string[] = [];
  for (const part of `${dir}/${path}`.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '' && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

function rewriteLine(line: string, resolve: ImageResolver): string {
  let result = '';
  let last = 0;

  for (const span of line.matchAll(CODE_SPAN)) {
    result += rewriteText(line.slice(last, span.index), resolve);
    result += span[0];
    last = span.index + span[0].length;
  }
  return result + rewriteText(line.slice(last), resolve);
}

function rewriteText(text: string, resolve: ImageResolver): string {
  return text
    .replace(WIKI_EMBED, (match, target: string, alias?: string) => {
      const linkpath = (target.split(/[#^]/)[0] ?? '').trim();
      const url = isImage(linkpath) ? resolve(linkpath) : null;
      return url ? image(aliasToAlt(alias), url) : match;
    })
    .replace(
      MARKDOWN_IMAGE,
      (match, alt: string, target: string, title?: string) => {
        const linkpath = decode(
          target.startsWith('<') ? target.slice(1, -1) : target,
        );
        if (linkpath === '' || URL_SCHEME.test(linkpath)) return match;

        const url = isImage(linkpath) ? resolve(linkpath) : null;
        return url ? image(alt, url, title) : match;
      },
    );
}

function aliasToAlt(alias: string | undefined): string {
  const text = alias?.trim() ?? '';
  const size = /^(\d+)(?:x(\d+))?$/.exec(text);
  if (!size) return text;
  return size[2] ? `w:${size[1]} h:${size[2]}` : `w:${size[1]}`;
}

function image(alt: string, url: string, title = ''): string {
  return `![${alt}](<${url}>${title})`;
}

function isImage(path: string): boolean {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(extension);
}

function decode(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

import { Marp } from '@marp-team/marp-core';
import { autoSlideStarts, isMarpDeck, toMarpMarkdown } from './auto';
import { extractCallouts } from './callouts';
import { extractEmbeds } from './embeds';
import { extractFootnotes, type Footnote } from './footnotes';
import { type ImageResolver, rewriteImages } from './images';
import { extractInline } from './inline';
import { extractMath, type Formula } from './math';
import { extractTasks } from './tasks';
import { OBSIDIAN_THEME_CSS } from './theme';

export interface RenderedDeck {
  html: string;
  css: string;
  formulas: Formula[];
  footnotes: Footnote[];
  callouts: string[];
  tasks: string[];
  embeds: string[];
  inline: string[];
  slideStarts: number[];
}

// Marp is instantiated on first use so it costs nothing at plugin startup.
let marp: Marp | undefined;

function getMarp(): Marp {
  if (!marp) {
    // Emoji stay as text: Marp would swap them for Twemoji images that are
    // fetched from a CDN. Math is Obsidian's, so Marp's own is off.
    marp = new Marp({
      html: false,
      script: false,
      math: false,
      emoji: { shortcode: false, unicode: false },
    });
    marp.themeSet.default = marp.themeSet.add(OBSIDIAN_THEME_CSS);
  }
  return marp;
}

// Marp marks the line each of its slides starts at, so a Marp deck asks Marp;
// a note in automatic mode asks the code that cuts it. The note goes through
// cuts before Marp sees it, which can in rare cases change where it breaks, so
// the result is trusted only when it has as many slides as were drawn.
function slideStarts(markdown: string, drawn: number): number[] {
  const starts = isMarpDeck(markdown)
    ? marpSlideStarts(markdown)
    : autoSlideStarts(markdown);
  return starts.length === drawn ? starts : [];
}

interface Token {
  type: string;
  map: [number, number] | null;
}

function marpSlideStarts(markdown: string): number[] {
  const parser = getMarp().markdown as unknown as {
    parse(source: string, env: object): Token[];
  };
  return parser
    .parse(markdown, {})
    .filter((token) => token.type === 'marpit_slide_open')
    .map((token) => token.map?.[0] ?? 0);
}

// Blocks come first, so what sits inside a callout or a task list is left to
// Obsidian whole; the inline pieces and the images come last.
export function renderDeck(
  markdown: string,
  resolveImage: ImageResolver,
): RenderedDeck {
  const withoutFootnotes = extractFootnotes(markdown);
  const withoutCallouts = extractCallouts(withoutFootnotes.markdown);
  const withoutTasks = extractTasks(withoutCallouts.markdown);
  const withoutEmbeds = extractEmbeds(withoutTasks.markdown);
  const withoutMath = extractMath(withoutEmbeds.markdown);
  const withoutInline = extractInline(withoutMath.markdown);

  const { html, css } = getMarp().render(
    toMarpMarkdown(rewriteImages(withoutInline.markdown, resolveImage)),
  );
  return {
    html,
    css,
    formulas: withoutMath.formulas,
    footnotes: withoutFootnotes.footnotes,
    callouts: withoutCallouts.callouts,
    tasks: withoutTasks.tasks,
    embeds: withoutEmbeds.embeds,
    inline: withoutInline.inline,
    slideStarts: slideStarts(
      markdown,
      (html.match(/data-marpit-svg/g) ?? []).length,
    ),
  };
}

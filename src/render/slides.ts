import { Marp } from '@marp-team/marp-core';
import { toMarpMarkdown } from './auto';
import { extractCallouts } from './callouts';
import { extractEmbeds } from './embeds';
import { type ImageResolver, rewriteImages } from './images';
import { extractInline } from './inline';
import { extractMath, type Formula } from './math';
import { extractTasks } from './tasks';
import { OBSIDIAN_THEME_CSS } from './theme';

export interface RenderedDeck {
  html: string;
  css: string;
  formulas: Formula[];
  callouts: string[];
  tasks: string[];
  embeds: string[];
  inline: string[];
}

// Marp is instantiated on first use so it costs nothing at plugin startup.
let marp: Marp | undefined;

function getMarp(): Marp {
  if (!marp) {
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

// Blocks come first, so what sits inside a callout or a task list is left to
// Obsidian whole; the inline pieces and the images come last.
export function renderDeck(
  markdown: string,
  resolveImage: ImageResolver,
): RenderedDeck {
  const withoutCallouts = extractCallouts(markdown);
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
    callouts: withoutCallouts.callouts,
    tasks: withoutTasks.tasks,
    embeds: withoutEmbeds.embeds,
    inline: withoutInline.inline,
  };
}

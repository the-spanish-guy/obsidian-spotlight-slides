import { Marp } from '@marp-team/marp-core';
import { toMarpMarkdown } from './auto';
import { type ImageResolver, rewriteImages } from './images';
import { type Formula, extractMath } from './math';
import { OBSIDIAN_THEME_CSS } from './theme';

export interface RenderedDeck {
  html: string;
  css: string;
  formulas: Formula[];
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

export function renderDeck(
  markdown: string,
  resolveImage: ImageResolver,
): RenderedDeck {
  const { markdown: text, formulas } = extractMath(markdown);
  const { html, css } = getMarp().render(
    toMarpMarkdown(rewriteImages(text, resolveImage)),
  );
  return { html, css, formulas };
}

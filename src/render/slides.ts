import { Marp } from '@marp-team/marp-core';
import { toMarpMarkdown } from './auto';
import { type ImageResolver, rewriteImages } from './images';
import { OBSIDIAN_THEME_CSS } from './theme';

export interface RenderedDeck {
  html: string;
  css: string;
}

// Marp is instantiated on first use so it costs nothing at plugin startup.
let marp: Marp | undefined;

function getMarp(): Marp {
  if (!marp) {
    marp = new Marp({ html: false, script: false });
    marp.themeSet.default = marp.themeSet.add(OBSIDIAN_THEME_CSS);
  }
  return marp;
}

export function renderDeck(
  markdown: string,
  resolveImage: ImageResolver,
): RenderedDeck {
  const { html, css } = getMarp().render(
    toMarpMarkdown(rewriteImages(markdown, resolveImage)),
  );
  return { html, css };
}

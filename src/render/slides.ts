import { Marp } from '@marp-team/marp-core';
import { toMarpMarkdown } from './auto';
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

export function renderDeck(markdown: string): RenderedDeck {
	const { html, css } = getMarp().render(toMarpMarkdown(markdown));
	return { html, css };
}

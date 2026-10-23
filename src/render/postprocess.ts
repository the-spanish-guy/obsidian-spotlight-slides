import { type App, type Component, MarkdownRenderer } from 'obsidian';
import type { HighlighterChoice } from '../settings';

// Languages whose rendering belongs to Obsidian (or other plugins) even when
// Marp is the chosen highlighter.
const OBSIDIAN_ONLY_LANGUAGES = new Set(['mermaid']);

function fence(code: string, lang: string): string {
	const longestRun = Math.max(
		0,
		...(code.match(/`+/g) ?? []).map((run) => run.length),
	);
	const marks = '`'.repeat(Math.max(3, longestRun + 1));
	return `${marks}${lang}\n${code}\n${marks}`;
}

function languageOf(code: HTMLElement): string {
	const cls = Array.from(code.classList).find((c) => c.startsWith('language-'));
	return cls ? cls.slice('language-'.length) : '';
}

// Swaps the code blocks Marp produced for what Obsidian's own renderer yields,
// which also triggers other plugins' code block processors (mermaid, dataview…).
export async function renderCodeBlocksWithObsidian(
	root: HTMLElement,
	app: App,
	component: Component,
	sourcePath: string,
	highlighter: HighlighterChoice,
): Promise<void> {
	const blocks = Array.from(root.querySelectorAll<HTMLElement>('pre > code'));

	await Promise.all(
		blocks.map(async (code) => {
			const lang = languageOf(code);
			const useObsidian =
				highlighter === 'obsidian' || OBSIDIAN_ONLY_LANGUAGES.has(lang);
			const pre = code.parentElement;
			if (!useObsidian || !pre) return;

			const host = createDiv({ cls: 'spotlight-block' });
			host.dataset.lang = lang;
			await MarkdownRenderer.render(
				app,
				fence(code.textContent ?? '', lang),
				host,
				sourcePath,
				component,
			);
			pre.replaceWith(host);
		}),
	);
}

import { type App, type Component, MarkdownRenderer } from 'obsidian';

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
): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('pre > code'));

  await Promise.all(
    blocks.map(async (code) => {
      const pre = code.parentElement;
      if (!pre) return;

      const lang = languageOf(code);
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

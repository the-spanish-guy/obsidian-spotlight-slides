import {
  type App,
  type Component,
  finishRenderMath,
  loadMathJax,
  MarkdownRenderer,
  renderMath,
} from 'obsidian';
import { CALLOUT_TOKEN } from './callouts';
import { EMBED_TOKEN } from './embeds';
import { type Formula, MATH_TOKEN } from './math';

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

function mathElement({ source, display }: Formula): HTMLElement {
  const host = display
    ? createDiv({ cls: 'math math-block' })
    : createSpan({ cls: 'math math-inline' });
  try {
    host.appendChild(renderMath(source, display));
  } catch {
    host.setText(display ? `$$${source}$$` : `$${source}$`);
  }
  return host;
}

export async function renderMathWithObsidian(
  root: HTMLElement,
  formulas: Formula[],
): Promise<void> {
  if (formulas.length === 0) return;
  await loadMathJax();

  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (new RegExp(MATH_TOKEN.source).test(node.nodeValue ?? '')) {
      texts.push(node as Text);
    }
  }

  for (const text of texts) {
    const parts = (text.nodeValue ?? '').split(MATH_TOKEN);
    const nodes = parts.flatMap((part, i): Node[] => {
      if (i % 2 === 0)
        return part === '' ? [] : [document.createTextNode(part)];
      const formula = formulas[Number(part)];
      return formula ? [mathElement(formula)] : [];
    });

    const paragraph = text.parentElement;
    const alone =
      paragraph?.tagName === 'P' &&
      paragraph.childNodes.length === 1 &&
      nodes.length === 1 &&
      nodes[0] instanceof HTMLElement &&
      nodes[0].hasClass('math-block');
    if (alone) paragraph.replaceWith(...nodes);
    else text.replaceWith(...nodes);
  }

  await finishRenderMath();
}

export async function renderCalloutsWithObsidian(
  root: HTMLElement,
  app: App,
  component: Component,
  sourcePath: string,
  callouts: string[],
): Promise<void> {
  if (callouts.length === 0) return;

  const paragraphs = Array.from(root.querySelectorAll('p'));
  await Promise.all(
    paragraphs.map(async (paragraph) => {
      const index = CALLOUT_TOKEN.exec(
        paragraph.textContent?.trim() ?? '',
      )?.[1];
      const source = index === undefined ? undefined : callouts[Number(index)];
      if (source === undefined) return;

      const host = createDiv({ cls: 'spotlight-callout' });
      await MarkdownRenderer.render(app, source, host, sourcePath, component);
      paragraph.replaceWith(host);
    }),
  );
}

export async function renderEmbedsWithObsidian(
  root: HTMLElement,
  app: App,
  component: Component,
  sourcePath: string,
  embeds: string[],
): Promise<void> {
  if (embeds.length === 0) return;

  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (new RegExp(EMBED_TOKEN.source).test(node.nodeValue ?? '')) {
      texts.push(node as Text);
    }
  }

  for (const text of texts) {
    // Splitting on a pattern with one group alternates text and embed index.
    const parts = (text.nodeValue ?? '').split(EMBED_TOKEN);
    const nodes: Node[] = [];
    for (const [i, part] of parts.entries()) {
      if (i % 2 === 0) {
        if (part !== '') nodes.push(doc.createTextNode(part));
        continue;
      }
      const source = embeds[Number(part)];
      if (source === undefined) continue;

      const host = createDiv({ cls: 'spotlight-embed' });
      await MarkdownRenderer.render(app, source, host, sourcePath, component);
      nodes.push(host);
    }

    // An embed alone in its paragraph replaces the paragraph.
    const paragraph = text.parentElement;
    const alone =
      paragraph?.tagName === 'P' &&
      paragraph.childNodes.length === 1 &&
      nodes.length === 1;
    if (alone) paragraph.replaceWith(...nodes);
    else text.replaceWith(...nodes);
  }
}

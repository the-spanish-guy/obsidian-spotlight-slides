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
import { INLINE_TOKEN } from './inline';
import { type Formula, MATH_TOKEN } from './math';
import type { RenderedDeck } from './slides';
import { TASKS_TOKEN } from './tasks';

interface Context {
  root: HTMLElement;
  app: App;
  component: Component;
  sourcePath: string;
}

export async function postprocessDeck(
  context: Context,
  deck: RenderedDeck,
): Promise<void> {
  await renderCodeBlocksWithObsidian(context);
  await renderBlocksWithObsidian(
    context,
    deck.callouts,
    CALLOUT_TOKEN,
    'spotlight-callout',
  );
  await renderBlocksWithObsidian(
    context,
    deck.tasks,
    TASKS_TOKEN,
    'spotlight-tasks',
  );
  await renderEmbedsWithObsidian(context, deck.embeds);
  await renderInlineWithObsidian(context, deck.inline);
  await renderMathWithObsidian(context.root, deck.formulas);
}

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
async function renderCodeBlocksWithObsidian({
  root,
  app,
  component,
  sourcePath,
}: Context): Promise<void> {
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

// Swaps the paragraphs that hold only a token (a callout or a task list) for
// the Markdown of the block, rendered by Obsidian with its own styles.
async function renderBlocksWithObsidian(
  { root, app, component, sourcePath }: Context,
  blocks: string[],
  token: RegExp,
  cls: string,
): Promise<void> {
  if (blocks.length === 0) return;

  await Promise.all(
    Array.from(root.querySelectorAll('p')).map(async (paragraph) => {
      const index = token.exec(paragraph.textContent?.trim() ?? '')?.[1];
      const source = index === undefined ? undefined : blocks[Number(index)];
      if (source === undefined) return;

      const host = createDiv({ cls });
      await MarkdownRenderer.render(app, source, host, sourcePath, component);
      paragraph.replaceWith(host);
    }),
  );
}

// The text nodes that hold at least one token.
function textsWithTokens(root: HTMLElement, token: RegExp): Text[] {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (new RegExp(token.source).test(node.nodeValue ?? '')) {
      texts.push(node as Text);
    }
  }
  return texts;
}

// Splitting on a pattern with one group alternates text and token index.
function splitTokens(text: Text, token: RegExp): string[] {
  return (text.nodeValue ?? '').split(token);
}

// A node that replaced the only content of a paragraph takes its place.
function place(text: Text, nodes: Node[], replaceParagraph: boolean): void {
  const paragraph = text.parentElement;
  const alone =
    replaceParagraph &&
    paragraph?.tagName === 'P' &&
    paragraph.childNodes.length === 1 &&
    nodes.length === 1;
  if (alone) paragraph.replaceWith(...nodes);
  else text.replaceWith(...nodes);
}

// Swaps the tokens left for embedded notes and files, rendered by Obsidian: it
// resolves the file, section or block and guards against cycles.
async function renderEmbedsWithObsidian(
  { root, app, component, sourcePath }: Context,
  embeds: string[],
): Promise<void> {
  if (embeds.length === 0) return;

  const doc = root.ownerDocument;
  for (const text of textsWithTokens(root, EMBED_TOKEN)) {
    const nodes: Node[] = [];
    for (const [i, part] of splitTokens(text, EMBED_TOKEN).entries()) {
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
    place(text, nodes, true);
  }
}

// Swaps the tokens left for links, tags and highlights with what Obsidian
// renders for each: the nodes of the paragraph it makes around the piece.
async function renderInlineWithObsidian(
  { root, app, component, sourcePath }: Context,
  inline: string[],
): Promise<void> {
  if (inline.length === 0) return;

  const doc = root.ownerDocument;
  const texts = textsWithTokens(root, INLINE_TOKEN);

  const rendered = new Map<string, Node[]>();
  const indices = new Set(
    texts.flatMap((text) =>
      splitTokens(text, INLINE_TOKEN).filter((_, i) => i % 2 === 1),
    ),
  );
  await Promise.all(
    Array.from(indices, async (index) => {
      const source = inline[Number(index)];
      if (source === undefined) return;

      const host = createDiv();
      await MarkdownRenderer.render(app, source, host, sourcePath, component);
      markUnresolvedLinks(host, app, sourcePath);
      const paragraph = host.firstElementChild;
      const content = paragraph?.tagName === 'P' ? paragraph : host;
      rendered.set(index, Array.from(content.childNodes));
    }),
  );

  for (const text of texts) {
    const nodes = splitTokens(text, INLINE_TOKEN).flatMap((part, i) =>
      i % 2 === 0
        ? part === ''
          ? []
          : [doc.createTextNode(part)]
        : (rendered.get(part) ?? []),
    );
    place(text, nodes, false);
  }
}

// Obsidian flags links to notes that do not exist when it renders a note, but
// not when a plugin renders a piece, so it is done here.
function markUnresolvedLinks(host: HTMLElement, app: App, sourcePath: string) {
  for (const link of host.querySelectorAll<HTMLElement>('a.internal-link')) {
    const target = (link.dataset.href ?? '').split('#')[0] ?? '';
    const exists =
      target === '' ||
      app.metadataCache.getFirstLinkpathDest(target, sourcePath);
    link.toggleClass('is-unresolved', !exists);
  }
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

// Swaps the tokens `extractMath` left in the text for the formulas, rendered
// by Obsidian's own MathJax.
async function renderMathWithObsidian(
  root: HTMLElement,
  formulas: Formula[],
): Promise<void> {
  if (formulas.length === 0) return;
  await loadMathJax();

  const doc = root.ownerDocument;
  for (const text of textsWithTokens(root, MATH_TOKEN)) {
    const nodes = splitTokens(text, MATH_TOKEN).flatMap((part, i): Node[] => {
      if (i % 2 === 0) return part === '' ? [] : [doc.createTextNode(part)];
      const formula = formulas[Number(part)];
      return formula ? [mathElement(formula)] : [];
    });

    // A display formula alone in its paragraph replaces the paragraph.
    const display =
      nodes.length === 1 &&
      nodes[0] instanceof HTMLElement &&
      nodes[0].hasClass('math-block');
    place(text, nodes, display);
  }

  await finishRenderMath();
}

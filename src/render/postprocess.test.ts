// @vitest-environment happy-dom

import type { App } from 'obsidian';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  Component,
  mathState,
  rendered,
  resetObsidianFake,
  setMarkdownRenderer,
} from '../test/obsidian';
import { postprocessDeck } from './postprocess';
import type { RenderedDeck } from './slides';

const deck = (parts: Partial<RenderedDeck> = {}): RenderedDeck => ({
  html: '',
  css: '',
  formulas: [],
  footnotes: [],
  callouts: [],
  tasks: [],
  embeds: [],
  inline: [],
  ...parts,
});

// Notes that exist in the fake vault; any other link is unresolved.
function run(html: string, parts: Partial<RenderedDeck>, known: string[] = []) {
  const root = document.createElement('div');
  root.append(...new DOMParser().parseFromString(html, 'text/html').body.childNodes);
  const app = {
    metadataCache: {
      getFirstLinkpathDest: (link: string) => (known.includes(link) ? {} : null),
    },
  } as unknown as App;
  const done = postprocessDeck(
    {
      root,
      app,
      component: new Component() as unknown as import('obsidian').Component,
      sourcePath: 'nota.md',
    },
    deck(parts),
  );
  return { root, done };
}

// Obsidian renders a piece of Markdown into a paragraph.
const asParagraph = () =>
  setMarkdownRenderer((markdown, el) => {
    el.createEl('p', { text: markdown });
  });

beforeEach(() => resetObsidianFake());

describe('code blocks', () => {
  it('swaps a Marp code block for what Obsidian renders', async () => {
    const { root, done } = run(
      '<section><pre><code class="language-go">fmt.Println()</code></pre></section>',
      {},
    );
    await done;

    expect(root.querySelector('pre > code')).toBeNull();
    const block = root.querySelector<HTMLElement>('.spotlight-block');
    expect(block?.dataset.lang).toBe('go');
    expect(rendered[0]?.markdown).toBe('```go\nfmt.Println()\n```');
  });

  it('works without a language', async () => {
    const { done } = run('<pre><code>texto</code></pre>', {});
    await done;
    expect(rendered[0]?.markdown).toBe('```\ntexto\n```');
  });

  it('uses a longer fence when the code holds backticks', async () => {
    const { done } = run(
      '<pre><code class="language-md">```js\na\n```</code></pre>',
      {},
    );
    await done;
    expect(rendered[0]?.markdown.startsWith('````md\n')).toBe(true);
    expect(rendered[0]?.markdown.endsWith('\n````')).toBe(true);
  });

  it('passes the note path, which resolves relative links', async () => {
    const { done } = run('<pre><code>x</code></pre>', {});
    await done;
    expect(rendered[0]?.sourcePath).toBe('nota.md');
  });
});

describe('callouts and task lists', () => {
  it('swaps a token paragraph for the rendered block', async () => {
    setMarkdownRenderer((markdown, el) => {
      el.createDiv({ cls: 'callout', text: markdown });
    });
    const { root, done } = run(
      '<section><p>SpotlightCallout0End</p><p>SpotlightTasks0End</p></section>',
      { callouts: ['> [!note] A\n> b'], tasks: ['- [x] feito'] },
    );
    await done;

    expect(root.querySelector('.spotlight-callout .callout')?.textContent).toBe(
      '> [!note] A\n> b',
    );
    expect(root.querySelector('.spotlight-tasks .callout')?.textContent).toBe(
      '- [x] feito',
    );
    expect(root.querySelector('p')).toBeNull();
  });

  it('leaves a paragraph that merely mentions a token', async () => {
    const { root, done } = run('<p>veja SpotlightCallout0End aqui</p>', {
      callouts: ['> [!note] A'],
    });
    await done;
    expect(root.querySelector('.spotlight-callout')).toBeNull();
    expect(root.querySelector('p')?.textContent).toContain('SpotlightCallout0End');
  });

  it('leaves a token whose block is missing', async () => {
    const { root, done } = run('<p>SpotlightCallout5End</p>', {
      callouts: ['> [!note] A'],
    });
    await done;
    expect(root.querySelector('p')).not.toBeNull();
  });
});

describe('embeds', () => {
  it('replaces the paragraph when the embed is alone', async () => {
    asParagraph();
    const { root, done } = run('<section><p>SpotlightEmbed0End</p></section>', {
      embeds: ['![[outra nota#Seção]]'],
    });
    await done;

    expect(root.querySelector('section > p')).toBeNull();
    expect(root.querySelector('.spotlight-embed')?.textContent).toBe(
      '![[outra nota#Seção]]',
    );
    expect(rendered[0]?.markdown).toBe('![[outra nota#Seção]]');
  });

  it('keeps the text around an embed inside a sentence', async () => {
    asParagraph();
    const { root, done } = run('<p>Antes SpotlightEmbed0End depois</p>', {
      embeds: ['![[x]]'],
    });
    await done;

    const paragraph = root.querySelector('p');
    expect(paragraph?.firstChild?.textContent).toBe('Antes ');
    expect(paragraph?.querySelector('.spotlight-embed')).not.toBeNull();
    expect(paragraph?.lastChild?.textContent).toBe(' depois');
  });

  it('handles several embeds in the same text', async () => {
    asParagraph();
    const { root, done } = run('<p>SpotlightEmbed0End e SpotlightEmbed1End</p>', {
      embeds: ['![[a]]', '![[b]]'],
    });
    await done;
    const hosts = root.querySelectorAll('.spotlight-embed');
    expect(Array.from(hosts, (h) => h.textContent)).toEqual(['![[a]]', '![[b]]']);
  });
});

describe('links, tags and highlights', () => {
  const link = (href: string, text = href) =>
    setMarkdownRenderer((_markdown, el) => {
      const p = el.createEl('p');
      p.createEl('a', { cls: 'internal-link', text, attr: { 'data-href': href } });
    });

  it('puts what Obsidian renders in place of the token, without its paragraph', async () => {
    link('nota');
    const { root, done } = run('<p>Veja SpotlightInline0End aqui.</p>', {
      inline: ['[[nota]]'],
    }, ['nota']);
    await done;

    const paragraph = root.querySelector('p');
    expect(paragraph?.querySelector('p')).toBeNull();
    expect(paragraph?.textContent).toBe('Veja nota aqui.');
    expect(paragraph?.querySelector('a.internal-link')).not.toBeNull();
  });

  it('flags a link to a note that does not exist', async () => {
    link('nao-existe');
    const { root, done } = run('<p>SpotlightInline0End</p>', {
      inline: ['[[nao-existe]]'],
    });
    await done;
    expect(root.querySelector('a')?.classList.contains('is-unresolved')).toBe(true);
  });

  it('does not flag a link to a note that exists, or to a section', async () => {
    link('nota#Seção');
    const known = run('<p>SpotlightInline0End</p>', { inline: ['[[nota#Seção]]'] }, ['nota']);
    await known.done;
    expect(known.root.querySelector('a')?.classList.contains('is-unresolved')).toBe(false);

    link('#Seção');
    const same = run('<p>SpotlightInline0End</p>', { inline: ['[[#Seção]]'] });
    await same.done;
    expect(same.root.querySelector('a')?.classList.contains('is-unresolved')).toBe(false);
  });

  it('places several pieces in order', async () => {
    asParagraph();
    const { root, done } = run(
      '<p>A SpotlightInline0End B SpotlightInline1End C</p>',
      { inline: ['#tag', '==realce=='] },
    );
    await done;
    expect(root.querySelector('p')?.textContent).toBe('A #tag B ==realce== C');
  });

  it('renders each piece once', async () => {
    asParagraph();
    const { done } = run('<p>SpotlightInline0End</p><p>SpotlightInline1End</p>', {
      inline: ['#a', '#b'],
    });
    await done;
    expect(rendered.map((r) => r.markdown)).toEqual(['#a', '#b']);
  });
});

describe('footnotes', () => {
  const notes = [
    { key: 'x', text: 'Nota X' },
    { key: 'y', text: 'Nota Y' },
    { key: 'x', text: 'Nota X' },
  ];

  it('numbers the notes of each slide from 1 and adds them at its foot', async () => {
    asParagraph();
    const { root, done } = run(
      '<section id="s1"><p>a SpotlightNote0End b SpotlightNote1End</p></section>' +
        '<section id="s2"><p>c SpotlightNote1End</p></section>' +
        '<section id="s3"><p>sem notas</p></section>',
      { footnotes: notes },
    );
    await done;

    const [s1, s2, s3] = Array.from(root.querySelectorAll('section'));
    expect(Array.from(s1?.querySelectorAll('.spotlight-footnote-ref') ?? [], (e) => e.textContent)).toEqual(['1', '2']);
    expect(Array.from(s1?.querySelectorAll('.spotlight-footnote') ?? [], (e) => e.textContent)).toEqual(['1Nota X', '2Nota Y']);
    expect(s2?.querySelector('.spotlight-footnote-ref')?.textContent).toBe('1');
    expect(s2?.querySelector('.spotlight-footnote')?.textContent).toBe('1Nota Y');
    expect(s3?.querySelector('.spotlight-footnotes')).toBeNull();
  });

  it('gives a note cited twice on a slide the same number', async () => {
    asParagraph();
    const { root, done } = run(
      '<section><p>SpotlightNote0End e SpotlightNote1End e SpotlightNote2End</p></section>',
      { footnotes: notes },
    );
    await done;

    const refs = Array.from(root.querySelectorAll('.spotlight-footnote-ref'), (e) => e.textContent);
    expect(refs).toEqual(['1', '2', '1']);
    expect(root.querySelectorAll('.spotlight-footnote')).toHaveLength(2);
  });

  it('renders the note text with Obsidian, so formulas and links work', async () => {
    asParagraph();
    const { done } = run('<section><p>a SpotlightNote0End</p></section>', {
      footnotes: [{ key: 'z', text: 'Com **negrito**' }],
    });
    await done;
    expect(rendered.map((r) => r.markdown)).toEqual(['Com **negrito**']);
  });

  it('puts the notes after the slide content', async () => {
    asParagraph();
    const { root, done } = run('<section><h1>T</h1><p>a SpotlightNote0End</p></section>', {
      footnotes: [{ key: 'z', text: 'N' }],
    });
    await done;
    expect(root.querySelector('section')?.lastElementChild?.className).toBe('spotlight-footnotes');
  });

  it('works for a token that Obsidian rendered inside a callout', async () => {
    setMarkdownRenderer((markdown, el) => {
      if (markdown.startsWith('>')) {
        el.createDiv({ cls: 'callout' }).createEl('p', {
          text: 'Texto SpotlightNote0End',
        });
      } else {
        el.createEl('p', { text: markdown });
      }
    });
    const { root, done } = run('<section><p>SpotlightCallout0End</p></section>', {
      callouts: ['> [!note] x[^1]'],
      footnotes: [{ key: '1', text: 'Dentro do callout' }],
    });
    await done;

    expect(root.querySelector('.callout .spotlight-footnote-ref')?.textContent).toBe('1');
    expect(root.querySelector('.spotlight-footnote')?.textContent).toContain('Dentro do callout');
  });
});

describe('math', () => {
  const formulas = [
    { source: 'x^2', display: false },
    { source: 'E=mc^2', display: true },
  ];

  it('renders inline formulas in the text and display ones as a block', async () => {
    const { root, done } = run(
      '<section><p>Texto SpotlightMath0End mais</p><p>SpotlightMath1End</p></section>',
      { formulas },
    );
    await done;

    const inline = root.querySelector<HTMLElement>('span.math-inline mjx-container');
    expect(inline?.dataset.source).toBe('x^2');
    expect(inline?.dataset.display).toBe('false');
    expect(root.querySelector('p')?.textContent).toBe('Texto  mais');

    const block = root.querySelector<HTMLElement>('div.math-block mjx-container');
    expect(block?.dataset.source).toBe('E=mc^2');
    expect(root.querySelectorAll('p')).toHaveLength(1);
  });

  it('keeps a display formula inside its paragraph when text surrounds it', async () => {
    const { root, done } = run('<p>antes SpotlightMath1End depois</p>', { formulas });
    await done;
    expect(root.querySelector('p .math-block')).not.toBeNull();
  });

  it('loads MathJax only when there are formulas', async () => {
    const without = run('<p>texto</p>', {});
    await without.done;
    expect(mathState.loaded).toBe(0);

    const withMath = run('<p>SpotlightMath0End</p>', { formulas });
    await withMath.done;
    expect(mathState.loaded).toBe(1);
    expect(mathState.finished).toBe(1);
  });

  it('falls back to the source when a formula cannot be rendered', async () => {
    mathState.fail = true;
    const { root, done } = run('<p>SpotlightMath0End</p><p>SpotlightMath1End</p>', { formulas });
    await done;
    expect(root.textContent).toBe('$x^2$$$E=mc^2$$');
  });
});

describe('an empty deck', () => {
  it('asks Obsidian for nothing and leaves the slides as they are', async () => {
    const html = '<section><p>texto <b>forte</b></p></section>';
    const { root, done } = run(html, {});
    await done;
    expect(rendered).toHaveLength(0);
    expect(root.innerHTML).toBe(html);
  });
});

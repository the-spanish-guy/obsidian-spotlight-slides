import { describe, expect, it } from 'vitest';
import type { ImageResolver } from './images';
import { renderDeck } from './slides';

// These run the real Marp, so they check how the steps work together.
const noImages: ImageResolver = () => null;
const render = (markdown: string, resolve: ImageResolver = noImages) =>
  renderDeck(markdown, resolve);
const slideCount = (html: string) => (html.match(/data-marpit-svg/g) ?? []).length;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('slides', () => {
  it('splits a plain note into slides', () => {
    const { html } = render('## A\ntexto\n## B\noutro');
    expect(slideCount(html)).toBe(2);
  });

  it('leaves a Marp deck to the author', () => {
    const { html } = render('---\nmarp: true\n---\n\n# Um\n\n---\n\n# Dois\n\n---\n\n# Três');
    expect(slideCount(html)).toBe(3);
  });

  it('uses the Obsidian theme, taking its colors from Obsidian', () => {
    const { css } = render('# Oi');
    expect(css).toContain('var(--background-primary)');
    expect(css).toContain('var(--text-normal)');
  });
});

describe('what Obsidian renders is kept out of Marp', () => {
  it('cuts each piece out and leaves a token behind', () => {
    const deck = render(
      [
        '# Título',
        '',
        'Veja [[nota]], #tag e ==realce==, a fórmula $x^2$ e a nota[^1].',
        '',
        '$$',
        'a_1 + b_2',
        '$$',
        '',
        '![[outra nota]]',
        '',
        '> [!note] Aviso',
        '> corpo',
        '',
        '- [x] feito',
        '- [ ] a fazer',
        '',
        '[^1]: Texto da nota.',
      ].join('\n'),
    );

    expect(deck.inline).toEqual(['[[nota]]', '#tag', '==realce==']);
    expect(deck.formulas.map((f) => f.source)).toEqual(['x^2', 'a_1 + b_2']);
    expect(deck.formulas.map((f) => f.display)).toEqual([false, true]);
    expect(deck.embeds).toEqual(['![[outra nota]]']);
    expect(deck.callouts).toEqual(['> [!note] Aviso\n> corpo']);
    expect(deck.tasks).toEqual(['- [x] feito\n- [ ] a fazer']);
    expect(deck.footnotes).toEqual([{ key: '1', text: 'Texto da nota.' }]);

    const shown = text(deck.html);
    for (const raw of ['[[', '$$', '$x', '[^1]', '> [!', '- [x]', '==realce']) {
      expect(shown).not.toContain(raw);
    }
  });

  it('puts a token where each piece was', () => {
    const { html } = render('Veja [[nota]] e $x$ e a nota[^1].\n\n[^1]: N');
    expect(html).toMatch(/SpotlightInline0End/);
    expect(html).toMatch(/SpotlightMath0End/);
    expect(html).toMatch(/SpotlightNote0End/);
  });

  it('keeps a formula out of the Markdown parser', () => {
    const { html } = render('Com $a_1 + b_2$ e $x * y * z$.');
    expect(html).not.toContain('<em>');
  });

  it('keeps a footnote reference inside a callout for Obsidian to render', () => {
    const deck = render('> [!note] Aviso\n> texto com nota[^1]\n\n[^1]: Dentro.');
    expect(deck.callouts[0]).toContain('SpotlightNote0End');
    expect(deck.footnotes).toHaveLength(1);
  });

  it('leaves what is inside a task list to Obsidian', () => {
    const deck = render('- [ ] ver [[nota]] e $x$ #tag');
    expect(deck.tasks[0]).toBe('- [ ] ver [[nota]] e $x$ #tag');
    expect(deck.inline).toEqual([]);
    expect(deck.formulas).toEqual([]);
  });

  it('does not touch code', () => {
    const deck = render('`[[a]] #b $c$`\n\n```md\n[[d]] ==e== $f$\n```');
    expect(deck.inline).toEqual([]);
    expect(deck.formulas).toEqual([]);
    expect(deck.html).toContain('[[d]]');
  });

  it('keeps the code blocks for Obsidian to swap', () => {
    const { html } = render('```go\npackage db\n```\n\n```mermaid\nflowchart TD\n  A --> B\n```');
    expect(html).toContain('<code class="language-go">');
    expect(html).toContain('<code class="language-mermaid">');
  });
});

describe('images', () => {
  it('asks for each image and shows the one that was found', () => {
    const asked: string[] = [];
    const { html } = render('![[foto.png|300]]\n\n![alt](pasta/b.jpg)', (path) => {
      asked.push(path);
      return `app://vault/${path}`;
    });

    expect(asked).toEqual(['foto.png', 'pasta/b.jpg']);
    expect(html).toContain('app://vault/foto.png');
    expect(html).toContain('app://vault/pasta/b.jpg');
  });

  it('leaves an image that cannot be found as text', () => {
    const { html } = render('![[sumiu.png]]');
    expect(html).not.toContain('<img');
    expect(text(html)).toContain('![[sumiu.png]]');
  });
});

describe('safety and privacy', () => {
  it('does not let raw HTML from a note into the page', () => {
    const { html } = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img src');
  });

  it('keeps emoji as text, so no image is fetched from a CDN', () => {
    const { html, css } = render('Oi 😀 e :smile:');
    expect(html).toContain('😀');
    expect(html).toContain(':smile:');
    expect(`${html}${css}`).not.toMatch(/twemoji|jsdelivr|https?:\/\//i);
  });

  it('does not render math with Marp', () => {
    const { css } = render('$x$');
    expect(css).not.toMatch(/mjx|katex/i);
  });
});

describe('where each slide starts', () => {
  const starts = (markdown: string) => render(markdown).slideStarts;

  it('gives the line of each slide of a note in automatic mode', () => {
    // 0 "## A", 1 "texto", 2 "## B", 3 "outro"
    expect(starts('## A\ntexto\n## B\noutro')).toEqual([0, 2]);
  });

  it('asks Marp for a Marp deck, front matter included', () => {
    // 0 "---", 1 "marp: true", 2 "---", 3 "", 4 "# A", 5 "", 6 "---", 7 "", 8 "# B"
    expect(starts('---\nmarp: true\n---\n\n# A\n\n---\n\n# B')).toEqual([0, 6]);
  });

  it('follows every kind of break Marp knows', () => {
    const note = '---\nmarp: true\n---\n\n# A\n\n***\n\n# B\n\n___\n\n# C';
    expect(starts(note)).toEqual([0, 6, 10]);
  });

  it('follows headingDivider, which breaks at headings', () => {
    const note =
      '---\nmarp: true\nheadingDivider: 2\n---\n\n## A\ntexto\n\n## B\ntexto\n\n## C';
    expect(starts(note)).toEqual([0, 8, 11]);
  });

  it('does not break at a rule inside a code block', () => {
    const note = '---\nmarp: true\n---\n\n# A\n\n```md\n---\n```\n\n---\n\n# B';
    expect(starts(note)).toEqual([0, 10]);
  });

  it('has as many starts as slides drawn', () => {
    const notes = [
      '## A\n## B\n## C',
      'a\n\n---\n\nb\n\n---\n\nc',
      '---\nmarp: true\n---\n\n# A\n\n---\n\n# B\n\n---\n\n# C',
    ];
    for (const note of notes) {
      const deck = render(note);
      expect(deck.slideStarts).toHaveLength(slideCount(deck.html));
    }
  });

  it('gives none when the cuts changed where the note breaks', () => {
    // A callout is cut out before Marp, which leaves the rule under it as a
    // break. Read on the note as written, the rule looks like a heading
    // underline, so the counts disagree and nothing is trusted.
    const deck = render('> [!note] A\n> b\n---\n\ntexto');
    expect(slideCount(deck.html)).toBe(2);
    expect(deck.slideStarts).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { extractCallouts } from './callouts';

describe('callouts', () => {
  it('swaps a callout for a token paragraph', () => {
    const { markdown, callouts } = extractCallouts(
      'antes\n\n> [!note] Título\n> corpo\n\ndepois',
    );
    expect(markdown).toBe('antes\n\n\nSpotlightCallout0End\n\n\ndepois');
    expect(callouts).toEqual(['> [!note] Título\n> corpo']);
  });

  it('accepts a callout without a title', () => {
    expect(extractCallouts('> [!tip]\n> dica').callouts).toEqual([
      '> [!tip]\n> dica',
    ]);
  });

  it('accepts foldable callouts and types with dashes or digits', () => {
    const md = '> [!faq]- Pergunta\n> r\n\n> [!my-type2]+ Aberto\n> r';
    expect(extractCallouts(md).callouts).toHaveLength(2);
  });

  it('keeps the whole block, including blank quote lines and nesting', () => {
    const md = '> [!note] A\n> um\n>\n> > [!warning] B\n> > dois\n\nfora';
    const { markdown, callouts } = extractCallouts(md);
    expect(callouts).toEqual([
      '> [!note] A\n> um\n>\n> > [!warning] B\n> > dois',
    ]);
    expect(markdown).toContain('fora');
    expect(markdown).not.toContain('warning');
  });

  it('keeps lists, code and math inside the callout', () => {
    const md = '> [!note]\n> - item\n> ```js\n> a();\n> ```\n> $x^2$';
    expect(extractCallouts(md).callouts[0]).toBe(md);
  });

  it('numbers several callouts in order', () => {
    const { markdown, callouts } = extractCallouts(
      '> [!note] um\n> a\n\ntexto\n\n> [!tip] dois\n> b',
    );
    expect(callouts).toHaveLength(2);
    expect(markdown).toContain('SpotlightCallout0End');
    expect(markdown).toContain('SpotlightCallout1End');
  });

  it('leaves a plain quote alone', () => {
    const md = '> só uma citação\n> em duas linhas';
    expect(extractCallouts(md)).toEqual({ markdown: md, callouts: [] });
  });

  it('leaves text that merely looks like a callout alone', () => {
    const md = 'texto [!note] no meio\n\n> [!] sem tipo\n\n>[ !note] espaço';
    expect(extractCallouts(md).callouts).toEqual([]);
  });

  it('skips code fences', () => {
    const md = '```md\n> [!note] x\n> y\n```';
    expect(extractCallouts(md)).toEqual({ markdown: md, callouts: [] });
  });

  it('skips the front matter', () => {
    const md = '---\nnota: "> [!note]"\n---\ntexto';
    expect(extractCallouts(md).callouts).toEqual([]);
  });

  it('keeps CRLF out of the callout source', () => {
    const { callouts } = extractCallouts('> [!note] t\r\n> corpo\r\n\r\nx');
    expect(callouts).toEqual(['> [!note] t\n> corpo']);
  });
});

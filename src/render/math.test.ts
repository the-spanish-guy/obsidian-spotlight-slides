import { describe, expect, it } from 'vitest';
import { extractMath } from './math';

const sources = (md: string) => extractMath(md).formulas.map((f) => f.source);

describe('inline math', () => {
  it('finds a formula inside a sentence', () => {
    const { markdown, formulas } = extractMath('veja $e^{i\\pi}$ aqui');
    expect(markdown).toBe('veja SpotlightMath0End aqui');
    expect(formulas).toEqual([{ source: 'e^{i\\pi}', display: false }]);
  });

  it('keeps underscores and asterisks out of the Markdown parser', () => {
    expect(extractMath('$a_1 + b_2 * c$').markdown).toBe('SpotlightMath0End');
  });

  it('finds several formulas on one line', () => {
    expect(sources('$a$ e $b$')).toEqual(['a', 'b']);
  });

  it('does not close on a space or open before one', () => {
    expect(sources('$ a$ e $b $')).toEqual([]);
  });

  it('leaves prices alone', () => {
    const md = 'O café custa $5 e o bolo custa $10, total $15.';
    expect(extractMath(md).markdown).toBe(md);
  });

  it('skips a price that comes before a formula', () => {
    const { markdown, formulas } = extractMath(
      'O preço é $5, mas a área é $\\pi r^2$.',
    );
    expect(markdown).toBe('O preço é $5, mas a área é SpotlightMath0End.');
    expect(formulas[0]?.source).toBe('\\pi r^2');
  });

  it('does not span lines', () => {
    const md = 'um $a\nb$ dois';
    expect(extractMath(md).markdown).toBe(md);
  });

  it('does not open a formula on an escaped dollar', () => {
    // Without the escape rule this would be the formula `a`.
    expect(sources('\\$a$')).toEqual([]);
  });

  it('does not close a formula on an escaped dollar', () => {
    expect(sources('$a\\$')).toEqual([]);
  });

  it('honors an escaped dollar', () => {
    const md = 'custa \\$5 e \\$6';
    expect(extractMath(md).markdown).toBe(md);
    expect(sources('$a \\$ b$')).toEqual(['a \\$ b']);
  });

  it('leaves an unclosed dollar as it is', () => {
    expect(extractMath('só $ um').markdown).toBe('só $ um');
    expect(extractMath('$\\frac{1}{').markdown).toBe('$\\frac{1}{');
  });
});

describe('display math', () => {
  it('finds a formula that spans lines', () => {
    const { markdown, formulas } = extractMath('antes\n\n$$\n\\sum x\n$$\n\ndepois');
    expect(markdown).toBe('antes\n\nSpotlightMath0End\n\ndepois');
    expect(formulas).toEqual([{ source: '\\sum x', display: true }]);
  });

  it('works on one line', () => {
    expect(extractMath('$$ a+b $$').formulas[0]?.display).toBe(true);
  });

  it('leaves an unclosed or empty $$ as it is', () => {
    expect(extractMath('$$ a').markdown).toBe('$$ a');
    expect(extractMath('$$$$').markdown).toBe('$$$$');
  });
});

describe('what is not touched', () => {
  it('skips inline code', () => {
    expect(extractMath('`$x^2$` e $y$').markdown).toBe(
      '`$x^2$` e SpotlightMath0End',
    );
  });

  it('skips code fences', () => {
    const md = '```latex\n$$ \\frac{a}{b} $$\n```';
    expect(extractMath(md).markdown).toBe(md);
  });

  it('skips the front matter', () => {
    const md = '---\nformula: "$x$"\n---\n$y$';
    expect(extractMath(md).markdown).toBe(
      '---\nformula: "$x$"\n---\nSpotlightMath0End',
    );
  });

  it('keeps CRLF line endings', () => {
    expect(extractMath('a\r\n$x$\r\nb').markdown).toBe(
      'a\r\nSpotlightMath0End\r\nb',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { extractFootnotes } from './footnotes';

describe('footnotes', () => {
  it('swaps a reference for a token and cuts the definition out', () => {
    const { markdown, footnotes } = extractFootnotes(
      'Uma frase[^1] aqui.\n\n[^1]: A nota.',
    );
    expect(markdown).toBe('Uma fraseSpotlightNote0End aqui.\n');
    expect(footnotes).toEqual([{ key: '1', text: 'A nota.' }]);
  });

  it('finds the definition even when it comes first', () => {
    const { footnotes } = extractFootnotes('[^a]: Antes.\n\nTexto[^a].');
    expect(footnotes).toEqual([{ key: 'a', text: 'Antes.' }]);
  });

  it('numbers references in order and keeps the key of repeated ones', () => {
    const { markdown, footnotes } = extractFootnotes(
      'um[^x] dois[^y] três[^x]\n\n[^x]: X.\n[^y]: Y.',
    );
    expect(markdown.trimEnd()).toBe(
      'umSpotlightNote0End doisSpotlightNote1End trêsSpotlightNote2End',
    );
    expect(footnotes.map((f) => f.key)).toEqual(['x', 'y', 'x']);
  });

  it('keeps continuation lines in the note', () => {
    const { footnotes, markdown } = extractFootnotes(
      'Texto[^n]\n\n[^n]: Primeira linha\n    segunda linha\n\nOutro parágrafo.',
    );
    expect(footnotes[0]?.text).toBe('Primeira linha\nsegunda linha');
    expect(markdown).toContain('Outro parágrafo.');
    expect(markdown).not.toContain('segunda linha');
  });

  it('accepts ids with words and dashes', () => {
    expect(
      extractFootnotes('a[^minha-nota]\n\n[^minha-nota]: ok').footnotes,
    ).toHaveLength(1);
  });

  it('leaves a reference without a definition as it is', () => {
    const md = 'Sem definição[^9] aqui.';
    expect(extractFootnotes(md)).toEqual({ markdown: md, footnotes: [] });
  });

  it('drops a definition nobody uses', () => {
    const { markdown, footnotes } = extractFootnotes('Texto.\n\n[^z]: Sobra.');
    expect(footnotes).toEqual([]);
    expect(markdown).not.toContain('Sobra');
  });

  it('takes inline notes with their own text', () => {
    const { markdown, footnotes } = extractFootnotes('Frase^[nota em linha] fim.');
    expect(markdown).toBe('FraseSpotlightNote0End fim.');
    expect(footnotes).toEqual([{ key: 'inline-0', text: 'nota em linha' }]);
  });

  it('does not confuse an inline note with a reference', () => {
    const { footnotes } = extractFootnotes('a[^1] b^[inline]\n\n[^1]: ref');
    expect(footnotes.map((f) => f.text)).toEqual(['ref', 'inline']);
  });

  it('skips code spans, code fences and HTML comments', () => {
    const md = '`[^1]` e <!-- [^1] -->\n\n```md\n[^1]\n```\n\n[^1]: nota';
    expect(extractFootnotes(md).footnotes).toEqual([]);
  });

  it('honors an escaped reference', () => {
    const md = 'texto \\[^1]\n\n[^1]: nota';
    expect(extractFootnotes(md).footnotes).toEqual([]);
  });

  it('skips the front matter', () => {
    const md = '---\nnota: "[^1]"\n---\nTexto[^1]\n\n[^1]: ok';
    expect(extractFootnotes(md).footnotes).toHaveLength(1);
  });

  it('keeps CRLF line endings', () => {
    const { markdown, footnotes } = extractFootnotes('a[^1]\r\nb\r\n\r\n[^1]: nota\r\n');
    expect(footnotes[0]?.text).toBe('nota');
    expect(markdown).toContain('a');
    expect(markdown).toContain('SpotlightNote0End');
  });
});

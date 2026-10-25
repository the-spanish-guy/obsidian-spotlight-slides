import { describe, expect, it } from 'vitest';
import { extractEmbeds } from './embeds';

describe('note embeds', () => {
  it('swaps an embed for a token and keeps its source', () => {
    const { markdown, embeds } = extractEmbeds('antes\n\n![[outra nota]]\n\ndepois');
    expect(markdown).toBe('antes\n\nSpotlightEmbed0End\n\ndepois');
    expect(embeds).toEqual(['![[outra nota]]']);
  });

  it('keeps a section, a block and an alias in the source', () => {
    const { embeds } = extractEmbeds(
      '![[nota#Seção B]]\n![[nota#^bloco]]\n![[nota|texto]]',
    );
    expect(embeds).toEqual([
      '![[nota#Seção B]]',
      '![[nota#^bloco]]',
      '![[nota|texto]]',
    ]);
  });

  it('accepts an explicit .md and dots in the name', () => {
    expect(extractEmbeds('![[a.md]] ![[v1.2 notas]]').embeds).toHaveLength(2);
  });

  it('works inside a sentence and with several on one line', () => {
    const { markdown, embeds } = extractEmbeds('veja ![[a]] e ![[b]] aqui');
    expect(markdown).toBe('veja SpotlightEmbed0End e SpotlightEmbed1End aqui');
    expect(embeds).toEqual(['![[a]]', '![[b]]']);
  });

  it('takes PDFs, audio, video and canvases too', () => {
    const md = '![[doc.pdf]] ![[som.mp3]] ![[video.mp4]] ![[quadro.canvas]]';
    expect(extractEmbeds(md).embeds).toHaveLength(4);
  });

  it('leaves images alone, since they have their own step', () => {
    const md = '![[foto.png]] ![[icon.SVG|300]] ![[x.webp]]';
    expect(extractEmbeds(md)).toEqual({ markdown: md, embeds: [] });
  });

  it('leaves a same-note embed and a plain link alone', () => {
    const md = '![[#Seção]] e [[nota]]';
    expect(extractEmbeds(md)).toEqual({ markdown: md, embeds: [] });
  });

  it('skips code spans and code fences', () => {
    const inline = '`![[nota]]` e ![[outra]]';
    expect(extractEmbeds(inline).markdown).toBe('`![[nota]]` e SpotlightEmbed0End');

    const fenced = '```md\n![[nota]]\n```';
    expect(extractEmbeds(fenced)).toEqual({ markdown: fenced, embeds: [] });
  });

  it('skips the front matter', () => {
    const md = '---\ncapa: "![[nota]]"\n---\n![[outra]]';
    expect(extractEmbeds(md).markdown).toBe(
      '---\ncapa: "![[nota]]"\n---\nSpotlightEmbed0End',
    );
  });

  it('keeps CRLF line endings', () => {
    expect(extractEmbeds('a\r\n![[n]]\r\nb').markdown).toBe(
      'a\r\nSpotlightEmbed0End\r\nb',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { extractInline } from './inline';

const sources = (md: string) => extractInline(md).inline;

describe('wikilinks', () => {
  it('swaps a link for a token and keeps its source', () => {
    const { markdown, inline } = extractInline('veja [[nota]] aqui');
    expect(markdown).toBe('veja SpotlightInline0End aqui');
    expect(inline).toEqual(['[[nota]]']);
  });

  it('keeps an alias, a section and a block in the source', () => {
    expect(sources('[[a|alias]] [[b#Seção]] [[c#^bloco]]')).toEqual([
      '[[a|alias]]',
      '[[b#Seção]]',
      '[[c#^bloco]]',
    ]);
  });

  it('keeps underscores out of the Markdown parser', () => {
    expect(extractInline('[[minha_nota_longa]]').markdown).toBe(
      'SpotlightInline0End',
    );
  });

  it('leaves an embed alone', () => {
    const md = '![[nota]]';
    expect(extractInline(md)).toEqual({ markdown: md, inline: [] });
  });
});

describe('tags', () => {
  it('finds simple and nested tags', () => {
    expect(sources('com #tag e #projeto/sub e #a-b_c aqui')).toEqual([
      '#tag',
      '#projeto/sub',
      '#a-b_c',
    ]);
  });

  it('finds a tag at the start of a line', () => {
    expect(sources('#tag no começo')).toEqual(['#tag']);
  });

  it('accepts accents', () => {
    expect(sources('uma #coração aqui')).toEqual(['#coração']);
  });

  it('is not a tag when the text is only numbers', () => {
    expect(sources('o número #1 e #1984')).toEqual([]);
  });

  it('is not a tag after a word character', () => {
    expect(sources('C# e a#b e foo#bar')).toEqual([]);
  });

  it('is not a tag in a heading', () => {
    expect(sources('# Título\n\n## Outro título')).toEqual([]);
  });

  it('is not a tag in a URL or a link target', () => {
    expect(sources('https://x.com/a#frag e [ir](#ancora) e &#39;')).toEqual([]);
  });

  it('honors an escaped hash', () => {
    expect(sources('\\#tag')).toEqual([]);
  });
});

describe('highlights and comments', () => {
  it('finds a highlight', () => {
    expect(sources('texto ==realce== aqui')).toEqual(['==realce=='] );
  });

  it('keeps inner Markdown in the source', () => {
    expect(sources('==**forte** e _itálico_==')).toEqual([
      '==**forte** e _itálico_==',
    ]);
  });

  it('does not take ===, == alone or spaces inside', () => {
    expect(sources('a === b e == c == e ==x ==')).toEqual([]);
  });

  it('drops a comment, on one line or several', () => {
    expect(extractInline('um %%oculto%% dois').markdown).toBe('um  dois');
    expect(extractInline('a\n%%\nvárias\nlinhas\n%%\nb').markdown).toBe(
      'a\n\nb',
    );
  });

  it('leaves an unclosed %% as it is', () => {
    expect(extractInline('50%% sem fim').markdown).toBe('50%% sem fim');
  });
});

describe('what is not touched', () => {
  it('skips code spans and code fences', () => {
    expect(extractInline('`[[a]] #b ==c==` e [[d]]').markdown).toBe(
      '`[[a]] #b ==c==` e SpotlightInline0End',
    );
    const fenced = '```md\n[[a]] #b ==c==\n```';
    expect(extractInline(fenced)).toEqual({ markdown: fenced, inline: [] });
  });

  it('skips HTML comments, where Marp directives live', () => {
    const md = '<!-- backgroundColor: #fff -->\n<!--\n_class: x #y\n-->';
    expect(extractInline(md)).toEqual({ markdown: md, inline: [] });
  });

  it('skips the front matter', () => {
    const md = '---\nlink: "[[a]]"\n---\n[[b]]';
    expect(extractInline(md).markdown).toBe(
      '---\nlink: "[[a]]"\n---\nSpotlightInline0End',
    );
  });

  it('keeps CRLF line endings', () => {
    expect(extractInline('a\r\n[[n]]\r\nb').markdown).toBe(
      'a\r\nSpotlightInline0End\r\nb',
    );
  });
});

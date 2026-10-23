import { describe, expect, it } from 'vitest';
import { isMarpDeck, splitIntoSlides, toMarpMarkdown } from './auto';

describe('splitIntoSlides', () => {
  it('cuts at the shallowest level used at least twice', () => {
    const slides = splitIntoSlides(
      '## Titulo x\n## Titulo y\n### Subtitulo Z\n### subtitulo A',
    );
    expect(slides).toEqual([
      '## Titulo x',
      '## Titulo y\n### Subtitulo Z\n### subtitulo A',
    ]);
  });

  it('gives the title its own slide, then one per section', () => {
    expect(
      splitIntoSlides('# Title\nintro\n## A\na\n## B\nb\n## C\nc'),
    ).toEqual(['# Title\nintro', '## A\na', '## B\nb', '## C\nc']);
  });

  it('keeps a single slide when no level repeats', () => {
    expect(splitIntoSlides('# A\ntext\n## B\nmore\n### C')).toHaveLength(1);
  });

  it('prefers a shallower repeated level over a deeper one', () => {
    expect(splitIntoSlides('# A\n## a1\n## a2\n# B\n## b1')).toEqual([
      '# A\n## a1\n## a2',
      '# B\n## b1',
    ]);
  });

  it('splits at horizontal rules', () => {
    expect(splitIntoSlides('one\n\n---\n\ntwo')).toEqual(['one', 'two']);
  });

  it('treats --- right under text as a setext heading, not a rule', () => {
    expect(splitIntoSlides('Title\n---\nbody')).toHaveLength(1);
  });

  it('drops the empty slide between a rule and a splitting heading', () => {
    expect(splitIntoSlides('## A\na\n\n---\n\n## B\nb\n## C\nc')).toEqual([
      '## A\na',
      '## B\nb',
      '## C\nc',
    ]);
  });

  it('ignores headings and rules inside code fences', () => {
    const md = '## A\n```md\n## not a heading\n---\n```\n## B\nb';
    expect(splitIntoSlides(md)).toEqual([
      '## A\n```md\n## not a heading\n---\n```',
      '## B\nb',
    ]);
  });

  it('does not close a fence with a shorter one', () => {
    expect(
      splitIntoSlides('## A\n````\n```\n## inner\n````\n## B'),
    ).toHaveLength(2);
  });

  it('does not take a #tag for a heading', () => {
    expect(splitIntoSlides('#tag one\n#tag two')).toHaveLength(1);
  });

  it('handles CRLF line endings', () => {
    expect(splitIntoSlides('## A\r\na\r\n## B\r\nb')).toEqual([
      '## A\na',
      '## B\nb',
    ]);
  });

  it('returns no slides for an empty note', () => {
    expect(splitIntoSlides('')).toEqual([]);
  });
});

describe('isMarpDeck', () => {
  it('is true only for marp: true in the front matter', () => {
    expect(isMarpDeck('---\nmarp: true\n---\n# A')).toBe(true);
    expect(isMarpDeck('---\nmarp: false\n---\n# A')).toBe(false);
    expect(isMarpDeck('# A')).toBe(false);
  });
});

describe('toMarpMarkdown', () => {
  it('omits the front matter of a regular note', () => {
    const md = '---\ntitle: x\ntags: [a]\n---\n## A\na\n## B\nb';
    expect(toMarpMarkdown(md)).toBe('## A\na\n\n---\n\n## B\nb');
  });

  it('passes a Marp deck through untouched', () => {
    const md = '---\nmarp: true\ntheme: gaia\n---\n# A\n\n---\n\n# B';
    expect(toMarpMarkdown(md)).toBe(md);
  });
});

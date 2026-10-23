import { describe, expect, it } from 'vitest';
import { resolveRelative, rewriteImages } from './images';

const files: Record<string, string> = {
  'foto.png': 'app://v/foto.png?1',
  'minha foto.png': 'app://v/minha%20foto.png?1',
  'pasta/a.jpg': 'app://v/pasta/a.jpg?1',
  'icon.svg': 'app://v/icon.svg?1',
};
const resolve = (linkpath: string) => files[linkpath] ?? null;
const rewrite = (md: string) => rewriteImages(md, resolve);

describe('wikilink embeds', () => {
  it('rewrites a plain embed', () => {
    expect(rewrite('![[foto.png]]')).toBe('![](<app://v/foto.png?1>)');
  });

  it('turns a bare number into the width', () => {
    expect(rewrite('![[foto.png|300]]')).toBe('![w:300](<app://v/foto.png?1>)');
  });

  it('turns WxH into width and height', () => {
    expect(rewrite('![[foto.png|300x200]]')).toBe(
      '![w:300 h:200](<app://v/foto.png?1>)',
    );
  });

  it('passes Marp keywords through, so height can be set alone', () => {
    expect(rewrite('![[foto.png|h:200]]')).toBe(
      '![h:200](<app://v/foto.png?1>)',
    );
    expect(rewrite('![[foto.png|bg left:40%]]')).toBe(
      '![bg left:40%](<app://v/foto.png?1>)',
    );
  });

  it('uses a text alias as the alt', () => {
    expect(rewrite('![[foto.png|uma legenda]]')).toBe(
      '![uma legenda](<app://v/foto.png?1>)',
    );
  });

  it('ignores a #heading or ^block suffix when resolving', () => {
    expect(rewrite('![[foto.png#x]]')).toBe('![](<app://v/foto.png?1>)');
  });

  it('keeps names with spaces', () => {
    expect(rewrite('![[minha foto.png]]')).toBe(
      '![](<app://v/minha%20foto.png?1>)',
    );
  });

  it('leaves embeds that are not images as they are', () => {
    expect(rewrite('![[outra nota]]')).toBe('![[outra nota]]');
    expect(rewrite('![[doc.pdf]]')).toBe('![[doc.pdf]]');
  });

  it('leaves an image that cannot be resolved as it is', () => {
    expect(rewrite('![[sumiu.png]]')).toBe('![[sumiu.png]]');
  });

  it('does not touch a plain wikilink', () => {
    expect(rewrite('veja [[foto.png]]')).toBe('veja [[foto.png]]');
  });
});

describe('markdown images', () => {
  it('rewrites a vault path', () => {
    expect(rewrite('![alt](pasta/a.jpg)')).toBe(
      '![alt](<app://v/pasta/a.jpg?1>)',
    );
  });

  it('decodes a percent-encoded path before resolving', () => {
    expect(rewrite('![alt](minha%20foto.png)')).toBe(
      '![alt](<app://v/minha%20foto.png?1>)',
    );
  });

  it('accepts the <angle bracket> form for paths with spaces', () => {
    expect(rewrite('![alt](<minha foto.png>)')).toBe(
      '![alt](<app://v/minha%20foto.png?1>)',
    );
  });

  it('keeps Marp keywords in the alt and the title', () => {
    expect(rewrite('![bg right:30%](foto.png "titulo")')).toBe(
      '![bg right:30%](<app://v/foto.png?1> "titulo")',
    );
  });

  it('leaves external and data URLs alone', () => {
    const md = '![a](https://x.com/a.png) ![b](data:image/png;base64,AAA)';
    expect(rewrite(md)).toBe(md);
  });

  it('leaves a path that cannot be resolved as it is', () => {
    expect(rewrite('![a](nao-existe.png)')).toBe('![a](nao-existe.png)');
  });

  it('rewrites several images on one line', () => {
    expect(rewrite('![[foto.png]] e ![x](icon.svg)')).toBe(
      '![](<app://v/foto.png?1>) e ![x](<app://v/icon.svg?1>)',
    );
  });
});

describe('what is not rewritten', () => {
  it('skips code fences', () => {
    const md = '```md\n![[foto.png]]\n```';
    expect(rewrite(md)).toBe(md);
  });

  it('skips inline code but rewrites the rest of the line', () => {
    expect(rewrite('`![[foto.png]]` e ![[foto.png]]')).toBe(
      '`![[foto.png]]` e ![](<app://v/foto.png?1>)',
    );
  });

  it('skips the front matter', () => {
    const md = '---\ncover: "![[foto.png]]"\n---\n![[foto.png]]';
    expect(rewrite(md)).toBe(
      '---\ncover: "![[foto.png]]"\n---\n![](<app://v/foto.png?1>)',
    );
  });

  it('keeps CRLF line endings', () => {
    expect(rewrite('a\r\n![[foto.png]]\r\nb')).toBe(
      'a\r\n![](<app://v/foto.png?1>)\r\nb',
    );
  });
});

describe('resolveRelative', () => {
  it('joins and normalizes a path relative to a folder', () => {
    expect(resolveRelative('notas/aulas', 'img/a.png')).toBe(
      'notas/aulas/img/a.png',
    );
    expect(resolveRelative('notas/aulas', '../img/a.png')).toBe(
      'notas/img/a.png',
    );
    expect(resolveRelative('notas', './a.png')).toBe('notas/a.png');
    expect(resolveRelative('/', 'a.png')).toBe('a.png');
  });
});

import { describe, expect, it } from 'vitest';
import { extractTasks } from './tasks';

describe('task lists', () => {
  it('swaps a task list for a token paragraph', () => {
    const { markdown, tasks } = extractTasks(
      'antes\n\n- [x] feito\n- [ ] a fazer\n\ndepois',
    );
    expect(markdown).toBe('antes\n\n\nSpotlightTasks0End\n\n\ndepois');
    expect(tasks).toEqual(['- [x] feito\n- [ ] a fazer']);
  });

  it('takes custom statuses', () => {
    const md = '- [/] andando\n- [-] cancelada\n- [>] adiada\n- [?] dúvida\n- [!] urgente';
    expect(extractTasks(md).tasks).toEqual([md]);
  });

  it('keeps nested items and indented lines in the same list', () => {
    const md = '- [x] pai\n  - [ ] filho\n  - [x] outro\n  continuação\n- [ ] irmão';
    expect(extractTasks(md).tasks).toEqual([md]);
  });

  it('works with numbered lists', () => {
    expect(extractTasks('1. [x] um\n2. [ ] dois').tasks).toHaveLength(1);
  });

  it('takes the whole list when only some items are tasks', () => {
    const md = '- item comum\n- [ ] tarefa\n- outro comum';
    expect(extractTasks(md).tasks).toEqual([md]);
  });

  it('keeps blank lines inside a list that goes on', () => {
    const md = '- [ ] um\n\n- [ ] dois';
    expect(extractTasks(md).tasks).toEqual([md]);
  });

  it('stops at a paragraph and finds the next list', () => {
    const { tasks } = extractTasks('- [ ] a\n\ntexto\n\n- [x] b');
    expect(tasks).toEqual(['- [ ] a', '- [x] b']);
  });

  it('leaves a list without tasks alone', () => {
    const md = '- um\n- dois\n  - três';
    expect(extractTasks(md)).toEqual({ markdown: md, tasks: [] });
  });

  it('does not take a checkbox-looking text outside a list', () => {
    const md = 'texto [ ] solto\n\n[x] também solto';
    expect(extractTasks(md)).toEqual({ markdown: md, tasks: [] });
  });

  it('leaves a horizontal rule alone', () => {
    const md = '- - -\n\ntexto';
    expect(extractTasks(md)).toEqual({ markdown: md, tasks: [] });
  });

  it('skips code fences and the front matter', () => {
    const fenced = '```md\n- [ ] a\n```';
    expect(extractTasks(fenced)).toEqual({ markdown: fenced, tasks: [] });
    const front = '---\nitens:\n- [ ] x\n---\ntexto';
    expect(extractTasks(front).tasks).toEqual([]);
  });

  it('keeps CRLF out of the list source', () => {
    expect(extractTasks('- [x] a\r\n- [ ] b\r\n').tasks).toEqual([
      '- [x] a\n- [ ] b',
    ]);
  });
});

import type { App } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { presentNote } from './present';
import { MarkdownView, TFile } from './test/obsidian';

vi.mock('./view', () => ({ VIEW_TYPE_SPOTLIGHT: 'spotlight-slides-view' }));

function setup(file: TFile | null = new TFile('aulas/intro.md')) {
  const calls: string[] = [];
  const leaf = {
    setViewState: vi.fn(() => {
      calls.push('setViewState');
      return Promise.resolve();
    }),
    view: { containerEl: { focus: vi.fn(() => calls.push('focus slides')) } },
  };
  const workspace = {
    getLeaf: vi.fn(() => leaf),
    openPopoutLeaf: vi.fn(() => leaf),
    setActiveLeaf: vi.fn(() => calls.push('focus editor')),
  };
  const source = new MarkdownView(file);
  const app = { workspace } as unknown as App;
  const present = (placement: 'tab' | 'side' | 'window') =>
    presentNote(app, source as never, placement);
  return { leaf, workspace, source, present, calls };
}

const state = { file: 'aulas/intro.md', follow: false };

describe('presenting in a tab', () => {
  it('opens a new tab with the slides and gives them the keyboard', async () => {
    const { present, workspace, leaf } = setup();
    await present('tab');

    expect(workspace.getLeaf).toHaveBeenCalledWith('tab');
    expect(workspace.openPopoutLeaf).not.toHaveBeenCalled();
    expect(leaf.setViewState).toHaveBeenCalledWith({
      type: 'spotlight-slides-view',
      active: true,
      state,
    });
    expect(leaf.view.containerEl.focus).toHaveBeenCalled();
    expect(workspace.setActiveLeaf).not.toHaveBeenCalled();
  });
});

describe('presenting beside the note', () => {
  it('splits to the right of the note', async () => {
    const { present, workspace, leaf } = setup();
    await present('side');

    expect(workspace.getLeaf).toHaveBeenCalledWith('split', 'vertical');
    expect(leaf.setViewState).toHaveBeenCalledWith({
      type: 'spotlight-slides-view',
      active: false,
      state: { ...state, follow: true },
    });
  });

  it('leaves the keyboard with the editor, so typing goes on', async () => {
    const { present, workspace, leaf, source } = setup();
    await present('side');

    expect(workspace.setActiveLeaf).toHaveBeenCalledWith(source.leaf, { focus: true });
    expect(leaf.view.containerEl.focus).not.toHaveBeenCalled();
  });

  it('gives the keyboard back only after the slides have opened', async () => {
    const { present, calls } = setup();
    await present('side');
    expect(calls).toEqual(['setViewState', 'focus editor']);
  });
});

describe('presenting in a new window', () => {
  it('opens the slides in a window of their own and gives them the keyboard', async () => {
    const { present, workspace, leaf } = setup();
    await present('window');

    expect(workspace.openPopoutLeaf).toHaveBeenCalledTimes(1);
    expect(workspace.getLeaf).not.toHaveBeenCalled();
    expect(leaf.setViewState).toHaveBeenCalledWith({
      type: 'spotlight-slides-view',
      active: true,
      state,
    });
    expect(leaf.view.containerEl.focus).toHaveBeenCalled();
    expect(workspace.setActiveLeaf).not.toHaveBeenCalled();
  });
});

describe('a view with no file', () => {
  it.each(['tab', 'side', 'window'] as const)('opens nothing for %s', async (placement) => {
    const { present, workspace } = setup(null);
    await present(placement);

    expect(workspace.getLeaf).not.toHaveBeenCalled();
    expect(workspace.openPopoutLeaf).not.toHaveBeenCalled();
  });
});

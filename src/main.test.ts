import { beforeEach, describe, expect, it, vi } from 'vitest';
import SpotlightSlidesPlugin from './main';
import { MarkdownView, TFile } from './test/obsidian';

vi.mock('./view', () => ({
  VIEW_TYPE_SPOTLIGHT: 'spotlight-slides-view',
  SpotlightView: class {
    constructor(public leaf: unknown) {}
  },
}));

interface FakePlugin {
  app: unknown;
  commands: Array<Record<string, unknown>>;
  ribbons: Array<{ icon: string; title: string; callback: () => void }>;
  views: Map<string, (leaf: unknown) => unknown>;
  onload(): Promise<void>;
}

function setup(active: MarkdownView | null = null) {
  const leaf = {
    setViewState: vi.fn(() => Promise.resolve()),
    view: { containerEl: { focus: vi.fn() } },
  };
  const workspace = {
    getActiveViewOfType: vi.fn(() => active),
    getLeaf: vi.fn(() => leaf),
  };
  // The real constructor takes an app and a manifest; the stand-in takes none.
  const plugin = new (SpotlightSlidesPlugin as unknown as new () => FakePlugin)();
  plugin.app = { workspace };
  return { plugin, leaf, workspace };
}

const command = (plugin: FakePlugin) => {
  const found = plugin.commands[0];
  if (!found) throw new Error('no command registered');
  return found as {
    id: string;
    name: string;
    checkCallback: (checking: boolean) => boolean;
  };
};

const flush = () => new Promise((resolve) => setTimeout(resolve));

let noteView: MarkdownView;
beforeEach(() => {
  noteView = new MarkdownView(new TFile('aulas/intro.md'));
});

describe('the plugin', () => {
  it('registers its view, a ribbon icon and one command', async () => {
    const { plugin } = setup();
    await plugin.onload();

    expect(plugin.views.has('spotlight-slides-view')).toBe(true);
    expect(plugin.ribbons).toHaveLength(1);
    expect(plugin.ribbons[0]).toMatchObject({
      icon: 'presentation',
      title: 'Present current note',
    });
    expect(plugin.commands).toHaveLength(1);
    expect(command(plugin)).toMatchObject({
      id: 'present-current-note',
      name: 'Present current note',
    });
  });

  it('creates the view for a leaf', async () => {
    const { plugin } = setup();
    await plugin.onload();

    const leaf = {};
    const view = plugin.views.get('spotlight-slides-view')?.(leaf) as { leaf: unknown };
    expect(view.leaf).toBe(leaf);
  });
});

describe('the command', () => {
  it('is not offered without a note open', async () => {
    const { plugin, workspace } = setup(null);
    await plugin.onload();

    expect(command(plugin).checkCallback(true)).toBe(false);
    expect(command(plugin).checkCallback(false)).toBe(false);
    expect(workspace.getLeaf).not.toHaveBeenCalled();
  });

  it('is not offered when the open view has no file', async () => {
    const { plugin } = setup(new MarkdownView(null));
    await plugin.onload();
    expect(command(plugin).checkCallback(true)).toBe(false);
  });

  it('is offered, and does nothing yet, while Obsidian only checks', async () => {
    const { plugin, workspace } = setup(noteView);
    await plugin.onload();

    expect(command(plugin).checkCallback(true)).toBe(true);
    expect(workspace.getLeaf).not.toHaveBeenCalled();
  });

  it('opens the note in a new tab of the presentation view', async () => {
    const { plugin, leaf, workspace } = setup(noteView);
    await plugin.onload();

    expect(command(plugin).checkCallback(false)).toBe(true);
    await flush();

    expect(workspace.getLeaf).toHaveBeenCalledWith('tab');
    expect(leaf.setViewState).toHaveBeenCalledWith({
      type: 'spotlight-slides-view',
      active: true,
      state: { file: 'aulas/intro.md' },
    });
    expect(leaf.view.containerEl.focus).toHaveBeenCalled();
  });

  it('does the same from the ribbon icon', async () => {
    const { plugin, leaf } = setup(noteView);
    await plugin.onload();

    plugin.ribbons[0]?.callback();
    await flush();

    expect(leaf.setViewState).toHaveBeenCalledWith(
      expect.objectContaining({ state: { file: 'aulas/intro.md' } }),
    );
  });

  it('does nothing from the ribbon icon without a note', async () => {
    const { plugin, workspace } = setup(null);
    await plugin.onload();

    plugin.ribbons[0]?.callback();
    await flush();

    expect(workspace.getLeaf).not.toHaveBeenCalled();
  });
});

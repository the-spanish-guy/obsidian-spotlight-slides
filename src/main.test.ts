import { beforeEach, describe, expect, it, vi } from 'vitest';
import SpotlightSlidesPlugin from './main';
import { MarkdownView, TFile } from './test/obsidian';

vi.mock('./view', () => ({
  VIEW_TYPE_SPOTLIGHT: 'spotlight-slides-view',
  SpotlightView: class {
    constructor(public leaf: unknown) {}
  },
}));

vi.mock('./follow-cursor', () => ({ cursorFollower: () => 'cursor-extension' }));

const presentNote = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock('./present', () => ({
  presentNote: (...args: unknown[]) => presentNote(...args),
}));

interface Command {
  id: string;
  name: string;
  checkCallback: (checking: boolean) => boolean;
}

interface FakePlugin {
  app: unknown;
  commands: Array<Record<string, unknown>>;
  ribbons: Array<{ icon: string; title: string; callback: () => void }>;
  views: Map<string, (leaf: unknown) => unknown>;
  extensions: unknown[];
  onload(): void;
}

function setup(active: MarkdownView | null = null) {
  const workspace = { getActiveViewOfType: vi.fn(() => active) };
  // The real constructor takes an app and a manifest; the stand-in takes none.
  const plugin = new (SpotlightSlidesPlugin as unknown as new () => FakePlugin)();
  plugin.app = { workspace };
  plugin.onload();
  return { plugin, workspace };
}

const commands = (plugin: FakePlugin) => plugin.commands as unknown as Command[];

const byId = (plugin: FakePlugin, id: string) => {
  const found = commands(plugin).find((c) => c.id === id);
  if (!found) throw new Error(`no command ${id}`);
  return found;
};

let noteView: MarkdownView;
beforeEach(() => {
  presentNote.mockClear();
  noteView = new MarkdownView(new TFile('aulas/intro.md'));
});

describe('the plugin', () => {
  it('registers its view, a ribbon icon and three commands', () => {
    const { plugin } = setup();

    expect(plugin.views.has('spotlight-slides-view')).toBe(true);
    expect(plugin.ribbons).toHaveLength(1);
    expect(plugin.ribbons[0]).toMatchObject({
      icon: 'presentation',
      title: 'Present current note',
    });
    expect(commands(plugin).map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'present-current-note', name: 'Present current note' },
      { id: 'present-to-the-side', name: 'Present to the side' },
      { id: 'present-in-new-window', name: 'Present in new window' },
    ]);
  });

  it('registers the editor extension that makes the slides follow the cursor', () => {
    const { plugin } = setup();
    expect(plugin.extensions).toEqual(['cursor-extension']);
  });

  it('creates the view for a leaf', () => {
    const { plugin } = setup();

    const leaf = {};
    const view = plugin.views.get('spotlight-slides-view')?.(leaf) as { leaf: unknown };
    expect(view.leaf).toBe(leaf);
  });
});

describe('the commands', () => {
  const placements = [
    ['present-current-note', 'tab'],
    ['present-to-the-side', 'side'],
    ['present-in-new-window', 'window'],
  ] as const;

  it.each(placements)('%s is not offered without a note open', (id) => {
    const { plugin } = setup(null);

    expect(byId(plugin, id).checkCallback(true)).toBe(false);
    expect(byId(plugin, id).checkCallback(false)).toBe(false);
    expect(presentNote).not.toHaveBeenCalled();
  });

  it.each(placements)('%s is not offered when the view has no file', (id) => {
    const { plugin } = setup(new MarkdownView(null));
    expect(byId(plugin, id).checkCallback(true)).toBe(false);
  });

  it.each(placements)('%s is offered, and does nothing while Obsidian only checks', (id) => {
    const { plugin } = setup(noteView);

    expect(byId(plugin, id).checkCallback(true)).toBe(true);
    expect(presentNote).not.toHaveBeenCalled();
  });

  it.each(placements)('%s presents the note where it says', (id, placement) => {
    const { plugin } = setup(noteView);

    expect(byId(plugin, id).checkCallback(false)).toBe(true);

    expect(presentNote).toHaveBeenCalledTimes(1);
    expect(presentNote).toHaveBeenCalledWith(plugin.app, noteView, placement);
  });
});

describe('the ribbon icon', () => {
  it('presents the note in a tab', () => {
    const { plugin } = setup(noteView);

    plugin.ribbons[0]?.callback();

    expect(presentNote).toHaveBeenCalledWith(plugin.app, noteView, 'tab');
  });

  it('does nothing without a note', () => {
    const { plugin } = setup(null);

    plugin.ribbons[0]?.callback();

    expect(presentNote).not.toHaveBeenCalled();
  });
});

// @vitest-environment happy-dom

import type { WorkspaceLeaf } from 'obsidian';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { postprocessDeck } from './render/postprocess';
import { renderDeck } from './render/slides';
import { MarkdownView, TFile } from './test/obsidian';
import { SpotlightView, VIEW_TYPE_SPOTLIGHT } from './view';

vi.mock('./render/slides', () => ({ renderDeck: vi.fn() }));
vi.mock('./render/postprocess', () => ({
  postprocessDeck: vi.fn(() => Promise.resolve()),
}));

const NOTE = 'aulas/intro.md';

function slidesHtml(count: number, firstSlideExtra = ''): string {
  const slides = Array.from(
    { length: count },
    (_, i) =>
      `<svg data-marpit-svg><foreignObject><section><h1>Slide ${i + 1}</h1>${
        i === 0 ? firstSlideExtra : ''
      }</section></foreignObject></svg>`,
  );
  return `<div class="marpit">${slides.join('')}</div>`;
}

function setDeck(html: string, css = 'section { color: red; }') {
  vi.mocked(renderDeck).mockReturnValue({
    html,
    css,
    formulas: [],
    footnotes: [],
    callouts: [],
    tasks: [],
    embeds: [],
    inline: [],
  });
}

type Handler = (...args: unknown[]) => void;

function makeApp(content = '# nota') {
  const handlers = new Map<string, Handler[]>();
  const on = (scope: string) =>
    vi.fn((name: string, callback: Handler) => {
      const key = `${scope}:${name}`;
      handlers.set(key, [...(handlers.get(key) ?? []), callback]);
      return { key };
    });

  const leaves: unknown[] = [];
  const files = new Map<string, TFile>([[NOTE, new TFile(NOTE, { path: 'aulas' })]]);
  const app = {
    vault: {
      getFileByPath: vi.fn((path: string) => files.get(path) ?? null),
      cachedRead: vi.fn(() => Promise.resolve(content)),
      getResourcePath: vi.fn((file: TFile) => `app://vault/${file.path}`),
      on: on('vault'),
    },
    metadataCache: { getFirstLinkpathDest: vi.fn((): TFile | null => null) },
    workspace: {
      on: on('workspace'),
      getLeavesOfType: vi.fn((): unknown[] => leaves),
    },
  };
  const emit = (key: string, ...args: unknown[]) => {
    for (const handler of handlers.get(key) ?? []) handler(...args);
  };
  return { app, files, emit, leaves };
}

// An editor that has a note open; its text is what is being typed.
function openEditor(leaves: unknown[], text: string, path = NOTE) {
  const editor = {
    text,
    getValue() {
      return this.text;
    },
  };
  const view = Object.assign(new MarkdownView(new TFile(path)), { editor });
  leaves.push({ view });
  return editor;
}

async function openView(
  options: { file?: string; content?: string; editorText?: string } = {},
) {
  const harness = makeApp(options.content);
  const editor =
    options.editorText === undefined
      ? undefined
      : openEditor(harness.leaves, options.editorText);
  const view = new SpotlightView({ app: harness.app } as unknown as WorkspaceLeaf);
  document.body.append(view.containerEl);
  await (view as unknown as { onOpen(): Promise<void> }).onOpen();
  await view.setState({ file: options.file ?? NOTE }, {} as never);
  return { view, editor, ...harness };
}

const slides = (view: SpotlightView) =>
  Array.from(view.contentEl.querySelectorAll('svg[data-marpit-svg]'));

// The index of the slide that is showing.
const shown = (view: SpotlightView) =>
  slides(view).findIndex((s) => !s.classList.contains('spotlight-hidden'));

function press(view: SpotlightView, key: string) {
  const evt = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  view.contentEl.dispatchEvent(evt);
  return evt;
}

// The components the view owns, which the stand-in keeps in a list.
const childrenOf = (view: SpotlightView) =>
  (view as unknown as { children: unknown[] }).children;

const counter = (view: SpotlightView) =>
  view.contentEl.querySelector('.spotlight-counter')?.textContent;

beforeEach(() => {
  document.body.replaceChildren();
  Object.defineProperty(document, 'adoptedStyleSheets', {
    value: [],
    writable: true,
    configurable: true,
  });
  vi.mocked(renderDeck).mockReset();
  vi.mocked(postprocessDeck).mockClear();
  setDeck(slidesHtml(3));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the view', () => {
  it('describes itself to Obsidian', async () => {
    const { view } = await openView();

    expect(view.getViewType()).toBe(VIEW_TYPE_SPOTLIGHT);
    expect(view.getIcon()).toBe('presentation');
    expect(view.getDisplayText()).toBe('Slides: intro');
    expect(view.getState()).toEqual({ file: NOTE });
  });

  it('has a plain name before it has a note', () => {
    const view = new SpotlightView({ app: makeApp().app } as unknown as WorkspaceLeaf);
    expect(view.getDisplayText()).toBe('Spotlight Slides');
    expect(view.getState()).toEqual({ file: undefined });
  });

  it('renders the note it was given and shows the first slide', async () => {
    const { view, app } = await openView({ content: '# Olá' });

    expect(renderDeck).toHaveBeenCalledWith('# Olá', expect.any(Function));
    expect(app.vault.cachedRead).toHaveBeenCalledTimes(1);
    expect(slides(view)).toHaveLength(3);
    expect(shown(view)).toBe(0);
    expect(counter(view)).toBe('1 / 3');
  });

  it('hands the stage to the post-render steps', async () => {
    const { view } = await openView();

    const [context, deck] = vi.mocked(postprocessDeck).mock.calls[0] ?? [];
    expect(context?.root).toBe(view.contentEl.querySelector('.spotlight-stage'));
    expect(context?.sourcePath).toBe(NOTE);
    expect(deck?.html).toContain('data-marpit-svg');
  });

  it('focuses itself, so the keys work without a click', async () => {
    const { view } = await openView();
    expect(document.activeElement).toBe(view.contentEl);
  });

  it('does not take the keyboard back when it renders again', async () => {
    vi.useFakeTimers();
    const { view, app, emit } = await openView();
    const editor = document.createElement('textarea');
    document.body.append(editor);
    editor.focus();

    app.vault.cachedRead.mockResolvedValue('# editada');
    emit('vault:modify', { path: NOTE });
    await vi.advanceTimersByTimeAsync(300);

    expect(renderDeck).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(editor);
    expect(document.activeElement).not.toBe(view.contentEl);
  });

  it('does not take the keyboard back on a theme change either', async () => {
    vi.useFakeTimers();
    const { emit } = await openView();
    const editor = document.createElement('textarea');
    document.body.append(editor);
    editor.focus();

    emit('workspace:css-change');
    await vi.advanceTimersByTimeAsync(300);

    expect(document.activeElement).toBe(editor);
  });

  it('says so when the note is gone', async () => {
    const { view } = await openView({ file: 'sumiu.md' });

    expect(view.contentEl.querySelector('.spotlight-empty')?.textContent).toBe(
      'Note not found.',
    );
    expect(renderDeck).not.toHaveBeenCalled();
  });
});

describe('moving through the slides', () => {
  it.each(['ArrowRight', 'ArrowDown', 'PageDown', ' '])('%j goes forward', async (key) => {
    const { view } = await openView();
    expect(press(view, key).defaultPrevented).toBe(true);
    expect(shown(view)).toBe(1);
    expect(counter(view)).toBe('2 / 3');
  });

  it.each(['ArrowLeft', 'ArrowUp', 'PageUp'])('%j goes back', async (key) => {
    const { view } = await openView();
    press(view, 'End');
    press(view, key);
    expect(shown(view)).toBe(1);
  });

  it('jumps to the first and last slide', async () => {
    const { view } = await openView();
    press(view, 'End');
    expect(shown(view)).toBe(2);
    press(view, 'Home');
    expect(shown(view)).toBe(0);
  });

  it('stops at both ends', async () => {
    const { view } = await openView();
    press(view, 'ArrowLeft');
    expect(shown(view)).toBe(0);

    press(view, 'End');
    press(view, 'ArrowRight');
    expect(shown(view)).toBe(2);
    expect(counter(view)).toBe('3 / 3');
  });

  it('ignores keys it does not use, so typing elsewhere is not swallowed', async () => {
    const { view } = await openView();
    const evt = press(view, 'a');
    expect(evt.defaultPrevented).toBe(false);
    expect(shown(view)).toBe(0);
  });

  it('shows how far along the deck is', async () => {
    const { view } = await openView();
    const bar = view.contentEl.querySelector<HTMLElement>('.spotlight-progress-bar');
    expect(bar?.style.width).toBe('0%');
    press(view, 'ArrowRight');
    expect(bar?.style.width).toBe('50%');
    press(view, 'End');
    expect(bar?.style.width).toBe('100%');
  });

  it('moves with the buttons too, and keeps the keyboard', async () => {
    const { view } = await openView();
    const next = view.contentEl.querySelector<HTMLButtonElement>('button[aria-label="Next slide"]');
    next?.click();
    expect(shown(view)).toBe(1);
    expect(document.activeElement).toBe(view.contentEl);

    press(view, ' ');
    expect(shown(view)).toBe(2);
  });
});

describe('full screen', () => {
  it('enters on F and leaves on F', async () => {
    const { view } = await openView();
    const enter = vi.fn(() => Promise.resolve());
    const leave = vi.fn(() => Promise.resolve());
    Object.assign(view.contentEl, { requestFullscreen: enter });
    Object.assign(document, { exitFullscreen: leave });

    expect(press(view, 'f').defaultPrevented).toBe(true);
    expect(enter).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'fullscreenElement', {
      value: view.contentEl,
      configurable: true,
    });
    press(view, 'F');
    expect(leave).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
  });

  it('is also on the button', async () => {
    const { view } = await openView();
    const enter = vi.fn(() => Promise.resolve());
    Object.assign(view.contentEl, { requestFullscreen: enter });

    view.contentEl
      .querySelector<HTMLButtonElement>('button[aria-label="Toggle full screen"]')
      ?.click();
    expect(enter).toHaveBeenCalledTimes(1);
  });
});

describe('links', () => {
  const click = (el: Element) => {
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(evt);
    return evt;
  };

  it('opens an external link in the browser and stays on the slide', async () => {
    setDeck(slidesHtml(2, '<p><a href="https://obsidian.md">site</a></p>'));
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { view } = await openView();

    const evt = click(view.contentEl.querySelector('a') as Element);

    expect(evt.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledWith('https://obsidian.md');
  });

  it('does nothing for an internal link or a tag', async () => {
    setDeck(
      slidesHtml(
        2,
        '<p><a class="internal-link" href="outra">nota</a> <a class="tag" href="#tag">#tag</a></p>',
      ),
    );
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { view } = await openView();

    for (const link of view.contentEl.querySelectorAll('a')) {
      expect(click(link).defaultPrevented).toBe(true);
    }
    expect(open).not.toHaveBeenCalled();
  });

  it('lets a click on plain text through', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { view } = await openView();

    expect(click(view.contentEl.querySelector('h1') as Element).defaultPrevented).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});

describe('editing the note', () => {
  it('renders again, after a pause, when the note changes', async () => {
    vi.useFakeTimers();
    const { view, app, emit } = await openView();
    expect(renderDeck).toHaveBeenCalledTimes(1);

    app.vault.cachedRead.mockResolvedValue('# editada');
    emit('vault:modify', { path: NOTE });
    emit('vault:modify', { path: NOTE });
    expect(renderDeck).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(300);
    expect(renderDeck).toHaveBeenCalledTimes(2);
    expect(renderDeck).toHaveBeenLastCalledWith('# editada', expect.any(Function));
    expect(slides(view)).toHaveLength(3);
  });

  it('ignores changes to other notes', async () => {
    vi.useFakeTimers();
    const { emit } = await openView();

    emit('vault:modify', { path: 'outra.md' });
    await vi.advanceTimersByTimeAsync(1000);

    expect(renderDeck).toHaveBeenCalledTimes(1);
  });

  it('renders again when the theme changes', async () => {
    vi.useFakeTimers();
    const { emit } = await openView();

    emit('workspace:css-change');
    await vi.advanceTimersByTimeAsync(300);

    expect(renderDeck).toHaveBeenCalledTimes(2);
  });

  it('stays on the same slide while the note is edited', async () => {
    vi.useFakeTimers();
    const { view, app, emit } = await openView();
    press(view, 'ArrowRight');
    expect(shown(view)).toBe(1);

    app.vault.cachedRead.mockResolvedValue('# editada');
    emit('vault:modify', { path: NOTE });
    await vi.advanceTimersByTimeAsync(300);

    expect(shown(view)).toBe(1);
    expect(counter(view)).toBe('2 / 3');
  });

  it('stays on the last slide when the deck gets shorter', async () => {
    vi.useFakeTimers();
    const { view, app, emit } = await openView();
    press(view, 'End');

    setDeck(slidesHtml(2));
    app.vault.cachedRead.mockResolvedValue('# mais curta');
    emit('vault:modify', { path: NOTE });
    await vi.advanceTimersByTimeAsync(300);

    expect(shown(view)).toBe(1);
    expect(counter(view)).toBe('2 / 2');
  });
});

describe('following the editor', () => {
  const typing = (path = NOTE) => ({ file: { path } });

  it('reads the note from the editor that has it open, not from the file', async () => {
    const { app } = await openView({ content: '# no disco', editorText: '# no editor' });

    expect(renderDeck).toHaveBeenCalledWith('# no editor', expect.any(Function));
    expect(app.vault.cachedRead).not.toHaveBeenCalled();
  });

  it('follows the typing without waiting for the file to be saved', async () => {
    vi.useFakeTimers();
    const { editor, app, emit } = await openView({ editorText: 'a' });

    if (editor) editor.text = 'ab';
    emit('workspace:editor-change', {}, typing());
    expect(renderDeck).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(300);
    expect(renderDeck).toHaveBeenCalledTimes(2);
    expect(renderDeck).toHaveBeenLastCalledWith('ab', expect.any(Function));
    expect(app.vault.cachedRead).not.toHaveBeenCalled();
  });

  it('waits for a pause in the typing', async () => {
    vi.useFakeTimers();
    const { editor, emit } = await openView({ editorText: 'a' });

    for (const text of ['ab', 'abc', 'abcd']) {
      if (editor) editor.text = text;
      emit('workspace:editor-change', {}, typing());
      await vi.advanceTimersByTimeAsync(200);
    }
    expect(renderDeck).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(300);
    expect(renderDeck).toHaveBeenCalledTimes(2);
    expect(renderDeck).toHaveBeenLastCalledWith('abcd', expect.any(Function));
  });

  it('ignores typing in another note', async () => {
    vi.useFakeTimers();
    const { editor, emit } = await openView({ editorText: 'a' });

    // Only the note's own events count, whatever the editors hold.
    if (editor) editor.text = 'ab';
    emit('workspace:editor-change', {}, typing('outra.md'));
    emit('workspace:editor-change', {}, { file: null });
    await vi.advanceTimersByTimeAsync(1000);

    expect(renderDeck).toHaveBeenCalledTimes(1);
  });

  it('does not draw the same text again when the save arrives', async () => {
    vi.useFakeTimers();
    const { editor, emit } = await openView({ editorText: 'a' });

    if (editor) editor.text = 'ab';
    emit('workspace:editor-change', {}, typing());
    await vi.advanceTimersByTimeAsync(300);
    expect(renderDeck).toHaveBeenCalledTimes(2);

    emit('vault:modify', { path: NOTE });
    await vi.advanceTimersByTimeAsync(300);
    expect(renderDeck).toHaveBeenCalledTimes(2);
  });

  it('does not draw the same text again when a save changes nothing', async () => {
    vi.useFakeTimers();
    const { emit } = await openView();

    emit('vault:modify', { path: NOTE });
    await vi.advanceTimersByTimeAsync(300);

    expect(renderDeck).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest typing when a save of older text arrives', async () => {
    vi.useFakeTimers();
    const { editor, app, emit } = await openView({ editorText: 'a' });

    if (editor) editor.text = 'abc';
    app.vault.cachedRead.mockResolvedValue('ab');
    emit('vault:modify', { path: NOTE });
    await vi.advanceTimersByTimeAsync(300);

    expect(renderDeck).toHaveBeenLastCalledWith('abc', expect.any(Function));
  });

  it('draws again on a theme change even though the text is the same', async () => {
    vi.useFakeTimers();
    const { emit } = await openView({ editorText: 'a' });

    emit('workspace:css-change');
    await vi.advanceTimersByTimeAsync(300);

    expect(renderDeck).toHaveBeenCalledTimes(2);
  });

  it('draws again when it is given the note again', async () => {
    const { view } = await openView();
    await view.setState({ file: NOTE }, {} as never);
    expect(renderDeck).toHaveBeenCalledTimes(2);
  });

  it('reads the file when no editor has the note open', async () => {
    const { app } = await openView({ content: '# só no disco' });
    expect(renderDeck).toHaveBeenCalledWith('# só no disco', expect.any(Function));
    expect(app.vault.cachedRead).toHaveBeenCalledTimes(1);
  });

  it('ignores an editor that has another note open', async () => {
    const harness = makeApp('# no disco');
    openEditor(harness.leaves, '# de outra nota', 'outra.md');
    const view = new SpotlightView({ app: harness.app } as unknown as WorkspaceLeaf);
    document.body.append(view.containerEl);
    await (view as unknown as { onOpen(): Promise<void> }).onOpen();
    await view.setState({ file: NOTE }, {} as never);

    expect(renderDeck).toHaveBeenCalledWith('# no disco', expect.any(Function));
  });
});

describe('the slide styles', () => {
  it('adds the deck styles to the page and reuses them', async () => {
    vi.useFakeTimers();
    const { app, emit } = await openView();
    expect(document.adoptedStyleSheets).toHaveLength(1);

    app.vault.cachedRead.mockResolvedValue('# editada');
    emit('vault:modify', { path: NOTE });
    await vi.advanceTimersByTimeAsync(300);
    expect(document.adoptedStyleSheets).toHaveLength(1);
  });

  it('takes them off the page when the view closes', async () => {
    const { view } = await openView();
    expect(document.adoptedStyleSheets).toHaveLength(1);

    await (view as unknown as { onClose(): Promise<void> }).onClose();
    expect(document.adoptedStyleSheets).toHaveLength(0);
  });

  it('lets go of the rendered deck when the view closes', async () => {
    const { view } = await openView();
    expect(childrenOf(view)).toHaveLength(1);

    await (view as unknown as { onClose(): Promise<void> }).onClose();
    expect(childrenOf(view)).toHaveLength(0);
  });
});

describe('watching the size of the stage', () => {
  it('uses the observer of its own window and lets go when unloaded', async () => {
    const observed: Element[] = [];
    const disconnect = vi.fn();
    class SpyObserver {
      observe(el: Element) {
        observed.push(el);
      }
      disconnect = disconnect;
    }
    const original = window.ResizeObserver;
    Object.assign(window, { ResizeObserver: SpyObserver });
    try {
      const { view } = await openView();
      expect(observed).toEqual([view.contentEl.querySelector('.spotlight-stage')]);
      expect(disconnect).not.toHaveBeenCalled();

      view.unload();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      Object.assign(window, { ResizeObserver: original });
    }
  });
});

describe('finding an image', () => {
  async function resolver() {
    const harness = await openView();
    const resolve = vi.mocked(renderDeck).mock.calls[0]?.[1];
    if (!resolve) throw new Error('renderDeck was not called');
    return { resolve, ...harness };
  }

  it('resolves a link the way Obsidian does', async () => {
    const { resolve, app, files } = await resolver();
    const photo = new TFile('anexos/foto.png');
    files.set(photo.path, photo);
    app.metadataCache.getFirstLinkpathDest.mockReturnValue(photo);

    expect(resolve('foto.png')).toBe('app://vault/anexos/foto.png');
    expect(app.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith('foto.png', NOTE);
  });

  it('falls back to a path relative to the note', async () => {
    const { resolve, files } = await resolver();
    const photo = new TFile('aulas/img/foto.png');
    files.set(photo.path, photo);

    expect(resolve('img/foto.png')).toBe('app://vault/aulas/img/foto.png');
    expect(resolve('./img/foto.png')).toBe('app://vault/aulas/img/foto.png');
  });

  it('understands ../ in a relative path', async () => {
    const { resolve, files } = await resolver();
    const photo = new TFile('capa.png');
    files.set(photo.path, photo);

    expect(resolve('../capa.png')).toBe('app://vault/capa.png');
  });

  it('gives null when the file is nowhere', async () => {
    const { resolve } = await resolver();
    expect(resolve('nao-existe.png')).toBeNull();
  });
});

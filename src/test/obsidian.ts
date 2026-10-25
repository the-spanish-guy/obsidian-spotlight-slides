type Listener = (...args: never[]) => unknown;

export class Component {
  children: Component[] = [];
  cleanups: Array<() => void> = [];
  events: unknown[] = [];

  addChild<T extends Component>(child: T): T {
    this.children.push(child);
    return child;
  }

  removeChild<T extends Component>(child: T): T {
    this.children = this.children.filter((c) => c !== child);
    return child;
  }

  register(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  registerEvent(ref: unknown): void {
    this.events.push(ref);
  }

  registerDomEvent(
    el: EventTarget,
    type: string,
    callback: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    el.addEventListener(type, callback, options);
    this.register(() => el.removeEventListener(type, callback, options));
  }

  unload(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
  }
}

export class ItemView extends Component {
  app: unknown;
  leaf: unknown;
  containerEl = document.createElement('div');
  contentEl = this.containerEl.createDiv();

  constructor(leaf: { app?: unknown }) {
    super();
    this.leaf = leaf;
    this.app = leaf.app;
  }

  setState(): Promise<void> {
    return Promise.resolve();
  }
}

export class TFile {
  constructor(
    public path: string,
    public parent: { path: string } | null = null,
  ) {}

  get basename(): string {
    return (this.path.split('/').pop() ?? '').replace(/\.md$/, '');
  }
}

export class MarkdownView {
  constructor(public file: TFile | null) {}
}

export class Plugin extends Component {
  app: unknown;
  commands: Array<Record<string, unknown>> = [];
  ribbons: Array<{ icon: string; title: string; callback: () => void }> = [];
  views = new Map<string, (leaf: unknown) => unknown>();

  addCommand(command: Record<string, unknown>): void {
    this.commands.push(command);
  }

  addRibbonIcon(icon: string, title: string, callback: () => void): void {
    this.ribbons.push({ icon, title, callback });
  }

  registerView(type: string, creator: (leaf: unknown) => unknown): void {
    this.views.set(type, creator);
  }
}

type Renderer = (
  markdown: string,
  el: HTMLElement,
  sourcePath: string,
) => void | Promise<void>;

const defaultRenderer: Renderer = (markdown, el) => {
  el.createEl('p', { text: markdown });
};

let renderer: Renderer = defaultRenderer;

// What each call to `MarkdownRenderer.render` was asked to render.
export const rendered: Array<{ markdown: string; sourcePath: string }> = [];

export const MarkdownRenderer = {
  async render(
    _app: unknown,
    markdown: string,
    el: HTMLElement,
    sourcePath: string,
    _component: Component,
  ): Promise<void> {
    rendered.push({ markdown, sourcePath });
    await renderer(markdown, el, sourcePath);
  },
};

// Lets a test decide what Obsidian renders for a piece of Markdown.
export function setMarkdownRenderer(next: Renderer | undefined): void {
  renderer = next ?? defaultRenderer;
}

export const mathState = { loaded: 0, finished: 0, fail: false };

export function resetObsidianFake(): void {
  rendered.length = 0;
  renderer = defaultRenderer;
  mathState.loaded = 0;
  mathState.finished = 0;
  mathState.fail = false;
}

export function renderMath(source: string, display: boolean): HTMLElement {
  if (mathState.fail) throw new Error('bad formula');
  const el = document.createElement('mjx-container');
  el.dataset.source = source;
  el.dataset.display = String(display);
  return el;
}

export function loadMathJax(): Promise<void> {
  mathState.loaded++;
  return Promise.resolve();
}

export function finishRenderMath(): Promise<void> {
  mathState.finished++;
  return Promise.resolve();
}

export function setIcon(el: HTMLElement, icon: string): void {
  el.dataset.icon = icon;
}

export function debounce<T extends unknown[]>(
  callback: (...args: T) => void,
  timeout = 0,
  resetTimer = false,
): (...args: T) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: T) => {
    if (timer !== undefined && resetTimer) clearTimeout(timer);
    if (timer === undefined || resetTimer) {
      timer = setTimeout(() => {
        timer = undefined;
        callback(...args);
      }, timeout);
    }
  };
}

export type { Listener };

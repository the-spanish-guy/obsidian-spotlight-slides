type Cls = string | string[];

interface ElementInfo {
  cls?: Cls;
  text?: string | DocumentFragment;
  attr?: Record<string, string | number | boolean | null>;
  title?: string;
  parent?: Node;
  prepend?: boolean;
}

const classes = (cls: Cls) => (Array.isArray(cls) ? cls : cls.split(/\s+/));

function build<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  info?: string | ElementInfo,
  callback?: (el: HTMLElementTagNameMap[K]) => void,
): HTMLElementTagNameMap[K] {
  const options: ElementInfo =
    typeof info === 'string' ? { cls: info } : (info ?? {});
  const el = document.createElement(tag);
  if (options.cls) el.classList.add(...classes(options.cls).filter(Boolean));
  if (options.text !== undefined) el.append(options.text);
  if (options.title) el.title = options.title;
  for (const [name, value] of Object.entries(options.attr ?? {})) {
    if (value !== null) el.setAttribute(name, String(value));
  }
  callback?.(el);
  return el;
}

function install(): void {
  const create = function <K extends keyof HTMLElementTagNameMap>(
    this: Element,
    tag: K,
    info?: string | ElementInfo,
    callback?: (el: HTMLElementTagNameMap[K]) => void,
  ) {
    const el = build(tag, info, callback);
    const options = typeof info === 'object' ? info : undefined;
    if (options?.prepend) this.prepend(el);
    else this.append(el);
    return el;
  };

  Object.assign(Element.prototype, {
    createEl: create,
    createDiv(this: Element, info?: string | ElementInfo) {
      return create.call(this, 'div', info);
    },
    createSpan(this: Element, info?: string | ElementInfo) {
      return create.call(this, 'span', info);
    },
    empty(this: Element) {
      this.replaceChildren();
    },
    addClass(this: Element, ...names: string[]) {
      this.classList.add(...names);
    },
    removeClass(this: Element, ...names: string[]) {
      this.classList.remove(...names);
    },
    hasClass(this: Element, name: string) {
      return this.classList.contains(name);
    },
    toggleClass(this: Element, names: Cls, value: boolean) {
      for (const name of classes(names)) this.classList.toggle(name, value);
    },
    setText(this: Element, text: string | DocumentFragment) {
      this.textContent = typeof text === 'string' ? text : '';
      if (typeof text !== 'string') this.append(text);
    },
  });

  Object.assign(globalThis, {
    createEl: build,
    createDiv: (info?: string | ElementInfo) => build('div', info),
    createSpan: (info?: string | ElementInfo) => build('span', info),
  });
}

// The window of an Obsidian app has these; a test DOM may not.
function fill(): void {
  if (!('adoptedStyleSheets' in document)) {
    Object.defineProperty(document, 'adoptedStyleSheets', {
      value: [],
      writable: true,
      configurable: true,
    });
  }
  if (typeof ResizeObserver === 'undefined') {
    Object.assign(globalThis, {
      ResizeObserver: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  }
}

if (typeof document !== 'undefined') {
  install();
  fill();
}

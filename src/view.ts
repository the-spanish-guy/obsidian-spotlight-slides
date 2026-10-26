import {
  Component,
  debounce,
  type Editor,
  ItemView,
  MarkdownView,
  type TFile,
  type ViewStateResult,
} from 'obsidian';
import { Controls } from './controls';
import { resolveRelative } from './render/images';
import { postprocessDeck } from './render/postprocess';
import { renderDeck } from './render/slides';
import { ScrollIndicator } from './scroll-indicator';

export const VIEW_TYPE_SPOTLIGHT = 'spotlight-slides-view';

interface SpotlightViewState extends Record<string, unknown> {
  file?: string;
  follow?: boolean;
}

export class SpotlightView extends ItemView {
  private filePath: string | undefined;
  private stageEl!: HTMLElement;
  private sheet: CSSStyleSheet | undefined;
  private deckComponent: Component | undefined;
  private controls: Controls | undefined;
  private scrollIndicator: ScrollIndicator | undefined;
  private current = 0;
  private focused = false;
  private lastMarkdown: string | undefined;
  private follow = false;
  private slideStarts: number[] = [];

  private readonly scheduleRender = debounce(
    () => void this.render(),
    300,
    true,
  );

  getViewType(): string {
    return VIEW_TYPE_SPOTLIGHT;
  }

  getDisplayText(): string {
    return this.filePath ? `Slides: ${this.fileName()}` : 'Spotlight Slides';
  }

  getIcon(): string {
    return 'presentation';
  }

  getState(): SpotlightViewState {
    return { file: this.filePath, follow: this.follow };
  }

  async setState(
    state: SpotlightViewState,
    result: ViewStateResult,
  ): Promise<void> {
    this.filePath = state.file;
    this.follow = state.follow === true;
    this.lastMarkdown = undefined;
    await super.setState(state, result);
    await this.render();
  }

  protected onOpen(): Promise<void> {
    this.contentEl.addClass('spotlight-view');
    this.contentEl.tabIndex = 0;
    this.stageEl = this.contentEl.createDiv({ cls: 'spotlight-stage' });
    this.controls = new Controls(this.contentEl, {
      previous: () => this.show(this.current - 1),
      next: () => this.show(this.current + 1),
      toggleFullscreen: () => this.toggleFullscreen(),
    });

    this.scrollIndicator = new ScrollIndicator(this.contentEl);

    this.registerDomEvent(this.contentEl, 'keydown', (evt) =>
      this.onKeydown(evt),
    );
    this.registerDomEvent(this.stageEl, 'click', (evt) =>
      this.onLinkClick(evt),
    );

    this.registerDomEvent(
      this.stageEl,
      'scroll',
      () => this.updateScrollIndicator(),
      true,
    );

    const win = this.contentEl.ownerDocument.defaultView ?? window;
    const resizes = new win.ResizeObserver(() => this.updateScrollIndicator());
    resizes.observe(this.stageEl);
    this.register(() => resizes.disconnect());
    this.registerEvent(
      this.app.workspace.on('editor-change', (_editor, info) => {
        if (info.file?.path === this.filePath) this.scheduleRender();
      }),
    );
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file.path === this.filePath) this.scheduleRender();
      }),
    );
    // Slides inherit the theme through CSS variables, but Mermaid bakes
    // colors into its SVG, so the deck is rendered again on a theme change,
    // even though the text is the same.
    this.registerEvent(
      this.app.workspace.on('css-change', () => {
        this.lastMarkdown = undefined;
        this.scheduleRender();
      }),
    );
    return Promise.resolve();
  }

  protected onClose(): Promise<void> {
    this.releaseDeck();
    this.releaseSheet();
    return Promise.resolve();
  }

  private fileName(): string {
    return this.filePath?.split('/').pop()?.replace(/\.md$/, '') ?? '';
  }

  private async render(): Promise<void> {
    if (!this.stageEl) return;
    const file = this.filePath
      ? this.app.vault.getFileByPath(this.filePath)
      : null;
    if (!file) {
      this.lastMarkdown = undefined;
      this.stageEl.empty();
      this.stageEl.createDiv({
        cls: 'spotlight-empty',
        text: 'Note not found.',
      });
      return;
    }

    const markdown = await this.currentText(file);
    if (markdown === this.lastMarkdown) return;
    this.lastMarkdown = markdown;

    const deck = renderDeck(markdown, (linkpath) =>
      this.resolveImage(linkpath, file),
    );

    this.applyCss(deck.css);
    this.releaseDeck();
    this.deckComponent = new Component();
    this.addChild(this.deckComponent);

    const doc = new DOMParser().parseFromString(deck.html, 'text/html');
    this.stageEl.empty();
    this.stageEl.append(...Array.from(doc.body.childNodes));

    await postprocessDeck(
      {
        root: this.stageEl,
        app: this.app,
        component: this.deckComponent,
        sourcePath: file.path,
      },
      deck,
    );

    this.slideStarts = deck.slideStarts;
    this.current = this.slideAtCursor(file) ?? this.current;
    this.show(this.current);
    if (!this.focused) {
      this.focused = true;
      this.contentEl.focus({ preventScroll: true });
    }
  }

  private editorFor(file: TFile): Editor | undefined {
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === file.path) {
        return view.editor;
      }
    }
    return undefined;
  }

  private currentText(file: TFile): Promise<string> {
    const editor = this.editorFor(file);
    return editor
      ? Promise.resolve(editor.getValue())
      : this.app.vault.cachedRead(file);
  }

  private slideAtCursor(file: TFile): number | undefined {
    const editor = this.follow ? this.editorFor(file) : undefined;
    if (!editor || this.slideStarts.length === 0) return undefined;

    const line = editor.getCursor().line;
    return this.slideStarts.reduce(
      (slide, start, i) => (start <= line ? i : slide),
      0,
    );
  }

  followCursor(): void {
    const file = this.filePath
      ? this.app.vault.getFileByPath(this.filePath)
      : null;
    const slide = file ? this.slideAtCursor(file) : undefined;
    if (slide !== undefined && slide !== this.current) this.show(slide);
  }

  private resolveImage(linkpath: string, note: TFile): string | null {
    const file =
      this.app.metadataCache.getFirstLinkpathDest(linkpath, note.path) ??
      this.app.vault.getFileByPath(
        resolveRelative(note.parent?.path ?? '', linkpath),
      );
    return file ? this.app.vault.getResourcePath(file) : null;
  }

  private slides(): HTMLElement[] {
    return Array.from(
      this.stageEl.querySelectorAll<HTMLElement>('svg[data-marpit-svg]'),
    );
  }

  private show(index: number): void {
    const slides = this.slides();
    if (slides.length === 0) return;
    this.current = Math.min(Math.max(index, 0), slides.length - 1);
    slides.forEach((slide, i) =>
      slide.toggleClass('spotlight-hidden', i !== this.current),
    );
    this.controls?.update(this.current, slides.length);
    this.updateScrollIndicator();
  }

  private updateScrollIndicator(): void {
    const section = this.stageEl.querySelector<HTMLElement>(
      'svg[data-marpit-svg]:not(.spotlight-hidden) section',
    );
    this.scrollIndicator?.update(section);
  }

  private toggleFullscreen(): void {
    const doc = this.contentEl.ownerDocument;
    if (doc.fullscreenElement) void doc.exitFullscreen();
    else void this.contentEl.requestFullscreen();
  }

  // A link must not take the app away from the presentation: external ones open
  // in the browser, and the rest (internal links, tags) do nothing.
  private onLinkClick(evt: MouseEvent): void {
    const link = (evt.target as HTMLElement).closest('a');
    if (!link) return;

    evt.preventDefault();
    evt.stopPropagation();
    const href = link.getAttribute('href') ?? '';
    if (/^https?:\/\//i.test(href)) window.open(href);
  }

  private onKeydown(evt: KeyboardEvent): void {
    const last = this.slides().length - 1;
    switch (evt.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
        this.show(this.current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        this.show(this.current - 1);
        break;
      case 'Home':
        this.show(0);
        break;
      case 'End':
        this.show(last);
        break;
      case 'f':
      case 'F':
        this.toggleFullscreen();
        break;
      default:
        return;
    }
    evt.preventDefault();
  }

  // Marp's CSS is scoped by its own selectors, so it goes in an adopted
  // stylesheet of this window instead of a <style> element.
  private applyCss(css: string): void {
    const doc = this.contentEl.ownerDocument;
    this.sheet ??= new (doc.defaultView ?? window).CSSStyleSheet();
    this.sheet.replaceSync(css);
    if (!doc.adoptedStyleSheets.includes(this.sheet)) {
      doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, this.sheet];
    }
  }

  private releaseSheet(): void {
    if (!this.sheet) return;
    const doc = this.contentEl.ownerDocument;
    doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter(
      (s) => s !== this.sheet,
    );
    this.sheet = undefined;
  }

  private releaseDeck(): void {
    if (!this.deckComponent) return;
    this.removeChild(this.deckComponent);
    this.deckComponent = undefined;
  }
}

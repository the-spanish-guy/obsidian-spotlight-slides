import {
  Component,
  debounce,
  ItemView,
  type ViewStateResult,
  type WorkspaceLeaf,
} from 'obsidian';
import type SpotlightSlidesPlugin from './main';
import { renderCodeBlocksWithObsidian } from './render/postprocess';
import { renderDeck } from './render/slides';

export const VIEW_TYPE_SPOTLIGHT = 'spotlight-slides-view';

interface SpotlightViewState extends Record<string, unknown> {
  file?: string;
}

export class SpotlightView extends ItemView {
  private filePath: string | undefined;
  private stageEl!: HTMLElement;
  private sheet: CSSStyleSheet | undefined;
  private deckComponent: Component | undefined;
  private current = 0;

  private readonly scheduleRender = debounce(
    () => void this.render(),
    300,
    true,
  );

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: SpotlightSlidesPlugin,
  ) {
    super(leaf);
  }

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
    return { file: this.filePath };
  }

  async setState(
    state: SpotlightViewState,
    result: ViewStateResult,
  ): Promise<void> {
    this.filePath = state.file;
    await super.setState(state, result);
    await this.render();
  }

  protected onOpen(): Promise<void> {
    this.contentEl.addClass('spotlight-view');
    this.contentEl.tabIndex = 0;
    this.stageEl = this.contentEl.createDiv({ cls: 'spotlight-stage' });

    this.registerDomEvent(this.contentEl, 'keydown', (evt) =>
      this.onKeydown(evt),
    );
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file.path === this.filePath) this.scheduleRender();
      }),
    );
    // Slides inherit the theme through CSS variables, but Mermaid bakes
    // colors into its SVG, so the deck is rendered again on a theme change.
    this.registerEvent(
      this.app.workspace.on('css-change', () => this.scheduleRender()),
    );
    return Promise.resolve();
  }

  protected onClose(): Promise<void> {
    this.releaseDeck();
    this.releaseSheet();
    return Promise.resolve();
  }

  refresh(): void {
    this.scheduleRender();
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
      this.stageEl.empty();
      this.stageEl.createDiv({
        cls: 'spotlight-empty',
        text: 'Note not found.',
      });
      return;
    }

    const markdown = await this.app.vault.cachedRead(file);
    const { html, css } = renderDeck(markdown);

    this.applyCss(css);
    this.releaseDeck();
    this.deckComponent = new Component();
    this.addChild(this.deckComponent);

    const doc = new DOMParser().parseFromString(html, 'text/html');
    this.stageEl.empty();
    this.stageEl.append(...Array.from(doc.body.childNodes));

    await renderCodeBlocksWithObsidian(
      this.stageEl,
      this.app,
      this.deckComponent,
      file.path,
      this.plugin.settings.highlighter,
    );

    this.show(this.current);
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

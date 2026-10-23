import { setIcon } from 'obsidian';

export interface ControlActions {
  previous: () => void;
  next: () => void;
  toggleFullscreen: () => void;
}

// The overlay over the slide: buttons that appear on hover, the slide counter
// and a progress bar.
export class Controls {
  private readonly counterEl: HTMLElement;
  private readonly barEl: HTMLElement;

  constructor(parent: HTMLElement, actions: ControlActions) {
    const bar = parent.createDiv({ cls: 'spotlight-progress' });
    this.barEl = bar.createDiv({ cls: 'spotlight-progress-bar' });

    const toolbar = parent.createDiv({ cls: 'spotlight-controls' });
    this.button(toolbar, 'chevron-left', 'Previous slide', actions.previous);
    this.counterEl = toolbar.createSpan({ cls: 'spotlight-counter' });
    this.button(toolbar, 'chevron-right', 'Next slide', actions.next);
    this.button(
      toolbar,
      'maximize',
      'Toggle full screen',
      actions.toggleFullscreen,
    );
  }

  update(current: number, total: number): void {
    this.counterEl.setText(`${current + 1} / ${total}`);
    const progress = total > 1 ? current / (total - 1) : 1;
    this.barEl.style.width = `${progress * 100}%`;
  }

  private button(
    parent: HTMLElement,
    icon: string,
    label: string,
    onClick: () => void,
  ): void {
    const button = parent.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': label },
    });
    setIcon(button, icon);
    button.addEventListener('click', (evt) => {
      onClick();
      parent.parentElement?.focus();
      evt.stopPropagation();
    });
  }
}

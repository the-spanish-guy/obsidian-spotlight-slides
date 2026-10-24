const MIN_THUMB = 24;

// A slim, short bar on the right edge that shows where a tall slide is
// scrolled to. It replaces the native scrollbar, which cannot be shortened.
export class ScrollIndicator {
  private readonly trackEl: HTMLElement;
  private readonly thumbEl: HTMLElement;

  constructor(parent: HTMLElement) {
    this.trackEl = parent.createDiv({ cls: 'spotlight-scroll' });
    this.thumbEl = this.trackEl.createDiv({ cls: 'spotlight-scroll-thumb' });
  }

  update(section: HTMLElement | null): void {
    const overflow = section ? section.scrollHeight - section.clientHeight : 0;
    this.trackEl.toggleClass('is-active', overflow > 1);
    if (!section || overflow <= 1) return;

    const track = this.trackEl.clientHeight;
    const thumb = Math.max(
      MIN_THUMB,
      (section.clientHeight / section.scrollHeight) * track,
    );
    this.thumbEl.style.height = `${thumb}px`;
    this.thumbEl.style.top = `${(section.scrollTop / overflow) * (track - thumb)}px`;
  }
}

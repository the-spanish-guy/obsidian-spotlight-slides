// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import { ScrollIndicator } from './scroll-indicator';

// A test DOM has no layout, so the sizes a browser would measure are set here.
function size(el: Element, sizes: Record<string, number>) {
  for (const [name, value] of Object.entries(sizes)) {
    Object.defineProperty(el, name, { value, configurable: true });
  }
}

function setup(trackHeight = 200) {
  const parent = document.createElement('div');
  const indicator = new ScrollIndicator(parent);
  const track = parent.querySelector<HTMLElement>('.spotlight-scroll');
  const thumb = parent.querySelector<HTMLElement>('.spotlight-scroll-thumb');
  if (!track || !thumb) throw new Error('indicator not built');
  size(track, { clientHeight: trackHeight });
  return { indicator, track, thumb };
}

function slide(sizes: { scrollHeight: number; clientHeight: number; scrollTop?: number }) {
  const section = document.createElement('section');
  size(section, { scrollTop: 0, ...sizes });
  return section;
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe('ScrollIndicator', () => {
  it('stays hidden when there is no slide', () => {
    const { indicator, track } = setup();
    indicator.update(null);
    expect(track.classList.contains('is-active')).toBe(false);
  });

  it('stays hidden when the slide fits', () => {
    const { indicator, track } = setup();
    indicator.update(slide({ scrollHeight: 720, clientHeight: 720 }));
    expect(track.classList.contains('is-active')).toBe(false);
  });

  it('ignores a one pixel overflow, which is only rounding', () => {
    const { indicator, track } = setup();
    indicator.update(slide({ scrollHeight: 721, clientHeight: 720 }));
    expect(track.classList.contains('is-active')).toBe(false);
  });

  it('sizes the thumb by how much of the slide is visible', () => {
    const { indicator, track, thumb } = setup(200);
    indicator.update(slide({ scrollHeight: 1000, clientHeight: 500 }));

    expect(track.classList.contains('is-active')).toBe(true);
    expect(thumb.style.height).toBe('100px');
    expect(thumb.style.top).toBe('0px');
  });

  it('moves the thumb along the track as the slide scrolls', () => {
    const { indicator, thumb } = setup(200);

    indicator.update(slide({ scrollHeight: 1000, clientHeight: 500, scrollTop: 250 }));
    expect(thumb.style.top).toBe('50px');

    indicator.update(slide({ scrollHeight: 1000, clientHeight: 500, scrollTop: 500 }));
    expect(thumb.style.top).toBe('100px');
  });

  it('never makes the thumb smaller than a size that can be seen', () => {
    const { indicator, thumb } = setup(200);
    indicator.update(slide({ scrollHeight: 10000, clientHeight: 500 }));
    expect(thumb.style.height).toBe('24px');
  });

  it('hides again when the next slide fits', () => {
    const { indicator, track } = setup();
    indicator.update(slide({ scrollHeight: 1000, clientHeight: 500 }));
    expect(track.classList.contains('is-active')).toBe(true);

    indicator.update(slide({ scrollHeight: 500, clientHeight: 500 }));
    expect(track.classList.contains('is-active')).toBe(false);
  });
});

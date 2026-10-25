// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Controls } from './controls';

function setup() {
  const container = document.createElement('div');
  container.tabIndex = 0;
  document.body.append(container);
  const actions = {
    previous: vi.fn(),
    next: vi.fn(),
    toggleFullscreen: vi.fn(),
  };
  const controls = new Controls(container, actions);
  return { container, actions, controls };
}

const button = (container: HTMLElement, label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

beforeEach(() => {
  document.body.replaceChildren();
});

describe('Controls', () => {
  it('builds the three buttons, the counter and the progress bar', () => {
    const { container } = setup();

    expect(button(container, 'Previous slide')?.dataset.icon).toBe('chevron-left');
    expect(button(container, 'Next slide')?.dataset.icon).toBe('chevron-right');
    expect(button(container, 'Toggle full screen')?.dataset.icon).toBe('maximize');
    expect(container.querySelector('.spotlight-counter')).not.toBeNull();
    expect(container.querySelector('.spotlight-progress-bar')).not.toBeNull();
  });

  it('shows the position and how far along the deck is', () => {
    const { container, controls } = setup();
    const counter = container.querySelector('.spotlight-counter');
    const bar = container.querySelector<HTMLElement>('.spotlight-progress-bar');

    controls.update(0, 5);
    expect(counter?.textContent).toBe('1 / 5');
    expect(bar?.style.width).toBe('0%');

    controls.update(2, 5);
    expect(counter?.textContent).toBe('3 / 5');
    expect(bar?.style.width).toBe('50%');

    controls.update(4, 5);
    expect(counter?.textContent).toBe('5 / 5');
    expect(bar?.style.width).toBe('100%');
  });

  it('shows a one-slide deck as complete', () => {
    const { container, controls } = setup();
    controls.update(0, 1);
    expect(container.querySelector<HTMLElement>('.spotlight-progress-bar')?.style.width).toBe('100%');
  });

  it('runs the action of the button that was clicked', () => {
    const { container, actions } = setup();

    button(container, 'Previous slide')?.click();
    button(container, 'Next slide')?.click();
    button(container, 'Next slide')?.click();
    button(container, 'Toggle full screen')?.click();

    expect(actions.previous).toHaveBeenCalledTimes(1);
    expect(actions.next).toHaveBeenCalledTimes(2);
    expect(actions.toggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it('hands the focus back to the view, so the keys keep working', () => {
    const { container } = setup();
    const next = button(container, 'Next slide');

    next?.focus();
    next?.click();

    expect(document.activeElement).toBe(container);
  });

  it('does not let a click reach what is behind the buttons', () => {
    const { container } = setup();
    const outside = vi.fn();
    container.addEventListener('click', outside);

    button(container, 'Next slide')?.click();

    expect(outside).not.toHaveBeenCalled();
  });
});

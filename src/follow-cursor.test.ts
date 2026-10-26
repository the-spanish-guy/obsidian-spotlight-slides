import type { App } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cursorFollower, notifyViews } from './follow-cursor';

// The editor extension is stood in for by the listener it wraps.
vi.mock('@codemirror/view', () => ({
  EditorView: { updateListener: { of: (listener: unknown) => listener } },
}));

const followCursor = vi.fn();
vi.mock('./view', () => ({
  VIEW_TYPE_SPOTLIGHT: 'spotlight-slides-view',
  SpotlightView: class {
    followCursor = followCursor;
  },
}));

async function slideView() {
  const { SpotlightView } = await import('./view');
  return new SpotlightView({} as never);
}

function appWith(...views: unknown[]) {
  const getLeavesOfType = vi.fn(() => views.map((view) => ({ view })));
  return { app: { workspace: { getLeavesOfType } } as unknown as App, getLeavesOfType };
}

beforeEach(() => followCursor.mockClear());

describe('notifyViews', () => {
  it('tells every slide view to follow the cursor', async () => {
    const { app, getLeavesOfType } = appWith(await slideView(), await slideView());

    notifyViews(app);

    expect(getLeavesOfType).toHaveBeenCalledWith('spotlight-slides-view');
    expect(followCursor).toHaveBeenCalledTimes(2);
  });

  it('leaves alone a leaf that is not a loaded slide view', () => {
    const { app } = appWith({ placeholder: true });
    notifyViews(app);
    expect(followCursor).not.toHaveBeenCalled();
  });
});

describe('the editor extension', () => {
  const listener = (app: App) =>
    cursorFollower(app) as unknown as (update: { selectionSet: boolean }) => void;

  it('tells the slides when the selection moves', async () => {
    const { app } = appWith(await slideView());
    listener(app)({ selectionSet: true });
    expect(followCursor).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when only something else in the editor changed', async () => {
    const { app } = appWith(await slideView());
    listener(app)({ selectionSet: false });
    expect(followCursor).not.toHaveBeenCalled();
  });
});

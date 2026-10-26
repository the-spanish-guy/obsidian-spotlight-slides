import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { App } from 'obsidian';
import { SpotlightView, VIEW_TYPE_SPOTLIGHT } from './view';

export function notifyViews(app: App): void {
  for (const leaf of app.workspace.getLeavesOfType(VIEW_TYPE_SPOTLIGHT)) {
    if (leaf.view instanceof SpotlightView) leaf.view.followCursor();
  }
}

export function cursorFollower(app: App): Extension {
  return EditorView.updateListener.of((update) => {
    if (update.selectionSet) notifyViews(app);
  });
}

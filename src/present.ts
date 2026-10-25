import type { App, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_SPOTLIGHT } from './view';

// Where the slides open: in a tab, beside the note (to edit with a preview), or
// in a window of their own (to take to a projector or a second screen).
export type Placement = 'tab' | 'side' | 'window';

function openLeaf(app: App, placement: Placement): WorkspaceLeaf {
  const { workspace } = app;
  switch (placement) {
    case 'tab':
      return workspace.getLeaf('tab');
    case 'side':
      // Vertical puts the new pane to the right of the note.
      return workspace.getLeaf('split', 'vertical');
    case 'window':
      return workspace.openPopoutLeaf();
  }
}

export async function presentNote(
  app: App,
  source: MarkdownView,
  placement: Placement,
): Promise<void> {
  const file = source.file;
  if (!file) return;

  const leaf = openLeaf(app, placement);
  const beside = placement === 'side';
  await leaf.setViewState({
    type: VIEW_TYPE_SPOTLIGHT,
    active: !beside,
    state: { file: file.path },
  });

  // Beside the note, the keyboard stays with the editor, so the writer can go
  // on typing while the slides follow. Elsewhere, the slides take it.
  if (beside) app.workspace.setActiveLeaf(source.leaf, { focus: true });
  else leaf.view.containerEl.focus();
}

import { MarkdownView, Plugin } from 'obsidian';
import { type Placement, presentNote } from './present';
import { SpotlightView, VIEW_TYPE_SPOTLIGHT } from './view';

const COMMANDS: ReadonlyArray<{ id: string; name: string; placement: Placement }> =
  [
    { id: 'present-current-note', name: 'Present current note', placement: 'tab' },
    { id: 'present-to-the-side', name: 'Present to the side', placement: 'side' },
    {
      id: 'present-in-new-window',
      name: 'Present in new window',
      placement: 'window',
    },
  ];

export default class SpotlightSlidesPlugin extends Plugin {
  onload() {
    this.registerView(VIEW_TYPE_SPOTLIGHT, (leaf) => new SpotlightView(leaf));

    this.addRibbonIcon('presentation', 'Present current note', () =>
      this.present('tab'),
    );
    for (const { id, name, placement } of COMMANDS) {
      this.addCommand({
        id,
        name,
        checkCallback: (checking) => {
          if (!this.activeNote()) return false;
          if (!checking) this.present(placement);
          return true;
        },
      });
    }
  }

  private activeNote(): MarkdownView | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.file ? view : null;
  }

  private present(placement: Placement) {
    const source = this.activeNote();
    if (source) void presentNote(this.app, source, placement);
  }
}

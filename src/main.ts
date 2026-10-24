import { MarkdownView, Plugin } from 'obsidian';
import { SpotlightView, VIEW_TYPE_SPOTLIGHT } from './view';

export default class SpotlightSlidesPlugin extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE_SPOTLIGHT, (leaf) => new SpotlightView(leaf));

    this.addRibbonIcon(
      'presentation',
      'Present current note',
      () => void this.presentActiveNote(),
    );
    this.addCommand({
      id: 'present-current-note',
      name: 'Present current note',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
        if (!file) return false;
        if (!checking) void this.presentActiveNote();
        return true;
      },
    });
  }

  private async presentActiveNote() {
    const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
    if (!file) return;
    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.setViewState({
      type: VIEW_TYPE_SPOTLIGHT,
      active: true,
      state: { file: file.path },
    });
    await this.app.workspace.revealLeaf(leaf);
    leaf.view.containerEl.focus();
  }
}

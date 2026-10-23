import { MarkdownView, Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	type SpotlightSettings,
	SpotlightSettingTab,
} from './settings';
import { SpotlightView, VIEW_TYPE_SPOTLIGHT } from './view';

export default class SpotlightSlidesPlugin extends Plugin {
	settings: SpotlightSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_SPOTLIGHT, (leaf) => new SpotlightView(leaf, this));
		this.addSettingTab(new SpotlightSettingTab(this.app, this));

		this.addRibbonIcon('presentation', 'Present current note', () =>
			void this.presentActiveNote(),
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

	refreshViews() {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SPOTLIGHT)) {
			if (leaf.view instanceof SpotlightView) leaf.view.refresh();
		}
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

	private async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<SpotlightSettings>,
		);
	}
}

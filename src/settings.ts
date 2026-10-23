import { PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import type SpotlightSlidesPlugin from './main';

export type HighlighterChoice = 'obsidian' | 'marp';

export interface SpotlightSettings {
	highlighter: HighlighterChoice;
}

export const DEFAULT_SETTINGS: SpotlightSettings = {
	highlighter: 'obsidian',
};

export class SpotlightSettingTab extends PluginSettingTab {
	constructor(
		app: SpotlightSlidesPlugin['app'],
		private readonly spotlight: SpotlightSlidesPlugin,
	) {
		super(app, spotlight);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Code highlighting',
				desc: 'Which engine highlights code blocks inside slides.',
				control: {
					type: 'dropdown',
					key: 'highlighter',
					options: {
						obsidian: 'Obsidian',
						marp: 'Marp (highlight.js)',
					},
				},
			},
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		await super.setControlValue(key, value);
		this.spotlight.refreshViews();
	}
}

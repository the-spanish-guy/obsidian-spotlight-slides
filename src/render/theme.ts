// Marp theme that takes every color and font from the Obsidian CSS variables,
// so slides follow the active app theme (light/dark included) without a rerender.
export const OBSIDIAN_THEME_CSS = `
/* @theme obsidian */

section {
	width: 1280px;
	height: 720px;
	box-sizing: border-box;
	padding: 56px 72px;
	display: flex;
	flex-direction: column;
	/* "safe" keeps the top reachable by scrolling when the content is taller */
	justify-content: safe center;
	overflow-x: hidden;
	overflow-y: auto;
	background: var(--background-primary);
	color: var(--text-normal);
	font-family: var(--font-text);
	font-size: 30px;
	line-height: 1.5;
}

section > * { margin-top: 0; }

/* The native scrollbar is hidden; the view draws its own indicator */
section { scrollbar-width: none; }

h1, h2, h3, h4, h5, h6 {
	font-family: var(--font-interface);
	font-weight: var(--bold-weight);
	line-height: 1.2;
	margin: 0 0 0.5em;
}
h1 { font-size: 2em; color: var(--h1-color); }
h2 { font-size: 1.6em; color: var(--h2-color); }
h3 { font-size: 1.3em; color: var(--h3-color); }
h4 { font-size: 1.1em; color: var(--h4-color); }
h5 { font-size: 1em; color: var(--h5-color); }
h6 { font-size: 0.9em; color: var(--h6-color); }

p { margin: 0 0 0.8em; }
strong { color: var(--bold-color); }
em { color: var(--italic-color); }
a { color: var(--link-color); text-decoration: underline; }
ul, ol { margin: 0 0 0.8em; padding-left: 1.4em; }
li::marker { color: var(--text-muted); }
hr { border: 0; border-top: 1px solid var(--background-modifier-border); }

blockquote {
	margin: 0 0 0.8em;
	padding: 0.2em 1em;
	border-left: 4px solid var(--interactive-accent);
	color: var(--text-muted);
}

code {
	font-family: var(--font-monospace);
	font-size: 0.85em;
	background: var(--code-background);
	color: var(--code-normal);
	padding: 0.1em 0.3em;
	border-radius: 4px;
}
pre {
	margin: 0 0 0.8em;
	padding: 0.7em 1em;
	background: var(--code-background);
	border-radius: 8px;
	overflow: hidden;
}
pre code { padding: 0; background: none; font-size: 0.75em; }

/* highlight.js tokens, used when the Marp highlighter is selected */
.hljs-comment, .hljs-quote { color: var(--code-comment); }
.hljs-keyword, .hljs-selector-tag, .hljs-doctag { color: var(--code-keyword); }
.hljs-string, .hljs-regexp, .hljs-addition { color: var(--code-string); }
.hljs-number, .hljs-literal, .hljs-bullet { color: var(--code-value); }
.hljs-title, .hljs-section, .hljs-function .hljs-title { color: var(--code-function); }
.hljs-built_in, .hljs-type, .hljs-class .hljs-title { color: var(--code-important); }
.hljs-attr, .hljs-attribute, .hljs-property, .hljs-variable, .hljs-params { color: var(--code-property); }
.hljs-tag, .hljs-name, .hljs-selector-id, .hljs-selector-class { color: var(--code-tag); }
.hljs-meta, .hljs-symbol, .hljs-operator, .hljs-punctuation { color: var(--code-operator); }
.hljs-deletion { color: var(--text-error); }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: bold; }

table { border-collapse: collapse; margin: 0 0 0.8em; }
th, td { border: 1px solid var(--background-modifier-border); padding: 0.3em 0.7em; }
th { background: var(--background-secondary); }

img { max-width: 100%; background: none; }
/* Images without a size set through w:/h: must not outgrow the slide */
img:not([style*="width"]):not([style*="height"]) { max-height: 520px; }

section::after {
	color: var(--text-faint);
	font-size: 0.6em;
}
`;

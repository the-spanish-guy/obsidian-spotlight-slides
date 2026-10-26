# Spotlight Slides

An Obsidian community plugin (desktop only) that presents a note as slides. [Marp Core](https://github.com/marp-team/marp-core) lays out the slides; Obsidian renders everything that is Obsidian's own (code, math, callouts, embeds, tasks, links, tags, highlights, footnotes) and the slides take their look from the active Obsidian theme.

- Entry point: `src/main.ts`, bundled by esbuild into `main.js`.
- Release artifacts: `main.js`, `manifest.json` and `styles.css`, nothing else.
- Docs: `README.md` (English, the main one) and `README.pt-BR.md`. Keep both in step when behavior changes.

## Commands

```bash
npm install
npm run dev      # rebuild on change
npm run build    # type-check, then bundle main.js
npm test         # Vitest
npm run lint     # ESLint with eslint-plugin-obsidianmd
npm version patch|minor|major   # runs version-bump.mjs: updates manifest.json and versions.json
```

- Node.js 22.12 or newer (what Vitest supports). CI builds, lints and tests every push and pull request on Node 22 and 24. Pushing a tag runs `release.yml`, which builds and creates a **draft** release with `main.js`, `manifest.json` and `styles.css`.
- To try it in Obsidian, link the project folder to `<vault>/.obsidian/plugins/spotlight-slides/` and run `npm run dev`. With the Hot-Reload plugin the plugin reloads on every rebuild, because the folder is a git clone.
- Before calling something done, run `npm run build`, `npm run lint` and `npm test`.

## How it works

Marp cannot render what Obsidian owns, and Obsidian cannot lay out slides. So each piece Obsidian owns is **cut out of the note and replaced by a plain token** before Marp runs, Marp turns the rest into slides, and then Obsidian renders each piece and the token is swapped back for it.

`renderDeck` in `src/render/slides.ts` does the cutting, in this order: footnotes, callouts, task lists, embeds, math, inline syntax (`[[links]]`, `#tags`, `==highlights==`, with `%%comments%%` dropped), images, then the split into slides. `postprocessDeck` in `src/render/postprocess.ts` runs after Marp and renders the pieces back through `MarkdownRenderer`, `renderMath` and friends.

Why tokens: Marp's Markdown parser would mangle them otherwise (`a_1 + b_2` becomes emphasis) and could not render them the way Obsidian does. Each cutting step is a **pure function with its own tests**, and it leaves code fences, code spans, HTML comments and the front matter alone.

A note with `marp: true` in its front matter goes to Marp as written. Any other note is split by `src/render/auto.ts`.

## Layout

```
src/
  main.ts              plugin lifecycle: view, ribbon icon, commands, editor extension
  present.ts           where the slides open: tab, side or window
  view.ts              the slide view: keys, links, live updates, following the cursor
  follow-cursor.ts     CodeMirror listener that tells the view the cursor moved
  controls.ts          buttons, counter and progress bar
  scroll-indicator.ts  slim scroll indicator for tall slides
  render/
    slides.ts          the pipeline above
    auto.ts            automatic mode: where to cut, and where each slide starts
    callouts.ts  embeds.ts  footnotes.ts  images.ts  inline.ts  math.ts  tasks.ts
    markdown.ts        helpers shared by the steps (fences, front matter, code spans)
    postprocess.ts     Obsidian renders each piece back into the slides
    theme.ts           Marp theme built on Obsidian's CSS variables
  test/                stand-in for the `obsidian` module and DOM helpers for tests
esbuild.config.mjs     bundling; esbuild.stubs.mjs empties highlight.js, MathJax and KaTeX
docs/demo/             notes the README images were taken from
docs/images/           README images, in en/ and pt-BR/
```

`docs/assets/` holds local originals (HEIC and MOV) and is never committed.

## Conventions

- TypeScript with `strict`. Keep `main.ts` to the lifecycle and delegate everything else.
- Put logic that does not need Obsidian in `src/render/` as pure functions. Code that touches the DOM or the Obsidian API goes in `postprocess.ts`, `view.ts` and the files beside it.
- Formatting: two spaces and single quotes (see `.editorconfig`). Biome formats it on the maintainer's machine; it is not a dependency of the project.
- Comments: write one only when it explains a reason or a rule the code does not show. Never restate what a name or the code already says, and remove such comments from any file you touch.
- English for code, comments, commit messages and `README.md`; `README.pt-BR.md` is Portuguese.
- UI text: sentence case, short, no jargon. Bold the literal UI labels in docs and use arrows for navigation: **Settings → Community plugins**.
- Commits: short and direct, `type: summary` with `feat`, `fix`, `perf`, `refactor`, `test`, `docs` or `chore`. Do not commit or push unless asked.
- Dependencies: exact versions, no `^` (`.npmrc` sets `save-exact`), and the latest that the peers allow. Today TypeScript stays on 6 until `typescript-eslint` accepts 7, ESLint on 9 until `eslint-plugin-obsidianmd` accepts 10, and `marp-core` on 4 until 5 leaves release candidate. The `@codemirror/*` packages use the versions `obsidian` declares and are external to the bundle.

## Testing

- Vitest. Tests that need a DOM start with `// @vitest-environment happy-dom`; the rest run in Node.
- `obsidian` ships only types, so `vitest.config.mjs` aliases it to `src/test/obsidian.ts`, a stand-in where a test decides what `MarkdownRenderer` and `renderMath` produce. `src/test/setup.ts` adds Obsidian's element helpers (`createDiv`, `toggleClass`…).
- Tests cannot see the real renderer, the CSS or the layout. Anything visual still needs a look in Obsidian; the notes in `docs/demo/` cover most syntax.
- To check that a new test really catches a bug, break the code on purpose and see it fail.

## Obsidian rules that apply

- **Manifest:** never change `id` (`spotlight-slides`) or the command IDs (`present-current-note`, `present-to-the-side`, `present-in-new-window`) after release. `minAppVersion` is 1.5.7; the lint rule `obsidianmd/no-unsupported-api` fails when code uses an API newer than that, so run `npm run lint` after touching an Obsidian API.
- **Releases:** the tag equals the `version` in `manifest.json`, with no leading `v`. Attach only `main.js`, `manifest.json` and `styles.css`. The directory reads `manifest.json` from the default branch, so it must be committed before submitting at community.obsidian.md.
- **Privacy:** the plugin makes no network request and has no telemetry. Marp runs with `html: false`, `script: false` and its emoji conversion off (it would fetch Twemoji from a CDN). External links open only when the user selects them. Do not add network calls without an obvious reason and a note in the README.
- **Cleanup:** register every listener with the `register*` helpers so the plugin unloads cleanly. The view can live in a popout window, so use `contentEl.ownerDocument.defaultView` for things such as `ResizeObserver`, not the global `window`.
- **Performance:** keep startup light. Marp is created on first use, renders are debounced and skipped when the text has not changed, and the bundle is about 690 KB. Avoid large dependencies; Marp's highlight.js, MathJax and KaTeX are stubbed out because Obsidian does that work.
- **Desktop only:** `isDesktopOnly` is `true`. Avoid Node and Electron APIs anyway.
- **Settings:** there is no settings tab today. If one comes back, check which Obsidian version its API needs against `minAppVersion`.

## Do and don't

**Do**

- Add or update tests with every behavior change, and keep both READMEs in step.
- Keep a new piece of Obsidian syntax in the same shape as the others: a pure extractor with tests in `src/render/`, a token, a step in `postprocess.ts`, and a place in the order in `renderDeck`.
- Start from the file as it is on disk when rewriting it, so edits the maintainer made are not undone.

**Don't**

- Commit `main.js`, `node_modules/` or `docs/assets/`.
- Add network calls, telemetry or settings without discussing it first.
- Restore comments the maintainer removed.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Submit your plugin: https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin
- Style guide: https://help.obsidian.md/style-guide
- Marp: https://marp.app

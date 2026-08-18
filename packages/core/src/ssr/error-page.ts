/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from './escape.js';

let cachedVersion: string | null = null;

/**
 * The running `@effuse/core` version, read from its own package manifest.
 *
 * Walked up from this module rather than hardcoded, because a literal would
 * drift from package.json silently and the banner would then lie. Best effort:
 * an unreadable manifest just leaves the version off the banner.
 */
const coreVersion = (): string => {
	if (cachedVersion !== null) return cachedVersion;
	cachedVersion = '';
	try {
		let dir = dirname(fileURLToPath(import.meta.url));
		for (let depth = 0; depth < 6; depth++) {
			try {
				const manifest = JSON.parse(
					readFileSync(join(dir, 'package.json'), 'utf8')
				) as { name?: string; version?: string };
				if (manifest.name === '@effuse/core' && manifest.version) {
					cachedVersion = manifest.version;
					break;
				}
			} catch {
				// keep walking
			}
			const parent = dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}
	} catch {
		cachedVersion = '';
	}
	return cachedVersion;
};

export interface StackFrame {
	readonly fn: string;
	readonly file: string;
	readonly line: number;
	readonly column: number;
	/** False for node internals and dependencies, which are noise by default. */
	readonly app: boolean;
}

const FRAME = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/;

const isAppFrame = (file: string): boolean =>
	!file.includes('node_modules') &&
	!file.startsWith('node:') &&
	!file.includes('/internal/');

/** Parse a V8 stack into frames, skipping the message lines above it. */
export const parseStackFrames = (stack: string | undefined): StackFrame[] => {
	if (!stack) return [];

	const frames: StackFrame[] = [];
	for (const raw of stack.split('\n')) {
		const match = FRAME.exec(raw);
		if (!match) continue;

		const file = (match[2] ?? '').replace(/^file:\/\//, '');
		const line = Number(match[3]);
		const column = Number(match[4]);
		if (!Number.isFinite(line) || !Number.isFinite(column)) continue;

		frames.push({
			fn: match[1] ?? '<anonymous>',
			file,
			line,
			column,
			app: isAppFrame(file),
		});
	}
	return frames;
};

export interface SourceLine {
	readonly number: number;
	readonly text: string;
	readonly target: boolean;
}

/**
 * Read a window of source around `line`.
 *
 * Development only, and best effort: a frame can point at a generated file, a
 * path that no longer exists, or something unreadable, and none of those should
 * turn an error page into a second error.
 */
export const readSourceFrame = (
	file: string,
	line: number,
	radius = 4
): SourceLine[] => {
	let content: string;
	try {
		content = readFileSync(file, 'utf8');
	} catch {
		return [];
	}

	const lines = content.split('\n');
	if (line < 1 || line > lines.length) return [];

	const from = Math.max(1, line - radius);
	const to = Math.min(lines.length, line + radius);

	const window: SourceLine[] = [];
	for (let n = from; n <= to; n++) {
		window.push({ number: n, text: lines[n - 1] ?? '', target: n === line });
	}
	return window;
};

interface ErrorLike {
	readonly name?: string;
	readonly message?: string;
	readonly stack?: string;
	readonly cause?: unknown;
}

const asErrorLike = (value: unknown): ErrorLike | null =>
	typeof value === 'object' && value !== null ? (value as ErrorLike) : null;

/** The wrapped error, then its cause, and so on. */
const causeChain = (error: unknown): ErrorLike[] => {
	const chain: ErrorLike[] = [];
	const seen = new Set<unknown>();
	let current = asErrorLike(error);
	while (current && !seen.has(current)) {
		seen.add(current);
		chain.push(current);
		current = asErrorLike(current.cause);
	}
	return chain;
};

const shortenPath = (file: string): string => {
	const cwd = typeof process !== 'undefined' ? process.cwd() : '';
	return cwd && file.startsWith(cwd) ? file.slice(cwd.length + 1) : file;
};

const renderSourceFrame = (frame: StackFrame): string => {
	const lines = readSourceFrame(frame.file, frame.line);
	if (lines.length === 0) return '';

	const rows = lines
		.map((line) => {
			const marker = line.target ? '&gt;' : '&nbsp;';
			const row = `<div class="line${line.target ? ' target' : ''}"><span class="mark">${marker}</span><span class="ln">${line.number}</span><span class="bar">|</span><code>${escapeHtml(line.text)}</code></div>`;
			if (!line.target) return row;
			const pad = '&nbsp;'.repeat(Math.max(0, frame.column - 1));
			return `${row}<div class="line caret"><span class="mark">&nbsp;</span><span class="ln"></span><span class="bar">|</span><code>${pad}^</code></div>`;
		})
		.join('');

	return `<section class="frame">
	<div class="frame-head">${escapeHtml(shortenPath(frame.file))} <span class="loc">(${frame.line}:${frame.column})</span> <span class="at">@ ${escapeHtml(frame.fn)}</span></div>
	<div class="source">${rows}</div>
</section>`;
};

const frameRow = (frame: StackFrame): string =>
	`<li><div class="fn">${escapeHtml(frame.fn)}</div><div class="path">${escapeHtml(shortenPath(frame.file))} (${frame.line}:${frame.column})</div></li>`;

/**
 * Application frames are listed; dependency and node-internal frames sit behind
 * a toggle, because a render stack is mostly framework and runtime noise and
 * the reader is looking for their own file.
 */
const renderFrames = (frames: StackFrame[]): string => {
	if (frames.length === 0) return '';

	const app = frames.filter((frame) => frame.app);
	const rest = frames.filter((frame) => !frame.app);
	const shown = (app.length > 0 ? app : frames).map(frameRow).join('');
	const hidden =
		app.length > 0 && rest.length > 0
			? `<details class="more"><summary>Show ${rest.length} framework frame${rest.length === 1 ? '' : 's'}</summary><ol class="frames dep">${rest.map(frameRow).join('')}</ol></details>`
			: '';

	return `<section class="stack">
	<div class="stack-head"><h2>Call Stack</h2><span class="count">${frames.length}</span></div>
	<ol class="frames">${shown}</ol>
	${hidden}
</section>`;
};

const renderCauses = (chain: ErrorLike[]): string => {
	if (chain.length < 2) return '';

	const rows = chain
		.slice(1)
		.map(
			(cause) =>
				`<li><div class="fn">${escapeHtml(cause.name ?? 'Error')}</div><div class="path">${escapeHtml(cause.message ?? '')}</div></li>`
		)
		.join('');

	return `<section class="stack">
	<div class="stack-head"><h2>Caused By</h2></div>
	<ol class="frames">${rows}</ol>
</section>`;
};

const STYLES = `
:root { color-scheme: dark light;
	--back:#0a0a0a; --panel:#151515; --bar:#1e1e1e; --ink:#ededed; --muted:#8b8b8b;
	--faint:#5a5a5a; --line:#2b2b2b; --accent:#ff6369; --accent-soft:#331317;
	--code:#101010; --ok:#3ecf8e; --shadow:0 12px 40px rgba(0,0,0,.5);
	--r-lg:12px; --r-md:8px; --r-sm:5px;
	--s-1:.5rem; --s-2:.75rem; --s-3:1rem; --s-4:1.5rem; --s-5:2rem; }
@media (prefers-color-scheme: light) { :root {
	--back:#f1f2f4; --panel:#fff; --bar:#f7f8f9; --ink:#18181b; --muted:#71717a;
	--faint:#a1a1aa; --line:#e4e4e7; --accent:#c81e2b; --accent-soft:#fdedee;
	--code:#fbfbfc; --ok:#16a34a; --shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.07); } }
* { box-sizing:border-box; }
body { margin:0; padding:var(--s-5) var(--s-4) 5rem; background:var(--back);
	color:var(--ink); -webkit-font-smoothing:antialiased;
	font:14px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
.shell { max-width:60rem; margin:0 auto; }
/* No left inset: the dialog's top-left corner is squared to meet the tab, so
   any gap there would leave a bare square corner beside it. */
.tabrow { display:flex; align-items:flex-end; justify-content:space-between;
	gap:var(--s-3); padding:0; }
.tab { display:flex; align-items:center; gap:var(--s-1); padding:.35rem .55rem;
	background:var(--panel); border:1px solid var(--line); border-bottom:none;
	border-radius:var(--r-lg) var(--r-lg) 0 0; margin-bottom:-1px; z-index:1; }
.counter { min-width:2.4rem; text-align:center; color:var(--muted);
	font:12px/1 ui-monospace,SFMono-Regular,Menlo,monospace; font-variant-numeric:tabular-nums; }
.pill { display:flex; align-items:center; gap:.4rem; margin-bottom:.5rem;
	padding:.3rem .65rem; background:var(--panel); border:1px solid var(--line);
	border-radius:999px; color:var(--muted);
	font:11.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace; }
.pill .dot { width:.45rem; height:.45rem; border-radius:50%; background:var(--ok); }
.pill .rt { color:var(--faint); }
.dialog { background:var(--panel); border:1px solid var(--line);
	border-radius:0 var(--r-lg) var(--r-lg) var(--r-lg);
	padding:var(--s-3) var(--s-3) var(--s-4); box-shadow:var(--shadow); }
.pgin { position:absolute; width:0; height:0; opacity:0; pointer-events:none; }
.panel { display:none; }
.nav { display:none; align-items:center; gap:var(--s-1); }
.nav label, .arrow-off { width:1.5rem; height:1.5rem; display:flex;
	align-items:center; justify-content:center; padding-bottom:1px;
	border:1px solid transparent; border-radius:50%; color:var(--muted);
	font-size:1rem; line-height:1; cursor:pointer; transition:color .12s,background .12s; }
.nav label:hover { color:var(--ink); background:var(--bar); }
.arrow-off { color:var(--faint); cursor:default; }
.pgin:focus-visible + .shell .nav label { border-color:var(--accent); }
.tag { display:inline-block; padding:.2rem .5rem; border-radius:var(--r-sm);
	font:11.5px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;
	background:var(--accent-soft); color:var(--accent); }
h1 { margin:var(--s-2) 0 0; font-size:.98rem; font-weight:450; line-height:1.65;
	color:var(--accent); overflow-wrap:anywhere; max-width:64ch; }
.meta { margin:var(--s-1) 0 0; color:var(--muted); font-size:.82rem; }
.meta code { color:var(--ink);
	font:11.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace; }
.frame { margin-top:var(--s-4); border:1px solid var(--line);
	border-radius:var(--r-md); overflow:hidden; background:var(--code); }
.frame-head { padding:.5rem .75rem; border-bottom:1px solid var(--line);
	background:var(--bar); color:var(--muted); overflow-wrap:anywhere;
	font:11.5px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace; }
.frame-head .loc { color:var(--accent); }
.frame-head .at { color:var(--faint); }
.source { padding:.5rem 0; overflow-x:auto;
	font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;
	font-variant-ligatures:none; }
.line { display:flex; gap:.5rem; padding:0 .75rem; white-space:pre; }
.line.target { background:var(--accent-soft); }
.line.target .ln, .line.target .mark { color:var(--accent); }
.mark { color:var(--accent); width:.75rem; }
.ln { color:var(--faint); text-align:right; min-width:1.75rem; user-select:none;
	font-variant-numeric:tabular-nums; }
.bar { color:var(--line); user-select:none; }
.line code { font:inherit; }
.line.caret code { color:var(--accent); }
.stack { margin-top:var(--s-4); }
.stack-head { display:flex; align-items:center; gap:var(--s-1);
	margin-bottom:var(--s-2); }
.stack-head h2 { margin:0; font-size:.875rem; font-weight:600;
	letter-spacing:-.005em; }
.count { padding:.05rem .4rem; border-radius:999px; background:var(--bar);
	border:1px solid var(--line); color:var(--muted);
	font:10.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;
	font-variant-numeric:tabular-nums; }
.frames { list-style:none; margin:0; padding:0; }
.frames li { padding:.3rem 0; }
.frames .fn { font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
	font-weight:600; overflow-wrap:anywhere; }
.frames .path { color:var(--muted); overflow-wrap:anywhere;
	font:11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }
.frames.dep { margin-top:.25rem; }
.frames.dep .fn { font-weight:450; color:var(--muted); }
.frames.dep .path { color:var(--faint); }
.more { margin-top:var(--s-1); }
.more > summary { cursor:pointer; color:var(--muted); list-style:none;
	text-align:right; font-size:.8rem; transition:color .12s; }
.more > summary::-webkit-details-marker { display:none; }
.more > summary:hover { color:var(--ink); }
.more > summary:focus-visible { outline:none; color:var(--accent); }
.raw { margin-top:var(--s-4); padding-top:var(--s-3);
	border-top:1px solid var(--line); }
.raw > summary { cursor:pointer; color:var(--muted); font-size:.8rem; }
.raw > summary:hover { color:var(--ink); }
pre { margin:var(--s-2) 0 0; background:var(--code); border:1px solid var(--line);
	border-radius:var(--r-md); padding:.75rem; overflow-x:auto; color:var(--muted);
	font:11.5px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace; }
`;

/**
 * Pick the frame to show source for.
 *
 * The deepest cause first, because the framework wraps a render failure in a
 * `RenderError` whose own stack points at the re-throw site inside the
 * renderer. Showing that told the reader where the framework noticed the
 * problem rather than where their code broke. Within an error, application
 * frames beat dependency and node-internal ones for the same reason.
 */
export const selectPrimaryFrame = (
	chain: readonly ErrorLike[]
): StackFrame | undefined => {
	for (const error of [...chain].reverse()) {
		const app = parseStackFrames(error.stack).find((frame) => frame.app);
		if (app) return app;
	}
	for (const error of [...chain].reverse()) {
		const first = parseStackFrames(error.stack)[0];
		if (first) return first;
	}
	return undefined;
};

/**
 * Errors worth paging through.
 *
 * An `AggregateError` carries several independent failures, and each deserves
 * its own panel rather than being flattened into one. A plain error is a list
 * of one, which the counter still reports honestly.
 */
export const errorList = (error: unknown): ErrorLike[] => {
	const root = asErrorLike(error);
	if (!root) return [];
	const aggregate = (root as { errors?: unknown }).errors;
	if (Array.isArray(aggregate) && aggregate.length > 0) {
		const parts = aggregate.map(asErrorLike).filter(Boolean) as ErrorLike[];
		if (parts.length > 0) return parts;
	}
	return [root];
};

const renderPanel = (
	tag: string,
	message: string,
	url: string | undefined,
	error: ErrorLike,
	diagnostic: string,
	index: number,
	solo: boolean
): string => {
	const chain = causeChain(error);
	const root = chain[chain.length - 1] ?? {};
	// The root cause's stack is the actionable one; the wrapper's only records
	// where the renderer caught it.
	const frames = parseStackFrames(root.stack);
	const primary = selectPrimaryFrame(chain);
	// Each panel speaks for its own error. Using the outer message for the
	// first one hid what the first aggregated failure actually said.
	const heading = solo ? message : (error.message ?? message);
	const kind = solo ? tag : (error.name ?? tag);

	return `<section class="panel" data-panel="${index}">
	<span class="tag">${escapeHtml(kind)}</span>
	<h1>${escapeHtml(heading)}</h1>
	${url ? `<p class="meta">while rendering <code>${escapeHtml(url)}</code></p>` : ''}
	${primary ? renderSourceFrame(primary) : ''}
	${renderCauses(chain)}
	${renderFrames(frames)}
	<details class="raw">
		<summary>Raw diagnostic</summary>
		<pre>${diagnostic}</pre>
	</details>
</section>`;
};

/**
 * Selectors that drive the pager.
 *
 * The pager is radio inputs and labels rather than a script, because the error
 * response is asserted to carry no `<script>` — which also lets the page work
 * unchanged under a strict Content-Security-Policy, exactly when a server is
 * misbehaving and the page matters most.
 */
const pagerRules = (count: number): string => {
	const rules: string[] = [];
	for (let index = 0; index < count; index++) {
		rules.push(
			`#pg-${index}:checked ~ .shell .nav[data-for="${index}"] { display:flex; }`,
			`#pg-${index}:checked ~ .shell .panel[data-panel="${index}"] { display:block; }`
		);
	}
	return rules.join('\n');
};

const renderPager = (count: number): string => {
	const groups: string[] = [];
	for (let index = 0; index < count; index++) {
		const prev = (index - 1 + count) % count;
		const next = (index + 1) % count;
		const arrows =
			count > 1
				? `<label for="pg-${prev}" title="Previous error">&lsaquo;</label>
				<span class="counter">${index + 1}/${count}</span>
				<label for="pg-${next}" title="Next error">&rsaquo;</label>`
				: `<span class="arrow-off">&lsaquo;</span>
				<span class="counter">1/1</span>
				<span class="arrow-off">&rsaquo;</span>`;
		groups.push(`<span class="nav" data-for="${index}">${arrows}</span>`);
	}
	return groups.join('');
};

/** The development error page. Never reached in production. */
export const renderErrorPage = (
	tag: string,
	message: string,
	url: string | undefined,
	error: unknown,
	diagnostic: string
): string => {
	const errors = errorList(error);
	const count = Math.max(1, errors.length);
	const panels = errors
		.map((entry, index) =>
			renderPanel(tag, message, url, entry, diagnostic, index, count === 1)
		)
		.join('');
	const radios = Array.from(
		{ length: count },
		(_, index) =>
			`<input type="radio" name="effuse-pager" id="pg-${index}" class="pgin"${index === 0 ? ' checked' : ''}>`
	).join('');
	const version = coreVersion();

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(tag)}: ${escapeHtml(message)}</title>
<style>${STYLES}
${pagerRules(count)}</style>
</head>
<body>
${radios}
<div class="shell">
	<div class="tabrow">
		<div class="tab">${renderPager(count)}</div>
		<div class="pill"><span class="dot"></span>Effuse${version ? ` <span class="rt">${escapeHtml(version)}</span>` : ''}</div>
	</div>
	<div class="dialog">${panels}</div>
</div>
</body>
</html>`;
};

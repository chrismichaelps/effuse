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

export interface MetaTag {
	readonly name?: string;
	readonly property?: string;
	readonly content: string;
	readonly httpEquiv?: string;
}

export interface LinkTag {
	readonly rel: string;
	readonly href: string;
	readonly type?: string;
	readonly crossOrigin?: 'anonymous' | 'use-credentials';
	readonly [key: string]: string | undefined;
}

export interface ScriptTag {
	readonly src?: string;
	readonly content?: string;
	readonly type?: string;
	readonly async?: boolean;
	readonly defer?: boolean;
	readonly id?: string;
}

export interface OpenGraphProps {
	readonly title?: string;
	readonly description?: string;
	readonly type?: string;
	readonly url?: string;
	readonly image?: string;
	readonly siteName?: string;
	readonly locale?: string;
	readonly [key: string]: string | undefined;
}

export interface TwitterCardProps {
	readonly card?: 'summary' | 'summary_large_image' | 'app' | 'player';
	readonly site?: string;
	readonly creator?: string;
	readonly title?: string;
	readonly description?: string;
	readonly image?: string;
	readonly [key: string]: string | undefined;
}

export interface HeadProps {
	readonly title?: string;

	readonly description?: string;

	readonly canonical?: string;

	readonly viewport?: string;

	readonly charset?: string;

	readonly lang?: string;

	readonly themeColor?: string;

	readonly favicon?: string;

	readonly og?: OpenGraphProps;

	readonly twitter?: TwitterCardProps;

	readonly meta?: readonly MetaTag[];

	readonly link?: readonly LinkTag[];

	readonly script?: readonly ScriptTag[];

	readonly base?: string;

	readonly robots?: string;
}

export interface SSRContext {
	readonly url: string;

	readonly headStack: HeadProps[];

	readonly state: Record<string, unknown>;

	readonly isServer: true;
}

export interface RenderResult {
	readonly html: string;

	readonly head: HeadProps;

	readonly state: Record<string, unknown>;

	readonly timing?: number;
}

export interface AssetManifestChunk {
	readonly file: string;
	readonly src?: string;
	readonly isEntry?: boolean;
	readonly isDynamicEntry?: boolean;
	readonly imports?: readonly string[];
	readonly css?: readonly string[];
	readonly assets?: readonly string[];
}

export type AssetManifest = Record<string, AssetManifestChunk>;

export interface ServerAppOptions {
	readonly basePath?: string;

	readonly minify?: boolean;

	/**
	 * An HTML document to render into, instead of the generated shell.
	 *
	 * The template is preserved verbatim except for three injection points: the
	 * render outlet (an element with `containerId`, or an
	 * `<!--effuse-ssr-outlet-->` marker), the end of `<head>`, and the end of
	 * `<body>`. Anything else the template declares — most importantly its
	 * client entry `<script type="module">` — is emitted as-is, so the served
	 * page can hydrate.
	 */
	readonly template?: string;

	/** Id of the element the app renders into and hydrates from. Defaults to `app`. */
	readonly containerId?: string;

	readonly hydrate?: boolean;

	/**
	 * URL of the client entry module, emitted as an executing
	 * `<script type="module">`. Use this when there is no build manifest
	 * (dev servers, hand-rolled builds). Ignored when the same URL is already
	 * emitted by `manifest` or present in `template`.
	 */
	readonly clientEntry?: string;

	/**
	 * A parsed Vite manifest.json from the client build.
	 * When provided, the renderer emits the entry chunk's executing
	 * `<script type="module">` plus `<link rel="modulepreload">` and
	 * `<link rel="stylesheet">` tags for its assets, preventing FOUC.
	 */
	readonly manifest?: AssetManifest;
}

export interface RequestContext {
	readonly request: Request;

	readonly url: URL;

	readonly params: Record<string, string>;

	readonly query: Record<string, string>;
}

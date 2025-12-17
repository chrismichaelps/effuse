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

	readonly titleTemplate?: string | ((title?: string) => string);

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

	readonly htmlAttrs?: Record<string, string | boolean>;

	readonly bodyAttrs?: Record<string, string | boolean>;

	readonly noscript?: readonly { innerHTML: string; id?: string }[];

	readonly style?: readonly { innerHTML: string; id?: string; type?: string }[];
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

export interface ServerAppOptions {
	readonly basePath?: string;

	readonly minify?: boolean;

	readonly template?: string;

	readonly hydrate?: boolean;
}

export interface RequestContext {
	readonly request: Request;

	readonly url: URL;

	readonly params: Record<string, string>;

	readonly query: Record<string, string>;
}

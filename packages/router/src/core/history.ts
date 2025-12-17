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

export interface RouterHistory {
	readonly push: (path: string) => void;
	readonly replace: (path: string) => void;
	readonly go: (delta: number) => void;
	readonly back: () => void;
	readonly forward: () => void;
	readonly listen: (callback: () => void) => () => void;
	readonly getCurrentPath: () => string;
}

export const createWebHistory = (base: string = ''): RouterHistory => {
	const normalizeBase = base.replace(/\/$/, '');

	return {
		push: (path: string) => {
			window.history.pushState({}, '', normalizeBase + path);
			window.dispatchEvent(new PopStateEvent('popstate'));
		},
		replace: (path: string) => {
			window.history.replaceState({}, '', normalizeBase + path);
			window.dispatchEvent(new PopStateEvent('popstate'));
		},
		go: (delta: number) => {
			window.history.go(delta);
		},
		back: () => {
			window.history.back();
		},
		forward: () => {
			window.history.forward();
		},
		listen: (callback: () => void) => {
			window.addEventListener('popstate', callback);
			return () => {
				window.removeEventListener('popstate', callback);
			};
		},
		getCurrentPath: () => {
			const path =
				window.location.pathname +
				window.location.search +
				window.location.hash;
			return normalizeBase ? path.replace(normalizeBase, '') || '/' : path;
		},
	};
};

export const createHashHistory = (): RouterHistory => {
	return {
		push: (path: string) => {
			window.location.hash = path;
		},
		replace: (path: string) => {
			const url = new URL(window.location.href);
			url.hash = path;
			window.history.replaceState({}, '', url.toString());
			window.dispatchEvent(new HashChangeEvent('hashchange'));
		},
		go: (delta: number) => {
			window.history.go(delta);
		},
		back: () => {
			window.history.back();
		},
		forward: () => {
			window.history.forward();
		},
		listen: (callback: () => void) => {
			window.addEventListener('hashchange', callback);
			return () => {
				window.removeEventListener('hashchange', callback);
			};
		},
		getCurrentPath: () => {
			const hash = window.location.hash.slice(1) || '/';
			return hash;
		},
	};
};

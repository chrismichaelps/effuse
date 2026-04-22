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

import type { Plugin } from 'vite';

const EFFUSE_HMR_ACCEPT_SNIPPET = `
if (import.meta.hot) {
	import.meta.hot.accept((newModule) => {
		if (!newModule) return;
		const runtime = typeof globalThis !== 'undefined' && (globalThis).__EFFUSE_HMR_RUNTIME__;
		if (!runtime) {
			console.warn('[effuse-hmr] HMR runtime not found. Skipping hot update.');
			return;
		}
		const hmrId = import.meta.url;
		runtime.accept(hmrId, newModule);
	});
}
`;

/**
 * Vite plugin that enables component-level Hot Module Replacement for
 * Effuse applications without full page reloads.
 *
 * How it works:
 * 1. Injects `__hmrId: import.meta.url` into every `define({...})` call
 *    so the DOM renderer can register mounted instances.
 * 2. Appends `import.meta.hot.accept()` to every source file so Vite
 *    sends HMR updates to the browser when the file changes.
 * 3. The accept handler calls `__EFFUSE_HMR_RUNTIME__.accept()` which
 *    finds all mounted instances of components from this module,
 *    runs their cleanup, and re-renders them with the new blueprint.
 */
export function effuseHMRPlugin(): Plugin {
	return {
		name: 'effuse-hmr',
		apply: 'serve',
		transform(code, id) {
			// Only process TypeScript/TSX files in the project source
			if (!/\.(ts|tsx|mts|cts)$/i.test(id)) {
				return null;
			}
			// Skip node_modules, .effuse generated files, and virtual modules
			if (
				id.includes('node_modules') ||
				id.includes('.effuse') ||
				id.startsWith('\0') ||
				id.includes('?')
			) {
				return null;
			}

			let transformed = code;

			// Inject __hmrId into define({ ... }) calls.
			// This regex handles:
			//   define({ ... })
			//   define({ name: 'Foo', ... })
			//   define/* comment */({ ... })
			// It intentionally avoids matching define*somethingElse(
			// and is conservative to avoid false positives.
			const defineRegex = /\bdefine\s*\(\s*\{/g;
			if (defineRegex.test(transformed)) {
				transformed = transformed.replace(
					defineRegex,
					"define({ __hmrId: import.meta.url, "
				);
			}

			// Append HMR accept code if not already present
			if (!transformed.includes('import.meta.hot')) {
				transformed += '\n' + EFFUSE_HMR_ACCEPT_SNIPPET;
			}

			// Return transformed code with source map disabled
			return {
				code: transformed,
				map: null,
			};
		},
	};
}

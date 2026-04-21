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

import type { HeadProps } from './types.js';
import { HYDRATION_SCRIPT_ID } from '../constants.js';

export { HYDRATION_SCRIPT_ID };

export interface HydrationData {
	head: HeadProps;
	state: Record<string, unknown>;
	url: string;
	timestamp: number;
}

/**
 * Serialize hydration data into a script tag for embedding in SSR output.
 *
 * This is now called by `renderToString` with real layer state,
 * ensuring the client receives the full hydration payload.
 */
export const serializeHydrationData = (data: HydrationData): string => {
	const json = JSON.stringify(data);
	const escaped = json.replace(/<\/script/gi, '<\\/script');
	return `<script id="${HYDRATION_SCRIPT_ID}" type="application/json">${escaped}</script>`;
};

/**
 * Retrieve hydration data from the DOM on the client side.
 * Returns null if the hydration script is not found or parsing fails.
 */
export const getHydrationData = (): HydrationData | null => {
	if (typeof document === 'undefined') {
		return null;
	}

	const script = document.getElementById(HYDRATION_SCRIPT_ID);
	if (!script) {
		return null;
	}

	try {
		const content = script.textContent;
		if (!content) return null;
		return JSON.parse(content) as HydrationData;
	} catch {
		return null;
	}
};

/**
 * Check if client state matches the server-rendered state.
 * Used during hydration to detect mismatches.
 */
export const checkHydrationMatch = (
	clientState: Record<string, unknown>,
	serverState: Record<string, unknown>
): boolean => {
	return JSON.stringify(clientState) === JSON.stringify(serverState);
};

/**
 * Apply the server-rendered head data to the client DOM.
 * This reconciles the document title and other head elements
 * that may have changed during client-side navigation.
 */
export const applyHydratedHead = (head: HeadProps): void => {
	if (typeof document === 'undefined') return;

	if (head.title && document.title !== head.title) {
		document.title = head.title;
	}
};

/**
 * Remove the hydration script from the DOM after rehydration.
 * Called after the client app has fully mounted and reconciled state.
 */
export const cleanupHydrationScript = (): void => {
	if (typeof document === 'undefined') return;

	const script = document.getElementById(HYDRATION_SCRIPT_ID);
	if (script) {
		script.remove();
	}
};

/**
 * Initialize client-side hydration.
 *
 * Reads the server-serialized hydration data, applies the head,
 * and returns the data for the client app to reconcile state.
 */
export const initHydration = (): HydrationData | null => {
	const data = getHydrationData();

	if (data) {
		applyHydratedHead(data.head);
	}

	return data;
};

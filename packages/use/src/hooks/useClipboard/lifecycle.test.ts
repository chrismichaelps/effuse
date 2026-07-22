// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createApp,
	define,
	CreateElementNode,
	EFFUSE_NODE,
} from '@effuse/core';
import { useClipboard, type UseClipboardReturn } from './index.js';

describe('useClipboard lifecycle ownership', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		document.body.innerHTML = '';
	});

	it('ignores late writes and clears copied timers after unmount', async () => {
		let resolveWrite: (() => void) | undefined;
		const writeText = vi.fn(
			() => new Promise<void>((resolve) => (resolveWrite = resolve))
		);
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText },
		});
		let clipboard: UseClipboardReturn | undefined;
		const App = define({
			script: () => {
				clipboard = useClipboard({ queryPermissions: false });
				return {};
			},
			template: () =>
				CreateElementNode({
					[EFFUSE_NODE]: true,
					tag: 'main',
					props: {},
					children: ['Clipboard owner'],
				}),
		});
		const mounted = await createApp(App).mount('#app');
		const pendingCopy = clipboard?.copy('late');

		await mounted.unmount();
		resolveWrite?.();
		await pendingCopy;

		expect(clipboard?.text.value).toBeNull();
		expect(clipboard?.copied.value).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});
});

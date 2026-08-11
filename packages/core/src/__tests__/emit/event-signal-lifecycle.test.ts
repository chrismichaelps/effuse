// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { useEmits } from '../../emit/hooks/useEmits.js';
import { useEventSignal } from '../../emit/hooks/useEventSignal.js';
import type { EventSignal } from '../../emit/types/index.js';

interface Events {
	readonly change: number;
}

describe('useEventSignal lifecycle ownership', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	it('cancels a pending debounce when its component unmounts', async () => {
		let emit: ((event: 'change', payload: number) => void) | undefined;
		let observed: EventSignal<number> | undefined;
		const App = define({
			script: () => {
				const events = useEmits<Events>();
				emit = events.emit;
				observed = useEventSignal<Events, number>(events.context, 'change', {
					debounce: 25,
				});
				return {};
			},
			template: () => 'Ready',
		});
		const app = await createApp(App).mount('#app');

		emit?.('change', 1);
		await app.unmount();
		vi.advanceTimersByTime(25);

		expect(observed?.value).toBeUndefined();
	});

	it('rejects source updates after component teardown', async () => {
		let emit: ((event: 'change', payload: number) => void) | undefined;
		let observed: EventSignal<number> | undefined;
		const App = define({
			script: () => {
				const events = useEmits<Events>();
				emit = events.emit;
				observed = useEventSignal<Events, number>(events.context, 'change', {
					filter: () => true,
				});
				return {};
			},
			template: () => 'Ready',
		});
		const app = await createApp(App).mount('#app');

		emit?.('change', 1);
		expect(observed?.value).toBe(1);
		await app.unmount();
		emit?.('change', 2);

		expect(observed?.value).toBe(1);
	});

	it('keeps standalone modifier signals active', () => {
		const events = useEmits<Events>();
		const observed = useEventSignal<Events, number>(
			events.context,
			'change',
			{ filter: (value) => Number(value) > 0 }
		);

		events.emit('change', -1);
		expect(observed.value).toBeUndefined();
		events.emit('change', 2);
		expect(observed.value).toBe(2);
	});

	it('replaces prior debounce work while mounted', () => {
		const events = useEmits<Events>();
		const observed = useEventSignal<Events, number>(
			events.context,
			'change',
			{ debounce: 25 }
		);

		events.emit('change', 1);
		vi.advanceTimersByTime(10);
		events.emit('change', 2);
		vi.advanceTimersByTime(24);
		expect(observed.value).toBeUndefined();
		vi.advanceTimersByTime(1);
		expect(observed.value).toBe(2);
	});

	it('preserves throttle, filter, and once composition', () => {
		vi.setSystemTime(1_000);
		const events = useEmits<Events>();
		const observed = useEventSignal<Events, number>(
			events.context,
			'change',
			{
				throttle: 20,
				filter: (value) => Number(value) > 0,
				once: true,
			}
		);

		events.emit('change', -1);
		events.emit('change', 1);
		vi.advanceTimersByTime(25);
		events.emit('change', 2);

		expect(observed.value).toBe(1);
	});
});

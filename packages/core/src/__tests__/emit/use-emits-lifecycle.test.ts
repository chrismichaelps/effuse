// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { useEmits } from '../../emit/hooks/useEmits.js';
import type { EmitContextData } from '../../emit/types/index.js';

interface Events {
	readonly change: number;
}

type Emitter = ReturnType<typeof useEmits<Events>>;

const mountEmitter = async (
	initialHandlers?: Partial<{ change: (payload: number) => void }>
): Promise<{ emitter: Emitter; unmount: () => Promise<void> }> => {
	let captured: Emitter | undefined;
	const App = define({
		script: () => {
			captured = useEmits<Events>(initialHandlers);
			return {};
		},
		template: () => 'Ready',
	});
	const app = await createApp(App).mount('#app');
	if (!captured) throw new Error('emitter was not created');
	return { emitter: captured, unmount: () => app.unmount() };
};

describe('useEmits lifecycle ownership', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
	});

	afterEach(() => {
		document.body.replaceChildren();
	});

	it('stops invoking handlers once the component unmounts', async () => {
		const handler = vi.fn();
		const { emitter, unmount } = await mountEmitter();
		emitter.on('change', handler);

		emitter.emit('change', 1);
		expect(handler).toHaveBeenCalledTimes(1);

		await unmount();
		emitter.emit('change', 2);

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('settles a queued emitAsync without invoking handlers', async () => {
		const handler = vi.fn();
		const { emitter, unmount } = await mountEmitter();
		emitter.on('change', handler);

		const pending = emitter.emitAsync('change', 1);
		await unmount();

		await expect(pending).resolves.toBeUndefined();
		expect(handler).not.toHaveBeenCalled();
	});

	it('settles an emitAsync issued after teardown', async () => {
		const handler = vi.fn();
		const { emitter, unmount } = await mountEmitter();
		emitter.on('change', handler);
		await unmount();

		await expect(emitter.emitAsync('change', 1)).resolves.toBeUndefined();
		expect(handler).not.toHaveBeenCalled();
	});

	it('releases handlers and event signals on teardown', async () => {
		const { emitter, unmount } = await mountEmitter({ change: vi.fn() });
		emitter.on('change', vi.fn());
		emitter.emit('change', 1);

		const context = emitter.context as EmitContextData<Events>;
		expect(context.handlers.size).toBeGreaterThan(0);
		expect(context.signals.size).toBeGreaterThan(0);

		await unmount();

		expect(context.handlers.size).toBe(0);
		expect(context.signals.size).toBe(0);
	});

	it('keeps unsubscribe and off idempotent after disposal', async () => {
		const handler = vi.fn();
		const { emitter, unmount } = await mountEmitter();
		const unsubscribe = emitter.on('change', handler);

		await unmount();

		expect(() => {
			unsubscribe();
			unsubscribe();
			emitter.off('change', handler);
		}).not.toThrow();
	});

	it('does not register new handlers after teardown', async () => {
		const handler = vi.fn();
		const { emitter, unmount } = await mountEmitter();
		await unmount();

		const unsubscribe = emitter.on('change', handler);
		emitter.emit('change', 1);

		expect(handler).not.toHaveBeenCalled();
		expect(() => unsubscribe()).not.toThrow();
	});

	it('leaves a standalone emitter fully operational', async () => {
		const handler = vi.fn();
		const standalone = useEmits<Events>();
		standalone.on('change', handler);

		const { unmount } = await mountEmitter();
		await unmount();

		standalone.emit('change', 1);
		await standalone.emitAsync('change', 2);

		expect(handler).toHaveBeenCalledTimes(2);
	});

	it('keeps a mounted emitter working before teardown', async () => {
		const handler = vi.fn();
		const { emitter, unmount } = await mountEmitter();
		emitter.on('change', handler);

		emitter.emit('change', 1);
		await emitter.emitAsync('change', 2);

		expect(handler).toHaveBeenCalledTimes(2);
		expect(handler).toHaveBeenNthCalledWith(1, 1);
		expect(handler).toHaveBeenNthCalledWith(2, 2);

		await unmount();
	});

	it('isolates disposal between two mounted emitters', async () => {
		const first = vi.fn();
		const second = vi.fn();
		const a = await mountEmitter();
		a.emitter.on('change', first);

		document.body.innerHTML = '<div id="app"></div>';
		const b = await mountEmitter();
		b.emitter.on('change', second);

		await a.unmount();

		a.emitter.emit('change', 1);
		b.emitter.emit('change', 2);

		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);

		await b.unmount();
	});
});

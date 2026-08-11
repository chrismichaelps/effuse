import { describe, it, expect, vi } from 'vitest';
import { useResizeObserver } from '../../hooks/useResizeObserver.js';

describe('useResizeObserver', () => {
	it('should return initial zero size when ResizeObserver is unavailable', () => {
		vi.stubGlobal('ResizeObserver', undefined);
		const div = {} as Element;
		const size = useResizeObserver(() => div);
		expect(size.value).toEqual({ width: 0, height: 0 });
	});

	it('should observe element and update size', () => {
		const observe = vi.fn();
		const disconnect = vi.fn();

		class MockResizeObserver {
			constructor(private callback: ResizeObserverCallback) {}
			observe = observe;
			disconnect = disconnect;
			trigger = (entries: ResizeObserverEntry[]) => this.callback(entries, this as any);
		}

		vi.stubGlobal('ResizeObserver', MockResizeObserver);

		const div = {} as Element;
		const size = useResizeObserver(() => div);

		expect(observe).toHaveBeenCalledWith(div);
		expect(size.value).toEqual({ width: 0, height: 0 });

		// Simulate resize
		const entry = {
			contentRect: { width: 200, height: 100 },
		} as ResizeObserverEntry;

		const observerInstance = observe.mock.instances[0] as unknown as InstanceType<typeof MockResizeObserver>;
		observerInstance.trigger([entry]);

		expect(size.value).toEqual({ width: 200, height: 100 });
		size.stop();
		size.stop();
		expect(disconnect).toHaveBeenCalledOnce();

		observerInstance.trigger([
			{
				contentRect: { width: 999, height: 999 },
			} as ResizeObserverEntry,
		]);
		expect(size.value).toEqual({ width: 200, height: 100 });
	});

	it('disconnects when target resolution fails during setup', () => {
		const disconnect = vi.fn();
		class MockResizeObserver {
			constructor(_callback: ResizeObserverCallback) {}
			observe = vi.fn();
			disconnect = disconnect;
		}
		vi.stubGlobal('ResizeObserver', MockResizeObserver);

		expect(() =>
			useResizeObserver(() => {
				throw new Error('missing target');
			})
		).toThrow('missing target');
		expect(disconnect).toHaveBeenCalledOnce();
	});
});

import { describe, it, expect, vi } from 'vitest';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver.js';

describe('useIntersectionObserver', () => {
	it('should return initial not-intersecting state when IntersectionObserver is unavailable', () => {
		vi.stubGlobal('IntersectionObserver', undefined);
		const div = {} as Element;
		const result = useIntersectionObserver(() => div);
		expect(result.value.isIntersecting).toBe(false);
		expect(result.value.intersectionRatio).toBe(0);
		expect(result.value.entry).toBeNull();
	});

	it('should observe element and update state on intersection', () => {
		const observe = vi.fn();
		const disconnect = vi.fn();

		class MockIntersectionObserver {
			constructor(
				private callback: IntersectionObserverCallback,
				private options?: IntersectionObserverInit
			) {}
			observe = observe;
			disconnect = disconnect;
			trigger = (entries: IntersectionObserverEntry[]) =>
				this.callback(entries, this as any);
		}

		vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

		const div = {} as Element;
		const result = useIntersectionObserver(() => div, { threshold: 0.5 });

		expect(observe).toHaveBeenCalledWith(div);
		expect(result.value.isIntersecting).toBe(false);

		// Simulate intersection
		const entry = {
			isIntersecting: true,
			intersectionRatio: 0.75,
		} as IntersectionObserverEntry;

		const observerInstance = observe.mock.instances[0] as unknown as InstanceType<typeof MockIntersectionObserver>;
		observerInstance.trigger([entry]);

		expect(result.value.isIntersecting).toBe(true);
		expect(result.value.intersectionRatio).toBe(0.75);
		expect(result.value.entry).toBe(entry);
		result.stop();
		result.stop();
		expect(disconnect).toHaveBeenCalledOnce();
	});
});

import { describe, it, expect, vi } from 'vitest';
import { getEmitService } from '../../emit/services/service.js';

describe('EmitService handler isolation', () => {
	it('should call all handlers even if one throws', () => {
		const service = getEmitService();
		const ctx = service.createContext<Record<string, unknown>>();

		const goodHandler = vi.fn();
		const badHandler = vi.fn(() => {
			throw new Error('bad handler');
		});
		const anotherGoodHandler = vi.fn();

		service.registerHandler(ctx, 'test-event', goodHandler);
		service.registerHandler(ctx, 'test-event', badHandler);
		service.registerHandler(ctx, 'test-event', anotherGoodHandler);

		// Should not throw
		expect(() => service.emit(ctx, 'test-event', { foo: 'bar' })).not.toThrow();

		expect(goodHandler).toHaveBeenCalledOnce();
		expect(badHandler).toHaveBeenCalledOnce();
		expect(anotherGoodHandler).toHaveBeenCalledOnce();
	});

	it('should still update signal even if a handler throws', () => {
		const service = getEmitService();
		const ctx = service.createContext<Record<string, unknown>>();

		const badHandler = vi.fn(() => {
			throw new Error('bad');
		});

		service.registerHandler(ctx, 'test-event', badHandler);
		const sig = service.getSignal(ctx, 'test-event');

		expect(() => service.emit(ctx, 'test-event', 42)).not.toThrow();
		expect(sig.value).toBe(42);
	});
});

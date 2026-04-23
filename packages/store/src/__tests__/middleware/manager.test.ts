import { describe, it, expect } from 'vitest';
import { createMiddlewareManager } from '../../middleware/manager.js';

describe('middleware / manager', () => {
	it('should add and execute middleware', () => {
		const manager = createMiddlewareManager<Record<string, unknown>>();
		const log: string[] = [];
		manager.add((state, action) => {
			log.push(action);
			return state;
		});
		manager.execute({ count: 0 }, 'test', []);
		expect(log).toContain('test');
	});

	it('should allow middleware to transform state', () => {
		const manager = createMiddlewareManager<{ count: number }>();
		manager.add((state) => ({ ...state, count: state.count + 1 }));
		const result = manager.execute({ count: 0 }, 'inc', []);
		expect(result.count).toBe(1);
	});

	it('should remove middleware', () => {
		const manager = createMiddlewareManager<Record<string, unknown>>();
		const mw = () => undefined;
		manager.add(mw);
		manager.remove(mw);
		expect(manager.getAll()).toHaveLength(0);
	});

	it('should return unsubscribe function from add', () => {
		const manager = createMiddlewareManager<Record<string, unknown>>();
		const mw = () => undefined;
		const unsub = manager.add(mw);
		expect(manager.getAll()).toHaveLength(1);
		unsub();
		expect(manager.getAll()).toHaveLength(0);
	});

	it('should execute multiple middleware in order', () => {
		const manager = createMiddlewareManager<{ log: string }>();
		manager.add((state) => ({ ...state, log: state.log + 'a' }));
		manager.add((state) => ({ ...state, log: state.log + 'b' }));
		const result = manager.execute({ log: '' }, 'test', []);
		expect(result.log).toBe('ab');
	});

	it('should handle middleware that returns undefined', () => {
		const manager = createMiddlewareManager<{ count: number }>();
		manager.add(() => undefined);
		const result = manager.execute({ count: 5 }, 'noop', []);
		expect(result.count).toBe(5);
	});
});

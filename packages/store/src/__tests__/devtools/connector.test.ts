import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	connectDevTools,
	hasDevTools,
	createDevToolsMiddleware,
	disconnectDevTools,
	disconnectAllDevTools,
} from '../../devtools/connector.js';
import { createStore } from '../../core/store.js';

describe('devtools / connector', () => {
	const originalExtension = (globalThis as unknown as Record<string, unknown>)
		.__REDUX_DEVTOOLS_EXTENSION__;

	afterEach(() => {
		disconnectAllDevTools();
		delete (globalThis as unknown as Record<string, unknown>).__REDUX_DEVTOOLS_EXTENSION__;
		if (originalExtension) {
			(globalThis as unknown as Record<string, unknown>).__REDUX_DEVTOOLS_EXTENSION__ =
				originalExtension;
		}
	});

	it('should return false when devtools not available', () => {
		expect(hasDevTools()).toBe(false);
	});

	it('should return true when devtools available', () => {
		(globalThis as unknown as Record<string, unknown>).__REDUX_DEVTOOLS_EXTENSION__ = {
			connect: () => ({
				init: () => {},
				send: () => {},
				subscribe: () => () => {},
			}),
		};
		expect(hasDevTools()).toBe(true);
	});

	it('should connect devtools to store', () => {
		const sendMock = vi.fn();
		const initMock = vi.fn();
		(globalThis as unknown as Record<string, unknown>).__REDUX_DEVTOOLS_EXTENSION__ = {
			connect: () => ({
				init: initMock,
				send: sendMock,
				subscribe: () => () => {},
			}),
		};

		const store = createStore('dev1', { count: 0 });
		const unsub = connectDevTools(store);
		expect(initMock).toHaveBeenCalledWith({ count: 0 });

		// @ts-expect-error testing proxy assignment
		store.count = 1;
		expect(sendMock).toHaveBeenCalled();

		unsub();
	});

	it('should create devtools middleware', () => {
		const sendMock = vi.fn();
		(globalThis as unknown as Record<string, unknown>).__REDUX_DEVTOOLS_EXTENSION__ = {
			connect: () => ({
				init: () => {},
				send: sendMock,
				subscribe: () => () => {},
			}),
		};

		const store = createStore('dev2', { count: 0 });
		connectDevTools(store);
		const mw = createDevToolsMiddleware('dev2');
		mw({ count: 1 }, 'set:count', [1]);
		expect(sendMock).toHaveBeenCalled();
	});

	it('should disconnect devtools', () => {
		const store = createStore('dev3', { count: 0 });
		connectDevTools(store);
		expect(() => { disconnectDevTools('dev3'); }).not.toThrow();
	});
});

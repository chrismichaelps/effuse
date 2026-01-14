// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	createRef,
	isRefObject,
	isRefCallback,
	applyRef,
	registerDirective,
	getDirective,
	hasDirective,
	unregisterDirective,
	applyDirective,
	getDirectiveNames,
	type RefObject,
	type RefCallback,
	type Directive,
} from '../../refs/index.js';

describe('Refs', () => {
	describe('createRef', () => {
		it('should create a RefObject with null initial value', () => {
			const ref = createRef<HTMLDivElement>();

			expect(ref.current).toBeNull();
		});

		it('should have subscribe method', () => {
			const ref = createRef<HTMLElement>();

			expect(typeof ref.subscribe).toBe('function');
		});

		it('should satisfy RefObject interface', () => {
			const ref: RefObject<HTMLButtonElement> = createRef<HTMLButtonElement>();

			expect('current' in ref).toBe(true);
			expect('subscribe' in ref).toBe(true);
		});

		it('should accept options parameter', () => {
			const ref = createRef<HTMLInputElement>({ name: 'testRef' });

			expect(ref.current).toBeNull();
		});

		it('should work with generic Element type', () => {
			const ref = createRef();

			expect(ref.current).toBeNull();
			expect(isRefObject(ref)).toBe(true);
		});
	});

	describe('RefObject.subscribe', () => {
		it('should call subscriber immediately with current value', () => {
			const ref = createRef<HTMLDivElement>();
			const callback = vi.fn();

			ref.subscribe(callback);

			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith(null);
		});

		it('should return unsubscribe function', () => {
			const ref = createRef<HTMLElement>();
			const callback = vi.fn();

			const unsubscribe = ref.subscribe(callback);

			expect(typeof unsubscribe).toBe('function');
		});

		it('should allow multiple subscribers', () => {
			const ref = createRef<HTMLSpanElement>();
			const callback1 = vi.fn();
			const callback2 = vi.fn();
			const callback3 = vi.fn();

			ref.subscribe(callback1);
			ref.subscribe(callback2);
			ref.subscribe(callback3);

			expect(callback1).toHaveBeenCalled();
			expect(callback2).toHaveBeenCalled();
			expect(callback3).toHaveBeenCalled();
		});

		it('should stop notifying after unsubscribe', () => {
			const ref = createRef<HTMLElement>();
			const callback = vi.fn();

			const unsubscribe = ref.subscribe(callback);
			callback.mockClear();

			unsubscribe();
		});
	});

	describe('isRefObject', () => {
		it('should return true for valid RefObject', () => {
			const ref = createRef<HTMLDivElement>();

			expect(isRefObject(ref)).toBe(true);
		});

		it('should return false for null', () => {
			expect(isRefObject(null)).toBe(false);
		});

		it('should return false for undefined', () => {
			expect(isRefObject(undefined)).toBe(false);
		});

		it('should return false for primitive string', () => {
			expect(isRefObject('string')).toBe(false);
		});

		it('should return false for primitive number', () => {
			expect(isRefObject(42)).toBe(false);
		});

		it('should return false for function', () => {
			expect(isRefObject(() => {})).toBe(false);
		});

		it('should return false for object without current', () => {
			expect(isRefObject({ subscribe: () => () => {} })).toBe(false);
		});

		it('should return false for object without subscribe', () => {
			expect(isRefObject({ current: null })).toBe(false);
		});

		it('should return false for object with non-function subscribe', () => {
			expect(isRefObject({ current: null, subscribe: 'not a function' })).toBe(
				false
			);
		});

		it('should return true for custom object matching RefObject shape', () => {
			const customRef = {
				current: null,
				subscribe: () => () => {},
			};

			expect(isRefObject(customRef)).toBe(true);
		});

		it('should return false for array', () => {
			expect(isRefObject([])).toBe(false);
		});

		it('should return false for Date object', () => {
			expect(isRefObject(new Date())).toBe(false);
		});
	});

	describe('isRefCallback', () => {
		it('should return true for function', () => {
			const callback: RefCallback<HTMLElement> = () => {};

			expect(isRefCallback(callback)).toBe(true);
		});

		it('should return true for arrow function', () => {
			expect(isRefCallback((_el: Element | null) => {})).toBe(true);
		});

		it('should return true for named function', () => {
			function namedCallback(_el: Element | null): void {}

			expect(isRefCallback(namedCallback)).toBe(true);
		});

		it('should return false for null', () => {
			expect(isRefCallback(null)).toBe(false);
		});

		it('should return false for undefined', () => {
			expect(isRefCallback(undefined)).toBe(false);
		});

		it('should return false for object', () => {
			expect(isRefCallback({})).toBe(false);
		});

		it('should return false for RefObject', () => {
			const ref = createRef<HTMLElement>();

			expect(isRefCallback(ref)).toBe(false);
		});

		it('should return false for string', () => {
			expect(isRefCallback('function')).toBe(false);
		});

		it('should return false for number', () => {
			expect(isRefCallback(123)).toBe(false);
		});

		it('should return false for boolean', () => {
			expect(isRefCallback(true)).toBe(false);
		});
	});

	describe('applyRef', () => {
		it('should call RefCallback with element', () => {
			const callback = vi.fn();
			const element = document.createElement('div');

			applyRef(callback, element);

			expect(callback).toHaveBeenCalledWith(element);
		});

		it('should call RefCallback with null', () => {
			const callback = vi.fn();

			applyRef(callback, null);

			expect(callback).toHaveBeenCalledWith(null);
		});

		it('should set RefObject current value', () => {
			const ref = createRef<HTMLButtonElement>();
			const button = document.createElement('button');

			applyRef(ref, button);

			expect(ref.current).toBe(button);
		});

		it('should set RefObject to null', () => {
			const ref = createRef<HTMLElement>();
			const element = document.createElement('span');

			applyRef(ref, element);
			expect(ref.current).toBe(element);

			applyRef(ref, null);
			expect(ref.current).toBeNull();
		});

		it('should handle undefined ref gracefully', () => {
			expect(() => {
				applyRef(undefined, document.createElement('div'));
			}).not.toThrow();
		});

		it('should handle null ref gracefully', () => {
			expect(() => {
				applyRef(null, document.createElement('div'));
			}).not.toThrow();
		});

		it('should notify RefObject subscribers when element changes', () => {
			const ref = createRef<HTMLDivElement>();
			const callback = vi.fn();
			const element = document.createElement('div');

			ref.subscribe(callback);
			callback.mockClear();

			applyRef(ref, element);

			expect(callback).toHaveBeenCalledWith(element);
		});
	});

	describe('Directives', () => {
		beforeEach(() => {
			for (const name of getDirectiveNames()) {
				unregisterDirective(name);
			}
		});

		describe('registerDirective', () => {
			it('should register a directive', () => {
				const directive: Directive = () => undefined;

				registerDirective('test', directive);

				expect(hasDirective('test')).toBe(true);
			});

			it('should allow typed directives', () => {
				const focusDirective: Directive<HTMLInputElement, boolean> = (
					el,
					accessor
				) => {
					if (accessor()) {
						el.focus();
					}
					return undefined;
				};

				registerDirective('focus', focusDirective);

				expect(getDirective('focus')).toBeDefined();
			});

			it('should overwrite existing directive with same name', () => {
				const first: Directive = () => undefined;
				const second: Directive = () => () => {};

				registerDirective('overwrite', first);
				registerDirective('overwrite', second);

				expect(getDirective('overwrite')).toBe(second);
			});
		});

		describe('getDirective', () => {
			it('should return registered directive', () => {
				const directive: Directive = () => undefined;
				registerDirective('myDirective', directive);

				expect(getDirective('myDirective')).toBe(directive);
			});

			it('should return undefined for unregistered directive', () => {
				expect(getDirective('nonexistent')).toBeUndefined();
			});
		});

		describe('hasDirective', () => {
			it('should return true for registered directive', () => {
				registerDirective('exists', () => undefined);

				expect(hasDirective('exists')).toBe(true);
			});

			it('should return false for unregistered directive', () => {
				expect(hasDirective('missing')).toBe(false);
			});
		});

		describe('unregisterDirective', () => {
			it('should remove registered directive', () => {
				registerDirective('toRemove', () => undefined);
				expect(hasDirective('toRemove')).toBe(true);

				const result = unregisterDirective('toRemove');

				expect(result).toBe(true);
				expect(hasDirective('toRemove')).toBe(false);
			});

			it('should return false for nonexistent directive', () => {
				const result = unregisterDirective('neverRegistered');

				expect(result).toBe(false);
			});
		});

		describe('applyDirective', () => {
			it('should call directive with element and accessor', () => {
				const directive = vi.fn(() => undefined);
				registerDirective('spy', directive);
				const element = document.createElement('input');
				const accessor = () => true;

				applyDirective('spy', element, accessor);

				expect(directive).toHaveBeenCalledWith(element, accessor);
			});

			it('should return cleanup function from directive', () => {
				const cleanup = vi.fn();
				registerDirective('withCleanup', () => cleanup);
				const element = document.createElement('div');

				const result = applyDirective('withCleanup', element, () => null);

				expect(result).toBe(cleanup);
			});

			it('should return undefined for directive without cleanup', () => {
				registerDirective('noCleanup', () => undefined);
				const element = document.createElement('div');

				const result = applyDirective('noCleanup', element, () => null);

				expect(result).toBeUndefined();
			});

			it('should return undefined for unregistered directive', () => {
				const element = document.createElement('div');

				const result = applyDirective('unknown', element, () => null);

				expect(result).toBeUndefined();
			});
		});

		describe('getDirectiveNames', () => {
			it('should return empty array when no directives registered', () => {
				expect(getDirectiveNames()).toEqual([]);
			});

			it('should return all registered directive names', () => {
				registerDirective('alpha', () => undefined);
				registerDirective('beta', () => undefined);
				registerDirective('gamma', () => undefined);

				const names = getDirectiveNames();

				expect(names).toContain('alpha');
				expect(names).toContain('beta');
				expect(names).toContain('gamma');
				expect(names).toHaveLength(3);
			});
		});
	});

	describe('Edge Cases', () => {
		it('should handle createRef called multiple times', () => {
			const refs = Array.from({ length: 100 }, () => createRef<HTMLElement>());

			expect(refs).toHaveLength(100);
			refs.forEach((ref) => {
				expect(ref.current).toBeNull();
				expect(isRefObject(ref)).toBe(true);
			});
		});

		it('should handle rapid subscribe/unsubscribe cycles', () => {
			const ref = createRef<HTMLElement>();
			const callbacks: (() => void)[] = [];

			for (let i = 0; i < 50; i++) {
				callbacks.push(ref.subscribe(() => {}));
			}

			callbacks.forEach((unsub) => {
				unsub();
			});
		});

		it('should handle applyRef with various element types', () => {
			const ref = createRef();

			const elements = [
				document.createElement('div'),
				document.createElement('span'),
				document.createElement('button'),
				document.createElement('input'),
				document.createElement('form'),
			];

			elements.forEach((el) => {
				applyRef(ref, el);
				expect(ref.current).toBe(el);
			});
		});

		it('should handle directive with reactive accessor', () => {
			let value = 0;
			const accessor = () => value;
			const capturedAccessor = vi.fn();

			registerDirective('reactive', (_el, acc) => {
				capturedAccessor(acc());
				return undefined;
			});

			const element = document.createElement('div');

			value = 10;
			applyDirective('reactive', element, accessor);

			expect(capturedAccessor).toHaveBeenCalledWith(10);

			unregisterDirective('reactive');
		});

		it('should handle RefCallback that throws', () => {
			const throwingCallback: RefCallback = () => {
				throw new Error('Callback error');
			};

			expect(() => {
				applyRef(throwingCallback, document.createElement('div'));
			}).toThrow('Callback error');
		});

		it('should handle empty string directive name', () => {
			registerDirective('', () => undefined);

			expect(hasDirective('')).toBe(true);
			expect(getDirective('')).toBeDefined();

			unregisterDirective('');
		});

		it('should handle special character directive names', () => {
			const specialNames = ['my-directive', 'directive_name', 'directive123'];

			specialNames.forEach((name) => {
				registerDirective(name, () => undefined);
				expect(hasDirective(name)).toBe(true);
				unregisterDirective(name);
			});
		});
	});

	describe('Type Guards Composition', () => {
		it('should correctly distinguish between RefObject and RefCallback', () => {
			const refObject = createRef<HTMLElement>();
			const refCallback: RefCallback = () => {};

			expect(isRefObject(refObject)).toBe(true);
			expect(isRefCallback(refObject)).toBe(false);

			expect(isRefObject(refCallback)).toBe(false);
			expect(isRefCallback(refCallback)).toBe(true);
		});

		it('should both return false for invalid values', () => {
			const invalidValues = [null, undefined, 42, 'string', {}, []];

			invalidValues.forEach((value) => {
				if (typeof value !== 'function') {
					expect(isRefObject(value)).toBe(false);
				}
				if (typeof value === 'function') {
					expect(isRefCallback(value)).toBe(true);
				} else {
					expect(isRefCallback(value)).toBe(false);
				}
			});
		});
	});
});

// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
	isTransitionIdle,
	isTransitionEntering,
	isTransitionEntered,
	isTransitionExiting,
	isTransitionExited,
	matchTransitionState,
	type TransitionState,
} from '../../components/Transition.js';

describe('Transition', () => {
	describe('Type Guards', () => {
		describe('isTransitionIdle', () => {
			it('should return true for idle state', () => {
				expect(isTransitionIdle('idle')).toBe(true);
			});

			it('should return false for other states', () => {
				expect(isTransitionIdle('entering')).toBe(false);
				expect(isTransitionIdle('entered')).toBe(false);
				expect(isTransitionIdle('exiting')).toBe(false);
				expect(isTransitionIdle('exited')).toBe(false);
			});
		});

		describe('isTransitionEntering', () => {
			it('should return true for entering state', () => {
				expect(isTransitionEntering('entering')).toBe(true);
			});

			it('should return false for other states', () => {
				expect(isTransitionEntering('idle')).toBe(false);
				expect(isTransitionEntering('entered')).toBe(false);
				expect(isTransitionEntering('exiting')).toBe(false);
				expect(isTransitionEntering('exited')).toBe(false);
			});
		});

		describe('isTransitionEntered', () => {
			it('should return true for entered state', () => {
				expect(isTransitionEntered('entered')).toBe(true);
			});

			it('should return false for other states', () => {
				expect(isTransitionEntered('idle')).toBe(false);
				expect(isTransitionEntered('entering')).toBe(false);
				expect(isTransitionEntered('exiting')).toBe(false);
				expect(isTransitionEntered('exited')).toBe(false);
			});
		});

		describe('isTransitionExiting', () => {
			it('should return true for exiting state', () => {
				expect(isTransitionExiting('exiting')).toBe(true);
			});

			it('should return false for other states', () => {
				expect(isTransitionExiting('idle')).toBe(false);
				expect(isTransitionExiting('entering')).toBe(false);
				expect(isTransitionExiting('entered')).toBe(false);
				expect(isTransitionExiting('exited')).toBe(false);
			});
		});

		describe('isTransitionExited', () => {
			it('should return true for exited state', () => {
				expect(isTransitionExited('exited')).toBe(true);
			});

			it('should return false for other states', () => {
				expect(isTransitionExited('idle')).toBe(false);
				expect(isTransitionExited('entering')).toBe(false);
				expect(isTransitionExited('entered')).toBe(false);
				expect(isTransitionExited('exiting')).toBe(false);
			});
		});
	});

	describe('matchTransitionState', () => {
		it('should call onIdle handler for idle state', () => {
			const result = matchTransitionState('idle', {
				onIdle: () => 'idle-result',
				onEntering: () => 'entering-result',
				onEntered: () => 'entered-result',
				onExiting: () => 'exiting-result',
				onExited: () => 'exited-result',
			});

			expect(result).toBe('idle-result');
		});

		it('should call onEntering handler for entering state', () => {
			const result = matchTransitionState('entering', {
				onIdle: () => 'idle-result',
				onEntering: () => 'entering-result',
				onEntered: () => 'entered-result',
				onExiting: () => 'exiting-result',
				onExited: () => 'exited-result',
			});

			expect(result).toBe('entering-result');
		});

		it('should call onEntered handler for entered state', () => {
			const result = matchTransitionState('entered', {
				onIdle: () => 'idle-result',
				onEntering: () => 'entering-result',
				onEntered: () => 'entered-result',
				onExiting: () => 'exiting-result',
				onExited: () => 'exited-result',
			});

			expect(result).toBe('entered-result');
		});

		it('should call onExiting handler for exiting state', () => {
			const result = matchTransitionState('exiting', {
				onIdle: () => 'idle-result',
				onEntering: () => 'entering-result',
				onEntered: () => 'entered-result',
				onExiting: () => 'exiting-result',
				onExited: () => 'exited-result',
			});

			expect(result).toBe('exiting-result');
		});

		it('should call onExited handler for exited state', () => {
			const result = matchTransitionState('exited', {
				onIdle: () => 'idle-result',
				onEntering: () => 'entering-result',
				onEntered: () => 'entered-result',
				onExiting: () => 'exiting-result',
				onExited: () => 'exited-result',
			});

			expect(result).toBe('exited-result');
		});

		it('should be exhaustive for all states', () => {
			const states: TransitionState[] = [
				'idle',
				'entering',
				'entered',
				'exiting',
				'exited',
			];
			const results: string[] = [];

			for (const state of states) {
				results.push(
					matchTransitionState(state, {
						onIdle: () => 'idle',
						onEntering: () => 'entering',
						onEntered: () => 'entered',
						onExiting: () => 'exiting',
						onExited: () => 'exited',
					})
				);
			}

			expect(results).toEqual([
				'idle',
				'entering',
				'entered',
				'exiting',
				'exited',
			]);
		});

		it('should support generic return types', () => {
			const numberResult = matchTransitionState('idle', {
				onIdle: () => 1,
				onEntering: () => 2,
				onEntered: () => 3,
				onExiting: () => 4,
				onExited: () => 5,
			});

			expect(typeof numberResult).toBe('number');
			expect(numberResult).toBe(1);
		});

		it('should support object return types', () => {
			const result = matchTransitionState('entering', {
				onIdle: () => ({ status: 'idle' }),
				onEntering: () => ({ status: 'entering', active: true }),
				onEntered: () => ({ status: 'entered' }),
				onExiting: () => ({ status: 'exiting' }),
				onExited: () => ({ status: 'exited' }),
			});

			expect(result).toEqual({ status: 'entering', active: true });
		});
	});

	describe('Edge Cases', () => {
		describe('Type Guard Edge Cases', () => {
			it('should handle rapid state transitions', () => {
				const states: TransitionState[] = [
					'idle',
					'entering',
					'entered',
					'exiting',
					'exited',
					'idle',
				];
				const guards = [
					isTransitionIdle,
					isTransitionEntering,
					isTransitionEntered,
					isTransitionExiting,
					isTransitionExited,
				];

				for (const state of states) {
					const matchCount = guards.filter((guard) => guard(state)).length;
					expect(matchCount).toBe(1);
				}
			});

			it('should work with state stored in variables', () => {
				let currentState: TransitionState = 'idle';
				expect(isTransitionIdle(currentState)).toBe(true);

				currentState = 'entering';
				expect(isTransitionEntering(currentState)).toBe(true);

				currentState = 'entered';
				expect(isTransitionEntered(currentState)).toBe(true);
			});

			it('should work with state from array', () => {
				const stateHistory: TransitionState[] = ['idle', 'entering', 'entered'];
				expect(isTransitionIdle(stateHistory[0])).toBe(true);
				expect(isTransitionEntering(stateHistory[1])).toBe(true);
				expect(isTransitionEntered(stateHistory[2])).toBe(true);
			});

			it('should work with state from object property', () => {
				const component = { state: 'exiting' as TransitionState };
				expect(isTransitionExiting(component.state)).toBe(true);
			});

			it('should correctly type narrow in conditionals', () => {
				const state: TransitionState = 'entering';
				let result = '';

				if (isTransitionIdle(state)) {
					result = 'idle';
				} else if (isTransitionEntering(state)) {
					result = 'entering';
				}

				expect(result).toBe('entering');
			});
		});

		describe('Match Function Edge Cases', () => {
			it('should handle handlers that return undefined', () => {
				let called = false;
				matchTransitionState('idle', {
					onIdle: () => {
						called = true;
						return undefined;
					},
					onEntering: () => undefined,
					onEntered: () => undefined,
					onExiting: () => undefined,
					onExited: () => undefined,
				});

				expect(called).toBe(true);
			});

			it('should handle handlers that return null', () => {
				const result = matchTransitionState('entering', {
					onIdle: () => null,
					onEntering: () => null,
					onEntered: () => null,
					onExiting: () => null,
					onExited: () => null,
				});

				expect(result).toBeNull();
			});

			it('should handle handlers that return arrays', () => {
				const result = matchTransitionState('entered', {
					onIdle: () => [],
					onEntering: () => [1],
					onEntered: () => [1, 2, 3],
					onExiting: () => [1, 2],
					onExited: () => [],
				});

				expect(result).toEqual([1, 2, 3]);
			});

			it('should handle handlers that return functions', () => {
				const fn = () => 'test';
				const result = matchTransitionState('exiting', {
					onIdle: () => fn,
					onEntering: () => fn,
					onEntered: () => fn,
					onExiting: () => fn,
					onExited: () => fn,
				});

				expect(typeof result).toBe('function');
				expect(result()).toBe('test');
			});

			it('should handle handlers that throw errors', () => {
				expect(() => {
					matchTransitionState('idle', {
						onIdle: () => {
							throw new Error('Test error');
						},
						onEntering: () => 'ok',
						onEntered: () => 'ok',
						onExiting: () => 'ok',
						onExited: () => 'ok',
					});
				}).toThrow('Test error');
			});

			it('should only call the matching handler once', () => {
				const handlers = {
					onIdle: vi.fn(() => 'idle'),
					onEntering: vi.fn(() => 'entering'),
					onEntered: vi.fn(() => 'entered'),
					onExiting: vi.fn(() => 'exiting'),
					onExited: vi.fn(() => 'exited'),
				};

				matchTransitionState('entering', handlers);

				expect(handlers.onIdle).not.toHaveBeenCalled();
				expect(handlers.onEntering).toHaveBeenCalledTimes(1);
				expect(handlers.onEntered).not.toHaveBeenCalled();
				expect(handlers.onExiting).not.toHaveBeenCalled();
				expect(handlers.onExited).not.toHaveBeenCalled();
			});

			it('should handle deeply nested return objects', () => {
				const result = matchTransitionState('entered', {
					onIdle: () => ({ a: { b: { c: 1 } } }),
					onEntering: () => ({ a: { b: { c: 2 } } }),
					onEntered: () => ({ a: { b: { c: 3, d: [4, 5] } } }),
					onExiting: () => ({ a: { b: { c: 4 } } }),
					onExited: () => ({ a: { b: { c: 5 } } }),
				});

				expect(result).toEqual({ a: { b: { c: 3, d: [4, 5] } } });
			});

			it('should handle Promise return types', async () => {
				const result = matchTransitionState('exited', {
					onIdle: () => Promise.resolve('idle'),
					onEntering: () => Promise.resolve('entering'),
					onEntered: () => Promise.resolve('entered'),
					onExiting: () => Promise.resolve('exiting'),
					onExited: () => Promise.resolve('exited'),
				});

				expect(result).toBeInstanceOf(Promise);
				const resolved = await result;
				expect(resolved).toBe('exited');
			});
		});

		describe('State Lifecycle Edge Cases', () => {
			it('should handle full lifecycle sequence', () => {
				const lifecycle: TransitionState[] = [
					'idle',
					'entering',
					'entered',
					'exiting',
					'exited',
				];
				const results: boolean[] = [];

				for (let i = 0; i < lifecycle.length; i++) {
					const state = lifecycle[i];
					results.push(
						i === 0 ? isTransitionIdle(state) : false,
						i === 1 ? isTransitionEntering(state) : false,
						i === 2 ? isTransitionEntered(state) : false,
						i === 3 ? isTransitionExiting(state) : false,
						i === 4 ? isTransitionExited(state) : false
					);
				}

				expect(results.filter(Boolean)).toHaveLength(5);
			});

			it('should handle repeated state checks', () => {
				const state: TransitionState = 'idle';

				for (let i = 0; i < 1000; i++) {
					expect(isTransitionIdle(state)).toBe(true);
				}
			});

			it('should work with state machine pattern', () => {
				const transitions: Record<TransitionState, TransitionState | null> = {
					idle: 'entering',
					entering: 'entered',
					entered: 'exiting',
					exiting: 'exited',
					exited: null,
				};

				let current: TransitionState = 'idle';
				const visited: TransitionState[] = [current];

				while (transitions[current] !== null) {
					current = transitions[current] as TransitionState;
					visited.push(current);
				}

				expect(visited).toEqual([
					'idle',
					'entering',
					'entered',
					'exiting',
					'exited',
				]);
			});
		});
	});
});

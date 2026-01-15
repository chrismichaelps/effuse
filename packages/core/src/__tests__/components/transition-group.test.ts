// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
	isGroupIdle,
	isGroupAnimating,
	matchGroupState,
	isItemEntering,
	isItemEntered,
	isItemExiting,
	isItemMoving,
	type TransitionGroupState,
	type ItemState,
} from '../../components/TransitionGroup.js';

describe('TransitionGroup', () => {
	describe('Group State Type Guards', () => {
		describe('isGroupIdle', () => {
			it('should return true for idle state', () => {
				expect(isGroupIdle('idle')).toBe(true);
			});

			it('should return false for animating state', () => {
				expect(isGroupIdle('animating')).toBe(false);
			});
		});

		describe('isGroupAnimating', () => {
			it('should return true for animating state', () => {
				expect(isGroupAnimating('animating')).toBe(true);
			});

			it('should return false for idle state', () => {
				expect(isGroupAnimating('idle')).toBe(false);
			});
		});
	});

	describe('matchGroupState', () => {
		it('should call onIdle handler for idle state', () => {
			const result = matchGroupState('idle', {
				onIdle: () => 'idle-result',
				onAnimating: () => 'animating-result',
			});

			expect(result).toBe('idle-result');
		});

		it('should call onAnimating handler for animating state', () => {
			const result = matchGroupState('animating', {
				onIdle: () => 'idle-result',
				onAnimating: () => 'animating-result',
			});

			expect(result).toBe('animating-result');
		});

		it('should be exhaustive for all states', () => {
			const states: TransitionGroupState[] = ['idle', 'animating'];
			const results: string[] = [];

			for (const state of states) {
				results.push(
					matchGroupState(state, {
						onIdle: () => 'idle',
						onAnimating: () => 'animating',
					})
				);
			}

			expect(results).toEqual(['idle', 'animating']);
		});

		it('should support generic return types', () => {
			const result = matchGroupState('idle', {
				onIdle: () => 0,
				onAnimating: () => 1,
			});

			expect(typeof result).toBe('number');
			expect(result).toBe(0);
		});
	});

	describe('Item State Type Guards', () => {
		describe('isItemEntering', () => {
			it('should return true for entering state', () => {
				expect(isItemEntering('entering')).toBe(true);
			});

			it('should return false for other states', () => {
				expect(isItemEntering('entered')).toBe(false);
				expect(isItemEntering('exiting')).toBe(false);
				expect(isItemEntering('moving')).toBe(false);
			});
		});

		describe('isItemEntered', () => {
			it('should return true for entered state', () => {
				expect(isItemEntered('entered')).toBe(true);
			});

			it('should return false for other states', () => {
				expect(isItemEntered('entering')).toBe(false);
				expect(isItemEntered('exiting')).toBe(false);
				expect(isItemEntered('moving')).toBe(false);
			});
		});

		describe('isItemExiting', () => {
			it('should return true for exiting state', () => {
				expect(isItemExiting('exiting')).toBe(true);
			});

			it('should return false for other states', () => {
				expect(isItemExiting('entering')).toBe(false);
				expect(isItemExiting('entered')).toBe(false);
				expect(isItemExiting('moving')).toBe(false);
			});
		});

		describe('isItemMoving', () => {
			it('should return true for moving state', () => {
				expect(isItemMoving('moving')).toBe(true);
			});

			it('should return false for other states', () => {
				expect(isItemMoving('entering')).toBe(false);
				expect(isItemMoving('entered')).toBe(false);
				expect(isItemMoving('exiting')).toBe(false);
			});
		});
	});

	describe('State Combinations', () => {
		it('should have exactly 2 group states', () => {
			const groupStates: TransitionGroupState[] = ['idle', 'animating'];
			expect(groupStates).toHaveLength(2);
		});

		it('should have exactly 4 item states', () => {
			const itemStates: ItemState[] = [
				'entering',
				'entered',
				'exiting',
				'moving',
			];
			expect(itemStates).toHaveLength(4);
		});

		it('should correctly identify all group states', () => {
			const states: TransitionGroupState[] = ['idle', 'animating'];

			const idleCount = states.filter(isGroupIdle).length;
			const animatingCount = states.filter(isGroupAnimating).length;

			expect(idleCount).toBe(1);
			expect(animatingCount).toBe(1);
		});

		it('should correctly identify all item states', () => {
			const states: ItemState[] = ['entering', 'entered', 'exiting', 'moving'];

			const enteringCount = states.filter(isItemEntering).length;
			const enteredCount = states.filter(isItemEntered).length;
			const exitingCount = states.filter(isItemExiting).length;
			const movingCount = states.filter(isItemMoving).length;

			expect(enteringCount).toBe(1);
			expect(enteredCount).toBe(1);
			expect(exitingCount).toBe(1);
			expect(movingCount).toBe(1);
		});
	});

	describe('Edge Cases', () => {
		describe('Group State Edge Cases', () => {
			it('should handle rapid toggling between states', () => {
				const sequence: TransitionGroupState[] = [
					'idle',
					'animating',
					'idle',
					'animating',
					'idle',
				];

				for (let i = 0; i < sequence.length; i++) {
					const state = sequence[i];
					if (i % 2 === 0) {
						expect(isGroupIdle(state)).toBe(true);
						expect(isGroupAnimating(state)).toBe(false);
					} else {
						expect(isGroupIdle(state)).toBe(false);
						expect(isGroupAnimating(state)).toBe(true);
					}
				}
			});

			it('should work with state stored in object', () => {
				const group = {
					state: 'animating' as TransitionGroupState,
					items: [],
				};

				expect(isGroupAnimating(group.state)).toBe(true);
				group.state = 'idle';
				expect(isGroupIdle(group.state)).toBe(true);
			});

			it('should correctly narrow types in switch-like pattern', () => {
				const getStateDescription = (state: TransitionGroupState): string => {
					if (isGroupIdle(state)) {
						return 'No animations running';
					}
					if (isGroupAnimating(state)) {
						return 'Animations in progress';
					}
					return 'Unknown';
				};

				expect(getStateDescription('idle')).toBe('No animations running');
				expect(getStateDescription('animating')).toBe('Animations in progress');
			});
		});

		describe('Item State Edge Cases', () => {
			it('should handle all item lifecycle states', () => {
				const lifecycle: ItemState[] = [
					'entering',
					'entered',
					'moving',
					'exiting',
				];

				for (const state of lifecycle) {
					const guards = [
						isItemEntering,
						isItemEntered,
						isItemExiting,
						isItemMoving,
					];
					const matchCount = guards.filter((g) => g(state)).length;
					expect(matchCount).toBe(1);
				}
			});

			it('should handle items in different states simultaneously', () => {
				const items: { id: number; state: ItemState }[] = [
					{ id: 1, state: 'entering' },
					{ id: 2, state: 'entered' },
					{ id: 3, state: 'moving' },
					{ id: 4, state: 'exiting' },
				];

				const entering = items.filter((i) => isItemEntering(i.state));
				const entered = items.filter((i) => isItemEntered(i.state));
				const moving = items.filter((i) => isItemMoving(i.state));
				const exiting = items.filter((i) => isItemExiting(i.state));

				expect(entering).toHaveLength(1);
				expect(entered).toHaveLength(1);
				expect(moving).toHaveLength(1);
				expect(exiting).toHaveLength(1);
			});

			it('should handle empty item list', () => {
				const items: { state: ItemState }[] = [];

				const anyEntering = items.some((i) => isItemEntering(i.state));
				expect(anyEntering).toBe(false);
			});

			it('should handle large item list efficiently', () => {
				const items: { state: ItemState }[] = Array.from(
					{ length: 1000 },
					(_, i) => ({
						state: (['entering', 'entered', 'moving', 'exiting'] as const)[
							i % 4
						],
					})
				);

				const enteringCount = items.filter((i) =>
					isItemEntering(i.state)
				).length;
				const enteredCount = items.filter((i) => isItemEntered(i.state)).length;
				const movingCount = items.filter((i) => isItemMoving(i.state)).length;
				const exitingCount = items.filter((i) => isItemExiting(i.state)).length;

				expect(enteringCount).toBe(250);
				expect(enteredCount).toBe(250);
				expect(movingCount).toBe(250);
				expect(exitingCount).toBe(250);
			});
		});

		describe('Match Function Edge Cases', () => {
			it('should only call matching handler once', () => {
				const handlers = {
					onIdle: vi.fn(() => 'idle'),
					onAnimating: vi.fn(() => 'animating'),
				};

				matchGroupState('animating', handlers);

				expect(handlers.onIdle).not.toHaveBeenCalled();
				expect(handlers.onAnimating).toHaveBeenCalledTimes(1);
			});

			it('should handle handlers returning complex objects', () => {
				const result = matchGroupState('idle', {
					onIdle: () => ({
						canStart: true,
						pendingItems: [],
						config: { duration: 300 },
					}),
					onAnimating: () => ({
						canStart: false,
						pendingItems: [1, 2, 3],
						config: { duration: 300 },
					}),
				});

				expect(result).toEqual({
					canStart: true,
					pendingItems: [],
					config: { duration: 300 },
				});
			});

			it('should handle handlers that throw', () => {
				expect(() => {
					matchGroupState('idle', {
						onIdle: () => {
							throw new Error('Idle handler error');
						},
						onAnimating: () => 'ok',
					});
				}).toThrow('Idle handler error');
			});

			it('should handle async handlers', async () => {
				const result = matchGroupState('animating', {
					onIdle: () => Promise.resolve('idle'),
					onAnimating: () => Promise.resolve('animating'),
				});

				expect(result).toBeInstanceOf(Promise);
				const resolved = await result;
				expect(resolved).toBe('animating');
			});

			it('should handle null and undefined returns', () => {
				const nullResult = matchGroupState('idle', {
					onIdle: () => null,
					onAnimating: () => 'animating',
				});

				const undefinedResult = matchGroupState('animating', {
					onIdle: () => 'idle',
					onAnimating: () => undefined,
				});

				expect(nullResult).toBeNull();
				expect(undefinedResult).toBeUndefined();
			});
		});

		describe('Combined State Scenarios', () => {
			it('should handle group state determining item behavior', () => {
				const groupState: TransitionGroupState = 'animating';
				const itemStates: ItemState[] = ['entering', 'entered', 'exiting'];

				const shouldAnimate = isGroupAnimating(groupState);
				expect(shouldAnimate).toBe(true);

				if (shouldAnimate) {
					const activeItems = itemStates.filter(
						(s) => isItemEntering(s) || isItemExiting(s) || isItemMoving(s)
					);
					expect(activeItems).toHaveLength(2);
				}
			});

			it('should handle state transitions with callbacks', () => {
				const callbacks: string[] = [];

				const processGroupState = (state: TransitionGroupState): void => {
					matchGroupState(state, {
						onIdle: () => callbacks.push('group-idle'),
						onAnimating: () => callbacks.push('group-animating'),
					});
				};

				const processItemState = (state: ItemState): void => {
					if (isItemEntering(state)) callbacks.push('item-entering');
					if (isItemEntered(state)) callbacks.push('item-entered');
					if (isItemExiting(state)) callbacks.push('item-exiting');
					if (isItemMoving(state)) callbacks.push('item-moving');
				};

				processGroupState('animating');
				processItemState('entering');
				processItemState('entered');
				processGroupState('idle');

				expect(callbacks).toEqual([
					'group-animating',
					'item-entering',
					'item-entered',
					'group-idle',
				]);
			});
		});
	});
});

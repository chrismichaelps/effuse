// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
	TransitionGroupState,
	isGroupIdle,
	isGroupAnimating,
	matchGroupState,
	ItemState,
	isItemEntering,
	isItemEntered,
	isItemExiting,
	isItemMoving,
	TransitionGroupError,
} from '../../components/TransitionGroup.js';

describe('TransitionGroupState TaggedEnum', () => {
	describe('Constructors', () => {
		it('should create Idle state', () => {
			const state = TransitionGroupState.Idle();
			expect(state._tag).toBe('Idle');
		});

		it('should create Animating state with activeCount', () => {
			const state = TransitionGroupState.Animating({ activeCount: 5 });
			expect(state._tag).toBe('Animating');
			expect(state.activeCount).toBe(5);
		});

		it('should create Animating state with zero activeCount', () => {
			const state = TransitionGroupState.Animating({ activeCount: 0 });
			expect(state._tag).toBe('Animating');
			expect(state.activeCount).toBe(0);
		});
	});

	describe('Type Guards', () => {
		describe('isGroupIdle', () => {
			it('should return true for Idle state', () => {
				expect(isGroupIdle(TransitionGroupState.Idle())).toBe(true);
			});

			it('should return false for Animating state', () => {
				expect(
					isGroupIdle(TransitionGroupState.Animating({ activeCount: 1 }))
				).toBe(false);
			});
		});

		describe('isGroupAnimating', () => {
			it('should return true for Animating state', () => {
				expect(
					isGroupAnimating(TransitionGroupState.Animating({ activeCount: 3 }))
				).toBe(true);
			});

			it('should return false for Idle state', () => {
				expect(isGroupAnimating(TransitionGroupState.Idle())).toBe(false);
			});
		});
	});

	describe('matchGroupState ($match)', () => {
		it('should call Idle handler', () => {
			const result = matchGroupState(TransitionGroupState.Idle(), {
				Idle: () => 'idle-result',
				Animating: () => 'animating-result',
			});
			expect(result).toBe('idle-result');
		});

		it('should call Animating handler with activeCount access', () => {
			const result = matchGroupState(
				TransitionGroupState.Animating({ activeCount: 7 }),
				{
					Idle: () => null,
					Animating: ({ activeCount }) =>
						`animating ${String(activeCount)} items`,
				}
			);
			expect(result).toBe('animating 7 items');
		});

		it('should support complex return types', () => {
			const result = matchGroupState(
				TransitionGroupState.Animating({ activeCount: 3 }),
				{
					Idle: () => ({ isActive: false, count: 0 }),
					Animating: ({ activeCount }) => ({
						isActive: true,
						count: activeCount,
					}),
				}
			);
			expect(result).toEqual({ isActive: true, count: 3 });
		});
	});

	describe('Edge Cases', () => {
		it('should handle rapid state changes', () => {
			let state:
				| ReturnType<typeof TransitionGroupState.Idle>
				| ReturnType<typeof TransitionGroupState.Animating> =
				TransitionGroupState.Idle();

			expect(isGroupIdle(state)).toBe(true);

			state = TransitionGroupState.Animating({ activeCount: 2 });
			expect(isGroupAnimating(state)).toBe(true);

			state = TransitionGroupState.Idle();
			expect(isGroupIdle(state)).toBe(true);
		});

		it('should handle large activeCount', () => {
			const state = TransitionGroupState.Animating({ activeCount: 10000 });
			expect(state.activeCount).toBe(10000);
			expect(isGroupAnimating(state)).toBe(true);
		});

		it('should work in filtering scenarios', () => {
			const states = [
				TransitionGroupState.Idle(),
				TransitionGroupState.Animating({ activeCount: 1 }),
				TransitionGroupState.Idle(),
				TransitionGroupState.Animating({ activeCount: 3 }),
			];

			const idleStates = states.filter(isGroupIdle);
			const animatingStates = states.filter(isGroupAnimating);

			expect(idleStates).toHaveLength(2);
			expect(animatingStates).toHaveLength(2);
		});
	});
});

describe('ItemState TaggedEnum', () => {
	describe('Constructors', () => {
		it('should create Entering state with element', () => {
			const el = document.createElement('div');
			const state = ItemState.Entering({ element: el });
			expect(state._tag).toBe('Entering');
			expect(state.element).toBe(el);
		});

		it('should create Entered state with element', () => {
			const el = document.createElement('span');
			const state = ItemState.Entered({ element: el });
			expect(state._tag).toBe('Entered');
			expect(state.element).toBe(el);
		});

		it('should create Exiting state with element', () => {
			const el = document.createElement('div');
			const state = ItemState.Exiting({ element: el });
			expect(state._tag).toBe('Exiting');
			expect(state.element).toBe(el);
		});

		it('should create Moving state with element and indices', () => {
			const el = document.createElement('li');
			const state = ItemState.Moving({ element: el, fromIndex: 0, toIndex: 2 });
			expect(state._tag).toBe('Moving');
			expect(state.element).toBe(el);
			expect(state.fromIndex).toBe(0);
			expect(state.toIndex).toBe(2);
		});
	});

	describe('Type Guards', () => {
		describe('isItemEntering', () => {
			it('should return true for Entering state', () => {
				const el = document.createElement('div');
				expect(isItemEntering(ItemState.Entering({ element: el }))).toBe(true);
			});

			it('should return false for other states', () => {
				const el = document.createElement('div');
				expect(isItemEntering(ItemState.Entered({ element: el }))).toBe(false);
				expect(isItemEntering(ItemState.Exiting({ element: el }))).toBe(false);
				expect(
					isItemEntering(
						ItemState.Moving({ element: el, fromIndex: 0, toIndex: 1 })
					)
				).toBe(false);
			});
		});

		describe('isItemEntered', () => {
			it('should return true for Entered state', () => {
				const el = document.createElement('div');
				expect(isItemEntered(ItemState.Entered({ element: el }))).toBe(true);
			});

			it('should return false for other states', () => {
				const el = document.createElement('div');
				expect(isItemEntered(ItemState.Entering({ element: el }))).toBe(false);
				expect(isItemEntered(ItemState.Exiting({ element: el }))).toBe(false);
				expect(
					isItemEntered(
						ItemState.Moving({ element: el, fromIndex: 0, toIndex: 1 })
					)
				).toBe(false);
			});
		});

		describe('isItemExiting', () => {
			it('should return true for Exiting state', () => {
				const el = document.createElement('div');
				expect(isItemExiting(ItemState.Exiting({ element: el }))).toBe(true);
			});

			it('should return false for other states', () => {
				const el = document.createElement('div');
				expect(isItemExiting(ItemState.Entering({ element: el }))).toBe(false);
				expect(isItemExiting(ItemState.Entered({ element: el }))).toBe(false);
				expect(
					isItemExiting(
						ItemState.Moving({ element: el, fromIndex: 0, toIndex: 1 })
					)
				).toBe(false);
			});
		});

		describe('isItemMoving', () => {
			it('should return true for Moving state', () => {
				const el = document.createElement('div');
				expect(
					isItemMoving(
						ItemState.Moving({ element: el, fromIndex: 0, toIndex: 1 })
					)
				).toBe(true);
			});

			it('should return false for other states', () => {
				const el = document.createElement('div');
				expect(isItemMoving(ItemState.Entering({ element: el }))).toBe(false);
				expect(isItemMoving(ItemState.Entered({ element: el }))).toBe(false);
				expect(isItemMoving(ItemState.Exiting({ element: el }))).toBe(false);
			});
		});
	});

	describe('$match pattern matching', () => {
		it('should match Entering state', () => {
			const el = document.createElement('div');
			const result = ItemState.$match(ItemState.Entering({ element: el }), {
				Entering: () => 'entering',
				Entered: () => 'entered',
				Exiting: () => 'exiting',
				Moving: () => 'moving',
			});
			expect(result).toBe('entering');
		});

		it('should match Entered state with element access', () => {
			const el = document.createElement('div');
			el.id = 'test-item';
			const result = ItemState.$match(ItemState.Entered({ element: el }), {
				Entering: () => null,
				Entered: ({ element }) => element.id,
				Exiting: () => null,
				Moving: () => null,
			});
			expect(result).toBe('test-item');
		});

		it('should match Exiting state', () => {
			const el = document.createElement('div');
			const result = ItemState.$match(ItemState.Exiting({ element: el }), {
				Entering: () => 'entering',
				Entered: () => 'entered',
				Exiting: () => 'exiting',
				Moving: () => 'moving',
			});
			expect(result).toBe('exiting');
		});

		it('should match Moving state with index access', () => {
			const el = document.createElement('div');
			const result = ItemState.$match(
				ItemState.Moving({ element: el, fromIndex: 2, toIndex: 5 }),
				{
					Entering: () => null,
					Entered: () => null,
					Exiting: () => null,
					Moving: ({ fromIndex, toIndex }) =>
						`moved from ${String(fromIndex)} to ${String(toIndex)}`,
				}
			);
			expect(result).toBe('moved from 2 to 5');
		});

		it('should support complex return types', () => {
			const el = document.createElement('div');
			const result = ItemState.$match(
				ItemState.Moving({ element: el, fromIndex: 1, toIndex: 3 }),
				{
					Entering: () => ({ animationType: 'fade-in', duration: 200 }),
					Entered: () => ({ animationType: 'none', duration: 0 }),
					Exiting: () => ({ animationType: 'fade-out', duration: 200 }),
					Moving: ({ fromIndex, toIndex }) => ({
						animationType: 'slide',
						duration: 300,
						delta: toIndex - fromIndex,
					}),
				}
			);
			expect(result).toEqual({
				animationType: 'slide',
				duration: 300,
				delta: 2,
			});
		});
	});

	describe('Edge Cases', () => {
		it('should handle same fromIndex and toIndex in Moving', () => {
			const el = document.createElement('div');
			const state = ItemState.Moving({ element: el, fromIndex: 5, toIndex: 5 });
			expect(state.fromIndex).toBe(5);
			expect(state.toIndex).toBe(5);
		});

		it('should handle negative indices in Moving', () => {
			const el = document.createElement('div');
			const state = ItemState.Moving({
				element: el,
				fromIndex: -1,
				toIndex: 0,
			});
			expect(state.fromIndex).toBe(-1);
			expect(state.toIndex).toBe(0);
		});

		it('should handle state filtering with mixed states', () => {
			const el = document.createElement('div');
			const states = [
				ItemState.Entering({ element: el }),
				ItemState.Entered({ element: el }),
				ItemState.Moving({ element: el, fromIndex: 0, toIndex: 1 }),
				ItemState.Exiting({ element: el }),
				ItemState.Entering({ element: el }),
			];

			const entering = states.filter(isItemEntering);
			const entered = states.filter(isItemEntered);
			const moving = states.filter(isItemMoving);
			const exiting = states.filter(isItemExiting);

			expect(entering).toHaveLength(2);
			expect(entered).toHaveLength(1);
			expect(moving).toHaveLength(1);
			expect(exiting).toHaveLength(1);
		});

		it('should handle item lifecycle transitions', () => {
			const el = document.createElement('div');
			type ItemStateType =
				| ReturnType<typeof ItemState.Entering>
				| ReturnType<typeof ItemState.Entered>
				| ReturnType<typeof ItemState.Exiting>
				| ReturnType<typeof ItemState.Moving>;

			let state: ItemStateType = ItemState.Entering({ element: el });
			expect(isItemEntering(state)).toBe(true);

			state = ItemState.Entered({ element: el });
			expect(isItemEntered(state)).toBe(true);

			state = ItemState.Moving({ element: el, fromIndex: 0, toIndex: 2 });
			expect(isItemMoving(state)).toBe(true);

			state = ItemState.Entered({ element: el });
			expect(isItemEntered(state)).toBe(true);

			state = ItemState.Exiting({ element: el });
			expect(isItemExiting(state)).toBe(true);
		});
	});
});

describe('TransitionGroupError', () => {
	it('should be an instance of Error', () => {
		const error = new TransitionGroupError({
			key: 'item-1',
			phase: 'enter',
			cause: new Error('Animation failed'),
		});
		expect(error).toBeInstanceOf(Error);
	});

	it('should have _tag property', () => {
		const error = new TransitionGroupError({
			key: 'item-2',
			phase: 'exit',
			cause: 'Timeout',
		});
		expect(error._tag).toBe('TransitionGroupError');
	});

	it('should store key property', () => {
		const error = new TransitionGroupError({
			key: 'unique-key-123',
			phase: 'enter',
			cause: null,
		});
		expect(error.key).toBe('unique-key-123');
	});

	it('should store various key types', () => {
		const keys = ['string-key', 123, Symbol('sym'), { id: 1 }];
		for (const key of keys) {
			const error = new TransitionGroupError({
				key,
				phase: 'enter',
				cause: null,
			});
			expect(error.key).toBe(key);
		}
	});

	it('should store phase property', () => {
		const enterError = new TransitionGroupError({
			key: 'k1',
			phase: 'enter',
			cause: null,
		});
		const exitError = new TransitionGroupError({
			key: 'k2',
			phase: 'exit',
			cause: null,
		});
		const moveError = new TransitionGroupError({
			key: 'k3',
			phase: 'move',
			cause: null,
		});

		expect(enterError.phase).toBe('enter');
		expect(exitError.phase).toBe('exit');
		expect(moveError.phase).toBe('move');
	});

	it('should store cause property', () => {
		const cause = new Error('Original error');
		const error = new TransitionGroupError({
			key: 'item',
			phase: 'exit',
			cause,
		});
		expect(error.cause).toBe(cause);
	});

	it('should support various cause types', () => {
		const causes = ['string error', 42, { code: 'ANIM_FAIL' }, null, undefined];
		for (const cause of causes) {
			const error = new TransitionGroupError({
				key: 'k',
				phase: 'enter',
				cause,
			});
			expect(error.cause).toBe(cause);
		}
	});

	it('should be usable in error handling patterns', () => {
		const handleError = (err: unknown): string => {
			if (err instanceof TransitionGroupError) {
				return `TransitionGroup ${err.phase} failed for key: ${String(err.key)}`;
			}
			return 'Unknown error';
		};

		const error = new TransitionGroupError({
			key: 'item-5',
			phase: 'move',
			cause: 'test',
		});
		expect(handleError(error)).toBe(
			'TransitionGroup move failed for key: item-5'
		);
		expect(handleError(new Error('other'))).toBe('Unknown error');
	});
});

describe('Combined Group and Item State Scenarios', () => {
	it('should track group state based on active items', () => {
		const el = document.createElement('div');
		const items = [
			ItemState.Entering({ element: el }),
			ItemState.Entered({ element: el }),
			ItemState.Exiting({ element: el }),
		];

		const activeCount = items.filter(
			(s) => isItemEntering(s) || isItemExiting(s) || isItemMoving(s)
		).length;

		const groupState =
			activeCount > 0
				? TransitionGroupState.Animating({ activeCount })
				: TransitionGroupState.Idle();

		expect(isGroupAnimating(groupState)).toBe(true);
		expect(
			(groupState as ReturnType<typeof TransitionGroupState.Animating>)
				.activeCount
		).toBe(2);
	});

	it('should transition to idle when all items are entered', () => {
		const el = document.createElement('div');
		const items = [
			ItemState.Entered({ element: el }),
			ItemState.Entered({ element: el }),
			ItemState.Entered({ element: el }),
		];

		const activeCount = items.filter(
			(s) => isItemEntering(s) || isItemExiting(s) || isItemMoving(s)
		).length;

		const groupState =
			activeCount > 0
				? TransitionGroupState.Animating({ activeCount })
				: TransitionGroupState.Idle();

		expect(isGroupIdle(groupState)).toBe(true);
	});

	it('should handle match callbacks with group context', () => {
		const el = document.createElement('div');
		const groupState = TransitionGroupState.Animating({ activeCount: 3 });
		const itemState = ItemState.Moving({
			element: el,
			fromIndex: 1,
			toIndex: 4,
		});

		const groupInfo = matchGroupState(groupState, {
			Idle: () => ({ canAddItems: true, activeAnimations: 0 }),
			Animating: ({ activeCount }) => ({
				canAddItems: false,
				activeAnimations: activeCount,
			}),
		});

		const itemInfo = ItemState.$match(itemState, {
			Entering: () => ({ animation: 'fade-in' }),
			Entered: () => ({ animation: 'none' }),
			Exiting: () => ({ animation: 'fade-out' }),
			Moving: ({ fromIndex, toIndex }) => ({
				animation: 'slide',
				distance: Math.abs(toIndex - fromIndex),
			}),
		});

		expect(groupInfo).toEqual({ canAddItems: false, activeAnimations: 3 });
		expect(itemInfo).toEqual({ animation: 'slide', distance: 3 });
	});
});

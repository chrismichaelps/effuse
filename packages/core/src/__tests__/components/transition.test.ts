// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
	TransitionState,
	isTransitionIdle,
	isTransitionEntering,
	isTransitionEntered,
	isTransitionExiting,
	isTransitionExited,
	matchTransitionState,
	TransitionMode,
	TransitionError,
} from '../../components/Transition.js';

describe('TransitionState TaggedEnum', () => {
	describe('Constructors', () => {
		it('should create Idle state', () => {
			const state = TransitionState.Idle();
			expect(state._tag).toBe('Idle');
		});

		it('should create Entering state with element', () => {
			const element = document.createElement('div');
			const state = TransitionState.Entering({ element });
			expect(state._tag).toBe('Entering');
			expect(state.element).toBe(element);
		});

		it('should create Entered state with element', () => {
			const element = document.createElement('span');
			const state = TransitionState.Entered({ element });
			expect(state._tag).toBe('Entered');
			expect(state.element).toBe(element);
		});

		it('should create Exiting state with element', () => {
			const element = document.createElement('div');
			const state = TransitionState.Exiting({ element });
			expect(state._tag).toBe('Exiting');
			expect(state.element).toBe(element);
		});

		it('should create Exited state', () => {
			const state = TransitionState.Exited();
			expect(state._tag).toBe('Exited');
		});
	});

	describe('Type Guards', () => {
		describe('isTransitionIdle', () => {
			it('should return true for Idle state', () => {
				expect(isTransitionIdle(TransitionState.Idle())).toBe(true);
			});

			it('should return false for other states', () => {
				const el = document.createElement('div');
				expect(
					isTransitionIdle(TransitionState.Entering({ element: el }))
				).toBe(false);
				expect(isTransitionIdle(TransitionState.Entered({ element: el }))).toBe(
					false
				);
				expect(isTransitionIdle(TransitionState.Exiting({ element: el }))).toBe(
					false
				);
				expect(isTransitionIdle(TransitionState.Exited())).toBe(false);
			});
		});

		describe('isTransitionEntering', () => {
			it('should return true for Entering state', () => {
				const el = document.createElement('div');
				expect(
					isTransitionEntering(TransitionState.Entering({ element: el }))
				).toBe(true);
			});

			it('should return false for other states', () => {
				const el = document.createElement('div');
				expect(isTransitionEntering(TransitionState.Idle())).toBe(false);
				expect(
					isTransitionEntering(TransitionState.Entered({ element: el }))
				).toBe(false);
				expect(
					isTransitionEntering(TransitionState.Exiting({ element: el }))
				).toBe(false);
				expect(isTransitionEntering(TransitionState.Exited())).toBe(false);
			});
		});

		describe('isTransitionEntered', () => {
			it('should return true for Entered state', () => {
				const el = document.createElement('div');
				expect(
					isTransitionEntered(TransitionState.Entered({ element: el }))
				).toBe(true);
			});

			it('should return false for other states', () => {
				const el = document.createElement('div');
				expect(isTransitionEntered(TransitionState.Idle())).toBe(false);
				expect(
					isTransitionEntered(TransitionState.Entering({ element: el }))
				).toBe(false);
				expect(
					isTransitionEntered(TransitionState.Exiting({ element: el }))
				).toBe(false);
				expect(isTransitionEntered(TransitionState.Exited())).toBe(false);
			});
		});

		describe('isTransitionExiting', () => {
			it('should return true for Exiting state', () => {
				const el = document.createElement('div');
				expect(
					isTransitionExiting(TransitionState.Exiting({ element: el }))
				).toBe(true);
			});

			it('should return false for other states', () => {
				const el = document.createElement('div');
				expect(isTransitionExiting(TransitionState.Idle())).toBe(false);
				expect(
					isTransitionExiting(TransitionState.Entering({ element: el }))
				).toBe(false);
				expect(
					isTransitionExiting(TransitionState.Entered({ element: el }))
				).toBe(false);
				expect(isTransitionExiting(TransitionState.Exited())).toBe(false);
			});
		});

		describe('isTransitionExited', () => {
			it('should return true for Exited state', () => {
				expect(isTransitionExited(TransitionState.Exited())).toBe(true);
			});

			it('should return false for other states', () => {
				const el = document.createElement('div');
				expect(isTransitionExited(TransitionState.Idle())).toBe(false);
				expect(
					isTransitionExited(TransitionState.Entering({ element: el }))
				).toBe(false);
				expect(
					isTransitionExited(TransitionState.Entered({ element: el }))
				).toBe(false);
				expect(
					isTransitionExited(TransitionState.Exiting({ element: el }))
				).toBe(false);
			});
		});
	});

	describe('matchTransitionState ($match)', () => {
		it('should call Idle handler', () => {
			const result = matchTransitionState(TransitionState.Idle(), {
				Idle: () => 'idle-result',
				Entering: () => 'entering-result',
				Entered: () => 'entered-result',
				Exiting: () => 'exiting-result',
				Exited: () => 'exited-result',
			});
			expect(result).toBe('idle-result');
		});

		it('should call Entering handler with element access', () => {
			const el = document.createElement('div');
			el.id = 'test-element';
			const result = matchTransitionState(
				TransitionState.Entering({ element: el }),
				{
					Idle: () => null,
					Entering: ({ element }) => element.id,
					Entered: () => null,
					Exiting: () => null,
					Exited: () => null,
				}
			);
			expect(result).toBe('test-element');
		});

		it('should call Entered handler with element access', () => {
			const el = document.createElement('span');
			el.className = 'active';
			const result = matchTransitionState(
				TransitionState.Entered({ element: el }),
				{
					Idle: () => null,
					Entering: () => null,
					Entered: ({ element }) => element.className,
					Exiting: () => null,
					Exited: () => null,
				}
			);
			expect(result).toBe('active');
		});

		it('should call Exiting handler', () => {
			const el = document.createElement('div');
			const result = matchTransitionState(
				TransitionState.Exiting({ element: el }),
				{
					Idle: () => 'idle',
					Entering: () => 'entering',
					Entered: () => 'entered',
					Exiting: () => 'exiting',
					Exited: () => 'exited',
				}
			);
			expect(result).toBe('exiting');
		});

		it('should call Exited handler', () => {
			const result = matchTransitionState(TransitionState.Exited(), {
				Idle: () => 'idle',
				Entering: () => 'entering',
				Entered: () => 'entered',
				Exiting: () => 'exiting',
				Exited: () => 'exited',
			});
			expect(result).toBe('exited');
		});

		it('should support complex return types', () => {
			const el = document.createElement('div');
			const result = matchTransitionState(
				TransitionState.Entering({ element: el }),
				{
					Idle: () => ({ phase: 'idle', progress: 0 }),
					Entering: () => ({ phase: 'entering', progress: 0.5 }),
					Entered: () => ({ phase: 'entered', progress: 1 }),
					Exiting: () => ({ phase: 'exiting', progress: 0.5 }),
					Exited: () => ({ phase: 'exited', progress: 0 }),
				}
			);
			expect(result).toEqual({ phase: 'entering', progress: 0.5 });
		});
	});

	describe('Edge Cases', () => {
		it('should handle state filtering', () => {
			const el = document.createElement('div');
			const states = [
				TransitionState.Idle(),
				TransitionState.Entering({ element: el }),
				TransitionState.Entered({ element: el }),
				TransitionState.Exiting({ element: el }),
				TransitionState.Exited(),
			];

			const activeStates = states.filter(
				(s) => isTransitionEntering(s) || isTransitionExiting(s)
			);
			expect(activeStates).toHaveLength(2);
		});

		it('should handle state machine transitions', () => {
			const el = document.createElement('div');
			let state:
				| ReturnType<typeof TransitionState.Idle>
				| ReturnType<typeof TransitionState.Entering>
				| ReturnType<typeof TransitionState.Entered>
				| ReturnType<typeof TransitionState.Exiting>
				| ReturnType<typeof TransitionState.Exited> = TransitionState.Idle();

			expect(isTransitionIdle(state)).toBe(true);

			state = TransitionState.Entering({ element: el });
			expect(isTransitionEntering(state)).toBe(true);

			state = TransitionState.Entered({ element: el });
			expect(isTransitionEntered(state)).toBe(true);

			state = TransitionState.Exiting({ element: el });
			expect(isTransitionExiting(state)).toBe(true);

			state = TransitionState.Exited();
			expect(isTransitionExited(state)).toBe(true);
		});

		it('should handle rapid type checks', () => {
			const el = document.createElement('div');
			const state = TransitionState.Entering({ element: el });

			for (let i = 0; i < 1000; i++) {
				expect(isTransitionEntering(state)).toBe(true);
				expect(isTransitionIdle(state)).toBe(false);
			}
		});
	});
});

describe('TransitionMode TaggedEnum', () => {
	describe('Constructors', () => {
		it('should create Default mode', () => {
			const mode = TransitionMode.Default();
			expect(mode._tag).toBe('Default');
		});

		it('should create OutIn mode', () => {
			const mode = TransitionMode.OutIn();
			expect(mode._tag).toBe('OutIn');
		});

		it('should create InOut mode', () => {
			const mode = TransitionMode.InOut();
			expect(mode._tag).toBe('InOut');
		});
	});

	describe('$is type guards', () => {
		it('should identify Default mode', () => {
			const mode = TransitionMode.Default();
			expect(TransitionMode.$is('Default')(mode)).toBe(true);
			expect(TransitionMode.$is('OutIn')(mode)).toBe(false);
			expect(TransitionMode.$is('InOut')(mode)).toBe(false);
		});

		it('should identify OutIn mode', () => {
			const mode = TransitionMode.OutIn();
			expect(TransitionMode.$is('OutIn')(mode)).toBe(true);
			expect(TransitionMode.$is('Default')(mode)).toBe(false);
			expect(TransitionMode.$is('InOut')(mode)).toBe(false);
		});

		it('should identify InOut mode', () => {
			const mode = TransitionMode.InOut();
			expect(TransitionMode.$is('InOut')(mode)).toBe(true);
			expect(TransitionMode.$is('Default')(mode)).toBe(false);
			expect(TransitionMode.$is('OutIn')(mode)).toBe(false);
		});
	});

	describe('$match pattern matching', () => {
		it('should match Default mode', () => {
			const result = TransitionMode.$match(TransitionMode.Default(), {
				Default: () => 'default-behavior',
				OutIn: () => 'out-in-behavior',
				InOut: () => 'in-out-behavior',
			});
			expect(result).toBe('default-behavior');
		});

		it('should match OutIn mode', () => {
			const result = TransitionMode.$match(TransitionMode.OutIn(), {
				Default: () => 'default-behavior',
				OutIn: () => 'out-in-behavior',
				InOut: () => 'in-out-behavior',
			});
			expect(result).toBe('out-in-behavior');
		});

		it('should match InOut mode', () => {
			const result = TransitionMode.$match(TransitionMode.InOut(), {
				Default: () => 'default-behavior',
				OutIn: () => 'out-in-behavior',
				InOut: () => 'in-out-behavior',
			});
			expect(result).toBe('in-out-behavior');
		});

		it('should support complex handlers', () => {
			const mode = TransitionMode.OutIn();
			const result = TransitionMode.$match(mode, {
				Default: () => ({ sequence: ['replace'] }),
				OutIn: () => ({ sequence: ['exit-current', 'enter-new'] }),
				InOut: () => ({ sequence: ['enter-new', 'exit-current'] }),
			});
			expect(result).toEqual({ sequence: ['exit-current', 'enter-new'] });
		});
	});

	describe('Edge Cases', () => {
		it('should work in conditional logic', () => {
			const modes = [
				TransitionMode.Default(),
				TransitionMode.OutIn(),
				TransitionMode.InOut(),
			];

			const descriptions = modes.map((mode) =>
				TransitionMode.$match(mode, {
					Default: () => 'Instant replacement',
					OutIn: () => 'Exit first, then enter',
					InOut: () => 'Enter first, then exit',
				})
			);

			expect(descriptions).toEqual([
				'Instant replacement',
				'Exit first, then enter',
				'Enter first, then exit',
			]);
		});
	});
});

describe('TransitionError', () => {
	it('should be an instance of Error', () => {
		const error = new TransitionError({
			phase: 'enter',
			element: null,
			cause: new Error('Animation failed'),
		});
		expect(error).toBeInstanceOf(Error);
	});

	it('should have _tag property', () => {
		const error = new TransitionError({
			phase: 'exit',
			element: null,
			cause: 'Timeout',
		});
		expect(error._tag).toBe('TransitionError');
	});

	it('should store phase property', () => {
		const enterError = new TransitionError({
			phase: 'enter',
			element: null,
			cause: null,
		});
		const exitError = new TransitionError({
			phase: 'exit',
			element: null,
			cause: null,
		});
		expect(enterError.phase).toBe('enter');
		expect(exitError.phase).toBe('exit');
	});

	it('should store element property', () => {
		const el = document.createElement('div');
		const error = new TransitionError({
			phase: 'enter',
			element: el,
			cause: null,
		});
		expect(error.element).toBe(el);
	});

	it('should store null element', () => {
		const error = new TransitionError({
			phase: 'enter',
			element: null,
			cause: null,
		});
		expect(error.element).toBeNull();
	});

	it('should store cause property', () => {
		const cause = new Error('Original error');
		const error = new TransitionError({
			phase: 'exit',
			element: null,
			cause,
		});
		expect(error.cause).toBe(cause);
	});

	it('should support various cause types', () => {
		const causes = ['string error', 42, { code: 'ANIM_FAIL' }, null];
		for (const cause of causes) {
			const error = new TransitionError({
				phase: 'enter',
				element: null,
				cause,
			});
			expect(error.cause).toBe(cause);
		}
	});

	it('should be usable in error handling patterns', () => {
		const handleError = (err: unknown): string => {
			if (err instanceof TransitionError) {
				return `Transition ${err.phase} failed`;
			}
			return 'Unknown error';
		};

		const error = new TransitionError({
			phase: 'enter',
			element: null,
			cause: 'test',
		});
		expect(handleError(error)).toBe('Transition enter failed');
		expect(handleError(new Error('other'))).toBe('Unknown error');
	});
});

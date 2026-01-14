/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Effect, Ref, Option, pipe, HashMap } from 'effect';

type ContextStack = HashMap.HashMap<string, readonly unknown[]>;

interface ContextRegistryService {
	readonly push: (id: string, value: unknown) => Effect.Effect<void>;
	readonly pop: (id: string) => Effect.Effect<void>;
	readonly get: <T>(id: string) => Effect.Effect<Option.Option<T>>;
	readonly has: (id: string) => Effect.Effect<boolean>;
	readonly getAll: () => Effect.Effect<readonly string[]>;
	readonly clear: () => Effect.Effect<void>;
}

const makeContextRegistry = Effect.gen(function* () {
	const stackRef = yield* Ref.make<ContextStack>(HashMap.empty());

	const push = (id: string, value: unknown): Effect.Effect<void> =>
		Ref.update(stackRef, (stacks) => {
			const current = pipe(
				HashMap.get(stacks, id),
				Option.getOrElse(() => [] as readonly unknown[])
			);
			return HashMap.set(stacks, id, [...current, value]);
		});

	const pop = (id: string): Effect.Effect<void> =>
		Ref.update(stackRef, (stacks) =>
			pipe(
				HashMap.get(stacks, id),
				Option.match({
					onNone: () => stacks,
					onSome: (stack) => {
						const newStack = stack.slice(0, -1);
						return newStack.length === 0
							? HashMap.remove(stacks, id)
							: HashMap.set(stacks, id, newStack);
					},
				})
			)
		);

	const get = <T>(id: string): Effect.Effect<Option.Option<T>> =>
		Ref.get(stackRef).pipe(
			Effect.map((stacks) =>
				pipe(
					HashMap.get(stacks, id),
					Option.flatMap((stack) =>
						stack.length > 0
							? Option.some(stack[stack.length - 1] as T)
							: Option.none()
					)
				)
			)
		);

	const has = (id: string): Effect.Effect<boolean> =>
		Ref.get(stackRef).pipe(
			Effect.map((stacks) =>
				pipe(
					HashMap.get(stacks, id),
					Option.match({
						onNone: () => false,
						onSome: (stack) => stack.length > 0,
					})
				)
			)
		);

	const getAll = (): Effect.Effect<readonly string[]> =>
		Ref.get(stackRef).pipe(
			Effect.map((stacks) => Array.from(HashMap.keys(stacks)))
		);

	const clear = (): Effect.Effect<void> => Ref.set(stackRef, HashMap.empty());

	return {
		push,
		pop,
		get,
		has,
		getAll,
		clear,
	} satisfies ContextRegistryService;
});

export { makeContextRegistry };

let globalRegistry: ContextRegistryService | null = null;

const initializeRegistry = (): ContextRegistryService => {
	if (!globalRegistry) {
		globalRegistry = Effect.runSync(makeContextRegistry);
	}
	return globalRegistry;
};

export const pushContext = (id: string, value: unknown): void => {
	Effect.runSync(initializeRegistry().push(id, value));
};

export const popContext = (id: string): void => {
	Effect.runSync(initializeRegistry().pop(id));
};

export const getContext = <T>(id: string): Option.Option<T> => {
	return Effect.runSync(initializeRegistry().get<T>(id));
};

export const hasContext = (id: string): boolean => {
	return Effect.runSync(initializeRegistry().has(id));
};

export const getRegisteredContexts = (): readonly string[] => {
	return Effect.runSync(initializeRegistry().getAll());
};

export const clearAllContexts = (): void => {
	Effect.runSync(initializeRegistry().clear());
	globalRegistry = null;
};

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

import { Predicate } from 'effect';
import type {
	BlueprintDef,
	BlueprintContext,
	EffuseChild,
	Component,
} from '../render/node.js';
import type { ScriptContext, ExposedValues } from './script-context.js';
import { createScriptContext, runMountCallbacks } from './script-context.js';
import type { ComponentLifecycle } from './lifecycle.js';
import {
	LifecycleError,
	reportLifecycleError,
	withActiveLifecycle,
} from './lifecycle.js';
import {
	assertLayerBindingsRegistered,
	type LayerSource,
} from '../layers/api/layersAccessor.js';
import {
	createProvideScope,
	runWithProvideScope,
	getCurrentProvideScope,
	type ProvideScope,
} from './provide-inject.js';
import type {
	AnyPropSchemaBuilder,
	PropSchemaBuilder,
	PropSchemaInput,
	PropSchemaOutput,
} from './props.js';
import { PropsSchemaConflictError } from './props.js';
import { devWarn } from '../utils/dev-warnings.js';

export type TemplateArgs<E extends ExposedValues> = E & {
	readonly children?: EffuseChild;
};

declare const DEFINE_PROPS_TYPE: unique symbol;
declare const DEFINE_PROPS_INPUT: unique symbol;

/** A type-only props declaration produced by defineProps(). */
export interface DefinePropsDeclaration<P, Input = P> {
	readonly [DEFINE_PROPS_TYPE]: P;
	readonly [DEFINE_PROPS_INPUT]: Input;
	readonly schema?: PropSchemaBuilder<
		P & Record<string, unknown>,
		Input & Record<string, unknown>
	>;
}

function isPropsDeclaration(
	value: unknown
): value is DefinePropsDeclaration<unknown> {
	return (
		Predicate.isObject(value) &&
		Object.getOwnPropertyDescriptor(value, Symbol.for('effuse.defineProps'))
			?.value === true
	);
}

export type TemplateReservedKey = 'props' | 'exposed' | 'children';

type ExplicitKeys<T> = string extends keyof T
	? never
	: number extends keyof T
		? never
		: symbol extends keyof T
			? never
			: keyof T;

type FlatExposedValues<E extends ExposedValues, P> = Omit<
	E,
	ExplicitKeys<P> | TemplateReservedKey
>;

type FlatPropValues<E extends ExposedValues, P> = Omit<
	Readonly<P>,
	ExplicitKeys<E> | TemplateReservedKey
>;

/**
 * Template values with explicit ownership and compatibility-safe flat access.
 * Keys shared by props and exposed values, plus reserved context keys, are
 * available only through their `props` or `exposed` namespace.
 */
export type TemplateContext<E extends ExposedValues, P> = FlatExposedValues<
	E,
	P
> &
	FlatPropValues<E, P> & {
		readonly props: Readonly<P>;
		readonly exposed: Readonly<E>;
		readonly children?: EffuseChild;
	};

const TEMPLATE_RESERVED_KEYS = new Set<TemplateReservedKey>([
	'props',
	'exposed',
	'children',
]);

export interface DefineOptionsWithInferredProps<
	P,
	E extends ExposedValues,
	L extends LayerSource = readonly never[],
> {
	name?: string;
	props: P;
	propsSchema?: AnyPropSchemaBuilder;
	layers?: L;
	script: (ctx: ScriptContext<P, L>) => E | undefined;
	template: (ctx: TemplateContext<E, P>) => EffuseChild;
	/** HMR module identifier — injected by the Vite dev plugin. */
	__hmrId?: string;
}

export interface DefineOptionsWithDeclaredProps<
	P,
	E extends ExposedValues,
	L extends LayerSource = readonly never[],
	Input = P,
> {
	name?: string;
	props: DefinePropsDeclaration<P, Input>;
	propsSchema?: AnyPropSchemaBuilder;
	layers?: L;
	script: (ctx: ScriptContext<P, L>) => E | undefined;
	template: (ctx: TemplateContext<E, P>) => EffuseChild;
	/** HMR module identifier — injected by the Vite dev plugin. */
	__hmrId?: string;
}

export interface DefineOptions<
	P,
	E extends ExposedValues,
	L extends LayerSource = readonly never[],
> {
	name?: string;
	props?: undefined;
	propsSchema?: AnyPropSchemaBuilder;
	layers?: L;
	script: (ctx: ScriptContext<P, L>) => E | undefined;
	template: (ctx: TemplateContext<E, P>) => EffuseChild;
	/** HMR module identifier — injected by the Vite dev plugin. */
	__hmrId?: string;
}

interface DefineState<E extends ExposedValues, P> {
	exposed: E;
	lifecycle: ComponentLifecycle;
	updateProps: (props: Record<string, unknown>) => void;
	_template: (ctx: TemplateContext<E, P>) => EffuseChild;
	/** Reactive props proxy created by script context. */
	_reactiveProps?: Readonly<Record<string, unknown>>;
	/** Provide scope for component-level provide/inject. */
	_provideScope?: ProvideScope;
	/** Keys already reported by the template-context collision diagnostic. */
	_templateWarnings: Set<PropertyKey>;
	[key: string]: unknown;
}

const createTemplateContext = <E extends ExposedValues, P>(
	componentName: string,
	state: DefineState<E, P>,
	props: Readonly<Record<string, unknown>>,
	children: EffuseChild | undefined
): TemplateContext<E, P> => {
	const exposed = state.exposed as Record<PropertyKey, unknown>;
	const propValues = props as Readonly<Record<PropertyKey, unknown>>;
	const exposedKeys = Reflect.ownKeys(exposed).filter((key) =>
		Object.prototype.propertyIsEnumerable.call(exposed, key)
	);
	const propKeys = Reflect.ownKeys(propValues).filter((key) =>
		Object.prototype.propertyIsEnumerable.call(propValues, key)
	);
	const exposedKeySet = new Set(exposedKeys);
	const propKeySet = new Set(propKeys);
	const ambiguousKeys = new Set<PropertyKey>();
	const diagnosticKeys = new Set<PropertyKey>();

	for (const key of exposedKeys) {
		if (
			propKeySet.has(key) ||
			TEMPLATE_RESERVED_KEYS.has(key as TemplateReservedKey)
		) {
			ambiguousKeys.add(key);
			diagnosticKeys.add(key);
		}
	}
	for (const key of propKeys) {
		if (
			exposedKeySet.has(key) ||
			TEMPLATE_RESERVED_KEYS.has(key as TemplateReservedKey)
		) {
			ambiguousKeys.add(key);
			if (key !== 'children') diagnosticKeys.add(key);
		}
	}

	const flatValues: Record<PropertyKey, unknown> = {};
	for (const key of exposedKeys) {
		if (!ambiguousKeys.has(key)) flatValues[key] = exposed[key];
	}
	for (const key of propKeys) {
		if (!ambiguousKeys.has(key)) flatValues[key] = propValues[key];
	}

	const newWarnings = [...diagnosticKeys].filter(
		(key) => !state._templateWarnings.has(key)
	);
	if (newWarnings.length > 0) {
		for (const key of newWarnings) state._templateWarnings.add(key);
		const label = (key: PropertyKey): string =>
			typeof key === 'symbol' ? String(key) : `"${key}"`;
		const accessorFor = (namespace: 'props' | 'exposed', key: PropertyKey) =>
			typeof key === 'symbol'
				? `ctx.${namespace}[${String(key)}]`
				: `ctx.${namespace}.${key}`;
		const describe = (key: PropertyKey): string =>
			TEMPLATE_RESERVED_KEYS.has(key as TemplateReservedKey)
				? `${label(key)} is a reserved template namespace; read your value as ${accessorFor(
						'props',
						key
					)} or ${accessorFor('exposed', key)}`
				: `${label(key)} is supplied by both a prop and an exposed value; read them as ${accessorFor(
						'props',
						key
					)} and ${accessorFor('exposed', key)}`;
		const keys = newWarnings.map(label);
		devWarn(
			`Component "${componentName}" cannot flatten template ${
				newWarnings.length === 1 ? 'key' : 'keys'
			} ${keys.join(', ')}. ${newWarnings
				.map(describe)
				.join(' ')} ctx.children remains rendered child content.`
		);
	}

	return {
		...flatValues,
		props,
		exposed: state.exposed,
		children,
	} as TemplateContext<E, P>;
};

export function define<
	P,
	E extends ExposedValues = ExposedValues,
	L extends LayerSource = readonly never[],
	Input = P,
>(options: DefineOptionsWithDeclaredProps<P, E, L, Input>): Component<P, Input>;
export function define<
	P extends Record<string, unknown>,
	E extends ExposedValues = ExposedValues,
	L extends LayerSource = readonly never[],
>(options: DefineOptionsWithInferredProps<P, E, L>): Component<Partial<P>>;
export function define<
	P = Record<string, unknown>,
	E extends ExposedValues = ExposedValues,
	L extends LayerSource = readonly never[],
>(options: DefineOptions<P, E, L>): Component<P>;
export function define<P, E extends ExposedValues, L extends LayerSource>(
	options:
		| DefineOptions<P, E, L>
		| DefineOptionsWithDeclaredProps<P, E, L>
		| DefineOptionsWithInferredProps<P & Record<string, unknown>, E, L>
): Component<P> {
	const componentName = options.name ?? 'anonymous';
	const declaredProps = isPropsDeclaration(options.props);
	const defaults =
		options.props && !declaredProps
			? (options.props as Record<string, unknown>)
			: undefined;
	const declarationSchema = declaredProps
		? (options.props as DefinePropsDeclaration<P, unknown>).schema
		: undefined;
	if (
		declarationSchema &&
		options.propsSchema &&
		declarationSchema !== options.propsSchema
	) {
		throw new PropsSchemaConflictError({ componentName });
	}
	const propsSchema = (declarationSchema ?? options.propsSchema) as
		| PropSchemaBuilder<Record<string, unknown>>
		| undefined;
	const resolveProps = (props: unknown): P => {
		const incoming = Predicate.isObject(props) ? props : {};
		const merged = defaults ? { ...defaults, ...incoming } : incoming;
		return (
			propsSchema ? propsSchema.validateSync(merged, componentName) : merged
		) as P;
	};

	const blueprint: Record<string, unknown> & BlueprintDef<P> = {
		_tag: 'Blueprint',
		name: (options as { name?: string }).name,
		__hmrId: (options as { __hmrId?: string }).__hmrId,

		state: (props: P) => {
			const resolvedProps = resolveProps(props);
			const layers = (options as { layers?: L }).layers;
			const { context, state } = createScriptContext<P, E, L>(
				resolvedProps,
				undefined,
				layers
			);
			assertLayerBindingsRegistered((layers ?? []) as L, {
				kind: 'component',
				name: componentName,
			});

			const parentScope = getCurrentProvideScope();
			const provideScope = createProvideScope(parentScope);

			let scriptResult: E | undefined;
			try {
				scriptResult = runWithProvideScope(provideScope, () =>
					withActiveLifecycle(state.lifecycle, () =>
						(options.script as (ctx: ScriptContext<P, L>) => E | undefined)(
							context
						)
					)
				);
			} catch (error) {
				try {
					state.lifecycle.runCleanup();
				} catch (cleanupError) {
					throw new AggregateError(
						[error, cleanupError],
						`[Effuse] Component "${componentName}" setup and cleanup both failed.`
					);
				}
				throw error;
			}

			if (Predicate.isNotNullable(scriptResult)) {
				Object.assign(state.exposed, scriptResult);
			}

			if (typeof document !== 'undefined') {
				queueMicrotask(() => {
					try {
						runMountCallbacks(state);
					} catch (error) {
						if (error instanceof LifecycleError) {
							reportLifecycleError(error, provideScope.lifecycleErrorHandler);
							return;
						}
						throw error;
					}
				});
			}

			return {
				exposed: state.exposed,
				lifecycle: state.lifecycle,
				updateProps: (nextProps: Record<string, unknown>) =>
					state.updateProps(resolveProps(nextProps) as Record<string, unknown>),
				_template: options.template,
				_reactiveProps: context.props as Readonly<Record<string, unknown>>,
				_provideScope: provideScope,
				_templateWarnings: new Set<PropertyKey>(),
			} as unknown as Record<string, unknown>;
		},

		view: (ctx: BlueprintContext<P>) => {
			const state = ctx.state as DefineState<E, P>;
			const props = (state._reactiveProps ?? ctx.props) as Readonly<
				Record<string, unknown>
			>;
			const children = ((ctx.props as Record<string, unknown>).children ??
				props.children) as EffuseChild | undefined;
			return state._template(
				createTemplateContext<E, P>(componentName, state, props, children)
			);
		},
	};

	// Component<P> adds a callable signature to BlueprintDef<P>; at runtime
	// JSX treats this as a blueprint, so the cast bridges the type gap.
	return blueprint as unknown as Component<P>;
}

export type InferExposed<D> =
	D extends DefineOptions<unknown, infer E> ? E : never;

export type InferProps<D> =
	D extends DefineOptionsWithDeclaredProps<infer P, ExposedValues>
		? P
		: D extends DefineOptionsWithInferredProps<infer P, ExposedValues>
			? P
			: D extends DefineOptions<infer P, ExposedValues>
				? P
				: never;

/**
 * Declares component props without dummy runtime values.
 *
 * Pass a PropSchema builder to infer optional caller inputs separately from
 * decoded props available to script and template. The generic-only form remains
 * available for declarations that do not need runtime validation.
 *
 * @example
 * ```ts
 * const Comp = define({
 *   props: defineProps<{ name: string; count: number }>(),
 *   script: ({ props }) => { … },
 *   template: (ctx) => <div>{ctx.name}</div>,
 * });
 * ```
 *
 * @example
 * ```ts
 * const schema = PropSchema.struct({
 *   name: PropSchema.required(PropSchema.String),
 *   role: PropSchema.optional(PropSchema.String, 'member'),
 * });
 * const Comp = define({
 *   props: defineProps(schema),
 *   script: ({ props }) => ({ label: `${props.name}:${props.role}` }),
 *   template: ({ label }) => label,
 * });
 * // Comp({ name: 'Effuse' }); role is optional here and string inside Comp.
 * ```
 */
export function defineProps<P>(): DefinePropsDeclaration<P>;
export function defineProps<S extends AnyPropSchemaBuilder>(
	schema: S
): DefinePropsDeclaration<PropSchemaOutput<S>, PropSchemaInput<S>>;
export function defineProps(
	schema?: AnyPropSchemaBuilder
): DefinePropsDeclaration<Record<string, unknown>, Record<string, unknown>> {
	const declaration = {};
	Object.defineProperty(declaration, Symbol.for('effuse.defineProps'), {
		value: true,
	});
	if (schema) {
		Object.defineProperty(declaration, 'schema', { value: schema });
	}
	return declaration as DefinePropsDeclaration<
		Record<string, unknown>,
		Record<string, unknown>
	>;
}

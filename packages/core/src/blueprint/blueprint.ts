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

import type { Signal } from '../types/index.js';
import type {
	BlueprintDef,
	BlueprintContext,
	EffuseChild,
	Portals,
} from '../render/node.js';
import type { PropSchemaBuilder } from './props.js';

export type PropsDef<P> = {
	[K in keyof P]?: P[K] | (() => P[K]);
};

export interface BlueprintOptions<
	P extends Record<string, unknown> = Record<string, unknown>,
> {
	readonly name?: string;
	readonly props?: PropsDef<P>;
	readonly propsSchema?: PropSchemaBuilder<P>;
	readonly state?: (props: P) => Record<string, Signal<unknown>>;
	readonly view: (context: BlueprintContext<P>) => EffuseChild;
	readonly error?: (error: Error) => EffuseChild;
	readonly loading?: () => EffuseChild;
}

// Build blueprint definition
export const blueprint = <
	P extends Record<string, unknown> = Record<string, unknown>,
>(
	options: BlueprintOptions<P>
): BlueprintDef<P> => {
	const def: BlueprintDef<P> = {
		_tag: 'Blueprint',
		name: options.name,
		view: options.view,
	};

	const mutableDef = def as unknown as Record<string, unknown>;
	if (options.state) {
		mutableDef.state = options.state;
	}
	if (options.error) {
		mutableDef.error = options.error;
	}
	if (options.loading) {
		mutableDef.loading = options.loading;
	}
	if (options.propsSchema) {
		mutableDef.propsSchema = options.propsSchema;
	}

	return def;
};

// Verify blueprint definition
export const isBlueprint = (value: unknown): value is BlueprintDef => {
	return (
		typeof value === 'object' &&
		value !== null &&
		'_tag' in value &&
		(value as Record<string, unknown>)._tag === 'Blueprint'
	);
};

// Initialize blueprint context
export const instantiateBlueprint = <P extends Record<string, unknown>>(
	def: BlueprintDef<P>,
	props: P,
	portals: Portals
): BlueprintContext<P> => {
	let validatedProps = props;

	const defWithSchema = def as unknown as {
		propsSchema?: PropSchemaBuilder<P>;
	};
	if (defWithSchema.propsSchema) {
		validatedProps = defWithSchema.propsSchema.validateSync(props, def.name);
	}

	const state = def.state ? def.state(validatedProps) : {};

	return {
		props: validatedProps,
		state,
		portals,
	};
};

// Build anonymous blueprint
export const view = (
	render: () => EffuseChild
): BlueprintDef<Record<string, never>> => {
	return blueprint({
		view: render,
	});
};

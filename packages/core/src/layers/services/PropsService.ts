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

import { Effect } from 'effect';
import type { LayerProps } from '../types.js';

export interface PropsRegistry {
	readonly props: Map<string, LayerProps>;
	get: (layerName: string) => LayerProps | undefined;
	set: (layerName: string, props: LayerProps) => void;
	has: (layerName: string) => boolean;
}

const createPropsRegistry = (): PropsRegistry => {
	const props = new Map<string, LayerProps>();

	return {
		props,
		get: (layerName) => props.get(layerName),
		set: (layerName, layerProps) => props.set(layerName, layerProps),
		has: (layerName) => props.has(layerName),
	};
};

export class PropsService extends Effect.Service<PropsService>()(
	'effuse/layer/Props',
	{
		effect: Effect.succeed(createPropsRegistry()),
	}
) {}

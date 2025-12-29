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

import { Data } from 'effect';

export class LayerNotFoundError extends Data.TaggedError('LayerNotFoundError')<{
	readonly layerName: string;
}> {
	get message(): string {
		return `[Effuse] Layer "${this.layerName}" not found.`;
	}
}

export class LayerRuntimeNotReadyError extends Data.TaggedError(
	'LayerRuntimeNotReadyError'
)<{
	readonly layerName: string;
}> {
	get message(): string {
		return (
			`[Effuse] Layer runtime not ready. Cannot access layer "${this.layerName}". ` +
			'Ensure the app is mounted with useLayers() before components render.'
		);
	}
}

export class LayerRuntimeNotInitializedError extends Data.TaggedError(
	'LayerRuntimeNotInitializedError'
)<{
	readonly resource: string;
}> {
	get message(): string {
		return `[Effuse] Layer runtime not initialized. Cannot access ${this.resource}.`;
	}
}

export class ServiceNotFoundError extends Data.TaggedError(
	'ServiceNotFoundError'
)<{
	readonly serviceKey: string;
}> {
	get message(): string {
		return `[Effuse] Service "${this.serviceKey}" not found.`;
	}
}

export class DependencyNotFoundError extends Data.TaggedError(
	'DependencyNotFoundError'
)<{
	readonly layerName: string;
	readonly dependencyName: string;
}> {
	get message(): string {
		return `[Effuse] Layer "${this.dependencyName}" not found as dependency of "${this.layerName}"`;
	}
}

export class CircularDependencyError extends Data.TaggedError(
	'CircularDependencyError'
)<{
	readonly layerName: string;
	readonly dependencyChain: readonly string[];
}> {
	get message(): string {
		return `[Effuse] Circular dependency detected: ${[...this.dependencyChain, this.layerName].join(' -> ')}`;
	}
}

export class RouterNotConfiguredError extends Data.TaggedError(
	'RouterNotConfiguredError'
)<{
	readonly _tag: 'RouterNotConfiguredError';
}> {
	override get message(): string {
		return '[Effuse] Router not configured. Call setGlobalRouter().';
	}
}

export type LayerError =
	| LayerNotFoundError
	| LayerRuntimeNotReadyError
	| LayerRuntimeNotInitializedError
	| ServiceNotFoundError
	| DependencyNotFoundError
	| CircularDependencyError
	| RouterNotConfiguredError;

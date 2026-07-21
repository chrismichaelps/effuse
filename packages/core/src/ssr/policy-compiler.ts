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

import type {
	AnyResolvedLayer,
	HttpMethod,
	ServerPolicy,
} from '../layers/types.js';
import {
	resolveLayerDefinitions,
	type LayerInputSource,
} from '../layers/api/defineLayer.js';
import { createLayerActionPath } from './actions.js';
import {
	foldServerPolicy,
	type PolicyProvenanceEntry,
	type PolicySource,
} from './policy-merge.js';
import {
	getLayerServerActionEntries,
	getLayerServerRouteEntries,
	getServerRouteMethods,
	type ServerMetadataDiagnostic,
} from './server-routes.js';

export interface CompiledServerRoute {
	readonly layer: string;
	readonly path: string;
	readonly methods: readonly HttpMethod[];
	readonly policy: ServerPolicy;
	readonly provenance: readonly PolicyProvenanceEntry[];
	readonly diagnostics?: readonly ServerMetadataDiagnostic[];
}

export interface CompiledServerAction {
	readonly layer: string;
	readonly name: string;
	readonly method: 'POST';
	readonly path: string;
	readonly policy: ServerPolicy;
	readonly provenance: readonly PolicyProvenanceEntry[];
	readonly diagnostics?: readonly ServerMetadataDiagnostic[];
}

export interface CompiledServerManifest {
	readonly routes: readonly CompiledServerRoute[];
	readonly actions: readonly CompiledServerAction[];
	readonly diagnostics: readonly ServerMetadataDiagnostic[];
}

/**
 * Order a layer's policy ancestors least-specific first: extended parents, then
 * dependencies (dependency-topological, deps before dependents), then the layer
 * itself. Mirrors the middleware inheritance order in `server-routing.ts` so
 * policy and middleware inherit through the same chain.
 */
const collectLayerSources = (
	byName: ReadonlyMap<string, AnyResolvedLayer>,
	target: AnyResolvedLayer
): readonly PolicySource[] => {
	const sources: PolicySource[] = [];
	const parentSeen = new Set<string>();
	const depSeen = new Set<string>();

	const addParents = (layer: AnyResolvedLayer): void => {
		for (const parent of (layer.extends ?? []) as readonly AnyResolvedLayer[]) {
			if (parentSeen.has(parent.name)) {
				continue;
			}
			parentSeen.add(parent.name);
			addParents(parent);
			sources.push({
				kind: 'parent',
				name: parent.name,
				policy: parent.server?.metadata,
			});
		}
	};

	const addDeps = (layer: AnyResolvedLayer): void => {
		for (const depName of (layer.dependencies as
			| readonly string[]
			| undefined) ?? []) {
			const dep = byName.get(depName);
			if (!dep || depSeen.has(dep.name)) {
				continue;
			}
			depSeen.add(dep.name);
			addDeps(dep);
			sources.push({
				kind: 'dependency',
				name: dep.name,
				policy: dep.server?.metadata,
			});
		}
	};

	addParents(target);
	addDeps(target);
	sources.push({
		kind: 'layer',
		name: target.name,
		policy: target.server?.metadata,
	});
	return sources;
};

/**
 * Compile every route and action's effective server policy by folding the full
 * hierarchy (parents -> dependencies -> layer -> route). Returns one inspectable
 * manifest — the single artifact the dev server and production adapters read — with
 * per-endpoint effective policy, provenance, and override diagnostics.
 */
export const compileServerPolicyFromLayers = (
	layers: readonly AnyResolvedLayer[]
): CompiledServerManifest => {
	const byName = new Map(layers.map((layer) => [layer.name, layer]));
	const routes: CompiledServerRoute[] = [];
	const actions: CompiledServerAction[] = [];

	for (const layer of layers) {
		const layerSources = collectLayerSources(byName, layer);

		for (const entry of getLayerServerRouteEntries(layer)) {
			const folded = foldServerPolicy(entry.route.path, [
				...layerSources,
				{
					kind: 'route',
					name: entry.route.path,
					policy: entry.route.metadata,
				},
			]);
			routes.push({
				layer: layer.name,
				path: entry.route.path,
				methods: getServerRouteMethods(entry.route),
				policy: folded.policy,
				provenance: folded.provenance,
				...(folded.diagnostics.length > 0
					? { diagnostics: folded.diagnostics }
					: {}),
			});
		}

		for (const entry of getLayerServerActionEntries(layer)) {
			const folded = foldServerPolicy(entry.name, [
				...layerSources,
				{ kind: 'route', name: entry.name, policy: entry.action.metadata },
			]);
			actions.push({
				layer: layer.name,
				name: entry.name,
				method: 'POST',
				path: createLayerActionPath(layer, entry.name),
				policy: folded.policy,
				provenance: folded.provenance,
				...(folded.diagnostics.length > 0
					? { diagnostics: folded.diagnostics }
					: {}),
			});
		}
	}

	return {
		routes,
		actions,
		diagnostics: [
			...routes.flatMap((route) => route.diagnostics ?? []),
			...actions.flatMap((action) => action.diagnostics ?? []),
		],
	};
};

export const compileServerPolicy = (
	layers: LayerInputSource
): CompiledServerManifest =>
	compileServerPolicyFromLayers(resolveLayerDefinitions(layers));

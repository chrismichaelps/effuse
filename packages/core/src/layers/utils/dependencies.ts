import type { EffuseLayer } from '../types.js';

export const getLayerDependencyNames = (
	layer: Pick<EffuseLayer, 'dependencies' | 'extends'>
): readonly string[] => {
	const names: string[] = [];
	const seen = new Set<string>();
	const add = (name: string): void => {
		if (!seen.has(name)) {
			seen.add(name);
			names.push(name);
		}
	};

	for (const extended of layer.extends ?? []) {
		add(extended.name);
	}
	for (const dependency of layer.dependencies ?? []) {
		add(dependency);
	}

	return names;
};

import { describe, it, expect } from 'vitest';
import {
	jsx,
	jsxs,
	jsxDEV,
	Fragment,
	type FragmentComponent,
} from '../../jsx/runtime.js';
import { NodeType, EFFUSE_NODE } from '../../constants.js';
import { signal } from '../../reactivity/signal.js';
import type { FragmentNode, EffuseNode } from '../../render/node.js';

const isFragmentNode = (node: EffuseNode): node is FragmentNode =>
	node.type === NodeType.FRAGMENT;

describe('Fragment', () => {
	describe('Core Identity', () => {
		it('should be a callable function for JSX compatibility', () => {
			expect(typeof Fragment).toBe('function');
		});

		it('should have a unique _tag symbol for framework identification', () => {
			expect(Fragment._tag).toBeDefined();
			expect(typeof Fragment._tag).toBe('symbol');
		});

		it('should satisfy FragmentComponent interface', () => {
			const fragmentFn: FragmentComponent = Fragment;
			expect(fragmentFn).toBe(Fragment);
		});

		it('should produce valid FragmentNode when called directly', () => {
			const result = Fragment({ children: 'Direct call' });

			expect(isFragmentNode(result)).toBe(true);
			expect((result as FragmentNode).children).toEqual(['Direct call']);
		});

		it('should be distinguishable from regular component functions', () => {
			const regularComponent = (props: { children?: unknown }) =>
				jsx('div', { children: props.children });

			expect('_tag' in Fragment).toBe(true);
			expect('_tag' in regularComponent).toBe(false);
		});
	});

	describe('JSX Runtime Integration', () => {
		describe('jsx() function', () => {
			it('should create FragmentNode with empty children', () => {
				const result = jsx(Fragment, {});

				expect(isFragmentNode(result)).toBe(true);
				expect((result as FragmentNode).children).toEqual([]);
			});

			it('should handle single child element', () => {
				const child = jsx('span', { children: 'Hello' });
				const result = jsx(Fragment, { children: child });

				expect(isFragmentNode(result)).toBe(true);
				const fragmentNode = result as FragmentNode;
				expect(fragmentNode.children).toHaveLength(1);
				expect(fragmentNode.children[0]).toBe(child);
			});

			it('should handle multiple children array', () => {
				const children = [
					jsx('div', { key: '1' }),
					jsx('span', { key: '2' }),
					jsx('p', { key: '3' }),
				];
				const result = jsx(Fragment, { children });

				const fragmentNode = result as FragmentNode;
				expect(fragmentNode.children).toHaveLength(3);
				expect(fragmentNode.children).toEqual(children);
			});

			it('should handle string children', () => {
				const result = jsx(Fragment, { children: 'Text content' });

				const fragmentNode = result as FragmentNode;
				expect(fragmentNode.children).toEqual(['Text content']);
			});

			it('should handle number children', () => {
				const result = jsx(Fragment, { children: 42 });

				const fragmentNode = result as FragmentNode;
				expect(fragmentNode.children).toEqual([42]);
			});
		});

		describe('jsxs() function static children', () => {
			it('should handle static children arrays', () => {
				const result = jsxs(Fragment, {
					children: ['First', 'Second', 'Third'],
				});

				const fragmentNode = result as FragmentNode;
				expect(fragmentNode.type).toBe(NodeType.FRAGMENT);
				expect(fragmentNode.children).toEqual(['First', 'Second', 'Third']);
			});

			it('should behave identically to jsx()', () => {
				const children = [jsx('li', { key: 'a' }), jsx('li', { key: 'b' })];

				const jsxResult = jsx(Fragment, { children });
				const jsxsResult = jsxs(Fragment, { children });

				expect(jsxResult).toEqual(jsxsResult);
			});
		});

		describe('jsxDEV() function development mode', () => {
			it('should work in development mode', () => {
				const result = jsxDEV(Fragment, { children: 'Dev mode' });

				expect(isFragmentNode(result)).toBe(true);
				expect((result as FragmentNode).children).toEqual(['Dev mode']);
			});

			it('should handle key parameter in dev mode', () => {
				const result = jsxDEV(Fragment, { children: 'Keyed' }, 'dev-key');

				expect(isFragmentNode(result)).toBe(true);
				expect((result as FragmentNode).children).toEqual(['Keyed']);
			});
		});
	});

	describe('Child Normalization', () => {
		it('should filter null children', () => {
			const result = jsx(Fragment, { children: [null, 'valid', null] });

			const fragmentNode = result as FragmentNode;
			expect(fragmentNode.children).not.toContain(null);
			expect(fragmentNode.children).toContain('valid');
		});

		it('should filter undefined children', () => {
			const result = jsx(Fragment, {
				children: [undefined, 'visible', undefined],
			});

			const fragmentNode = result as FragmentNode;
			expect(fragmentNode.children).not.toContain(undefined);
			expect(fragmentNode.children).toContain('visible');
		});

		it('should filter boolean children false', () => {
			const result = jsx(Fragment, { children: [false, 'shown', false] });

			const fragmentNode = result as FragmentNode;
			expect(fragmentNode.children).not.toContain(false);
			expect(fragmentNode.children).toContain('shown');
		});

		it('should filter boolean children true', () => {
			const result = jsx(Fragment, { children: [true, 'display', true] });

			const fragmentNode = result as FragmentNode;
			expect(fragmentNode.children).not.toContain(true);
			expect(fragmentNode.children).toContain('display');
		});

		it('should preserve zero (0) as valid child', () => {
			const result = jsx(Fragment, { children: 0 });

			const fragmentNode = result as FragmentNode;
			expect(fragmentNode.children).toContain(0);
		});

		it('should preserve empty string as valid child', () => {
			const result = jsx(Fragment, { children: '' });

			const fragmentNode = result as FragmentNode;
			expect(fragmentNode.children).toContain('');
		});
	});

	describe('Nesting & Composition', () => {
		it('should support fragments nested inside fragments', () => {
			const inner = jsx(Fragment, { children: 'Inner content' });
			const outer = jsx(Fragment, { children: [inner, 'Outer content'] });

			const outerNode = outer as FragmentNode;
			expect(outerNode.children).toHaveLength(2);
			expect(outerNode.children[0]).toBe(inner);
		});

		it('should support deeply nested fragment structures', () => {
			const level3 = jsx(Fragment, { children: 'Deep' });
			const level2 = jsx(Fragment, { children: level3 });
			const level1 = jsx(Fragment, { children: level2 });

			expect(isFragmentNode(level1)).toBe(true);
			expect(
				isFragmentNode((level1 as FragmentNode).children[0] as EffuseNode)
			).toBe(true);
		});

		it('should support mixed element and fragment children', () => {
			const element = jsx('div', { children: 'Element' });
			const fragment = jsx(Fragment, { children: 'Fragment content' });

			const result = jsx(Fragment, { children: [element, fragment, 'Text'] });

			const fragmentNode = result as FragmentNode;
			expect(fragmentNode.children).toHaveLength(3);
		});
	});

	describe('Reactivity Integration', () => {
		it('should accept Signal as child', () => {
			const count = signal(0);
			const result = jsx(Fragment, { children: count });

			const fragmentNode = result as FragmentNode;
			expect(fragmentNode.children).toHaveLength(1);
			expect(fragmentNode.children[0]).toBe(count);
		});

		it('should accept derived function as child', () => {
			const count = signal(5);
			const doubled = () => count.value * 2;
			const result = jsx(Fragment, { children: doubled });

			const fragmentNode = result as FragmentNode;
			expect(fragmentNode.children).toHaveLength(1);
			expect(fragmentNode.children[0]).toBe(doubled);
		});

		it('should accept array of Signals as children', () => {
			const sig1 = signal('A');
			const sig2 = signal('B');
			const result = jsx(Fragment, { children: [sig1, sig2] });

			const fragmentNode = result as FragmentNode;
			expect(fragmentNode.children).toHaveLength(2);
			expect(fragmentNode.children[0]).toBe(sig1);
			expect(fragmentNode.children[1]).toBe(sig2);
		});

		it('should accept function as child Render Prop pattern', () => {
			const renderFn = () => 'Rendered content';
			const result = jsx(Fragment, { children: renderFn });

			const fragmentNode = result as FragmentNode;
			expect(fragmentNode.children).toHaveLength(1);
			expect(fragmentNode.children[0]).toBe(renderFn);
		});
	});

	describe('Edge Cases', () => {
		it('should handle null props gracefully', () => {
			const result = jsx(Fragment, null);

			expect(isFragmentNode(result)).toBe(true);
			expect((result as FragmentNode).children).toEqual([]);
		});

		it('should handle undefined props gracefully', () => {
			const result = jsx(Fragment, undefined as unknown as null);

			expect(isFragmentNode(result)).toBe(true);
			expect((result as FragmentNode).children).toEqual([]);
		});

		it('should handle empty object props', () => {
			const result = jsx(Fragment, {});

			expect(isFragmentNode(result)).toBe(true);
			expect((result as FragmentNode).children).toEqual([]);
		});

		it('should handle nested arrays in children flattened', () => {
			const nested = [[jsx('span', {}), jsx('div', {})]];
			const result = jsx(Fragment, { children: nested });

			const fragmentNode = result as FragmentNode;
			expect(fragmentNode.children.length).toBeGreaterThanOrEqual(1);
		});

		it('should handle very large children arrays', () => {
			const manyChildren = Array.from({ length: 1000 }, (_, i) =>
				jsx('span', { key: i, children: `Item ${String(i)}` })
			);
			const result = jsx(Fragment, { children: manyChildren });

			const fragmentNode = result as FragmentNode;
			expect(fragmentNode.children).toHaveLength(1000);
		});

		it('should handle object children non-node', () => {
			const obj = { custom: 'data' };
			const result = jsx(Fragment, { children: obj as unknown });

			const fragmentNode = result as FragmentNode;
			expect(fragmentNode.children).toHaveLength(1);
			expect(fragmentNode.children[0]).toBe(obj);
		});
	});

	describe('FragmentNode Properties', () => {
		it('should have correct [EFFUSE_NODE] marker', () => {
			const result = jsx(Fragment, { children: 'test' });

			expect(result[EFFUSE_NODE]).toBe(true);
		});

		it('should have correct type property', () => {
			const result = jsx(Fragment, { children: 'test' });

			expect(result.type).toBe(NodeType.FRAGMENT);
		});

		it('should have children property as array', () => {
			const result = jsx(Fragment, { children: 'single' });

			const fragmentNode = result as FragmentNode;
			expect(Array.isArray(fragmentNode.children)).toBe(true);
		});

		it('should not have key property on FragmentNode', () => {
			const result = jsx(Fragment, {
				key: 'ignored',
				children: 'test',
			}) as FragmentNode;

			expect(result.key).toBeUndefined();
		});
	});
});

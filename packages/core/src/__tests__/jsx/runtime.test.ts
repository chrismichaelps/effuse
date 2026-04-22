import { describe, it, expect, vi } from 'vitest';
import { jsx, jsxs, jsxDEV, Fragment } from '../../jsx/runtime.js';
import { signal } from '../../reactivity/signal.js';
import type { ElementNode, EffuseNode, BlueprintNode, FragmentNode } from '../../render/node.js';

const asElement = (node: EffuseNode): ElementNode => {
	if (node._tag !== 'Element') throw new Error('Expected ElementNode');
	return node;
};

const asFragment = (node: EffuseNode): FragmentNode => {
	if (node._tag !== 'Fragment') throw new Error('Expected FragmentNode');
	return node;
};

const asBlueprint = (node: EffuseNode): BlueprintNode => {
	if (node._tag !== 'Blueprint') throw new Error('Expected BlueprintNode');
	return node;
};

describe('jsx runtime', () => {
	describe('element creation', () => {
		it('should create an element node for string type', () => {
			const result = asElement(jsx('div', { className: 'container', children: 'Hello' }));

			expect(result.tag).toBe('div');
			expect(result.props).toEqual({ className: 'container' });
			expect(result.children).toEqual(['Hello']);
		});

		it('should handle key prop on elements', () => {
			const result = asElement(jsx('li', { children: 'Item' }, 'item-1'));

			expect(result.key).toBe('item-1');
		});

		it('should handle number children', () => {
			const result = asElement(jsx('span', { children: 42 }));

			expect(result.children).toEqual([42]);
		});

		it('should handle multiple children', () => {
			const result = asElement(jsx('div', { children: ['a', 'b', 'c'] }));

			expect(result.children).toEqual(['a', 'b', 'c']);
		});

		it('should filter null children', () => {
			const result = asElement(jsx('div', { children: [null, 'valid', null] }));

			expect(result.children).toEqual(['valid']);
		});

		it('should filter undefined children', () => {
			const result = asElement(jsx('div', { children: [undefined, 'visible', undefined] }));

			expect(result.children).toEqual(['visible']);
		});

		it('should filter boolean children', () => {
			const result = asElement(jsx('div', { children: [false, 'shown', true] }));

			expect(result.children).toEqual(['shown']);
		});

		it('should preserve zero as valid child', () => {
			const result = asElement(jsx('div', { children: 0 }));

			expect(result.children).toContain(0);
		});

		it('should preserve empty string as valid child', () => {
			const result = asElement(jsx('div', { children: '' }));

			expect(result.children).toContain('');
		});

		it('should handle signal children', () => {
			const count = signal(0);
			const result = asElement(jsx('div', { children: count }));

			expect(result.children).toEqual([count]);
		});

		it('should handle function children', () => {
			const renderFn = () => 'dynamic';
			const result = asElement(jsx('div', { children: renderFn }));

			expect(result.children).toEqual([renderFn]);
		});
	});

	describe('component invocation', () => {
		it('should invoke function components', () => {
			const MyComponent = (props: { name: string }) =>
				jsx('span', { children: props.name });

			const result = asElement(jsx(MyComponent as any, { name: 'World' }));

			expect(result.tag).toBe('span');
			expect(result.children).toEqual(['World']);
		});

		it('should pass children to function components', () => {
			const Wrapper = (props: { children?: unknown }) =>
				jsx('div', { children: props.children });

			const result = asElement(jsx(Wrapper as any, { children: 'Content' }));

			expect(result.tag).toBe('div');
			expect(result.children).toEqual(['Content']);
		});

		it('should pass key to function components', () => {
			const Item = vi.fn((props: { children?: unknown; key?: string }) =>
				jsx('li', { children: props.children })
			);

			jsx(Item as any, { children: 'A' }, 'key-1');

			expect(Item).toHaveBeenCalledWith(
				expect.objectContaining({ key: 'key-1', children: 'A' })
			);
		});
	});

	describe('Fragment handling', () => {
		it('should create FragmentNode with jsx', () => {
			const result = asFragment(jsx(Fragment, { children: 'Hello' }));

			expect(result.children).toEqual(['Hello']);
		});

		it('should create FragmentNode with jsxs', () => {
			const result = asFragment(jsxs(Fragment, { children: ['A', 'B'] }));

			expect(result.children).toEqual(['A', 'B']);
		});

		it('should create FragmentNode with jsxDEV', () => {
			const result = asFragment(jsxDEV(Fragment, { children: 'Dev' }, 'dev-key'));

			expect(result.children).toEqual(['Dev']);
		});

		it('should handle custom fragment components', () => {
			const CustomFragment = Object.assign(
				(props: { children?: unknown }) => jsx('div', { children: props.children }),
				{ _tag: Fragment._tag }
			);

			const result = asElement(jsx(CustomFragment as any, { children: 'Custom' }));

			expect(result.tag).toBe('div');
			expect(result.children).toEqual(['Custom']);
		});
	});

	describe('blueprint handling', () => {
		it('should create BlueprintNode for blueprint types', () => {
			const blueprint = {
				_tag: 'Blueprint' as const,
				name: 'TestBlueprint',
				view: () => 'view',
			};

			const result = asBlueprint(jsx(blueprint as any, { foo: 'bar', children: 'child' }));

			expect(result.blueprint).toBe(blueprint);
			expect(result.props).toEqual({ foo: 'bar', children: 'child' });
		});
	});

	describe('edge cases', () => {
		it('should handle null props', () => {
			const result = asElement(jsx('div', null));

			expect(result.children).toEqual([]);
		});

		it('should handle empty props', () => {
			const result = asElement(jsx('div', {}));

			expect(result.children).toEqual([]);
		});

		it('should throw UnknownJSXTypeError for invalid type', () => {
			expect(() => jsx(123 as any, {})).toThrow();
		});
	});
});

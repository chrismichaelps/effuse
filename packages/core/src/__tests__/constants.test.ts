// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
	NodeType,
	isNodeElement,
	isNodeText,
	isNodeBlueprint,
	isNodeFragment,
	isNodeList,
	matchNodeType,
} from '../constants.js';

describe('NodeType TaggedEnum', () => {
	describe('Constructors', () => {
		it('should create Element node type', () => {
			const node = NodeType.Element();
			expect(node._tag).toBe('Element');
		});

		it('should create Text node type', () => {
			const node = NodeType.Text();
			expect(node._tag).toBe('Text');
		});

		it('should create Blueprint node type', () => {
			const node = NodeType.Blueprint();
			expect(node._tag).toBe('Blueprint');
		});

		it('should create Fragment node type', () => {
			const node = NodeType.Fragment();
			expect(node._tag).toBe('Fragment');
		});

		it('should create List node type', () => {
			const node = NodeType.List();
			expect(node._tag).toBe('List');
		});
	});

	describe('Type Guards', () => {
		describe('isNodeElement', () => {
			it('should return true for Element', () => {
				expect(isNodeElement(NodeType.Element())).toBe(true);
			});

			it('should return false for other types', () => {
				expect(isNodeElement(NodeType.Text())).toBe(false);
				expect(isNodeElement(NodeType.Blueprint())).toBe(false);
				expect(isNodeElement(NodeType.Fragment())).toBe(false);
				expect(isNodeElement(NodeType.List())).toBe(false);
			});
		});

		describe('isNodeText', () => {
			it('should return true for Text', () => {
				expect(isNodeText(NodeType.Text())).toBe(true);
			});

			it('should return false for other types', () => {
				expect(isNodeText(NodeType.Element())).toBe(false);
				expect(isNodeText(NodeType.Blueprint())).toBe(false);
				expect(isNodeText(NodeType.Fragment())).toBe(false);
				expect(isNodeText(NodeType.List())).toBe(false);
			});
		});

		describe('isNodeBlueprint', () => {
			it('should return true for Blueprint', () => {
				expect(isNodeBlueprint(NodeType.Blueprint())).toBe(true);
			});

			it('should return false for other types', () => {
				expect(isNodeBlueprint(NodeType.Element())).toBe(false);
				expect(isNodeBlueprint(NodeType.Text())).toBe(false);
				expect(isNodeBlueprint(NodeType.Fragment())).toBe(false);
				expect(isNodeBlueprint(NodeType.List())).toBe(false);
			});
		});

		describe('isNodeFragment', () => {
			it('should return true for Fragment', () => {
				expect(isNodeFragment(NodeType.Fragment())).toBe(true);
			});

			it('should return false for other types', () => {
				expect(isNodeFragment(NodeType.Element())).toBe(false);
				expect(isNodeFragment(NodeType.Text())).toBe(false);
				expect(isNodeFragment(NodeType.Blueprint())).toBe(false);
				expect(isNodeFragment(NodeType.List())).toBe(false);
			});
		});

		describe('isNodeList', () => {
			it('should return true for List', () => {
				expect(isNodeList(NodeType.List())).toBe(true);
			});

			it('should return false for other types', () => {
				expect(isNodeList(NodeType.Element())).toBe(false);
				expect(isNodeList(NodeType.Text())).toBe(false);
				expect(isNodeList(NodeType.Blueprint())).toBe(false);
				expect(isNodeList(NodeType.Fragment())).toBe(false);
			});
		});
	});

	describe('matchNodeType', () => {
		it('should call onElement handler for Element', () => {
			const result = matchNodeType(NodeType.Element(), {
				onElement: () => 'element-result',
				onText: () => 'text-result',
				onBlueprint: () => 'blueprint-result',
				onFragment: () => 'fragment-result',
				onList: () => 'list-result',
			});
			expect(result).toBe('element-result');
		});

		it('should call onText handler for Text', () => {
			const result = matchNodeType(NodeType.Text(), {
				onElement: () => 'element-result',
				onText: () => 'text-result',
				onBlueprint: () => 'blueprint-result',
				onFragment: () => 'fragment-result',
				onList: () => 'list-result',
			});
			expect(result).toBe('text-result');
		});

		it('should call onBlueprint handler for Blueprint', () => {
			const result = matchNodeType(NodeType.Blueprint(), {
				onElement: () => 'element-result',
				onText: () => 'text-result',
				onBlueprint: () => 'blueprint-result',
				onFragment: () => 'fragment-result',
				onList: () => 'list-result',
			});
			expect(result).toBe('blueprint-result');
		});

		it('should call onFragment handler for Fragment', () => {
			const result = matchNodeType(NodeType.Fragment(), {
				onElement: () => 'element-result',
				onText: () => 'text-result',
				onBlueprint: () => 'blueprint-result',
				onFragment: () => 'fragment-result',
				onList: () => 'list-result',
			});
			expect(result).toBe('fragment-result');
		});

		it('should call onList handler for List', () => {
			const result = matchNodeType(NodeType.List(), {
				onElement: () => 'element-result',
				onText: () => 'text-result',
				onBlueprint: () => 'blueprint-result',
				onFragment: () => 'fragment-result',
				onList: () => 'list-result',
			});
			expect(result).toBe('list-result');
		});

		it('should be exhaustive for all node types', () => {
			const nodeTypes = [
				NodeType.Element(),
				NodeType.Text(),
				NodeType.Blueprint(),
				NodeType.Fragment(),
				NodeType.List(),
			];
			const results: string[] = [];

			for (const nodeType of nodeTypes) {
				results.push(
					matchNodeType(nodeType, {
						onElement: () => 'Element',
						onText: () => 'Text',
						onBlueprint: () => 'Blueprint',
						onFragment: () => 'Fragment',
						onList: () => 'List',
					})
				);
			}

			expect(results).toEqual([
				'Element',
				'Text',
				'Blueprint',
				'Fragment',
				'List',
			]);
		});

		it('should support generic return types', () => {
			const result = matchNodeType(NodeType.Element(), {
				onElement: () => ({ type: 'element', priority: 1 }),
				onText: () => ({ type: 'text', priority: 2 }),
				onBlueprint: () => ({ type: 'blueprint', priority: 3 }),
				onFragment: () => ({ type: 'fragment', priority: 4 }),
				onList: () => ({ type: 'list', priority: 5 }),
			});

			expect(result).toEqual({ type: 'element', priority: 1 });
		});

		it('should handle handlers returning null or undefined', () => {
			const nullResult = matchNodeType(NodeType.Element(), {
				onElement: () => null,
				onText: () => 'text',
				onBlueprint: () => 'blueprint',
				onFragment: () => 'fragment',
				onList: () => 'list',
			});

			const undefinedResult = matchNodeType(NodeType.Text(), {
				onElement: () => 'element',
				onText: () => undefined,
				onBlueprint: () => 'blueprint',
				onFragment: () => 'fragment',
				onList: () => 'list',
			});

			expect(nullResult).toBeNull();
			expect(undefinedResult).toBeUndefined();
		});

		it('should handle handlers that throw', () => {
			expect(() => {
				matchNodeType(NodeType.Blueprint(), {
					onElement: () => 'element',
					onText: () => 'text',
					onBlueprint: () => {
						throw new Error('Blueprint handler failed');
					},
					onFragment: () => 'fragment',
					onList: () => 'list',
				});
			}).toThrow('Blueprint handler failed');
		});
	});

	describe('Edge Cases', () => {
		it('should handle multiple instances of same type', () => {
			const elem1 = NodeType.Element();
			const elem2 = NodeType.Element();

			expect(isNodeElement(elem1)).toBe(true);
			expect(isNodeElement(elem2)).toBe(true);
			expect(elem1._tag).toBe(elem2._tag);
		});

		it('should work in filtering scenarios', () => {
			const nodes = [
				NodeType.Element(),
				NodeType.Text(),
				NodeType.Element(),
				NodeType.Fragment(),
				NodeType.List(),
				NodeType.Text(),
			];

			const elements = nodes.filter(isNodeElement);
			const texts = nodes.filter(isNodeText);
			const fragments = nodes.filter(isNodeFragment);

			expect(elements).toHaveLength(2);
			expect(texts).toHaveLength(2);
			expect(fragments).toHaveLength(1);
		});

		it('should work in reduce scenarios', () => {
			const nodes = [NodeType.Element(), NodeType.Text(), NodeType.Blueprint()];

			const counts = nodes.reduce(
				(acc, node) => {
					if (isNodeElement(node)) acc.elements++;
					else if (isNodeText(node)) acc.texts++;
					else if (isNodeBlueprint(node)) acc.blueprints++;
					return acc;
				},
				{ elements: 0, texts: 0, blueprints: 0 }
			);

			expect(counts).toEqual({ elements: 1, texts: 1, blueprints: 1 });
		});

		it('should handle rapid type checks', () => {
			const node = NodeType.Element();
			const iterations = 1000;

			for (let i = 0; i < iterations; i++) {
				expect(isNodeElement(node)).toBe(true);
				expect(isNodeText(node)).toBe(false);
			}
		});
	});
});

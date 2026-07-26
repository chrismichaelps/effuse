import { describe, it, expect, vi } from 'vitest';
import { useOnClickOutside } from '../../hooks/useOnClickOutside.js';

describe('useOnClickOutside', () => {
	const createMockElement = () => {
		const children: object[] = [];
		return {
			tagName: 'DIV',
			contains: (node: object | null) =>
				node !== null && children.includes(node),
			appendChild: (child: object) => {
				children.push(child);
				return child;
			},
		};
	};

	it('should call callback when clicking outside', () => {
		const callback = vi.fn();
		const div = createMockElement();

		const addEventListener = vi.fn();
		vi.stubGlobal('document', {
			addEventListener,
			removeEventListener: vi.fn(),
			querySelector: () => null,
		});

		useOnClickOutside(() => div as any, callback);

		const handler = addEventListener.mock.calls[0][1] as (e: MouseEvent) => void;
		handler({ target: {} } as MouseEvent);

		expect(callback).toHaveBeenCalledOnce();
	});

	it('should not call callback when clicking inside', () => {
		const callback = vi.fn();
		const div = createMockElement();

		const addEventListener = vi.fn();
		vi.stubGlobal('document', {
			addEventListener,
			removeEventListener: vi.fn(),
			querySelector: () => null,
		});

		useOnClickOutside(() => div as any, callback);

		const handler = addEventListener.mock.calls[0][1] as (e: MouseEvent) => void;
		const insideNode = {};
		(div as any).appendChild(insideNode);
		handler({ target: insideNode } as MouseEvent);

		expect(callback).not.toHaveBeenCalled();
	});

	it('should respect exclude selector', () => {
		const callback = vi.fn();
		const div = createMockElement();
		const excludedBtn = createMockElement();

		const addEventListener = vi.fn();
		vi.stubGlobal('document', {
			addEventListener,
			removeEventListener: vi.fn(),
			querySelector: () => excludedBtn,
		});

		useOnClickOutside(() => div as any, callback, { exclude: '#ignore' });

		const handler = addEventListener.mock.calls[0][1] as (e: MouseEvent) => void;
		const targetNode = {};
		(excludedBtn as any).appendChild(targetNode);
		handler({ target: targetNode } as MouseEvent);

		expect(callback).not.toHaveBeenCalled();
	});
});

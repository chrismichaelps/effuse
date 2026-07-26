import { describe, it, expect } from 'vitest';
import { Await } from '../../components/Await.js';
import { createTextNode } from '../../render/node.js';

describe('Await deferred', () => {
	it('should not start promise automatically when defer is true', async () => {
		let resolved = false;
		const promise = new Promise<string>((resolve) => {
			setTimeout(() => {
				resolved = true;
				resolve('done');
			}, 20);
		});

		const node = Await({
			promise,
			defer: true,
			pending: createTextNode('loading'),
			children: (data: string) => createTextNode(data),
		});

		// Immediately check children — should still be pending
		const children = (node as any).children;
		expect(children).toHaveLength(1);
		expect(children[0].text).toBe('loading');

		// Promise should not have resolved yet because we deferred
		expect(resolved).toBe(false);
	});

	it('should allow manual start via _start', async () => {
		const promise = Promise.resolve('data');

		const node = Await({
			promise,
			defer: true,
			pending: createTextNode('loading'),
			children: (data: string) => createTextNode(data),
		}) as any;

		node._start();

		// Wait for promise to resolve
		await new Promise((r) => setTimeout(r, 10));

		const children = node.children;
		expect(children).toHaveLength(1);
		expect(children[0].text).toBe('data');
	});

	it('should allow refresh via _refresh', async () => {
		let callCount = 0;
		const factory = () => Promise.resolve(`call-${++callCount}`);

		const node = Await({
			promise: factory,
			defer: true,
			pending: createTextNode('loading'),
			children: (data: string) => createTextNode(data),
		}) as any;

		node._start();
		await new Promise((r) => setTimeout(r, 10));
		expect(node.children[0].text).toBe('call-1');

		node._refresh();
		await new Promise((r) => setTimeout(r, 10));
		expect(node.children[0].text).toBe('call-2');
	});
});

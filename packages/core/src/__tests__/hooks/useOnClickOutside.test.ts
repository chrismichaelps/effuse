// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnClickOutside } from '../../hooks/useOnClickOutside.js';

const click = (element: Element): MouseEvent => {
	const event = new MouseEvent('mousedown', { bubbles: true, composed: true });
	element.dispatchEvent(event);
	return event;
};

describe('useOnClickOutside (issue #509)', () => {
	beforeEach(() => {
		document.body.innerHTML = [
			'<div id="owned"><button id="inside">inside</button></div>',
			'<div class="exclude"><button id="excluded-first">first</button></div>',
			'<div class="exclude"><span><button id="excluded-second">second</button></span></div>',
			'<button id="outside">outside</button>',
		].join('');
	});

	afterEach(() => {
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('invokes once for a genuine outside event and preserves its identity', () => {
		const callback = vi.fn();
		const owned = document.querySelector('#owned')!;
		const stop = useOnClickOutside(() => owned, callback);

		const event = click(document.querySelector('#outside')!);
		expect(callback).toHaveBeenCalledOnce();
		expect(callback).toHaveBeenCalledWith(event);
		stop();
	});

	it('ignores clicks inside the owned element', () => {
		const callback = vi.fn();
		const owned = document.querySelector('#owned')!;
		const stop = useOnClickOutside(() => owned, callback);

		click(document.querySelector('#inside')!);
		expect(callback).not.toHaveBeenCalled();
		stop();
	});

	it('ignores descendants of every element matching the exclusion selector', () => {
		const callback = vi.fn();
		const owned = document.querySelector('#owned')!;
		const stop = useOnClickOutside(() => owned, callback, {
			exclude: '.exclude',
		});

		click(document.querySelector('#excluded-first')!);
		click(document.querySelector('#excluded-second')!);
		expect(callback).not.toHaveBeenCalled();
		stop();
	});

	it('matches excluded ancestors when composedPath is unavailable', () => {
		const add = vi.spyOn(document, 'addEventListener');
		const callback = vi.fn();
		const owned = document.querySelector('#owned')!;
		const stop = useOnClickOutside(() => owned, callback, {
			exclude: '.exclude',
		});
		const handler = add.mock.calls.find(
			([type]) => type === 'mousedown'
		)?.[1] as EventListener;
		const target = document.querySelector('#excluded-second')!;

		handler({ target, composedPath: undefined } as unknown as MouseEvent);
		expect(callback).not.toHaveBeenCalled();
		stop();
	});

	it('honors excluded elements in a composed shadow path', () => {
		const callback = vi.fn();
		const owned = document.querySelector('#owned')!;
		const host = document.createElement('div');
		document.body.append(host);
		const shadow = host.attachShadow({ mode: 'open' });
		const excluded = document.createElement('button');
		excluded.className = 'exclude';
		shadow.append(excluded);
		const stop = useOnClickOutside(() => owned, callback, {
			exclude: '.exclude',
		});

		click(excluded);
		expect(callback).not.toHaveBeenCalled();
		stop();
	});

	it('keeps missing refs and invalid selectors inert', () => {
		const callback = vi.fn();
		const missingStop = useOnClickOutside(() => null, callback);
		const invalidStop = useOnClickOutside(
			() => document.querySelector('#owned'),
			callback,
			{ exclude: '[' }
		);

		click(document.querySelector('#outside')!);
		expect(callback).not.toHaveBeenCalled();
		missingStop();
		invalidStop();
	});

	it('removes its listener exactly once', () => {
		const remove = vi.spyOn(document, 'removeEventListener');
		const callback = vi.fn();
		const stop = useOnClickOutside(
			() => document.querySelector('#owned'),
			callback
		);

		stop();
		stop();
		expect(remove).toHaveBeenCalledTimes(1);

		click(document.querySelector('#outside')!);
		expect(callback).not.toHaveBeenCalled();
	});
});

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

import type { EffuseNode } from '../render/node.js';

export type DOMTransitionsOptions = {
	duration?: number;
	easing?: string;
	axis?: 'y' | 'x';
	distance?: number;
	fade?: boolean;
	cleanup?: boolean;
};

export const createDOMTransitions = (
	getEl: (node: EffuseNode) => HTMLElement | null,
	options: DOMTransitionsOptions = {}
): {
	enter: (node: EffuseNode, index: number) => void;
	move: (node: EffuseNode, fromIndex: number, toIndex: number) => void;
	exit: (node: EffuseNode, index: number) => void;
} => {
	const {
		duration = 180,
		easing = 'ease-out',
		axis = 'y',
		distance = 8,
		fade = true,
		cleanup = true,
	} = options;

	const translateProp = axis === 'y' ? 'translateY' : 'translateX';

	const enter = (node: EffuseNode) => {
		const el = getEl(node);
		if (!el || typeof el.animate !== 'function') return;
		const keyframes: Keyframe[] = [
			{
				opacity: fade ? 0 : 1,
				transform: `${translateProp}(${String(distance)}px)`,
			},
			{ opacity: 1, transform: `${translateProp}(0px)` },
		];
		el.animate(keyframes, { duration, easing });
	};

	const move = (node: EffuseNode) => {
		const el = getEl(node);
		if (!el || typeof el.animate !== 'function') return;
		const keyframes: Keyframe[] = [
			{ transform: 'scale(1.0)' },
			{ transform: 'scale(1.0)' },
		];
		el.animate(keyframes, { duration: Math.max(120, duration / 2), easing });
	};

	const exit = (node: EffuseNode) => {
		const el = getEl(node);
		if (!el || typeof el.animate !== 'function') return;
		const keyframes: Keyframe[] = [
			{ opacity: 1, transform: `${translateProp}(0px)` },
			{
				opacity: fade ? 0 : 1,
				transform: `${translateProp}(${String(distance)}px)`,
			},
		];
		const anim = el.animate(keyframes, { duration, easing });
		if (cleanup) {
			anim.addEventListener('finish', () => {});
		}
	};

	return {
		enter: (node: EffuseNode) => {
			enter(node);
		},
		move: (node: EffuseNode) => {
			move(node);
		},
		exit: (node: EffuseNode) => {
			exit(node);
		},
	};
};

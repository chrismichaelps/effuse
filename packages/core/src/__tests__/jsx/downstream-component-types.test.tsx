import { describe, expect, it } from 'vitest';
import { For, define, signal, type EffuseChild } from '../../index.js';

interface BadgeProps {
	label: string;
	children?: EffuseChild;
}

const Badge = define<BadgeProps, Record<string, never>>({
	script: () => ({}),
	template: ({ label, children }) => (
		<span>
			{label}
			{children}
		</span>
	),
});

describe('downstream JSX component contracts', () => {
	it('keeps typed components and generic built-ins valid JSX element types', () => {
		if (false) {
			const badge = <Badge label="Stable">child</Badge>;
			const list = (
				<For each={signal(['one', 'two'])}>
					{(item) => <span>{item.value}</span>}
				</For>
			);
			void badge;
			void list;

			// @ts-expect-error required component props remain required
			const missing = <Badge />;
			// @ts-expect-error unknown component props remain rejected
			const extra = <Badge label="Stable" unknown />;
			void missing;
			void extra;
		}

		expect(true).toBe(true);
	});
});

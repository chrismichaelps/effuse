// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';
import { useForm } from '../../form/useForm.js';
import { signal } from '../../reactivity/signal.js';
import { renderToFragment } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';
import type { UseFormReturn } from '../../form/types.js';

type Values = {
	readonly name: string;
};

describe('useForm automatic validation ownership', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		document.body.replaceChildren();
	});

	it('stops change validation when its component unmounts', async () => {
		const validator = vi.fn((value: string) =>
			value.length > 0 ? undefined : 'Required'
		);
		let form: UseFormReturn<Values> | undefined;
		const App = define({
			script: () => {
				form = useForm<Values>({
					initial: { name: signal('Ready') },
					validators: { name: validator },
					validationOptions: { debounce: 0 },
				});
				return {};
			},
			template: () => 'Form',
		});
		const app = await createApp(App).mount('#app');
		const callsAtUnmount = validator.mock.calls.length;

		await app.unmount();
		form?.setFieldValue('name', '');

		expect(validator).toHaveBeenCalledTimes(callsAtUnmount);
		expect(form?.errors.value.name).toBeUndefined();
	});

	it('cancels pending debounced validation during unmount', async () => {
		let form: UseFormReturn<Values> | undefined;
		const App = define({
			script: () => {
				form = useForm<Values>({
					initial: { name: signal('Ready') },
					validators: {
						name: (value) => (value.length > 0 ? undefined : 'Required'),
					},
					validationOptions: { debounce: 25 },
				});
				return {};
			},
			template: () => 'Form',
		});
		const app = await createApp(App).mount('#app');

		form?.setFieldValue('name', '');
		await app.unmount();
		vi.advanceTimersByTime(25);

		expect(form?.errors.value.name).toBeUndefined();
	});

	it('preserves mounted debounced validation', async () => {
		let form: UseFormReturn<Values> | undefined;
		const App = define({
			script: () => {
				form = useForm<Values>({
					initial: { name: signal('Ready') },
					validators: {
						name: (value) => (value.length > 0 ? undefined : 'Required'),
					},
					validationOptions: { debounce: 25 },
				});
				return {};
			},
			template: () => 'Form',
		});
		const app = await createApp(App).mount('#app');

		form?.setFieldValue('name', '');
		vi.advanceTimersByTime(25);
		expect(form?.errors.value.name).toBe('Required');

		await app.unmount();
	});

	it('keeps standalone automatic validation active', () => {
		const form = useForm<Values>({
			initial: { name: signal('Ready') },
			validators: {
				name: (value) => (value.length > 0 ? undefined : 'Required'),
			},
			validationOptions: { debounce: 0 },
		});

		form.setFieldValue('name', '');

		expect(form.errors.value.name).toBe('Required');
	});

	it('disposes automatic validation after SSR rendering', async () => {
		const validator = vi.fn((value: string) =>
			value.length > 0 ? undefined : 'Required'
		);
		let form: UseFormReturn<Values> | undefined;
		const App = define({
			script: () => {
				form = useForm<Values>({
					initial: { name: signal('Ready') },
					validators: { name: validator },
					validationOptions: { debounce: 0 },
				});
				return {};
			},
			template: () => 'Server form',
		});
		const runtime = await createSSRRuntime([], { runSetup: false });

		try {
			expect(runtime.run(() => renderToFragment(App, runtime))).toBe(
				'Server form'
			);
			const callsAfterRender = validator.mock.calls.length;
			form?.setFieldValue('name', '');
			expect(validator).toHaveBeenCalledTimes(callsAfterRender);
		} finally {
			await runtime.dispose();
		}
	});
});

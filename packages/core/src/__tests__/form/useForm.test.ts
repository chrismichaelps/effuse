import { describe, it, expect } from 'vitest';
import { useForm } from '../../form/useForm.js';
import { signal } from '../../reactivity/signal.js';

describe('useForm bind input types', () => {
	it('should handle checkbox inputs', () => {
		const form = useForm({
			initial: { agree: signal(false) },
		});
		const binding = form.bind('agree');

		const checkbox = {
			tagName: 'INPUT',
			type: 'checkbox',
			checked: true,
		} as unknown as HTMLInputElement;

		binding.onInput({ target: checkbox } as unknown as Event);
		expect(form.fields.agree.value).toBe(true);
	});

	it('should handle radio inputs', () => {
		const form = useForm({
			initial: { color: signal('red') },
		});
		const binding = form.bind('color');

		const radio = {
			tagName: 'INPUT',
			type: 'radio',
			value: 'blue',
			checked: true,
		} as unknown as HTMLInputElement;

		binding.onInput({ target: radio } as unknown as Event);
		expect(form.fields.color.value).toBe('blue');
	});

	it('should handle number inputs', () => {
		const form = useForm({
			initial: { age: signal(0) },
		});
		const binding = form.bind('age');

		const numberInput = {
			tagName: 'INPUT',
			type: 'number',
			value: '25',
			get valueAsNumber() {
				return Number(this.value);
			},
		} as unknown as HTMLInputElement;

		binding.onInput({ target: numberInput } as unknown as Event);
		expect(form.fields.age.value).toBe(25);
	});

	it('should handle range inputs', () => {
		const form = useForm({
			initial: { volume: signal(0) },
		});
		const binding = form.bind('volume');

		const rangeInput = {
			tagName: 'INPUT',
			type: 'range',
			value: '75',
			get valueAsNumber() {
				return Number(this.value);
			},
		} as unknown as HTMLInputElement;

		binding.onInput({ target: rangeInput } as unknown as Event);
		expect(form.fields.volume.value).toBe(75);
	});

	it('should handle select inputs', () => {
		const form = useForm({
			initial: { country: signal('') },
		});
		const binding = form.bind('country');

		const select = {
			tagName: 'SELECT',
			multiple: false,
			value: 'uk',
			selectedOptions: [{ value: 'uk' }],
		} as unknown as HTMLSelectElement;

		binding.onInput({ target: select } as unknown as Event);
		expect(form.fields.country.value).toBe('uk');
	});

	it('should handle multi-select inputs', () => {
		const form = useForm({
			initial: { tags: signal([] as string[]) },
		});
		const binding = form.bind('tags');

		const select = {
			tagName: 'SELECT',
			multiple: true,
			selectedOptions: [{ value: 'a' }, { value: 'b' }],
		} as unknown as HTMLSelectElement;

		binding.onInput({ target: select } as unknown as Event);
		expect(form.fields.tags.value).toEqual(['a', 'b']);
	});

	it('should fall back to text value for unknown input types', () => {
		const form = useForm({
			initial: { name: signal('') },
		});
		const binding = form.bind('name');

		const input = {
			tagName: 'INPUT',
			type: 'text',
			value: 'Alice',
		} as unknown as HTMLInputElement;

		binding.onInput({ target: input } as unknown as Event);
		expect(form.fields.name.value).toBe('Alice');
	});
});

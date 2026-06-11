import { describe, it, expect } from 'vitest';
import { useForm } from '../../form/useForm.js';
import { v } from '../../form/index.js';
import { signal } from '../../reactivity/signal.js';

describe('useForm validation reactivity', () => {
	it('should update validity and errors when field signals change directly', () => {
		const form = useForm<{ name: string }>({
			initial: { name: signal('Form User') },
			validators: {
				name: v.compose(
					v.required('Name is required.'),
					v.minLength(2, 'Name must contain at least two characters.')
				),
			},
		});

		expect(form.isValid.value).toBe(true);

		form.fields.name.value = '';

		expect(form.isValid.value).toBe(false);
		expect(form.errors.value.name).toBe('Name is required.');

		form.fields.name.value = 'Ada';

		expect(form.isValid.value).toBe(true);
		expect(form.errors.value.name).toBeUndefined();
	});

	it('should update validity and errors through bind input handlers', () => {
		const form = useForm<{ name: string }>({
			initial: { name: signal('Form User') },
			validators: {
				name: v.minLength(2, 'Name must contain at least two characters.'),
			},
		});
		const binding = form.bind('name');

		const input = {
			tagName: 'INPUT',
			type: 'text',
			value: 'A',
		} as unknown as HTMLInputElement;

		binding.onInput({ target: input } as unknown as Event);

		expect(form.fields.name.value).toBe('A');
		expect(form.isValid.value).toBe(false);
		expect(form.errors.value.name).toBe(
			'Name must contain at least two characters.'
		);
	});

	it('should not submit invalid values', async () => {
		const submitted: string[] = [];
		const form = useForm<{ name: string }>({
			initial: { name: signal('') },
			validators: {
				name: v.required('Name is required.'),
			},
			onSubmit: ({ name }) => {
				submitted.push(name);
			},
		});

		await form.submit();

		expect(submitted).toEqual([]);
		expect(form.touched.name.value).toBe(true);
		expect(form.errors.value.name).toBe('Name is required.');
	});
});

describe('useForm bind input types', () => {
	it('should handle checkbox inputs', () => {
		const form = useForm<{ agree: boolean }>({
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
		const form = useForm<{ color: string }>({
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
		const form = useForm<{ age: number }>({
			initial: { age: signal(0) },
		});
		const binding = form.bind('age');

		const numberInput = {
			tagName: 'INPUT',
			type: 'number',
			value: '25',
			valueAsNumber: 25,
		} as unknown as HTMLInputElement;

		binding.onInput({ target: numberInput } as unknown as Event);
		expect(form.fields.age.value).toBe(25);
	});

	it('should handle range inputs', () => {
		const form = useForm<{ volume: number }>({
			initial: { volume: signal(0) },
		});
		const binding = form.bind('volume');

		const rangeInput = {
			tagName: 'INPUT',
			type: 'range',
			value: '75',
			valueAsNumber: 75,
		} as unknown as HTMLInputElement;

		binding.onInput({ target: rangeInput } as unknown as Event);
		expect(form.fields.volume.value).toBe(75);
	});

	it('should handle select inputs', () => {
		const form = useForm<{ country: string }>({
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
		const form = useForm<{ tags: string[] }>({
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
		const form = useForm<{ name: string }>({
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

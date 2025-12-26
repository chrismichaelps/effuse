---
title: Components
---

# Components

Components in Effuse combine logic and UI in a clean, type-safe structure.

## Basic Structure

Every component has a `script` and `template`:

```tsx
import { define } from '@effuse/core';

const Greeting = define({
	script: () => {
		return { message: 'Hello, World!' };
	},
	template: ({ message }) => <h1>{message}</h1>,
});
```

## Props

Components receive props from their parent. Use generics for type safety:

```tsx
import { define, computed, unref, type Signal } from '@effuse/core';

interface ButtonProps {
	label: string;
	variant?: 'primary' | 'secondary';
	onClick?: () => void;
}

const Button = define<ButtonProps>({
	script: ({ props }) => ({
		label: props.label,
		variant: computed(() => unref(props.variant) ?? 'primary'),
		onClick: props.onClick,
	}),
	template: ({ label, variant, onClick }) => (
		<button class={`btn btn-${variant.value}`} onClick={onClick}>
			{label}
		</button>
	),
});

// Usage
<Button label="Click me" variant="primary" onClick={handleClick} />;
```

## Lifecycle Hooks

Components have access to lifecycle hooks via the script context:

```tsx
import { define, signal } from '@effuse/core';

const Timer = define({
	script: ({ onMount }) => {
		const seconds = signal(0);

		onMount(() => {
			const interval = setInterval(() => {
				seconds.value++;
			}, 1000);

			// Return cleanup function
			return () => clearInterval(interval);
		});

		return { seconds };
	},
	template: ({ seconds }) => <p>Timer: {seconds} seconds</p>,
});
```

## useCallback for Stable References

Use `useCallback` from the script context for event handlers that need stable references:

```tsx
import { define, signal } from '@effuse/core';

const Form = define({
	script: ({ useCallback }) => {
		const inputValue = signal('');

		// Stable reference for event handler
		const handleInputChange = useCallback((e: Event) => {
			inputValue.value = (e.target as HTMLInputElement).value;
		});

		const handleSubmit = useCallback(() => {
			console.log('Submitted:', inputValue.value);
			inputValue.value = '';
		});

		return { inputValue, handleInputChange, handleSubmit };
	},
	template: ({ inputValue, handleInputChange, handleSubmit }) => (
		<div>
			<input value={inputValue} onInput={handleInputChange} />
			<button onClick={handleSubmit}>Submit</button>
		</div>
	),
});
```

## Children

Pass children to create wrapper components:

```tsx
import { define } from '@effuse/core';

const Card = define({
	script: () => ({}),
	template: ({ children }) => <div class="card">{children}</div>,
});

// Usage
<Card>
	<h2>Title</h2>
	<p>Content goes here</p>
</Card>;
```

## List Rendering with For

Use the `For` component for efficient list rendering:

```tsx
import { define, signal, For } from '@effuse/core';

const TodoList = define({
	script: () => {
		const todos = signal([
			{ id: 1, text: 'Learn Effuse' },
			{ id: 2, text: 'Build an app' },
		]);

		return { todos };
	},
	template: ({ todos }) => (
		<ul>
			<For each={todos} keyExtractor={(t) => t.id}>
				{(todoSignal) => <li>{todoSignal.value.text}</li>}
			</For>
		</ul>
	),
});
```

---
title: Quick Start
---

# Component API

Effuse components are created using the `define` function, which provides a type-safe schema for defining logic and rendering.

## 1. define

The `define` function is the entry point for creating components:

```tsx
import {
	define,
	signal,
	computed,
	type Signal,
	type ReadonlySignal,
} from '@effuse/core';

interface Props {
	title: string;
}

interface Exposed {
	count: Signal<number>;
	doubleCount: ReadonlySignal<number>;
	increment: () => void;
}

export const Counter = define<Props, Exposed>({
	script: ({ props }) => {
		const count = signal(0);
		const doubleCount = computed(() => count.value * 2);
		const increment = () => count.value++;

		return { count, doubleCount, increment };
	},
	template: ({ count, doubleCount, increment }, props) => (
		<div>
			<h1>{props.title}</h1>
			<p>Count: {count}</p>
			<p>Double: {doubleCount}</p>
			<button onClick={increment}>+</button>
		</div>
	),
});
```

## 2. script

The `script` function contains your component's logic. It receives a `ScriptContext` and returns values for the template.

### ScriptContext Properties

| Property          | Type                    | Description                                          |
| ----------------- | ----------------------- | ---------------------------------------------------- |
| `props`           | `Readonly<P>`           | Properties passed from parent. Read-only and frozen. |
| `expose`          | `(values) => void`      | Manually expose values to the template.              |
| `signal`          | `(initial) => Signal`   | Create a new reactive signal.                        |
| `store`           | `(name) => T`           | Access a global store by name.                       |
| `router`          | `Router`                | Access the router instance.                          |
| `onMount`         | `(cb) => void`          | Callback after mount. Can return cleanup.            |
| `onUnmount`       | `(cb) => void`          | Callback when removed from DOM.                      |
| `onBeforeMount`   | `(cb) => void`          | Callback before mount.                               |
| `onBeforeUnmount` | `(cb) => void`          | Callback before unmount.                             |
| `watch`           | `(source, cb) => void`  | Watch a signal and run callback on change.           |
| `useCallback`     | `(fn, deps?) => fn`     | Memoized callback with stable identity.              |
| `useMemo`         | `(fn, deps?) => getter` | Memoize a computed value.                            |

## 3. template

The `template` function returns the JSX structure. It receives exposed values and props:

```tsx
template: ({ count, increment, children }, props) => (
	<div class="counter">
		<h1>{props.title}</h1>
		<p>Count: {count}</p>
		<button onClick={increment}>+</button>
		{children}
	</div>
);
```

## 4. useCallback for Event Handlers

Use `useCallback` from the script context for stable event handler references:

```tsx
const Form = define({
	script: ({ useCallback }) => {
		const value = signal('');

		const handleChange = useCallback((e: Event) => {
			value.value = (e.target as HTMLInputElement).value;
		});

		const handleSubmit = useCallback(() => {
			console.log('Submitted:', value.value);
			value.value = '';
		});

		return { value, handleChange, handleSubmit };
	},
	template: ({ value, handleChange, handleSubmit }) => (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			<input value={value} onInput={handleChange} />
			<button type="submit">Submit</button>
		</form>
	),
});
```

## 5. Lifecycle Example

```tsx
const Timer = define({
	script: ({ onMount, onUnmount }) => {
		const seconds = signal(0);

		onMount(() => {
			const interval = setInterval(() => {
				seconds.value++;
			}, 1000);

			// Return cleanup function
			return () => clearInterval(interval);
		});

		onUnmount(() => {
			console.log('Timer component removed');
		});

		return { seconds };
	},
	template: ({ seconds }) => <p>Elapsed: {seconds} seconds</p>,
});
```

## 6. Reactive Classes and Styles

Use functions for dynamic class names:

```tsx
<button class={() => (isActive.value ? 'btn btn-active' : 'btn btn-inactive')}>
	Toggle
</button>
```

## 7. Conditional Rendering

Use `computed` for reactive conditional rendering:

```tsx
{
	computed(() =>
		isLoading.value ? <div>Loading...</div> : <div>Content</div>
	);
}
```

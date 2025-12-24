---
title: Props
---

# Props

Props are the way to pass data from a parent component to a child component. In Effuse, props are fully typed and reactive.

## Defining Props

To define props, you pass a TypeScript interface as the first generic argument to the `define` function. The `define` function actually accepts two generic arguments:

1.  **Props Type (`P`)**: Defines the shape of props passed to the component.
2.  **Exposed Values (`E`)**: Defines the shape of the object returned by the `script` function and available in the `template`.

```tsx
import { define, signal, type Signal } from '@effuse/core';

interface UserCardProps {
	name: string;
	age: number;
}

interface UserCardExposed {
	capitalizedName: Signal<string>;
}

const UserCard = define<UserCardProps, UserCardExposed>({
	script: ({ props }) => {
		const capitalizedName = signal(props.name.toUpperCase());
		return { capitalizedName };
	},
	template: ({ capitalizedName }, props) => (
		<div class="user-card">
			<h2>{capitalizedName}</h2>
			<p>Age: {props.age}</p>
		</div>
	),
});
```

## Reactivity in Props

In the `script` function, `props` is a reactive object. If a parent passes a signal as a prop, accessing that prop in the script (e.g. inside a `computed` or `effect`) will track it.

```tsx
import { define, computed, unref } from '@effuse/core';

interface CounterProps {
	count: number; // Can be passed as a number or a Signal<number>
}

const DoubleCounter = define<CounterProps>({
	script: ({ props }) => {
		// This computed will update whenever the parent's 'count' signal changes
		const double = computed(() => unref(props.count) * 2);

		return { double };
	},
	template: ({ double }) => <div>Double count: {double}</div>,
});
```

## Default Values

You can handle default values using standard JavaScript patterns or `computed` for reactive defaults.

```tsx
import { define, computed, unref } from '@effuse/core';

interface ButtonProps {
	variant?: 'primary' | 'secondary';
}

const Button = define<ButtonProps>({
	script: ({ props }) => {
		// Reactive default value
		const safeVariant = computed(() => unref(props.variant) ?? 'primary');

		return { safeVariant };
	},
	template: ({ safeVariant, children }) => (
		<button class={`btn btn-${safeVariant.value}`}>{children}</button>
	),
});
```

## Passing Props

You pass props to components just like standard HTML attributes.

```tsx
// Using static values
<UserCard name="Alice" age={30} isAdmin />;

// Using signals
const age = signal(25);
<UserCard name="Bob" age={age} />;
```

Note that when passing a signal (like `age={age}`), Effuse automatically unwraps it in the DOM but keeps the reactivity connection alive for the component logic.

## Children Prop

The `children` prop is special. It contains the content passed inside the component tags.

```tsx
const Container = define({
	script: () => ({}),
	template: ({ children }) => <div class="container">{children}</div>,
});

// Usage
<Container>
	<h1>Hello</h1>
</Container>;
```

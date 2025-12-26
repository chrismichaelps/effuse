---
title: Signals
---

# Signals

Signals are the foundation of Effuse's reactivity system. They are imported directly from `@effuse/core`.

## Creating Signals

Import `signal` from `@effuse/core` to create reactive state:

```tsx
import { define, signal, computed } from '@effuse/core';

export const Counter = define({
	script: () => {
		// Create a signal with initial value
		const count = signal(0);

		// Create computed derived state
		const doubleCount = computed(() => count.value * 2);

		// Define operations that mutate the signal
		const increment = () => count.value++;
		const decrement = () => count.value--;

		// Return signals and operations to template
		return { count, doubleCount, increment, decrement };
	},
	template: ({ count, doubleCount, increment, decrement }) => (
		<div>
			<p>Count: {count}</p>
			<p>Double: {doubleCount}</p>
			<button onClick={decrement}>-</button>
			<button onClick={increment}>+</button>
		</div>
	),
});
```

## Reactivity Types

### 1. Writable Signals

The basic `signal()` creates a writable reference. Access and mutate via the `.value` property.

```tsx
import { define, signal } from '@effuse/core';

const ColorPicker = define({
	script: () => {
		// Primitives
		const color = signal('blue');
		// Objects/Arrays
		const palette = signal(['red', 'blue', 'green']);

		const updateColor = (newColor: string) => {
			color.value = newColor; // Triggers updates
		};

		return { color, palette, updateColor };
	},
	template: ({ color, updateColor }) => (
		<button onClick={() => updateColor('red')}>Current: {color}</button>
	),
});
```

### 2. Computed Signals

Computed signals derive their value from other signals. They update automatically when dependencies change.

```tsx
import { define, signal, computed } from '@effuse/core';

const GradientBox = define({
	script: () => {
		const startColor = signal('red');
		const endColor = signal('blue');

		// Automatically tracks dependencies
		const gradient = computed(
			() => `linear-gradient(${startColor.value}, ${endColor.value})`
		);

		return { gradient };
	},
	template: ({ gradient }) => (
		<div style={`background: ${gradient.value}`}>Gradient</div>
	),
});
```

### 3. Watching Signals

Use the `watch` helper from the script context to perform side effects when a signal changes.

```tsx
import { define, signal } from '@effuse/core';

const Logger = define({
	script: ({ watch }) => {
		const count = signal(0);

		// Runs whenever count changes
		watch(count, (value) => {
			console.log(`Count changed to: ${value}`);
		});

		return { count, increment: () => count.value++ };
	},
	template: ({ count, increment }) => (
		<button onClick={increment}>{count}</button>
	),
});
```

## Using Signals in Templates

Signals can be used directly in JSX - they will automatically update the DOM:

```tsx
// Direct interpolation - updates automatically
<p>Count: {count}</p>

// Dynamic classes with functions
<button class={() => isActive.value ? 'active' : 'inactive'}>
  Toggle
</button>

// Conditional rendering with computed
{computed(() => isLoading.value ? <Spinner /> : <Content />)}
```

## Best Practices

1. **Import Directly**: Import `signal` and `computed` directly from `@effuse/core`
2. **Expose Signals**: Return the signal object itself from `script`, not just the value
3. **Mutate in Handlers**: Keep state mutation logic inside function handlers
4. **Use Computed**: Prefer derived state over manual synchronization

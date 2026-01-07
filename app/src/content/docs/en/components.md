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

### For Props

| Prop           | Type                                           | Description                                    |
| -------------- | ---------------------------------------------- | ---------------------------------------------- |
| `each`         | `Signal<T[]>`                                  | The signal containing the array to iterate     |
| `keyExtractor` | `(item: T, index: number) => string or number` | Function to extract unique keys                |
| `fallback`     | `JSX.Element`                                  | Optional element to render when array is empty |

## Conditional Rendering with Show

Use the `Show` component for conditional rendering based on signal values:

```tsx
import { define, signal, Show } from '@effuse/core';

const UserProfile = define({
	script: () => {
		const user = signal<{ name: string } | null>(null);
		const login = () => {
			user.value = { name: 'John' };
		};
		const logout = () => {
			user.value = null;
		};

		return { user, login, logout };
	},
	template: ({ user, login, logout }) => (
		<div>
			<Show when={user} fallback={<button onClick={login}>Log in</button>}>
				{(u) => (
					<div>
						<p>Welcome, {u.name}!</p>
						<button onClick={logout}>Log out</button>
					</div>
				)}
			</Show>
		</div>
	),
});
```

### Show Props

| Prop       | Type                        | Description                                |
| ---------- | --------------------------- | ------------------------------------------ |
| `when`     | `Signal<T>` or `() => T`    | Condition to evaluate for truthiness       |
| `fallback` | `JSX.Element`               | Element to render when condition is falsy  |
| `children` | `(value: T) => JSX.Element` | Render function receiving the truthy value |

## Dynamic Component

The `Dynamic` component allows you to render different components dynamically based on a signal:

```tsx
import { define, signal, Dynamic } from '@effuse/core';

const TabPanel = define({
	script: () => {
		const tabs = { home: HomeTab, settings: SettingsTab, profile: ProfileTab };
		const activeTab = signal<keyof typeof tabs>('home');

		const currentComponent = computed(() => tabs[activeTab.value]);

		return { activeTab, currentComponent };
	},
	template: ({ activeTab, currentComponent }) => (
		<div>
			<nav>
				<button
					onClick={() => {
						activeTab.value = 'home';
					}}
				>
					Home
				</button>
				<button
					onClick={() => {
						activeTab.value = 'settings';
					}}
				>
					Settings
				</button>
				<button
					onClick={() => {
						activeTab.value = 'profile';
					}}
				>
					Profile
				</button>
			</nav>
			<Dynamic component={currentComponent} fallback={<p>Loading...</p>} />
		</div>
	),
});
```

### Dynamic Props

| Prop        | Type                                     | Description                                     |
| ----------- | ---------------------------------------- | ----------------------------------------------- |
| `component` | `Signal<Component>` or `() => Component` | The component to render dynamically             |
| `props`     | `P`                                      | Props to pass to the rendered component         |
| `fallback`  | `JSX.Element`                            | Element to render when component is null        |
| `portals`   | `Portals`                                | Portal configuration for the rendered component |

## Dynamic Styling

Use reactive functions for dynamic styles and classes:

```tsx
import { define, signal, computed } from '@effuse/core';

const ColorBox = define({
	script: () => {
		const colors = ['mint', 'purple', 'cyan'];
		const index = signal(0);
		const currentColor = computed(() => colors[index.value]);
		const nextColor = () => {
			index.value = (index.value + 1) % colors.length;
		};

		return { currentColor, nextColor };
	},
	template: ({ currentColor, nextColor }) => (
		<div>
			<button onClick={nextColor}>Change Color</button>
			<div
				style={() => ({
					backgroundColor: `var(--accent-${currentColor.value})`,
					padding: '2rem',
					transition: 'background-color 0.3s ease',
				})}
			>
				Current: {currentColor.value}
			</div>
		</div>
	),
});
```

### Dynamic Classes

```tsx
<div class={() => `card ${isActive.value ? 'active' : ''}`}>Content</div>
```

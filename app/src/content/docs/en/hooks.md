---
title: Hooks
---

# Hooks

Hooks in Effuse provide reusable, composable logic with built-in lifecycle management. Create custom hooks using `defineHook` from `@effuse/core`.

## Creating a Hook

Use `defineHook` to create typed, reusable hooks:

```typescript
import { defineHook, type Signal } from '@effuse/core';

interface ToggleConfig {
	initial?: boolean;
}

interface ToggleReturn {
	isOpen: Signal<boolean>;
	toggle: () => void;
	open: () => void;
	close: () => void;
}

export const useToggle = defineHook<ToggleConfig, ToggleReturn>({
	name: 'useToggle',
	setup: ({ config, signal }): ToggleReturn => {
		const isOpen = signal(config.initial ?? false);

		return {
			isOpen,
			toggle: () => {
				isOpen.value = !isOpen.value;
			},
			open: () => {
				isOpen.value = true;
			},
			close: () => {
				isOpen.value = false;
			},
		};
	},
});
```

## Hook Context

The `setup` function receives a context object with these utilities:

| Property        | Description                                     |
| --------------- | ----------------------------------------------- |
| `config`        | Configuration passed when calling the hook      |
| `signal`        | Create reactive signals                         |
| `computed`      | Create derived computed values                  |
| `effect`        | Run side effects that track dependencies        |
| `onMount`       | Register callbacks for when the hook is mounted |
| `layer`         | Access layer props by name                      |
| `layerProvider` | Access layer services                           |
| `scope`         | Manage cleanup and finalizers                   |

## Using Hooks in Components

Call hooks in your component's `script` function:

```tsx
import { define } from '@effuse/core';
import { useToggle } from '../hooks';

const Dropdown = define({
	script: ({ onMount }) => {
		const menu = useToggle({ initial: false });

		return {
			isOpen: menu.isOpen,
			toggle: menu.toggle,
		};
	},
	template: ({ isOpen, toggle }) => (
		<div>
			<button onClick={toggle}>{isOpen.value ? 'Close' : 'Open'}</button>
			{isOpen.value && <div class="menu">Menu Content</div>}
		</div>
	),
});
```

## DOM-Dependent Hooks

For hooks that need DOM access, use a lazy initialization pattern:

```typescript
import { defineHook, type Signal } from '@effuse/core';

interface ClickOutsideConfig {
	selector: string;
}

interface ClickOutsideReturn {
	onClickOutside: (callback: () => void) => void;
	init: () => void;
}

export const useClickOutside = defineHook<
	ClickOutsideConfig,
	ClickOutsideReturn
>({
	name: 'useClickOutside',
	setup: ({ config, signal, effect }): ClickOutsideReturn => {
		const initialized = signal(false);
		let callback: (() => void) | null = null;

		effect(() => {
			if (!initialized.value) return undefined;

			const handleClick = (e: Event) => {
				const target = e.target as HTMLElement;
				if (!target.closest(config.selector)) {
					callback?.();
				}
			};

			document.addEventListener('click', handleClick);
			return () => document.removeEventListener('click', handleClick);
		});

		return {
			onClickOutside: (cb) => {
				callback = cb;
			},
			init: () => {
				initialized.value = true;
			},
		};
	},
});
```

Use in a component:

```tsx
const Dropdown = define({
	script: ({ onMount }) => {
		const toggle = useToggle({ initial: false });
		const clickOutside = useClickOutside({ selector: '.dropdown' });

		onMount(() => {
			clickOutside.onClickOutside(() => toggle.close());
			clickOutside.init();
			return undefined;
		});

		return { isOpen: toggle.isOpen, toggle: toggle.toggle };
	},
	template: ({ isOpen, toggle }) => (
		<div class="dropdown">
			<button onClick={toggle}>Menu</button>
			{isOpen.value && <div class="menu">Content</div>}
		</div>
	),
});
```

## Accessing Layers from Hooks

Hooks can access layer state and services:

```typescript
import { defineHook } from '@effuse/core';

export const useTranslation = defineHook<
	undefined,
	{ t: (key: string) => string }
>({
	name: 'useTranslation',
	deps: ['i18n'],
	setup: ({ layer }) => {
		const i18n = layer('i18n');
		const translations = i18n.translations;

		return {
			t: (key: string) => translations.value?.[key] ?? key,
		};
	},
});
```

## Cleanup

Effects automatically clean up when the component unmounts. Return a cleanup function from `effect`:

```typescript
effect(() => {
	const handler = () => {
		/* ... */
	};
	window.addEventListener('resize', handler);

	// Cleanup runs when effect re-runs or component unmounts
	return () => window.removeEventListener('resize', handler);
});
```

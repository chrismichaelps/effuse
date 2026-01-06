---
title: Layers
---

# Layers

Layers provide dependency injection, shared state, and lifecycle management across your application. They enable components and hooks to access global services without prop drilling.

## Overview

The layer system consists of three key concepts:

| Concept         | Purpose                                     | Access In Components                     |
| --------------- | ------------------------------------------- | ---------------------------------------- |
| **store**       | Reactive state container (signals)          | Via `deriveProps` → `useLayerProps`      |
| **deriveProps** | Extract signals from store for components   | `useLayerProps('name')`                  |
| **provides**    | Services/factories for dependency injection | `useStore('key')` or `useService('key')` |

## Creating a Layer

Use `defineLayer` from `@effuse/core`:

```typescript
import { defineLayer, signal } from '@effuse/core';
import { createStore } from '@effuse/store';

// Create a store with reactive state
const themeStore = createStore('theme', {
	mode: 'dark' as 'light' | 'dark',
	accentColor: '#8df0cc',

	setMode(mode: 'light' | 'dark') {
		this.mode.value = mode;
	},

	toggleMode() {
		this.mode.value = this.mode.value === 'dark' ? 'light' : 'dark';
	},
});

export const ThemeLayer = defineLayer({
	name: 'theme',

	// Dependencies on other layers (loaded first)
	dependencies: ['layout'],

	// The store instance for this layer
	store: themeStore,

	// Extract reactive props from store for components
	deriveProps: (store) => ({
		mode: store.mode,
		accentColor: store.accentColor,
	}),

	// Services exposed via dependency injection
	provides: {
		theme: () => themeStore,
	},

	// Lifecycle hooks
	onMount: (ctx) => {
		// ctx.store, ctx.deps, ctx.getService available
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme) ctx.store.mode.value = savedTheme as 'light' | 'dark';
	},

	onUnmount: (ctx) => {
		// Persist state before unmount
		localStorage.setItem('theme', ctx.store.mode.value);
	},

	onError: (error, ctx) => {
		// Intelligent recovery with context access
		console.error('[ThemeLayer] error:', error.message);
		ctx.store.mode.value = 'dark'; // fallback
	},

	onReady: (ctx, allLayers) => {
		// Called after ALL layers are initialized
		console.log(`[ThemeLayer] ready with ${allLayers.length} layers`);
	},

	// Setup function with access to store and dependencies
	setup: (ctx) => {
		// ctx.store is the themeStore with full type safety
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme === 'light' || savedTheme === 'dark') {
			ctx.store.mode.value = savedTheme;
		}

		// Return cleanup function (optional)
		return () => {
			console.log('[ThemeLayer] cleanup');
		};
	},
});
```

## Layer Schema

The complete `defineLayer` options:

```typescript
interface EffuseLayer<P, D, S> {
	// Required
	name: string; // Unique identifier

	// State management
	store?: S; // Store instance (createStore)
	deriveProps?: (store: S) => P; // Extract props from store

	// Dependency injection
	dependencies?: D; // Array of layer names to load first
	provides?: Record<string, () => unknown>; // Service factories

	// Lifecycle
	setup?: (ctx: SetupContext<P, D, S>) => CleanupFn | void;
	onMount?: (ctx: SetupContext<P, D, S>) => void;
	onUnmount?: (ctx: SetupContext<P, D, S>) => void;
	onError?: (error: Error, ctx: SetupContext<P, D, S>) => void;
	onReady?: (ctx: SetupContext<P, D, S>, allLayers: ResolvedLayer[]) => void;

	// Advanced
	components?: Record<string, Component>; // Scoped components
	routes?: RouteConfig[]; // Layer-specific routes
	plugins?: PluginFn[]; // Layer plugins
}
```

## store vs provides

| Aspect            | `store`                      | `provides`                               |
| ----------------- | ---------------------------- | ---------------------------------------- |
| **Purpose**       | Layer's reactive state       | Dependency injection services            |
| **What it holds** | `createStore()` instance     | Factory functions `{ key: () => value }` |
| **Used in**       | `deriveProps(store)` → props | Components via `useStore('key')`         |
| **Reactivity**    | Built-in signals             | Whatever you return                      |

### store

The **store** is the layer's internal reactive state, created via `@effuse/store`:

```typescript
const i18nStore = createStore('i18n', {
	locale: 'en',
	translations: null as Record<string, string> | null,

	setLocale(loc: string) {
		this.locale.value = loc;
		// Load translations...
	},
});

defineLayer({
	name: 'i18n',
	store: i18nStore,
	deriveProps: (store) => ({
		locale: store.locale,
		translations: store.translations,
	}),
});
```

### provides

**provides** exposes services for dependency injection:

```typescript
defineLayer({
	name: 'router',
	provides: {
		router: () => routerInstance, // Factory function
	},
});

// In a component:
script: ({ useStore }) => {
	const router = useStore('router'); // Gets the router
};
```

## Using Layers in Components

Access layer data and services in component scripts:

```tsx
import { define, computed } from '@effuse/core';

const ThemeToggle = define({
	script: ({ useLayerProps, useStore }) => {
		// Get reactive props from deriveProps
		const themeProps = useLayerProps('theme');

		// Get service from provides
		const themeStore = useStore('theme');

		const buttonText = computed(() =>
			themeProps?.mode.value === 'dark' ? 'Light' : 'Dark'
		);

		const toggle = () => {
			themeStore?.toggleMode();
		};

		return { buttonText, toggle };
	},
	template: ({ buttonText, toggle }) => (
		<button onClick={toggle}>{buttonText}</button>
	),
});
```

## Using Layers in Hooks

Use `defineHook` to create reusable hooks with layer access:

```typescript
import { defineHook, signal } from '@effuse/core';

export const useTheme = defineHook<
	undefined, // No config
	readonly ['theme'], // Depends on 'theme' layer
	{ mode: Signal<string>; toggle: () => void }
>({
	name: 'useTheme',
	deps: ['theme'] as const,
	setup: ({ layer }) => {
		// layer() returns deriveProps result
		const themeProps = layer('theme');

		return {
			mode: themeProps.mode,
			toggle: () => {
				themeProps.mode.value =
					themeProps.mode.value === 'dark' ? 'light' : 'dark';
			},
		};
	},
});
```

## Layer Dependencies

Layers declare their dependencies explicitly:

```typescript
defineLayer({
	name: 'todos',
	dependencies: ['i18n', 'router'], // ← Must be loaded first
	setup: (ctx) => {
		// Access dependency layers
		const i18n = ctx.deps.i18n;
		const router = ctx.deps.router;
	},
});
```

The layer runtime ensures dependencies are initialized in the correct order.

## Type Registry

For full type safety, extend `EffuseLayerRegistry` via module augmentation:

```typescript
// src/layers/effuse.d.ts
import type { Signal } from '@effuse/core';

declare module '@effuse/core' {
	interface EffuseLayerRegistry {
		theme: {
			props: {
				mode: Signal<'light' | 'dark'>;
				accentColor: Signal<string>;
			};
			provides: { theme: typeof themeStore };
		};
		i18n: {
			props: {
				locale: Signal<string>;
				translations: Signal<Record<string, string> | null>;
			};
			provides: { i18n: typeof i18nStore };
		};
	}
}

export {};
```

This enables type inference:

```typescript
const { mode } = useLayerProps('theme')!;
//      ^? Signal<'light' | 'dark'>
```

## Real-World Example: I18n Layer

```typescript
import { defineLayer } from '@effuse/core';
import { i18nStore } from '../store/appI18n';

export const I18nLayer = defineLayer({
	name: 'i18n',
	dependencies: ['router'],

	store: i18nStore,

	deriveProps: (store) => ({
		locale: store.locale,
		isLoading: store.isLoading,
		translations: store.translations,
	}),

	provides: {
		i18n: () => i18nStore,
	},

	onMount: (ctx) => {
		const saved = localStorage.getItem('effuse:locale');
		if (saved) ctx.store.setLocale(saved);
	},

	onUnmount: (ctx) => {
		localStorage.setItem('effuse:locale', ctx.store.locale.value);
	},

	onError: (_, ctx) => {
		ctx.store.setLocale('en'); // fallback
	},

	onReady: (ctx, allLayers) => {
		console.log(`[I18nLayer] Ready with ${allLayers.length} layers`);
	},

	setup: (ctx) => {
		ctx.store.init(); // Load initial translations ASAP
	},
});
```

## Best Practices

1. **One Layer Per Domain** - Create focused layers (auth, i18n, theme, todos)
2. **Store for State** - Use `store` + `deriveProps` for reactive values
3. **Provides for Services** - Use `provides` for methods, stores, and services
4. **Declare Dependencies** - List all required layers in `dependencies`
5. **Setup for Init** - Use `setup` for initialization (localStorage, API calls)
6. **Cleanup in Setup** - Return cleanup function from `setup` when needed
7. **Type Registry** - Use module augmentation for type-safe layer access

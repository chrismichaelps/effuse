---
title: Getting Started
---

# Getting Started with Effuse

Welcome to **Effuse**, a modern reactive UI framework built with TypeScript and [Effect](https://effect.website).

## What is Effuse?

Effuse is a signal-based UI framework that combines the best ideas from modern frontend development:

- **Fine-grained reactivity** — Only the DOM nodes that depend on changed data are updated
- **Type-safe components** — Full TypeScript support with inferred types
- **Effect-powered** — Built on Effect for robust async and error handling
- **Composable architecture** — Layers and plugins for extensibility

## Quick Example

Here's a simple counter component:

```tsx
import { define, signal } from '@effuse/core';

const Counter = define({
	script: () => {
		const count = signal(0);
		const increment = () => count.value++;
		return { count, increment };
	},
	template: ({ count, increment }) => (
		<button onClick={increment}>Clicked {count} times</button>
	),
});
```

## Framework Configuration

Here is how you configure the root of your application, including routing and layers:

### 1. App Component (src/App.tsx)

```tsx
import { define } from '@effuse/core';
import { RouterView } from '@effuse/router';
import { AppLayout } from './layers/AppLayout';
import { SmoothScroll } from './components/SmoothScroll';

export const App = define({
	script: ({}) => ({}),
	template: () => (
		<AppLayout>
			<SmoothScroll />
			<RouterView />
		</AppLayout>
	),
});
```

### 2. Entry Point (src/main.ts)

```typescript
import { createApp } from '@effuse/core';
import { InkProseLayer } from '@effuse/ink';
import { App } from './App';
import { router, installRouter } from './router';

import './styles.css';

// Install router before creating app
installRouter(router);

// Create and mount the application
createApp(App)
	.useLayers([InkProseLayer])
	.then((app) => app.mount('#app'));
```

### 3. Router Configuration (src/router/index.ts)

```typescript
import {
	createRouter,
	createWebHistory,
	installRouter,
	type RouteRecord,
} from '@effuse/router';
import { HomePage } from '../pages/Home';
import { DocsPage } from '../pages/Docs';
import { ContactPage } from '../pages/Contact';

const routes: RouteRecord[] = [
	{ path: '/', name: 'home', component: HomePage },
	{ path: '/docs', name: 'docs', component: DocsPage },
	{ path: '/docs/:slug', name: 'docs-page', component: DocsPage },
	{ path: '/contact', name: 'contact', component: ContactPage },
];

export const router = createRouter({
	history: createWebHistory(),
	routes,
});

export { installRouter };
```

## Component Definition

Components are created using the `define` function, which accepts a configuration object with `script` and `template`:

- **script**: Contains the component's logic, state, and event handlers
- **template**: Returns JSX that renders the component

## Script Context

The `script` function receives a `ScriptContext` object with useful utilities:

| Property          | Type                         | Description                                                   |
| ----------------- | ---------------------------- | ------------------------------------------------------------- |
| `props`           | `Readonly<P>`                | Properties passed to the component. Read-only and frozen.     |
| `expose`          | `(values: object) => void`   | Manually expose values to the template.                       |
| `signal`          | `<T>(value: T) => Signal<T>` | Create a new reactive signal.                                 |
| `store`           | `<T>(name: string) => T`     | Access a global store by name.                                |
| `router`          | `Router`                     | Access the router instance.                                   |
| `onMount`         | `(cb) => void`               | Callback after component mounts. Can return cleanup function. |
| `onUnmount`       | `(cb) => void`               | Callback when component is removed.                           |
| `onBeforeMount`   | `(cb) => void`               | Callback before component mounts.                             |
| `onBeforeUnmount` | `(cb) => void`               | Callback before component unmounts.                           |
| `watch`           | `(source, cb) => void`       | Watch a signal and run callback on change.                    |
| `useCallback`     | `(fn, deps?) => fn`          | Memoize a callback with stable identity.                      |
| `useMemo`         | `(fn, deps?) => getter`      | Memoize a computed value.                                     |

## Next Steps

Ready to dive in? Here's where to go next:

- **[Installation](/docs/installation)** — Set up Effuse in your project
- **[Quick Start](/docs/quick-start)** — Build your first app
- **[Signals](/docs/signals)** — Master the reactivity system

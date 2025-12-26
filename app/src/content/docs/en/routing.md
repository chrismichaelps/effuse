---
title: Routing
---

# Routing

Effuse Router provides type-safe, declarative routing.

## Setup

```typescript
import {
	createRouter,
	createWebHistory,
	installRouter,
	type RouteRecord,
} from '@effuse/router';
import { HomePage } from './pages/Home';
import { DocsPage } from './pages/Docs';
import { ContactPage } from './pages/Contact';

const routes: RouteRecord[] = [
	{ path: '/', name: 'home', component: HomePage },
	{ path: '/docs/:slug', name: 'docs', component: DocsPage },
	{ path: '/contact', name: 'contact', component: ContactPage },
];

export const router = createRouter({
	history: createWebHistory(),
	routes,
});

// Install router before creating app
installRouter(router);
```

## Navigation with Link

Use the `Link` component for navigation:

```tsx
import { define } from '@effuse/core';
import { Link } from '@effuse/router';

const Nav = define({
	script: () => ({}),
	template: () => (
		<nav>
			<Link to="/">Home</Link>
			<Link to="/docs/getting-started">Docs</Link>
			<Link to="/contact">Contact</Link>
		</nav>
	),
});
```

## RouterView

Use `RouterView` to render the matched component:

```tsx
import { define } from '@effuse/core';
import { RouterView } from '@effuse/router';

const App = define({
	script: () => ({}),
	template: () => (
		<div class="app">
			<header>...</header>
			<main>
				<RouterView />
			</main>
			<footer>...</footer>
		</div>
	),
});
```

## Dynamic Route Parameters

Access route parameters, query strings, and hash in your components using the `useRoute` hook. First, define your route with dynamic segments:

```typescript
const routes: RouteRecord[] = [
	{
		path: '/user/:userId',
		name: 'user-profile',
		component: UserProfile,
	},
];
```

Then access the parameters in your component:

```tsx
import { define } from '@effuse/core';
import { useRoute } from '@effuse/router';

const UserProfile = define({
	script: () => {
		const route = useRoute();

		return {
			userId: route.params.userId, // Matches :userId in the path
			search: route.query.q, // Accesses ?q=... from URL
		};
	},
	template: ({ userId, search }) => (
		<div class="user-profile">
			<h1>User Profile</h1>
			<p>User ID: {userId}</p>
			{search && <p>Searching for: {search}</p>}
		</div>
	),
});
```

## Programmatic Navigation

Navigate programmatically using the `useRouter` hook:

```tsx
import { define } from '@effuse/core';
import { useRouter } from '@effuse/router';

const DashboardButton = define({
	script: () => {
		const router = useRouter();

		return {
			goToSettings: () => {
				router.push('/settings');
			},
		};
	},
	template: ({ goToSettings }) => (
		<button onClick={goToSettings}>Go to Settings</button>
	),
});
```

## Router Composables

### `useRoute()`

Returns the current route object. This object contains reactive properties that update whenever navigation occurs.

| Property   | Type                      | Description                                        |
| :--------- | :------------------------ | :------------------------------------------------- |
| `path`     | `string`                  | The pathname of the route.                         |
| `fullPath` | `string`                  | The complete URL including query and hash.         |
| `params`   | `Record<string, string>`  | Key-value pairs of dynamic segments.               |
| `query`    | `Record<string, string>`  | Key-value pairs of the query string.               |
| `hash`     | `string`                  | The URL hash fragment.                             |
| `matched`  | `NormalizedRouteRecord[]` | Array of matched route records for nested routing. |
| `name`     | `string or undefined`     | The name given to the route record.                |
| `meta`     | `Record<string, any>`     | Metadata defined on the route or its parents.      |

### `useRouter()`

Returns the router instance for programmatic control.

| Member          | Signature / Type                                    | Description                                                  |
| :-------------- | :-------------------------------------------------- | :----------------------------------------------------------- |
| `currentRoute`  | `Signal<Route>`                                     | Reactive signal of the current route.                        |
| `routes`        | `NormalizedRouteRecord[]`                           | Readonly array of all registered routes.                     |
| `isReady`       | `boolean`                                           | Whether the router has finished initialization.              |
| `push`          | `(to: RouteLocation) => void`                       | Navigates to a new URL, adding a new entry to history.       |
| `replace`       | `(to: RouteLocation) => void`                       | Navigate to a new URL by replacing the current entry.        |
| `back`          | `() => void`                                        | Navigates one step back in history.                          |
| `forward`       | `() => void`                                        | Navigates one step forward in history.                       |
| `go`            | `(delta: number) => void`                           | Navigates `n` steps back or forward.                         |
| `beforeEach`    | `(guard: NavigationGuard) => () => void`            | Adds a global navigation guard. Returns unregister function. |
| `beforeResolve` | `(guard: NavigationGuard) => () => void`            | Adds a guard called before navigation is resolved.           |
| `afterEach`     | `(hook: NavigationHook) => () => void`              | Adds a global navigation hook called after navigation.       |
| `resolve`       | `(to: RouteLocation) => ResolvedRoute`              | Resolves a route location to a normalized route object.      |
| `hasRoute`      | `(name: string) => boolean`                         | Checks if a route with the given name exists.                |
| `addRoute`      | `(route: RouteRecord, parentName?: string) => void` | Dynamically add a new route.                                 |
| `removeRoute`   | `(name: string) => void`                            | Dynamically remove a route by name.                          |
| `getRoutes`     | `() => NormalizedRouteRecord[]`                     | Returns all normalized route records.                        |

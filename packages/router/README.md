<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

<p align="center">
  Type-safe browser navigation and request-isolated routing for Effuse.
</p>

# `@effuse/router`

The router owns route matching, browser and memory history, navigation guards,
lazy route components, links, route views, and the router state exposed through
Effuse's script context.

## Install

```bash
pnpm add @effuse/router
```

## Browser application

Install one router for the lifetime of the browser application.

```ts
import { createRouter, createWebHistory, installRouter } from '@effuse/router';

const router = createRouter({
	history: createWebHistory(),
	routes,
});

const installed = installRouter(router);
```

Call `installed.cleanup()` when the application itself is disposed.

## Public Surface

| Area        | APIs                                                           |
| ----------- | -------------------------------------------------------------- |
| Runtime     | `createRouter`, `installRouter`, `runWithRouter`               |
| History     | `createWebHistory`, `createHashHistory`, `createMemoryHistory` |
| Components  | `RouterView`, `Link`, `RouterLink`                             |
| Composition | `useRouter`, `useRoute`, `navigateTo`, `onRouteChange`         |
| Loading     | `lazyRoute`, `lazyRouteComponent`                              |

Navigation guards may redirect, cancel, or allow navigation. Keep guard side
effects cancellable and avoid storing request-specific decisions globally.

## Server request isolation

Create a memory-history router for each incoming URL and render inside
`runWithRouter()`. Router composables, `Link`, `RouterView`, and the core script
context then resolve the same request-owned router across asynchronous work.

```ts
import {
	createMemoryHistory,
	createRouter,
	runWithRouter,
} from '@effuse/router';

export const renderRequest = (url: string) => {
	const router = createRouter({
		history: createMemoryHistory(url),
		routes,
	});

	return runWithRouter(router, () => renderApplication(url));
};
```

Do not use `installRouter()` per request. Its global installation is the
browser-compatible application fallback; `runWithRouter()` owns concurrent SSR
router and route state for the lifetime of its callback or returned promise.

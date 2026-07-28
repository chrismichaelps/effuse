<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

<p align="center">
  A simple, type-safe router for Single Page Applications (SPA). It manages URL state and navigation seamlessly for Effuse applications.
</p>

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

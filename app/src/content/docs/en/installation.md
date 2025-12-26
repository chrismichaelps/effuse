---
title: Installation
---

# Installation

Get Effuse set up in your project in minutes.

## Requirements

- **Node.js** v23.0.0 or later
- **npm**, **yarn**, or **pnpm**
- TypeScript 5.0+ (recommended)

## Package Installation

Effuse packages are not yet published to npm. The framework is currently in development. You can clone the repository and use it locally via workspace linking.

## Manual Setup

### 1. Create Entry Point

```typescript
// src/main.tsx
import { createApp } from '@effuse/core';
import { installRouter, router } from './router';
import { App } from './App';

installRouter(router);

const app = createApp(App);
app.mount('#app');
```

### 2. Create App Component

```tsx
// src/App.tsx
import { define } from '@effuse/core';
import { RouterView } from '@effuse/router';

export const App = define({
	script: () => ({}),
	template: () => (
		<div>
			<RouterView />
		</div>
	),
});
```

### 3. Configure Router

```typescript
// src/router/index.ts
import {
	createRouter,
	createWebHistory,
	installRouter,
	type RouteRecord,
} from '@effuse/router';
import { HomePage } from '../pages/Home';

const routes: RouteRecord[] = [
	{ path: '/', name: 'home', component: HomePage },
];

export const router = createRouter({
	history: createWebHistory(),
	routes,
});

export { installRouter };
```

## TypeScript Configuration

Not available at the moment.

## Vite Configuration

Not available at the moment.

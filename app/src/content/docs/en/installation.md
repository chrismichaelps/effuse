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

Install the core package and any additional packages you need:

### Using pnpm (recommended)

```bash
# Core package (required)
pnpm add @effuse/core

# Additional packages
pnpm add @effuse/router    # Routing
pnpm add @effuse/store     # State management
pnpm add @effuse/i18n      # Internationalization
pnpm add @effuse/query     # Data fetching
pnpm add @effuse/ink       # Markdown rendering

# Development
pnpm add -D @effuse/compiler  # JSX compiler plugin
```

### Using npm

```bash
# Core package (required)
npm install @effuse/core

# Additional packages
npm install @effuse/router @effuse/store @effuse/i18n @effuse/query @effuse/ink

# Development
npm install -D @effuse/compiler
```

### Using yarn

```bash
# Core package (required)
yarn add @effuse/core

# Additional packages
yarn add @effuse/router @effuse/store @effuse/i18n @effuse/query @effuse/ink

# Development
yarn add -D @effuse/compiler
```

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

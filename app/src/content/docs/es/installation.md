---
title: Instalación
---

# Instalación

Configura Effuse en tu proyecto en minutos.

## Requisitos

- **Node.js** v23.0.0 o superior
- **npm**, **yarn**, o **pnpm**
- TypeScript 5.0+ (recomendado)

## Instalación de Paquetes

Los paquetes de Effuse aún no están publicados en npm. El framework está actualmente en desarrollo. Puedes clonar el repositorio y usarlo localmente mediante enlace de workspace.

## Configuración Manual

### 1. Crear Punto de Entrada

```typescript
// src/main.tsx
import { createApp } from '@effuse/core';
import { installRouter, router } from './router';
import { App } from './App';

installRouter(router);

const app = createApp(App);
app.mount('#app');
```

### 2. Crear Componente App

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

### 3. Configurar Router

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

## Configuración de TypeScript

No disponible por el momento.

## Configuración de Vite

No disponible por el momento.

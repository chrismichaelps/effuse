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

Instala el paquete principal y cualquier paquete adicional que necesites:

### Usando pnpm (recomendado)

```bash
# Paquete principal (requerido)
pnpm add @effuse/core

# Paquetes adicionales
pnpm add @effuse/router    # Enrutamiento
pnpm add @effuse/store     # Gestión de estado
pnpm add @effuse/i18n      # Internacionalización
pnpm add @effuse/query     # Obtención de datos
pnpm add @effuse/ink       # Renderizado de Markdown

# Desarrollo
pnpm add -D @effuse/compiler  # Plugin del compilador JSX
```

### Usando npm

```bash
# Paquete principal (requerido)
npm install @effuse/core

# Paquetes adicionales
npm install @effuse/router @effuse/store @effuse/i18n @effuse/query @effuse/ink

# Desarrollo
npm install -D @effuse/compiler
```

### Usando yarn

```bash
# Paquete principal (requerido)
yarn add @effuse/core

# Paquetes adicionales
yarn add @effuse/router @effuse/store @effuse/i18n @effuse/query @effuse/ink

# Desarrollo
yarn add -D @effuse/compiler
```

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

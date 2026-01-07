---
title: Primeros Pasos
---

# Primeros Pasos con Effuse

Bienvenido a **Effuse**, un moderno framework de UI reactivo construido con TypeScript.

## ¿Qué es Effuse?

Effuse es un framework de UI basado en señales que combina las mejores ideas del desarrollo frontend moderno:

- **Reactividad de grano fino** — Solo los nodos del DOM que dependen de datos modificados se actualizan
- **Componentes seguros con tipos** — Soporte completo de TypeScript con tipos inferidos
- **Robustez** — Diseñado para una gestión fiable de tareas asíncronas y errores
- **Arquitectura componible** — Capas y plugins para extensibilidad

## Ejemplo Rápido

Aquí hay un componente contador simple:

```tsx
import { define, signal } from '@effuse/core';

const Counter = define({
	script: () => {
		const count = signal(0);
		const increment = () => count.value++;
		return { count, increment };
	},
	template: ({ count, increment }) => (
		<button onClick={increment}>Clic {count} veces</button>
	),
});
```

## Configuración del Framework

Así es como configuras la raíz de tu aplicación, incluyendo enrutamiento y capas:

### 1. Componente App (src/App.tsx)

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

### 2. Punto de Entrada (src/main.ts)

```typescript
import { createApp } from '@effuse/core';
import { InkLayer } from '@effuse/ink';
import { App } from './App';
import { router, installRouter } from './router';

import './styles.css';

// Instalar router antes de crear la app
installRouter(router);

// Crear y montar la aplicación
createApp(App)
	.useLayers([InkLayer])
	.then((app) => app.mount('#app'));
```

### 3. Configuración del Router (src/router/index.ts)

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

## Definición de Componentes

Los componentes se crean usando la función `define`, que acepta un objeto de configuración con `script` y `template`:

- **script**: Contiene la lógica del componente, estado y manejadores de eventos
- **template**: Retorna JSX que renderiza el componente

## Contexto del Script

La función `script` recibe un objeto `ScriptContext` con utilidades:

| Propiedad         | Tipo                         | Descripción                                                       |
| ----------------- | ---------------------------- | ----------------------------------------------------------------- |
| `props`           | `Readonly<P>`                | Propiedades pasadas al componente. Solo lectura y congeladas.     |
| `expose`          | `(values: object) => void`   | Exponer valores manualmente al template.                          |
| `signal`          | `<T>(value: T) => Signal<T>` | Crear una nueva señal reactiva.                                   |
| `store`           | `<T>(name: string) => T`     | Acceder a un store global por nombre.                             |
| `router`          | `Router`                     | Acceder a la instancia del router.                                |
| `onMount`         | `(cb) => void`               | Callback después de montar el componente. Puede retornar cleanup. |
| `onUnmount`       | `(cb) => void`               | Callback cuando el componente se remueve.                         |
| `onBeforeMount`   | `(cb) => void`               | Callback antes de montar el componente.                           |
| `onBeforeUnmount` | `(cb) => void`               | Callback antes de desmontar el componente.                        |
| `watch`           | `(source, cb) => void`       | Observar una señal y ejecutar callback al cambiar.                |
| `useCallback`     | `(fn, deps?) => fn`          | Memorizar un callback con identidad estable.                      |
| `useMemo`         | `(fn, deps?) => getter`      | Memorizar un valor computado.                                     |

## Próximos Pasos

¿Listo para profundizar? Aquí tienes los siguientes pasos:

- **[Instalación](/docs/installation)** — Configura Effuse en tu proyecto
- **[Inicio Rápido](/docs/quick-start)** — Construye tu primera app
- **[Señales](/docs/signals)** — Domina el sistema de reactividad

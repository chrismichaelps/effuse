---
title: Enrutamiento
---

# Enrutamiento

Effuse Router proporciona enrutamiento declarativo y seguro en tipos.

## Configuración

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

// Instalar router antes de crear app
installRouter(router);
```

## Navegación con Link

Usa el componente `Link` para navegación:

```tsx
import { define } from '@effuse/core';
import { Link } from '@effuse/router';

const Nav = define({
	script: () => ({}),
	template: () => (
		<nav>
			<Link to="/">Inicio</Link>
			<Link to="/docs/getting-started">Docs</Link>
			<Link to="/contact">Contacto</Link>
		</nav>
	),
});
```

## RouterView

Usa `RouterView` para renderizar el componente coincidente:

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

## Parámetros de Ruta Dinámicos

Accede a parámetros de ruta, cadenas de consulta y hash en tus componentes usando el hook `useRoute`. Primero, define tu ruta con segmentos dinámicos:

```typescript
const routes: RouteRecord[] = [
	{
		path: '/user/:userId',
		name: 'user-profile',
		component: UserProfile,
	},
];
```

Luego accede a los parámetros en tu componente:

```tsx
import { define } from '@effuse/core';
import { useRoute } from '@effuse/router';

const UserProfile = define({
	script: () => {
		const route = useRoute();

		return {
			userId: route.params.userId, // Coincide con :userId en el path
			search: route.query.q, // Accede a ?q=... de la URL
		};
	},
	template: ({ userId, search }) => (
		<div class="user-profile">
			<h1>Perfil de Usuario</h1>
			<p>ID de Usuario: {userId}</p>
			{search && <p>Buscando: {search}</p>}
		</div>
	),
});
```

## Navegación Programática

Navega programáticamente usando el hook `useRouter`:

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
		<button onClick={goToSettings}>Ir a Configuración</button>
	),
});
```

## Composables del Router

### `useRoute()`

Retorna el objeto de ruta actual. Este objeto contiene propiedades reactivas que se actualizan cuando ocurre navegación.

| Propiedad  | Tipo                      | Descripción                                             |
| :--------- | :------------------------ | :------------------------------------------------------ |
| `path`     | `string`                  | El pathname de la ruta.                                 |
| `fullPath` | `string`                  | La URL completa incluyendo query y hash.                |
| `params`   | `Record<string, string>`  | Pares clave-valor de segmentos dinámicos.               |
| `query`    | `Record<string, string>`  | Pares clave-valor de la cadena de consulta.             |
| `hash`     | `string`                  | El fragmento hash de la URL.                            |
| `matched`  | `NormalizedRouteRecord[]` | Array de registros de ruta coincidentes para anidación. |
| `name`     | `string o undefined`      | El nombre dado al registro de ruta.                     |
| `meta`     | `Record<string, any>`     | Metadatos definidos en la ruta o sus padres.            |

### `useRouter()`

Retorna la instancia del router para control programático.

| Miembro         | Firma / Tipo                                        | Descripción                                                       |
| :-------------- | :-------------------------------------------------- | :---------------------------------------------------------------- |
| `currentRoute`  | `Signal<Route>`                                     | Señal reactiva de la ruta actual.                                 |
| `routes`        | `NormalizedRouteRecord[]`                           | Array de solo lectura de todas las rutas registradas.             |
| `isReady`       | `boolean`                                           | Si el router ha terminado la inicialización.                      |
| `push`          | `(to: RouteLocation) => void`                       | Navega a una nueva URL, añadiendo entrada al historial.           |
| `replace`       | `(to: RouteLocation) => void`                       | Navega a nueva URL reemplazando la entrada actual.                |
| `back`          | `() => void`                                        | Navega un paso atrás en el historial.                             |
| `forward`       | `() => void`                                        | Navega un paso adelante en el historial.                          |
| `go`            | `(delta: number) => void`                           | Navega `n` pasos atrás o adelante.                                |
| `beforeEach`    | `(guard: NavigationGuard) => () => void`            | Añade un guard de navegación global. Retorna función para quitar. |
| `beforeResolve` | `(guard: NavigationGuard) => () => void`            | Añade guard llamado antes de resolver navegación.                 |
| `afterEach`     | `(hook: NavigationHook) => () => void`              | Añade hook de navegación global llamado después de navegar.       |
| `resolve`       | `(to: RouteLocation) => ResolvedRoute`              | Resuelve una ubicación de ruta a un objeto de ruta normalizado.   |
| `hasRoute`      | `(name: string) => boolean`                         | Verifica si existe una ruta con el nombre dado.                   |
| `addRoute`      | `(route: RouteRecord, parentName?: string) => void` | Añade dinámicamente una nueva ruta.                               |
| `removeRoute`   | `(name: string) => void`                            | Remueve dinámicamente una ruta por nombre.                        |
| `getRoutes`     | `() => NormalizedRouteRecord[]`                     | Retorna todos los registros de ruta normalizados.                 |

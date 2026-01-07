---
title: Capas
---

# Capas

Las capas proporcionan inyección de dependencias, estado compartido y gestión del ciclo de vida en toda tu aplicación. Permiten que los componentes y hooks accedan a servicios globales sin perforación de props.

## Visión General

El sistema de capas consiste en tres conceptos clave:

| Concepto        | Propósito                                          | Acceso en Componentes                       |
| --------------- | -------------------------------------------------- | ------------------------------------------- |
| **store**       | Contenedor de estado reactivo (signals)            | Via `deriveProps` → `useLayerProps`         |
| **deriveProps** | Extraer signals del store para componentes         | `useLayerProps('nombre')`                   |
| **provides**    | Servicios/factories para inyección de dependencias | `useStore('clave')` o `useService('clave')` |

## Creando una Capa

Usa `defineLayer` de `@effuse/core`:

```typescript
import { defineLayer, signal } from '@effuse/core';
import { createStore } from '@effuse/store';

// Crear un store con estado reactivo
const themeStore = createStore('theme', {
	mode: 'dark' as 'light' | 'dark',
	accentColor: '#8df0cc',

	setMode(mode: 'light' | 'dark') {
		this.mode.value = mode;
	},

	toggleMode() {
		this.mode.value = this.mode.value === 'dark' ? 'light' : 'dark';
	},
});

export const ThemeLayer = defineLayer({
	name: 'theme',

	// Dependencias de otras capas (se cargan primero)
	dependencies: ['layout'],

	// La instancia del store para esta capa
	store: themeStore,

	// Extraer props reactivos del store para componentes
	deriveProps: (store) => ({
		mode: store.mode,
		accentColor: store.accentColor,
	}),

	// Servicios expuestos via inyección de dependencias
	provides: {
		theme: () => themeStore,
	},

	// Hooks de ciclo de vida
	onMount: (ctx) => {
		// ctx.store, ctx.deps, ctx.getService disponibles
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme) ctx.store.mode.value = savedTheme as 'light' | 'dark';
	},

	onUnmount: (ctx) => {
		// Persistir estado antes de desmontar
		localStorage.setItem('theme', ctx.store.mode.value);
	},

	onError: (error, ctx) => {
		// Recuperación inteligente con acceso al contexto
		console.error('[ThemeLayer] error:', error.message);
		ctx.store.mode.value = 'dark'; // fallback
	},

	onReady: (ctx, allLayers) => {
		// Llamado después de que TODAS las capas estén inicializadas
		console.log(`[ThemeLayer] listo con ${allLayers.length} capas`);
	},

	// Función setup con acceso al store y dependencias
	setup: (ctx) => {
		// ctx.store es el themeStore con seguridad de tipos completa
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme === 'light' || savedTheme === 'dark') {
			ctx.store.mode.value = savedTheme;
		}

		// Retornar función de limpieza (opcional)
		return () => {
			console.log('[ThemeLayer] limpieza');
		};
	},
});
```

## Esquema de Capa

Las opciones completas de `defineLayer`:

```typescript
interface EffuseLayer<P, D, S> {
	// Requerido
	name: string; // Identificador único

	// Gestión de estado
	store?: S; // Instancia de store (createStore)
	deriveProps?: (store: S) => P; // Extraer props del store

	// Inyección de dependencias
	dependencies?: D; // Array de nombres de capas a cargar primero
	provides?: Record<string, () => unknown>; // Factories de servicios

	// Ciclo de vida
	setup?: (ctx: SetupContext<P, D, S>) => CleanupFn | void;
	onMount?: (ctx: SetupContext<P, D, S>) => void;
	onUnmount?: (ctx: SetupContext<P, D, S>) => void;
	onError?: (error: Error, ctx: SetupContext<P, D, S>) => void;
	onReady?: (ctx: SetupContext<P, D, S>, allLayers: ResolvedLayer[]) => void;

	// Avanzado
	components?: Record<string, Component>; // Componentes con scope
	routes?: RouteConfig[]; // Rutas específicas de la capa
	plugins?: PluginFn[]; // Plugins de la capa
}
```

## store vs provides

| Aspecto          | `store`                      | `provides`                                 |
| ---------------- | ---------------------------- | ------------------------------------------ |
| **Propósito**    | Estado reactivo de la capa   | Servicios de inyección de dependencias     |
| **Qué contiene** | Instancia de `createStore()` | Funciones factory `{ clave: () => valor }` |
| **Usado en**     | `deriveProps(store)` → props | Componentes via `useStore('clave')`        |
| **Reactividad**  | Signals incorporados         | Lo que retornes                            |

### store

El **store** es el estado reactivo interno de la capa, creado via `@effuse/store`:

```typescript
const i18nStore = createStore('i18n', {
	locale: 'en',
	translations: null as Record<string, string> | null,

	setLocale(loc: string) {
		this.locale.value = loc;
		// Cargar traducciones...
	},
});

defineLayer({
	name: 'i18n',
	store: i18nStore,
	deriveProps: (store) => ({
		locale: store.locale,
		translations: store.translations,
	}),
});
```

### provides

**provides** expone servicios para inyección de dependencias:

```typescript
defineLayer({
	name: 'router',
	provides: {
		router: () => routerInstance, // Función factory
	},
});

// En un componente:
script: ({ useStore }) => {
	const router = useStore('router'); // Obtiene el router
};
```

## Usando Capas en Componentes

Accede a los datos y servicios de capas en scripts de componentes:

```tsx
import { define, computed } from '@effuse/core';

const ThemeToggle = define({
	script: ({ useLayerProps, useStore }) => {
		// Obtener props reactivos de deriveProps
		const themeProps = useLayerProps('theme');

		// Obtener servicio de provides
		const themeStore = useStore('theme');

		const buttonText = computed(() =>
			themeProps?.mode.value === 'dark' ? 'Claro' : 'Oscuro'
		);

		const toggle = () => {
			themeStore?.toggleMode();
		};

		return { buttonText, toggle };
	},
	template: ({ buttonText, toggle }) => (
		<button onClick={toggle}>{buttonText}</button>
	),
});
```

## Usando Capas en Hooks

Usa `defineHook` para crear hooks reutilizables con acceso a capas:

```typescript
import { defineHook, signal } from '@effuse/core';

export const useTheme = defineHook<
	undefined, // Sin config
	{ mode: Signal<string>; toggle: () => void }
>({
	name: 'useTheme',
	deps: ['theme'] as const,
	setup: ({ layer }) => {
		// layer() retorna el resultado de deriveProps
		const themeProps = layer('theme');

		return {
			mode: themeProps.mode,
			toggle: () => {
				themeProps.mode.value =
					themeProps.mode.value === 'dark' ? 'light' : 'dark';
			},
		};
	},
});
```

## Dependencias de Capas

Las capas declaran sus dependencias explícitamente:

```typescript
defineLayer({
	name: 'todos',
	dependencies: ['i18n', 'router'], // ← Deben cargarse primero
	setup: (ctx) => {
		// Acceder a capas de dependencia
		const i18n = ctx.deps.i18n;
		const router = ctx.deps.router;
	},
});
```

El runtime de capas asegura que las dependencias se inicialicen en el orden correcto.

## Registro de Tipos

Para seguridad de tipos completa, extiende `EffuseLayerRegistry` via module augmentation:

```typescript
// src/layers/effuse.d.ts
import type { Signal } from '@effuse/core';

declare module '@effuse/core' {
	interface EffuseLayerRegistry {
		theme: {
			props: {
				mode: Signal<'light' | 'dark'>;
				accentColor: Signal<string>;
			};
			provides: { theme: typeof themeStore };
		};
		i18n: {
			props: {
				locale: Signal<string>;
				translations: Signal<Record<string, string> | null>;
			};
			provides: { i18n: typeof i18nStore };
		};
	}
}

export {};
```

Esto habilita la inferencia de tipos:

```typescript
const { mode } = useLayerProps('theme')!;
//      ^? Signal<'light' | 'dark'>
```

## Ejemplo Real: Capa I18n

```typescript
import { defineLayer } from '@effuse/core';
import { i18nStore } from '../store/appI18n';

export const I18nLayer = defineLayer({
	name: 'i18n',
	dependencies: ['router'],

	store: i18nStore,

	deriveProps: (store) => ({
		locale: store.locale,
		isLoading: store.isLoading,
		translations: store.translations,
	}),

	provides: {
		i18n: () => i18nStore,
	},

	onMount: (ctx) => {
		const saved = localStorage.getItem('effuse:locale');
		if (saved) ctx.store.setLocale(saved);
	},

	onUnmount: (ctx) => {
		localStorage.setItem('effuse:locale', ctx.store.locale.value);
	},

	onError: (_, ctx) => {
		ctx.store.setLocale('en'); // fallback
	},

	onReady: (ctx, allLayers) => {
		console.log(`[I18nLayer] Listo con ${allLayers.length} capas`);
	},

	setup: (ctx) => {
		ctx.store.init(); // Cargar traducciones lo antes posible
	},
});
```

## Mejores Prácticas

1. **Una Capa Por Dominio** - Crea capas enfocadas (auth, i18n, theme, todos)
2. **Store para Estado** - Usa `store` + `deriveProps` para valores reactivos
3. **Provides para Servicios** - Usa `provides` para métodos, stores y servicios
4. **Declarar Dependencias** - Lista todas las capas requeridas en `dependencies`
5. **Setup para Init** - Usa `setup` para inicialización (localStorage, llamadas API)
6. **Limpieza en Setup** - Retorna función de limpieza desde `setup` cuando sea necesario
7. **Registro de Tipos** - Usa module augmentation para acceso tipado a capas

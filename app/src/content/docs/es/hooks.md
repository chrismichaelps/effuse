---
title: Hooks
---

# Hooks

Los Hooks en Effuse proporcionan lógica reutilizable y componible con gestión de ciclo de vida integrada. Crea hooks personalizados usando `defineHook` de `@effuse/core`.

## Creando un Hook

Usa `defineHook` para crear hooks tipados y reutilizables:

```typescript
import { defineHook, type Signal } from '@effuse/core';

interface ToggleConfig {
	initial?: boolean;
}

interface ToggleReturn {
	isOpen: Signal<boolean>;
	toggle: () => void;
	open: () => void;
	close: () => void;
}

export const useToggle = defineHook<ToggleConfig, readonly [], ToggleReturn>({
	name: 'useToggle',
	setup: ({ config, signal }): ToggleReturn => {
		const isOpen = signal(config.initial ?? false);

		return {
			isOpen,
			toggle: () => {
				isOpen.value = !isOpen.value;
			},
			open: () => {
				isOpen.value = true;
			},
			close: () => {
				isOpen.value = false;
			},
		};
	},
});
```

## Contexto del Hook

La función `setup` recibe un objeto de contexto con estas utilidades:

| Propiedad       | Descripción                                            |
| --------------- | ------------------------------------------------------ |
| `config`        | Configuración pasada al llamar al hook                 |
| `signal`        | Crear señales reactivas                                |
| `computed`      | Crear valores derivados computados                     |
| `effect`        | Ejecutar efectos secundarios que rastrean dependencias |
| `onMount`       | Registrar callbacks para cuando el hook se monta       |
| `layer`         | Acceder a props de capas por nombre                    |
| `layerProvider` | Acceder a servicios de capas                           |
| `scope`         | Gestionar limpieza y finalizadores                     |

## Usando Hooks en Componentes

Llama a los hooks en la función `script` de tu componente:

```tsx
import { define } from '@effuse/core';
import { useToggle } from '../hooks';

const Dropdown = define({
	script: ({ onMount }) => {
		const menu = useToggle({ initial: false });

		return {
			isOpen: menu.isOpen,
			toggle: menu.toggle,
		};
	},
	template: ({ isOpen, toggle }) => (
		<div>
			<button onClick={toggle}>{isOpen.value ? 'Cerrar' : 'Abrir'}</button>
			{isOpen.value && <div class="menu">Contenido del Menú</div>}
		</div>
	),
});
```

## Hooks Dependientes del DOM

Para hooks que necesitan acceso al DOM, usa un patrón de inicialización diferida:

```typescript
import { defineHook, type Signal } from '@effuse/core';

interface ClickOutsideConfig {
	selector: string;
}

interface ClickOutsideReturn {
	onClickOutside: (callback: () => void) => void;
	init: () => void;
}

export const useClickOutside = defineHook<
	ClickOutsideConfig,
	readonly [],
	ClickOutsideReturn
>({
	name: 'useClickOutside',
	setup: ({ config, signal, effect }): ClickOutsideReturn => {
		const initialized = signal(false);
		let callback: (() => void) | null = null;

		effect(() => {
			if (!initialized.value) return undefined;

			const handleClick = (e: Event) => {
				const target = e.target as HTMLElement;
				if (!target.closest(config.selector)) {
					callback?.();
				}
			};

			document.addEventListener('click', handleClick);
			return () => document.removeEventListener('click', handleClick);
		});

		return {
			onClickOutside: (cb) => {
				callback = cb;
			},
			init: () => {
				initialized.value = true;
			},
		};
	},
});
```

## Accediendo a Capas desde Hooks

Los hooks pueden acceder al estado y servicios de las capas:

```typescript
import { defineHook } from '@effuse/core';

export const useTranslation = defineHook<
	undefined,
	readonly ['i18n'],
	{ t: (key: string) => string }
>({
	name: 'useTranslation',
	deps: ['i18n'],
	setup: ({ layer }) => {
		const i18n = layer('i18n');
		const translations = i18n.translations;

		return {
			t: (key: string) => translations.value?.[key] ?? key,
		};
	},
});
```

## Limpieza

Los efectos se limpian automáticamente cuando el componente se desmonta. Retorna una función de limpieza desde `effect`:

```typescript
effect(() => {
	const handler = () => {
		/* ... */
	};
	window.addEventListener('resize', handler);

	// La limpieza se ejecuta cuando el efecto se re-ejecuta o el componente se desmonta
	return () => window.removeEventListener('resize', handler);
});
```

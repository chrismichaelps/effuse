---
title: Contexto
---

# API de Contexto

La API de Contexto en Effuse proporciona una forma poderosa de compartir estado entre componentes sin perforación de props. Utiliza internamente un registro basado en pila para un soporte adecuado de anidamiento.

## Creando un Contexto

Usa `createContext` para definir un nuevo contexto con un valor predeterminado opcional:

```typescript
import { createContext } from '@effuse/core';

interface ThemeConfig {
	mode: 'light' | 'dark';
	primaryColor: string;
}

const ThemeContext = createContext<ThemeConfig>({
	id: 'theme',
	defaultValue: {
		mode: 'dark',
		primaryColor: '#6366f1',
	},
	displayName: 'Theme',
});
```

### Opciones de Contexto

| Propiedad      | Tipo           | Descripción                                        |
| -------------- | -------------- | -------------------------------------------------- |
| `id`           | `string`       | Identificador único para el contexto               |
| `defaultValue` | `T \| () => T` | Valor predeterminado opcional o función de fábrica |
| `displayName`  | `string`       | Nombre legible para depuración                     |

## Usando Valores de Contexto

Usa `useContext` para consumir un valor de contexto en cualquier componente:

```tsx
import { define, useContext } from '@effuse/core';
import { ThemeContext } from './contexts';

const ThemedButton = define({
	script: () => {
		const theme = useContext(ThemeContext);

		return { theme };
	},
	template: ({ theme }) => (
		<button
			style={{
				backgroundColor: theme.primaryColor,
				color: theme.mode === 'dark' ? '#fff' : '#000',
			}}
		>
			Botón con Tema
		</button>
	),
});
```

## Proporcionando Valores de Contexto

Usa el componente `Provider` auto-generado para suministrar valores:

```tsx
import { define } from '@effuse/core';
import { ThemeContext } from './contexts';

const App = define({
	script: () => {
		const customTheme = {
			mode: 'light' as const,
			primaryColor: '#22c55e',
		};

		return { customTheme };
	},
	template: ({ customTheme }) => (
		<ThemeContext.Provider value={customTheme}>
			<ThemedButton />
			<NestedComponent />
		</ThemeContext.Provider>
	),
});
```

## Proveedores Anidados

Los valores de contexto se apilan correctamente. Los proveedores internos anulan a los externos:

```tsx
const NestedExample = define({
	template: () => (
		<ThemeContext.Provider value={{ mode: 'dark', primaryColor: '#6366f1' }}>
			{/* Este componente ve el tema oscuro */}
			<ThemedButton />

			<ThemeContext.Provider value={{ mode: 'light', primaryColor: '#22c55e' }}>
				{/* Este componente ve el tema claro */}
				<ThemedButton />
			</ThemeContext.Provider>
		</ThemeContext.Provider>
	),
});
```

## Verificando Disponibilidad de Contexto

Usa `hasContextValue` para verificar si existe un valor de contexto:

```typescript
import { hasContextValue } from '@effuse/core';

if (hasContextValue(ThemeContext)) {
	const theme = useContext(ThemeContext);
	// ...
}
```

## Guardia de Tipo

Usa `isEffuseContext` para verificar si un valor es un contexto de Effuse:

```typescript
import { isEffuseContext } from '@effuse/core';

function processContext(maybeContext: unknown) {
	if (isEffuseContext(maybeContext)) {
		console.log('Contexto válido:', maybeContext.id);
	}
}
```

## Manejo de Errores

Cuando un contexto no se encuentra y no tiene valor predeterminado, `useContext` lanza un `ContextNotFoundError`:

```typescript
import { useContext, ContextNotFoundError } from '@effuse/core';

try {
	const auth = useContext(AuthContext);
} catch (error) {
	if (error instanceof ContextNotFoundError) {
		console.error(`Contexto "${error.contextId}" no encontrado`);
	}
}
```

## Mejores Prácticas

1. **Usa IDs descriptivos**: Elige IDs únicos y descriptivos para tus contextos
2. **Proporciona valores predeterminados cuando sea posible**: Hace los componentes más resilientes
3. **Mantén los contextos enfocados**: Un contexto por concepto (tema, auth, i18n)
4. **Tipea tus contextos**: Siempre usa genéricos de TypeScript para seguridad de tipos
5. **Usa displayName**: Ayuda con la depuración y devtools

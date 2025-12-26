---
title: Señales
---

# Señales

Las señales son la base del sistema de reactividad de Effuse. Se importan directamente de `@effuse/core`.

## Creando Señales

Importa `signal` de `@effuse/core` para crear estado reactivo:

```tsx
import { define, signal, computed } from '@effuse/core';

export const Counter = define({
	script: () => {
		// Crear una señal con valor inicial
		const count = signal(0);

		// Crear estado derivado computado
		const doubleCount = computed(() => count.value * 2);

		// Definir operaciones que mutan la señal
		const increment = () => count.value++;
		const decrement = () => count.value--;

		// Retornar señales y operaciones al template
		return { count, doubleCount, increment, decrement };
	},
	template: ({ count, doubleCount, increment, decrement }) => (
		<div>
			<p>Contador: {count}</p>
			<p>Doble: {doubleCount}</p>
			<button onClick={decrement}>-</button>
			<button onClick={increment}>+</button>
		</div>
	),
});
```

## Tipos de Reactividad

### 1. Señales Escribibles

El `signal()` básico crea una referencia escribible. Accede y muta mediante la propiedad `.value`.

```tsx
import { define, signal } from '@effuse/core';

const ColorPicker = define({
	script: () => {
		// Primitivos
		const color = signal('azul');
		// Objetos/Arrays
		const palette = signal(['rojo', 'azul', 'verde']);

		const updateColor = (newColor: string) => {
			color.value = newColor; // Dispara actualizaciones
		};

		return { color, palette, updateColor };
	},
	template: ({ color, updateColor }) => (
		<button onClick={() => updateColor('rojo')}>Actual: {color}</button>
	),
});
```

### 2. Señales Computadas

Las señales computadas derivan su valor de otras señales. Se actualizan automáticamente cuando las dependencias cambian.

```tsx
import { define, signal, computed } from '@effuse/core';

const GradientBox = define({
	script: () => {
		const startColor = signal('rojo');
		const endColor = signal('azul');

		// Rastrea dependencias automáticamente
		const gradient = computed(
			() => `linear-gradient(${startColor.value}, ${endColor.value})`
		);

		return { gradient };
	},
	template: ({ gradient }) => (
		<div style={`background: ${gradient.value}`}>Degradado</div>
	),
});
```

### 3. Observando Señales

Usa el helper `watch` del contexto del script para realizar efectos secundarios cuando una señal cambia.

```tsx
import { define, signal } from '@effuse/core';

const Logger = define({
	script: ({ watch }) => {
		const count = signal(0);

		// Se ejecuta cada vez que count cambia
		watch(count, (value) => {
			console.log(`Contador cambió a: ${value}`);
		});

		return { count, increment: () => count.value++ };
	},
	template: ({ count, increment }) => (
		<button onClick={increment}>{count}</button>
	),
});
```

## Usando Señales en Templates

Las señales se pueden usar directamente en JSX - actualizarán automáticamente el DOM:

```tsx
// Interpolación directa - se actualiza automáticamente
<p>Contador: {count}</p>

// Clases dinámicas con funciones
<button class={() => isActive.value ? 'active' : 'inactive'}>
  Alternar
</button>

// Renderizado condicional con computed
{computed(() => isLoading.value ? <Spinner /> : <Content />)}
```

## Mejores Prácticas

1. **Importar Directamente**: Importa `signal` y `computed` directamente de `@effuse/core`
2. **Exponer Señales**: Retorna el objeto señal desde `script`, no solo el valor
3. **Mutar en Manejadores**: Mantén la lógica de mutación de estado dentro de funciones manejadoras
4. **Usar Computed**: Prefiere estado derivado sobre sincronización manual

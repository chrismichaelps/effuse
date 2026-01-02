---
title: Señales
---

# Señales

Las señales son la base del sistema de reactividad de Effuse. Se importan directamente desde `@effuse/core`.

## Creando Señales

Importa `signal` desde `@effuse/core` para crear estado reactivo:

```tsx
import { define, signal, computed } from '@effuse/core';

export const Counter = define({
	script: () => {
		// Crear una señal con valor inicial
		const count = signal(0);

		// Crear estado derivado con computed
		const doubleCount = computed(() => count.value * 2);

		// Definir operaciones que mutan la señal
		const increment = () => count.value++;
		const decrement = () => count.value--;

		// Retornar señales y operaciones al template
		return { count, doubleCount, increment, decrement };
	},
	template: ({ count, doubleCount, increment, decrement }) => (
		<div>
			<p>Cuenta: {count}</p>
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
		const color = signal('blue');
		// Objetos/Arrays
		const palette = signal(['red', 'blue', 'green']);

		const updateColor = (newColor: string) => {
			color.value = newColor; // Dispara actualizaciones
		};

		return { color, palette, updateColor };
	},
	template: ({ color, updateColor }) => (
		<button onClick={() => updateColor('red')}>Actual: {color}</button>
	),
});
```

### 2. Señales Computed

Las señales computed derivan su valor de otras señales. Se actualizan automáticamente cuando las dependencias cambian.

```tsx
import { define, signal, computed } from '@effuse/core';

const GradientBox = define({
	script: () => {
		const startColor = signal('red');
		const endColor = signal('blue');

		// Rastrea dependencias automáticamente
		const gradient = computed(
			() => `linear-gradient(${startColor.value}, ${endColor.value})`
		);

		return { gradient };
	},
	template: ({ gradient }) => (
		<div style={`background: ${gradient.value}`}>Gradiente</div>
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

		// Se ejecuta cuando count cambia
		watch(count, (value) => {
			console.log(`Count cambió a: ${value}`);
		});

		return { count, increment: () => count.value++ };
	},
	template: ({ count, increment }) => (
		<button onClick={increment}>{count}</button>
	),
});
```

## Usando Señales en Templates

Las señales se pueden usar directamente en JSX - actualizarán el DOM automáticamente:

```tsx
// Interpolación directa - se actualiza automáticamente
<p>Cuenta: {count}</p>

// Clases dinámicas con funciones
<button class={() => isActive.value ? 'active' : 'inactive'}>
  Toggle
</button>

// Renderizado condicional con computed
{computed(() => isLoading.value ? <Spinner /> : <Content />)}
```

## Mejores Prácticas

1. **Importar Directamente**: Importa `signal` y `computed` directamente desde `@effuse/core`
2. **Exponer Señales**: Retorna el objeto señal desde `script`, no solo el valor
3. **Mutar en Handlers**: Mantén la lógica de mutación de estado dentro de handlers de funciones
4. **Usar Computed Cuando Sea Necesario**: Prefiere estado derivado sobre sincronización manual

## Optimizaciones del Compilador

El compilador de Effuse maneja automáticamente muchos escenarios de reactividad:

### Auto-Wrapping en Templates

Cuando usas expresiones en templates, el compilador automáticamente las envuelve en señales computed. No necesitas envolver manualmente cada valor derivado:

```tsx
// El compilador maneja esto automáticamente
template: ({ firstName, lastName }) => (
	<p>
		Nombre Completo: {firstName} {lastName}
	</p>
);

// No se necesita computed() explícito en casos simples
// El compilador optimizará el binding
```

### Cuándo Usar `computed()` Explícito

Usa `computed()` explícito cuando:

1. **Estado derivado complejo** - Múltiples señales combinadas con lógica
2. **Retornado desde script** - Para valores expuestos a múltiples consumidores
3. **Optimización de rendimiento** - Para cachear cálculos costosos

```tsx
script: () => {
	const items = signal<Item[]>([]);
	const filter = signal('all');

	// Computed explícito para lógica compleja retornada al template
	const filteredItems = computed(() => {
		const f = filter.value;
		return items.value.filter((item) =>
			f === 'all' ? true : item.status === f
		);
	});

	return { filteredItems, filter };
};
```

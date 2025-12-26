---
title: Inicio Rápido
---

# API de Componentes

Los componentes de Effuse se crean usando la función `define`, que proporciona un esquema seguro en tipos para definir lógica y renderizado.

## 1. define

La función `define` es el punto de entrada para crear componentes:

```tsx
import {
	define,
	signal,
	computed,
	type Signal,
	type ReadonlySignal,
} from '@effuse/core';

interface Props {
	title: string;
}

interface Exposed {
	count: Signal<number>;
	doubleCount: ReadonlySignal<number>;
	increment: () => void;
}

export const Counter = define<Props, Exposed>({
	script: ({ props }) => {
		const count = signal(0);
		const doubleCount = computed(() => count.value * 2);
		const increment = () => count.value++;

		return { count, doubleCount, increment };
	},
	template: ({ count, doubleCount, increment }, props) => (
		<div>
			<h1>{props.title}</h1>
			<p>Contador: {count}</p>
			<p>Doble: {doubleCount}</p>
			<button onClick={increment}>+</button>
		</div>
	),
});
```

## 2. script

La función `script` contiene la lógica de tu componente. Recibe un `ScriptContext` y retorna valores para el template.

### Propiedades de ScriptContext

| Propiedad         | Tipo                    | Descripción                                           |
| ----------------- | ----------------------- | ----------------------------------------------------- |
| `props`           | `Readonly<P>`           | Propiedades del padre. Solo lectura y congeladas.     |
| `expose`          | `(values) => void`      | Exponer valores manualmente al template.              |
| `signal`          | `(initial) => Signal`   | Crear una nueva señal reactiva.                       |
| `store`           | `(name) => T`           | Acceder a un store global por nombre.                 |
| `router`          | `Router`                | Acceder a la instancia del router.                    |
| `onMount`         | `(cb) => void`          | Callback después del montaje. Puede retornar cleanup. |
| `onUnmount`       | `(cb) => void`          | Callback cuando se remueve del DOM.                   |
| `onBeforeMount`   | `(cb) => void`          | Callback antes del montaje.                           |
| `onBeforeUnmount` | `(cb) => void`          | Callback antes del desmontaje.                        |
| `watch`           | `(source, cb) => void`  | Observar una señal y ejecutar callback al cambiar.    |
| `useCallback`     | `(fn, deps?) => fn`     | Callback memorizado con identidad estable.            |
| `useMemo`         | `(fn, deps?) => getter` | Memorizar un valor computado.                         |

## 3. template

La función `template` retorna la estructura JSX. Recibe los valores expuestos y los props:

```tsx
template: ({ count, increment, children }, props) => (
	<div class="counter">
		<h1>{props.title}</h1>
		<p>Contador: {count}</p>
		<button onClick={increment}>+</button>
		{children}
	</div>
);
```

## 4. useCallback para Manejadores de Eventos

Usa `useCallback` del contexto del script para referencias estables de manejadores de eventos:

```tsx
const Form = define({
	script: ({ useCallback }) => {
		const value = signal('');

		const handleChange = useCallback((e: Event) => {
			value.value = (e.target as HTMLInputElement).value;
		});

		const handleSubmit = useCallback(() => {
			console.log('Enviado:', value.value);
			value.value = '';
		});

		return { value, handleChange, handleSubmit };
	},
	template: ({ value, handleChange, handleSubmit }) => (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			<input value={value} onInput={handleChange} />
			<button type="submit">Enviar</button>
		</form>
	),
});
```

## 5. Ejemplo de Ciclo de Vida

```tsx
const Timer = define({
	script: ({ onMount, onUnmount }) => {
		const seconds = signal(0);

		onMount(() => {
			const interval = setInterval(() => {
				seconds.value++;
			}, 1000);

			// Retornar función de limpieza
			return () => clearInterval(interval);
		});

		onUnmount(() => {
			console.log('Componente Timer removido');
		});

		return { seconds };
	},
	template: ({ seconds }) => <p>Transcurrido: {seconds} segundos</p>,
});
```

## 6. Clases y Estilos Reactivos

Usa funciones para nombres de clase dinámicos:

```tsx
<button class={() => (isActive.value ? 'btn btn-active' : 'btn btn-inactive')}>
	Alternar
</button>
```

## 7. Renderizado Condicional

Usa `computed` para renderizado condicional reactivo:

```tsx
{
	computed(() =>
		isLoading.value ? <div>Cargando...</div> : <div>Contenido</div>
	);
}
```

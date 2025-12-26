---
title: Componentes
---

# Componentes

Los componentes en Effuse combinan lógica e interfaz en una estructura limpia y segura en tipos.

## Estructura Básica

Cada componente tiene un `script` y `template`:

```tsx
import { define } from '@effuse/core';

const Greeting = define({
	script: () => {
		return { message: '¡Hola, Mundo!' };
	},
	template: ({ message }) => <h1>{message}</h1>,
});
```

## Props

Los componentes reciben props de su padre. Usa genéricos para seguridad de tipos:

```tsx
import { define, computed, unref, type Signal } from '@effuse/core';

interface ButtonProps {
	label: string;
	variant?: 'primary' | 'secondary';
	onClick?: () => void;
}

const Button = define<ButtonProps>({
	script: ({ props }) => ({
		label: props.label,
		variant: computed(() => unref(props.variant) ?? 'primary'),
		onClick: props.onClick,
	}),
	template: ({ label, variant, onClick }) => (
		<button class={`btn btn-${variant.value}`} onClick={onClick}>
			{label}
		</button>
	),
});

// Uso
<Button label="Haz clic" variant="primary" onClick={handleClick} />;
```

## Hooks de Ciclo de Vida

Los componentes tienen acceso a hooks de ciclo de vida a través del contexto del script:

```tsx
import { define, signal } from '@effuse/core';

const Timer = define({
	script: ({ onMount }) => {
		const seconds = signal(0);

		onMount(() => {
			const interval = setInterval(() => {
				seconds.value++;
			}, 1000);

			// Retornar función de limpieza
			return () => clearInterval(interval);
		});

		return { seconds };
	},
	template: ({ seconds }) => <p>Temporizador: {seconds} segundos</p>,
});
```

## useCallback para Referencias Estables

Usa `useCallback` del contexto del script para manejadores de eventos que necesitan referencias estables:

```tsx
import { define, signal } from '@effuse/core';

const Form = define({
	script: ({ useCallback }) => {
		const inputValue = signal('');

		// Referencia estable para manejador de eventos
		const handleInputChange = useCallback((e: Event) => {
			inputValue.value = (e.target as HTMLInputElement).value;
		});

		const handleSubmit = useCallback(() => {
			console.log('Enviado:', inputValue.value);
			inputValue.value = '';
		});

		return { inputValue, handleInputChange, handleSubmit };
	},
	template: ({ inputValue, handleInputChange, handleSubmit }) => (
		<div>
			<input value={inputValue} onInput={handleInputChange} />
			<button onClick={handleSubmit}>Enviar</button>
		</div>
	),
});
```

## Children

Pasa children para crear componentes contenedor:

```tsx
import { define } from '@effuse/core';

const Card = define({
	script: () => ({}),
	template: ({ children }) => <div class="card">{children}</div>,
});

// Uso
<Card>
	<h2>Título</h2>
	<p>El contenido va aquí</p>
</Card>;
```

## Renderizado de Listas con For

Usa el componente `For` para renderizado eficiente de listas:

```tsx
import { define, signal, For } from '@effuse/core';

const TodoList = define({
	script: () => {
		const todos = signal([
			{ id: 1, text: 'Aprender Effuse' },
			{ id: 2, text: 'Construir una app' },
		]);

		return { todos };
	},
	template: ({ todos }) => (
		<ul>
			<For each={todos} keyExtractor={(t) => t.id}>
				{(todoSignal) => <li>{todoSignal.value.text}</li>}
			</For>
		</ul>
	),
});
```

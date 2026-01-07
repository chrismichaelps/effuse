---
title: Props
---

# Props

Los props son la manera de pasar datos desde un componente padre a un componente hijo. En Effuse, los props tienen tipado completo y son reactivos.

## Definiendo Props

Para definir props, pasas una interfaz de TypeScript como el primer argumento genérico a la función `define`. La función `define` acepta dos argumentos genéricos:

1.  **Tipo de Props (`P`)**: Define la forma de los props pasados al componente.
2.  **Valores Expuestos (`E`)**: Define la forma del objeto retornado por la función `script` y disponible en el `template`.

```tsx
import { define, signal, type Signal } from '@effuse/core';

interface UserCardProps {
	name: string;
	age: number;
}

interface UserCardExposed {
	capitalizedName: Signal<string>;
}

const UserCard = define<UserCardProps, UserCardExposed>({
	script: ({ props }) => {
		const capitalizedName = signal(props.name.toUpperCase());
		return { capitalizedName };
	},
	template: ({ capitalizedName }, props) => (
		<div class="user-card">
			<h2>{capitalizedName}</h2>
			<p>Edad: {props.age}</p>
		</div>
	),
});
```

## Reactividad en Props

En la función `script`, `props` es un objeto reactivo. Si un padre pasa una señal como prop, acceder a ese prop en el script (por ejemplo, dentro de un `computed` o `effect`) lo rastreará.

```tsx
import { define, computed, unref } from '@effuse/core';

interface CounterProps {
	count: number; // Puede pasarse como número o Signal<number>
}

const DoubleCounter = define<CounterProps>({
	script: ({ props }) => {
		// Este computed se actualizará cuando la señal 'count' del padre cambie
		const double = computed(() => unref(props.count) * 2);

		return { double };
	},
	template: ({ double }) => <div>Doble del contador: {double}</div>,
});
```

## Valores por Defecto

Puedes manejar valores por defecto usando patrones estándar de JavaScript o `computed` para defaults reactivos.

```tsx
import { define, computed, unref } from '@effuse/core';

interface ButtonProps {
	variant?: 'primary' | 'secondary';
}

const Button = define<ButtonProps>({
	script: ({ props }) => {
		// Valor por defecto reactivo
		const safeVariant = computed(() => unref(props.variant) ?? 'primary');

		return { safeVariant };
	},
	template: ({ safeVariant, children }) => (
		<button class={`btn btn-${safeVariant.value}`}>{children}</button>
	),
});
```

## Pasando Props

Pasas props a componentes igual que atributos HTML estándar.

```tsx
// Usando valores estáticos
<UserCard name="Alicia" age={30} isAdmin />;

// Usando señales
const age = signal(25);
<UserCard name="Roberto" age={age} />;
```

Ten en cuenta que al pasar una señal (como `age={age}`), Effuse automáticamente la desenvuelve en el DOM pero mantiene viva la conexión de reactividad para la lógica del componente.

## Prop Children

El prop `children` es especial. Contiene el contenido pasado dentro de las etiquetas del componente.

```tsx
const Container = define({
	script: () => ({}),
	template: ({ children }) => <div class="container">{children}</div>,
});

// Uso
<Container>
	<h1>Hola</h1>
</Container>;
```

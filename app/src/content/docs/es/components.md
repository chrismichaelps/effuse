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

### Props de For

| Prop           | Tipo                                           | Descripción                                  |
| -------------- | ---------------------------------------------- | -------------------------------------------- |
| `each`         | `Signal<T[]>`                                  | La señal que contiene el array a iterar      |
| `keyExtractor` | `(item: T, index: number) => string or number` | Función para extraer claves únicas           |
| `fallback`     | `JSX.Element`                                  | Elemento opcional cuando el array está vacío |

## Renderizado Condicional con Show

Usa el componente `Show` para renderizado condicional basado en valores de señales:

```tsx
import { define, signal, Show } from '@effuse/core';

const UserProfile = define({
	script: () => {
		const user = signal<{ name: string } | null>(null);
		const login = () => {
			user.value = { name: 'Juan' };
		};
		const logout = () => {
			user.value = null;
		};

		return { user, login, logout };
	},
	template: ({ user, login, logout }) => (
		<div>
			<Show
				when={user}
				fallback={<button onClick={login}>Iniciar sesión</button>}
			>
				{(u) => (
					<div>
						<p>¡Bienvenido, {u.name}!</p>
						<button onClick={logout}>Cerrar sesión</button>
					</div>
				)}
			</Show>
		</div>
	),
});
```

### Props de Show

| Prop       | Tipo                        | Descripción                                          |
| ---------- | --------------------------- | ---------------------------------------------------- |
| `when`     | `Signal<T>` o `() => T`     | Condición a evaluar                                  |
| `fallback` | `JSX.Element`               | Elemento a renderizar cuando la condición es falsa   |
| `children` | `(value: T) => JSX.Element` | Función de renderizado que recibe el valor verdadero |

## Componente Dynamic

El componente `Dynamic` permite renderizar diferentes componentes dinámicamente basado en una señal:

```tsx
import { define, signal, Dynamic } from '@effuse/core';

const TabPanel = define({
	script: () => {
		const tabs = { home: HomeTab, settings: SettingsTab, profile: ProfileTab };
		const activeTab = signal<keyof typeof tabs>('home');

		const currentComponent = computed(() => tabs[activeTab.value]);

		return { activeTab, currentComponent };
	},
	template: ({ activeTab, currentComponent }) => (
		<div>
			<nav>
				<button
					onClick={() => {
						activeTab.value = 'home';
					}}
				>
					Inicio
				</button>
				<button
					onClick={() => {
						activeTab.value = 'settings';
					}}
				>
					Configuración
				</button>
				<button
					onClick={() => {
						activeTab.value = 'profile';
					}}
				>
					Perfil
				</button>
			</nav>
			<Dynamic component={currentComponent} fallback={<p>Cargando...</p>} />
		</div>
	),
});
```

### Props de Dynamic

| Prop        | Tipo                                    | Descripción                                              |
| ----------- | --------------------------------------- | -------------------------------------------------------- |
| `component` | `Signal<Component>` o `() => Component` | El componente a renderizar dinámicamente                 |
| `props`     | `P`                                     | Props a pasar al componente renderizado                  |
| `fallback`  | `JSX.Element`                           | Elemento a renderizar cuando el componente es null       |
| `portals`   | `Portals`                               | Configuración de portales para el componente renderizado |

## Estilos Dinámicos

Usa funciones reactivas para estilos y clases dinámicas:

```tsx
import { define, signal, computed } from '@effuse/core';

const ColorBox = define({
	script: () => {
		const colors = ['mint', 'purple', 'cyan'];
		const index = signal(0);
		const currentColor = computed(() => colors[index.value]);
		const nextColor = () => {
			index.value = (index.value + 1) % colors.length;
		};

		return { currentColor, nextColor };
	},
	template: ({ currentColor, nextColor }) => (
		<div>
			<button onClick={nextColor}>Cambiar Color</button>
			<div
				style={() => ({
					backgroundColor: `var(--accent-${currentColor.value})`,
					padding: '2rem',
					transition: 'background-color 0.3s ease',
				})}
			>
				Actual: {currentColor.value}
			</div>
		</div>
	),
});
```

### Clases Dinámicas

```tsx
<div class={() => `card ${isActive.value ? 'active' : ''}`}>Contenido</div>
```

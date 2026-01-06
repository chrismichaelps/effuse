---
title: Context
---

# Context API

The Context API in Effuse provides a powerful way to share state between components without prop drilling. It uses a stack-based registry internally for proper nesting support.

## Creating a Context

Use `createContext` to define a new context with an optional default value:

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

### Context Options

| Property       | Type           | Description                                |
| -------------- | -------------- | ------------------------------------------ |
| `id`           | `string`       | Unique identifier for the context          |
| `defaultValue` | `T \| () => T` | Optional default value or factory function |
| `displayName`  | `string`       | Human-readable name for debugging          |

## Using Context Values

Use `useContext` to consume a context value in any component:

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
			Themed Button
		</button>
	),
});
```

## Providing Context Values

Use the auto-generated `Provider` component to supply values:

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

## Nested Providers

Context values stack properly. Inner providers override outer ones:

```tsx
const NestedExample = define({
	template: () => (
		<ThemeContext.Provider value={{ mode: 'dark', primaryColor: '#6366f1' }}>
			{/* This component sees dark theme */}
			<ThemedButton />

			<ThemeContext.Provider value={{ mode: 'light', primaryColor: '#22c55e' }}>
				{/* This component sees light theme */}
				<ThemedButton />
			</ThemeContext.Provider>
		</ThemeContext.Provider>
	),
});
```

## Checking Context Availability

Use `hasContextValue` to check if a context value exists:

```typescript
import { hasContextValue } from '@effuse/core';

if (hasContextValue(ThemeContext)) {
	const theme = useContext(ThemeContext);
	// ...
}
```

## Type Guard

Use `isEffuseContext` to verify if a value is an Effuse context:

```typescript
import { isEffuseContext } from '@effuse/core';

function processContext(maybeContext: unknown) {
	if (isEffuseContext(maybeContext)) {
		console.log('Valid context:', maybeContext.id);
	}
}
```

## Error Handling

When a context is not found and has no default value, `useContext` throws a `ContextNotFoundError`:

```typescript
import { useContext, ContextNotFoundError } from '@effuse/core';

try {
	const auth = useContext(AuthContext);
} catch (error) {
	if (error instanceof ContextNotFoundError) {
		console.error(`Context "${error.contextId}" not found`);
	}
}
```

You can also pass a component name for better error messages:

```typescript
const auth = useContext(AuthContext, 'LoginButton');
// Error: Context "auth" not found in component "LoginButton"
```

## Factory Default Values

Default values can be factory functions for dynamic initialization:

```typescript
const TimestampContext = createContext({
	id: 'timestamp',
	defaultValue: () => ({
		createdAt: Date.now(),
		version: '1.0.0',
	}),
});
```

## Best Practices

1. **Use descriptive IDs**: Choose unique, descriptive IDs for your contexts
2. **Provide defaults when possible**: Makes components more resilient
3. **Keep contexts focused**: One context per concern (theme, auth, i18n)
4. **Type your contexts**: Always use TypeScript generics for type safety
5. **Use displayName**: Helps with debugging and devtools

## API Reference

### createContext

```typescript
function createContext<T>(options: ContextOptions<T>): EffuseContext<T>;
```

### useContext

```typescript
function useContext<T>(context: EffuseContext<T>, componentName?: string): T;
```

### hasContextValue

```typescript
function hasContextValue<T>(context: EffuseContext<T>): boolean;
```

### isEffuseContext

```typescript
function isEffuseContext(value: unknown): value is EffuseContext<unknown>;
```

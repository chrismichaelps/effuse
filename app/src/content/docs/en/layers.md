---
title: Layers
---

# Layers

Layers provide dependency injection and shared state across your application. They enable components to access global services and reactive props without prop drilling.

## Creating a Layer

Use `defineLayer` from `@effuse/core` to create a layer:

```typescript
import { defineLayer, signal, computed } from '@effuse/core';

export const ThemeLayer = defineLayer({
  name: 'theme',
  
  // Props exposed to components
  props: {
    mode: signal<'light' | 'dark'>('dark'),
    accentColor: signal('#8df0cc'),
  },

  // Derived props (automatically computed)
  derived: {
    isDark: (props) => computed(() => props.mode.value === 'dark'),
  },

  // Services exposed via provider
  provides: {
    theme: {
      setMode: (mode: 'light' | 'dark') => { /* ... */ },
      toggleMode: () => { /* ... */ },
    },
  },

  // Initialization logic
  setup: (ctx) => {
    // ctx.store contains typed access to props
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      ctx.store.mode.value = savedTheme as 'light' | 'dark';
    }
  },
});
```

## Using Layers in Components

Access layer props and providers in your component's script:

```tsx
import { define, computed } from '@effuse/core';

const ThemeToggle = define({
  script: ({ useLayerProps, useLayerProvider }) => {
    // Get reactive props from the layer
    const themeProps = useLayerProps('theme')!;
    
    // Get services from the layer
    const themeProvider = useLayerProvider('theme')!;

    const buttonText = computed(() => 
      themeProps.mode.value === 'dark' ? 'Light' : 'Dark'
    );

    const toggle = () => {
      themeProvider.theme.toggleMode();
    };

    return { buttonText, toggle };
  },
  template: ({ buttonText, toggle }) => (
    <button onClick={toggle}>{buttonText}</button>
  ),
});
```

## Layer Props vs Provider

| Concept | Purpose | Access Method |
|---------|---------|---------------|
| **Props** | Reactive state values | `useLayerProps('name')` |
| **Provider** | Services and actions | `useLayerProvider('name')` |

**Props** are signals you read and subscribe to. **Providers** expose methods and services.

## Typed Store Access

Layers have typed access to their store in the setup function:

```typescript
setup: (ctx) => {
  // ctx.store is typed based on your props definition
  ctx.store.mode.value = 'dark';  // Full type safety
  ctx.store.init();  // If you have methods
}
```

## Deriving Props

Use `derived` to create computed values that depend on props:

```typescript
derived: {
  // Automatically updates when mode changes
  backgroundColor: (props) => computed(() => 
    props.mode.value === 'dark' ? '#0a0f12' : '#ffffff'
  ),
  
  // Can depend on multiple props
  theme: (props) => computed(() => ({
    mode: props.mode.value,
    accent: props.accentColor.value,
  })),
}
```

## Layer Registry

Layers are automatically registered. The type system knows about all registered layers:

```typescript
// These are fully typed based on your layer definitions
const i18nProps = useLayerProps('i18n');    // knows i18n layer props
const themeProvider = useLayerProvider('theme'); // knows theme services
```

## Best Practices

1. **One Layer Per Domain**: Create focused layers (auth, i18n, theme, etc.)
2. **Props for State**: Use `props` for reactive values components subscribe to
3. **Provider for Actions**: Use `provides` for methods and services
4. **Derived for Computations**: Use `derived` instead of computing in components
5. **Setup for Init**: Use `setup` for initialization logic (localStorage, API calls)

## Example: i18n Layer

```typescript
import { defineLayer, signal, computed } from '@effuse/core';

export type Locale = 'en' | 'es' | 'ja' | 'zh';

export const I18nLayer = defineLayer({
  name: 'i18n',
  
  props: {
    locale: signal<Locale>('en'),
    translations: signal<Record<string, string> | null>(null),
  },

  provides: {
    i18n: {
      setLocale: async (locale: Locale) => {
        const response = await fetch(`/locales/${locale}.json`);
        const data = await response.json();
        // Access store through closure
        store.translations.value = data;
        store.locale.value = locale;
      },
    },
  },

  setup: async (ctx) => {
    // Load default locale on init
    const response = await fetch('/locales/en.json');
    ctx.store.translations.value = await response.json();
  },
});
```

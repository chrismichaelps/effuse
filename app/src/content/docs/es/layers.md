---
title: Capas
---

# Capas

Las capas proporcionan inyección de dependencias y estado compartido en toda tu aplicación. Permiten que los componentes accedan a servicios globales y props reactivos sin perforación de props.

## Creando una Capa

Usa `defineLayer` de `@effuse/core` para crear una capa:

```typescript
import { defineLayer, signal, computed } from '@effuse/core';

export const ThemeLayer = defineLayer({
  name: 'theme',
  
  // Props expuestos a los componentes
  props: {
    mode: signal<'light' | 'dark'>('dark'),
    accentColor: signal('#8df0cc'),
  },

  // Props derivados (automáticamente computados)
  derived: {
    isDark: (props) => computed(() => props.mode.value === 'dark'),
  },

  // Servicios expuestos vía provider
  provides: {
    theme: {
      setMode: (mode: 'light' | 'dark') => { /* ... */ },
      toggleMode: () => { /* ... */ },
    },
  },

  // Lógica de inicialización
  setup: (ctx) => {
    // ctx.store contiene acceso tipado a props
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      ctx.store.mode.value = savedTheme as 'light' | 'dark';
    }
  },
});
```

## Usando Capas en Componentes

Accede a los props y providers de capas en el script de tu componente:

```tsx
import { define, computed } from '@effuse/core';

const ThemeToggle = define({
  script: ({ useLayerProps, useLayerProvider }) => {
    // Obtener props reactivos de la capa
    const themeProps = useLayerProps('theme')!;
    
    // Obtener servicios de la capa
    const themeProvider = useLayerProvider('theme')!;

    const buttonText = computed(() => 
      themeProps.mode.value === 'dark' ? 'Claro' : 'Oscuro'
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

## Props de Capa vs Provider

| Concepto | Propósito | Método de Acceso |
|----------|-----------|------------------|
| **Props** | Valores de estado reactivo | `useLayerProps('nombre')` |
| **Provider** | Servicios y acciones | `useLayerProvider('nombre')` |

**Props** son señales que lees y a las que te suscribes. **Providers** exponen métodos y servicios.

## Acceso Tipado al Store

Las capas tienen acceso tipado a su store en la función setup:

```typescript
setup: (ctx) => {
  // ctx.store está tipado basado en tu definición de props
  ctx.store.mode.value = 'dark';  // Seguridad de tipos completa
  ctx.store.init();  // Si tienes métodos
}
```

## Derivando Props

Usa `derived` para crear valores computados que dependen de props:

```typescript
derived: {
  // Se actualiza automáticamente cuando mode cambia
  backgroundColor: (props) => computed(() => 
    props.mode.value === 'dark' ? '#0a0f12' : '#ffffff'
  ),
  
  // Puede depender de múltiples props
  theme: (props) => computed(() => ({
    mode: props.mode.value,
    accent: props.accentColor.value,
  })),
}
```

## Registro de Capas

Las capas se registran automáticamente. El sistema de tipos conoce todas las capas registradas:

```typescript
// Estos están completamente tipados según tus definiciones de capas
const i18nProps = useLayerProps('i18n');    // conoce los props de la capa i18n
const themeProvider = useLayerProvider('theme'); // conoce los servicios de theme
```

## Mejores Prácticas

1. **Una Capa Por Dominio**: Crea capas enfocadas (auth, i18n, theme, etc.)
2. **Props para Estado**: Usa `props` para valores reactivos a los que los componentes se suscriben
3. **Provider para Acciones**: Usa `provides` para métodos y servicios
4. **Derived para Cálculos**: Usa `derived` en lugar de calcular en componentes
5. **Setup para Init**: Usa `setup` para lógica de inicialización (localStorage, llamadas API)

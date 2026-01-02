---
title: 层
---

# 层

层提供应用程序范围内的依赖注入和共享状态。它们使组件能够访问全局服务和响应式 props，而无需逐层传递。

## 创建层

使用 `@effuse/core` 中的 `defineLayer` 创建层：

```typescript
import { defineLayer, signal, computed } from '@effuse/core';

export const ThemeLayer = defineLayer({
  name: 'theme',
  
  // 暴露给组件的 props
  props: {
    mode: signal<'light' | 'dark'>('dark'),
    accentColor: signal('#8df0cc'),
  },

  // 派生 props（自动计算）
  derived: {
    isDark: (props) => computed(() => props.mode.value === 'dark'),
  },

  // 通过 provider 暴露的服务
  provides: {
    theme: {
      setMode: (mode: 'light' | 'dark') => { /* ... */ },
      toggleMode: () => { /* ... */ },
    },
  },

  // 初始化逻辑
  setup: (ctx) => {
    // ctx.store 包含对 props 的类型化访问
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      ctx.store.mode.value = savedTheme as 'light' | 'dark';
    }
  },
});
```

## 在组件中使用层

在组件的 script 中访问层的 props 和 provider：

```tsx
import { define, computed } from '@effuse/core';

const ThemeToggle = define({
  script: ({ useLayerProps, useLayerProvider }) => {
    // 从层获取响应式 props
    const themeProps = useLayerProps('theme')!;
    
    // 从层获取服务
    const themeProvider = useLayerProvider('theme')!;

    const buttonText = computed(() => 
      themeProps.mode.value === 'dark' ? '浅色' : '深色'
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

## 层 Props vs Provider

| 概念 | 用途 | 访问方法 |
|------|------|----------|
| **Props** | 响应式状态值 | `useLayerProps('名称')` |
| **Provider** | 服务和操作 | `useLayerProvider('名称')` |

**Props** 是你读取和订阅的信号。**Providers** 暴露方法和服务。

## 类型化 Store 访问

层在 setup 函数中具有对其 store 的类型化访问：

```typescript
setup: (ctx) => {
  // ctx.store 根据你的 props 定义进行类型化
  ctx.store.mode.value = 'dark';  // 完全的类型安全
  ctx.store.init();  // 如果你有方法
}
```

## 派生 Props

使用 `derived` 创建依赖于 props 的计算值：

```typescript
derived: {
  // 当 mode 改变时自动更新
  backgroundColor: (props) => computed(() => 
    props.mode.value === 'dark' ? '#0a0f12' : '#ffffff'
  ),
  
  // 可以依赖多个 props
  theme: (props) => computed(() => ({
    mode: props.mode.value,
    accent: props.accentColor.value,
  })),
}
```

## 层注册表

层会自动注册。类型系统知道所有已注册的层：

```typescript
// 这些根据你的层定义完全类型化
const i18nProps = useLayerProps('i18n');    // 知道 i18n 层的 props
const themeProvider = useLayerProvider('theme'); // 知道 theme 服务
```

## 最佳实践

1. **每个领域一个层**: 创建专注的层（auth、i18n、theme 等）
2. **Props 用于状态**: 对组件订阅的响应式值使用 `props`
3. **Provider 用于操作**: 对方法和服务使用 `provides`
4. **Derived 用于计算**: 使用 `derived` 而不是在组件中计算
5. **Setup 用于初始化**: 对初始化逻辑（localStorage、API 调用）使用 `setup`

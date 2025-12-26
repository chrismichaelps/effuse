---
title: 表单管理 (useForm)
---

# 表单管理 (useForm)

Effuse 提供了一个强大的 `useForm` 钩子，用于管理表单状态、验证和提交处理。它与 Effuse 的响应式信号无缝集成，并提供内置的验证工具。

## 基本用法

`useForm` 钩子接受一个初始状态，其中每个字段都是一个 `Signal`。

```typescript
import { define, useForm, signal } from '@effuse/core';

const MyForm = define({
  script: () => {
    const form = useForm({
      initial: {
        username: signal(''),
        email: signal(''),
      },
      onSubmit: async (values) => {
        console.log('Form submitted:', values);
      }
    });

    return { form };
  },
  template: ({ form }) => (
    <form onSubmit={(e) => form.submit(e)}>
      <input
        value={form.fields.username}
        onInput={(e) => form.fields.username.value = e.target.value}
      />
      <button type="submit">Submit</button>
    </form>
  )
});
```

## 验证

Effuse 包含一个可组合的验证系统。可以使用 `validators` 选项和 `v` 工具为每个字段定义验证器。

### 内置验证器

常用验证器在 `v` 命名空间下可用：

- `v.required(message)`
- `v.minLength(length, message)`
- `v.maxLength(length, message)`
- `v.email(message)`
- `v.integer(message)`
- `v.compose(...)`: 组合多个验证器

### 带验证的示例

```typescript
import { define, useForm, signal, v } from '@effuse/core';

const SignupForm = define({
  script: () => {
    const form = useForm({
      initial: {
        email: signal(''),
        password: signal(''),
      },
      validators: {
        email: v.compose(
          v.required('Email is required'),
          v.email('Invalid email address')
        ),
        password: v.compose(
          v.required('Password is required'),
          v.minLength(8, 'Password must be at least 8 characters')
        )
      },
      validationOptions: {
        validateOn: 'change', // 'change', 'blur', or 'submit'
        debounce: 300 // 300ms 不活动后验证
      },
      onSubmit: async (values) => {
        // 处理有效提交
      }
    });

    return { form };
  },
  template: ({ form }) => (
    <form onSubmit={(e) => form.submit(e)}>
      <div>
        <label>Email</label>
        <input
          value={form.fields.email}
          onInput={(e) => form.fields.email.value = e.target.value}
          onBlur={() => form.touched.email.value = true}
        />
        {form.errors.value.email && (
          <span class="error">{form.errors.value.email}</span>
        )}
      </div>

      {/* ... password field ... */}

      <button type="submit" disabled={!form.isValid.value}>
        Sign Up
      </button>
    </form>
  )
});
```

## API 参考

### 选项

| 选项                | 类型                                                             | 描述                   |
| ------------------- | ---------------------------------------------------------------- | ---------------------- |
| `initial`           | `Record<string, Signal<T>>`                                      | 带信号的初始表单状态。 |
| `validators`        | `Record<string, Validator>`                                      | 每个字段的验证规则。   |
| `onSubmit`          | `(values: T) => void` or `Promise<void>`                         | 有效表单提交时的回调。 |
| `validationOptions` | `{ validateOn?: 'change', 'blur', 'submit'; debounce?: number }` | 验证时机的配置。       |

### 返回值

`useForm` 钩子返回一个包含以下内容的对象：

- **`fields`**: 响应式字段信号。
- **`errors`**: 包含当前验证错误的信号。
- **`touched`**: 指示字段是否已交互的信号。
- **`isValid`**: 指示表单是否没有错误的 computed 信号（boolean）。
- **`isDirty`**: 指示值是否已从初始值更改的 computed 信号（boolean）。
- **`isSubmitting`**: 指示 `onSubmit` 是否正在执行的信号（boolean）。
- **`submit(e?: Event)`**: 处理表单提交的函数。阻止默认行为，设置 touched，验证，并调用 `onSubmit`。
- **`reset()`**: 将字段重置为初始值并清除 errors/touched 状态。
- **`setFieldValue(name, value)`**: 设置字段值的辅助函数。
- **`setFieldError(name, error)`**: 手动设置错误的辅助函数。

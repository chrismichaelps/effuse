---
title: フォーム管理 (useForm)
---

# フォーム管理 (useForm)

Effuse は、フォームの状態、バリデーション、送信処理を管理するための堅牢な `useForm` フックを提供します。Effuse のリアクティブシグナルとシームレスに統合し、組み込みのバリデーションユーティリティを提供します。

## 基本的な使用法

`useForm` フックは、各フィールドが `Signal` である初期状態を受け取ります。

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

## バリデーション

Effuse には構成可能なバリデーションシステムが含まれています。`validators` オプションと `v` ユーティリティを使用して各フィールドのバリデータを定義できます。

### 組み込みバリデータ

一般的なバリデータは `v` 名前空間で利用可能です：

- `v.required(message)`
- `v.minLength(length, message)`
- `v.maxLength(length, message)`
- `v.email(message)`
- `v.integer(message)`
- `v.compose(...)`: 複数のバリデータを組み合わせる

### バリデーション付きの例

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
        debounce: 300 // 300ms の非アクティブ後にバリデート
      },
      onSubmit: async (values) => {
        // 有効な送信を処理
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

## API リファレンス

### オプション

| オプション          | 型                                                               | 説明                                 |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| `initial`           | `Record<string, Signal<T>>`                                      | シグナルを持つ初期フォーム状態。     |
| `validators`        | `Record<string, Validator>`                                      | 各フィールドのバリデーションルール。 |
| `onSubmit`          | `(values: T) => void` or `Promise<void>`                         | 有効なフォーム送信時のコールバック。 |
| `validationOptions` | `{ validateOn?: 'change', 'blur', 'submit'; debounce?: number }` | バリデーションタイミングの設定。     |

### 戻り値

`useForm` フックは以下を含むオブジェクトを返します：

- **`fields`**: リアクティブなフィールドシグナル。
- **`errors`**: 現在のバリデーションエラーを含むシグナル。
- **`touched`**: フィールドが操作されたかを示すシグナル。
- **`isValid`**: フォームにエラーがないかを示す computed シグナル（boolean）。
- **`isDirty`**: 値が初期値から変更されたかを示す computed シグナル（boolean）。
- **`isSubmitting`**: `onSubmit` が現在実行中かを示すシグナル（boolean）。
- **`submit(e?: Event)`**: フォーム送信を処理する関数。デフォルトを防ぎ、touched を設定し、バリデートし、`onSubmit` を呼び出す。
- **`reset()`**: フィールドを初期値にリセットし、errors/touched 状態をクリア。
- **`setFieldValue(name, value)`**: フィールド値を設定するヘルパー。
- **`setFieldError(name, error)`**: 手動でエラーを設定するヘルパー。

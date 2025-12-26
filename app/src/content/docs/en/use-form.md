---
title: Form Management (useForm)
---

# Form Management (useForm)

Effuse provides a robust `useForm` hook for managing form state, validation, and submission handling. It integrates seamlessly with Effuse's reactive signals and provides built-in validation utilities.

## Basic Usage

The `useForm` hook takes an initial state where each field is a `Signal`.

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

## Validation

Effuse includes a composable validation system. You can define validators for each field using the `validators` option and the `v` utility.

### Built-in Validators

Common validators are available under the `v` namespace:

- `v.required(message)`
- `v.minLength(length, message)`
- `v.maxLength(length, message)`
- `v.email(message)`
- `v.integer(message)`
- `v.compose(...)`: Combine multiple validators

### Example with Validation

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
        debounce: 300 // Validate after 300ms of inactivity
      },
      onSubmit: async (values) => {
        // Handle valid submission
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

## API Reference

### Options

| Option              | Type                                                             | Description                            |
| ------------------- | ---------------------------------------------------------------- | -------------------------------------- |
| `initial`           | `Record<string, Signal<T>>`                                      | Initial form state with signals.       |
| `validators`        | `Record<string, Validator>`                                      | Validation rules for each field.       |
| `onSubmit`          | `(values: T) => void` or `Promise<void>`                         | Callback when valid form is submitted. |
| `validationOptions` | `{ validateOn?: 'change', 'blur', 'submit'; debounce?: number }` | Configuration for validation timing.   |

### Return Values

The `useForm` hook returns an object containing:

- **`fields`**: The reactive field signals.
- **`errors`**: A signal containing current validation errors.
- **`touched`**: Signals indicating if a field has been interacted with.
- **`isValid`**: A computed signal (boolean) indicating if the form has no errors.
- **`isDirty`**: A computed signal (boolean) indicating if values have changed from initial.
- **`isSubmitting`**: A signal (boolean) indicating if `onSubmit` is currently executing.
- **`submit(e?: Event)`**: Function to handle form submission. Prevents default, sets touched, validates, and calls `onSubmit`.
- **`reset()`**: Resets fields to initial values and clears errors/touched states.
- **`setFieldValue(name, value)`**: Helper to set a field value.
- **`setFieldError(name, error)`**: Helper to manually set an error.

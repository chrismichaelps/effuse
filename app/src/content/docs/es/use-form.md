---
title: Gestión de Formularios (useForm)
---

# Gestión de Formularios (useForm)

Effuse proporciona un hook robusto `useForm` para gestionar estado de formularios, validación y manejo de envíos. Se integra perfectamente con las señales reactivas de Effuse y proporciona utilidades de validación incorporadas.

## Uso Básico

El hook `useForm` toma un estado inicial donde cada campo es una `Signal`.

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
        console.log('Formulario enviado:', values);
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
      <button type="submit">Enviar</button>
    </form>
  )
});
```

## Validación

Effuse incluye un sistema de validación componible. Puedes definir validadores para cada campo usando la opción `validators` y la utilidad `v`.

### Validadores Incorporados

Los validadores comunes están disponibles bajo el namespace `v`:

- `v.required(message)`
- `v.minLength(length, message)`
- `v.maxLength(length, message)`
- `v.email(message)`
- `v.integer(message)`
- `v.compose(...)`: Combinar múltiples validadores

### Ejemplo con Validación

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
          v.required('El email es requerido'),
          v.email('Dirección de email inválida')
        ),
        password: v.compose(
          v.required('La contraseña es requerida'),
          v.minLength(8, 'La contraseña debe tener al menos 8 caracteres')
        )
      },
      validationOptions: {
        validateOn: 'change', // 'change', 'blur', o 'submit'
        debounce: 300 // Validar después de 300ms de inactividad
      },
      onSubmit: async (values) => {
        // Manejar envío válido
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

      {/* ... campo de contraseña ... */}

      <button type="submit" disabled={!form.isValid.value}>
        Registrarse
      </button>
    </form>
  )
});
```

## Referencia de API

### Opciones

| Opción              | Tipo                                                             | Descripción                                 |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| `initial`           | `Record<string, Signal<T>>`                                      | Estado inicial del formulario con señales.  |
| `validators`        | `Record<string, Validator>`                                      | Reglas de validación para cada campo.       |
| `onSubmit`          | `(values: T) => void` o `Promise<void>`                          | Callback cuando se envía formulario válido. |
| `validationOptions` | `{ validateOn?: 'change', 'blur', 'submit'; debounce?: number }` | Configurar timing de validación.            |

### Valores de Retorno

El hook `useForm` retorna un objeto conteniendo:

- **`fields`**: Las señales de campo reactivas.
- **`errors`**: Una señal conteniendo errores de validación actuales.
- **`touched`**: Señales indicando si un campo ha sido interactuado.
- **`isValid`**: Una señal computada (boolean) indicando si el formulario no tiene errores.
- **`isDirty`**: Una señal computada (boolean) indicando si los valores han cambiado del inicial.
- **`isSubmitting`**: Una señal (boolean) indicando si `onSubmit` se está ejecutando.
- **`submit(e?: Event)`**: Función para manejar envío. Previene default, marca touched, valida, y llama `onSubmit`.
- **`reset()`**: Resetea campos a valores iniciales y limpia errores/estados touched.
- **`setFieldValue(name, value)`**: Helper para establecer valor de campo.
- **`setFieldError(name, error)`**: Helper para establecer un error manualmente.

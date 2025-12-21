/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { signal } from '../reactivity/signal.js';
import { computed } from '../reactivity/computed.js';
import { effect } from '../effects/effect.js';
import { validateForm, hasErrors } from './validation.js';
import type {
  FormOptions,
  FormFields,
  FormTouched,
  FormErrors,
  UseFormReturn,
  BindResult,
} from './types.js';
import type { ReadonlySignal } from '../types/index.js';
import { DEFAULT_FORM_CONFIG } from './config.js';

/**
 * Reactive form state with validation.
 */
export function useForm<T extends Record<string, unknown>>(
  options: FormOptions<T>
): UseFormReturn<T> {
  const { initial, validators, onSubmit, validationOptions } = options;
  const debounceMs = validationOptions?.debounce ?? DEFAULT_FORM_CONFIG.debounceMs;
  const validateOn = validationOptions?.validateOn ?? DEFAULT_FORM_CONFIG.validateOn;

  const initialValues = {} as T;
  for (const key of Object.keys(initial) as Array<keyof T>) {
    initialValues[key] = initial[key].value;
  }

  const fields = initial as unknown as FormFields<T>;

  const touched = {} as FormTouched<T>;
  for (const key of Object.keys(initial) as Array<keyof T>) {
    touched[key] = signal(false);
  }

  const errorsSignal = signal<FormErrors<T>>({});
  const isSubmittingSignal = signal(false);

  const getValues = (): T => {
    const values = {} as T;
    for (const key of Object.keys(fields) as Array<keyof T>) {
      values[key] = fields[key].value;
    }
    return values;
  };

  const runValidation = (): FormErrors<T> => {
    if (!validators) {
      return {};
    }
    const values = getValues();
    return validateForm(validators, values);
  };

  const isDirty: ReadonlySignal<boolean> = computed(() => {
    for (const key of Object.keys(fields) as Array<keyof T>) {
      if (!Object.is(fields[key].value, initialValues[key])) {
        return true;
      }
    }
    return false;
  });

  const isValid: ReadonlySignal<boolean> = computed(() => {
    if (!validators) {
      return true;
    }
    const values = getValues();
    const errors = validateForm(validators, values);
    return !hasErrors(errors);
  });

  if (validators && (validateOn === 'change' || validateOn === 'blur')) {
    const effectOptions =
      debounceMs > 0 ? { debounce: { wait: debounceMs } } : {};

    effect(() => {
      const values = getValues();

      const newErrors = validateForm(validators, values);

      if (validateOn === 'blur') {
        const filteredErrors: FormErrors<T> = {};
        for (const key of Object.keys(newErrors) as Array<keyof T>) {
          if (touched[key].value) {
            filteredErrors[key] = newErrors[key];
          }
        }
        errorsSignal.value = filteredErrors;
      } else {
        errorsSignal.value = newErrors;
      }
    }, effectOptions);
  }

  const validate = (): boolean => {
    const newErrors = runValidation();
    errorsSignal.value = newErrors;
    return !hasErrors(newErrors);
  };

  const submit = async (e?: Event): Promise<void> => {
    e?.preventDefault();

    for (const key of Object.keys(touched) as Array<keyof T>) {
      touched[key].value = true;
    }

    const isFormValid = validate();
    if (!isFormValid) {
      return;
    }

    if (!onSubmit) {
      return;
    }

    isSubmittingSignal.value = true;

    try {
      const values = getValues();
      await onSubmit(values);
    } finally {
      isSubmittingSignal.value = false;
    }
  };

  const reset = (): void => {
    for (const key of Object.keys(fields) as Array<keyof T>) {
      fields[key].value = initialValues[key];
      touched[key].value = false;
    }
    errorsSignal.value = {};
  };

  const bind = <K extends keyof T>(name: K): BindResult<T[K]> => {
    const fieldSignal = fields[name];
    const touchedSignal = touched[name];

    return {
      get value() {
        return fieldSignal.value;
      },
      onInput: (e: Event) => {
        const target = e.target as HTMLInputElement;
        fieldSignal.value = target.value as T[K];
      },
      onBlur: () => {
        touchedSignal.value = true;

        if (validateOn === 'blur' && validators) {
          const newErrors = runValidation();
          const filteredErrors: FormErrors<T> = { ...errorsSignal.value };
          if (newErrors[name] !== undefined) {
            filteredErrors[name] = newErrors[name];
          } else {
            filteredErrors[name] = undefined;
          }
          errorsSignal.value = filteredErrors;
        }
      },
      name: String(name),
    };
  };

  const setFieldValue = (name: keyof T, value: T[keyof T]): void => {
    if (name in fields) {
      fields[name].value = value;
    }
  };

  const setFieldError = (name: keyof T, error: string | undefined): void => {
    const currentErrors = { ...errorsSignal.value };
    currentErrors[name] = error;
    errorsSignal.value = currentErrors;
  };

  const clearErrors = (): void => {
    errorsSignal.value = {};
  };

  return {
    fields,
    errors: errorsSignal as ReadonlySignal<FormErrors<T>>,
    touched,
    isValid,
    isDirty,
    isSubmitting: isSubmittingSignal as ReadonlySignal<boolean>,
    submit,
    reset,
    bind,
    setFieldValue,
    setFieldError,
    clearErrors,
    validate,
  };
}

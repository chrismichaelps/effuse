---
title: Error Handling
---

# Error Handling

Effuse provides a robust and clean error boundary system. In modern versions of the framework, all complex internal backend errors (like those originating from Effect Fiber failures) are automatically abstracted into clean, standard JavaScript `Error` objects before bleeding into userland.

## Standard Error Objects

When catching an error in an Effuse hook or mount function, you can rely on standard `try/catch` and `instanceof Error` checks. Effuse guarantees that its core engine won't leak proprietary types (like `Data.TaggedError`) into your application logic.

```typescript
import { useConcurrency } from '@effuse/store';

export const submitForm = useConcurrency({
  async action(data: FormData) {
    try {
      await api.submit(data);
    } catch (error) {
      if (error instanceof Error) {
        // Standard JS Error handling
        console.error('Submission failed:', error.message);
      }
    }
  }
});
```

## Internal Pipeline Translation

Under the hood, Effuse uses a strongly-typed `mapEffuseErrors` pipeline during Reactivity Mount Points, Component Lifecycles, and Server Renderers. This ensures any `FiberFailure` occurring in the low-level Effect engine is parsed, matched via `Predicate.hasProperty`, and neatly repackaged as a native JS error for your frontend logging services.

1. **Standardization**: Predictable Javascript structures that serialize safely across JSON borders.
2. **Type Safety**: Native narrow down via standard JS prototype chains.
3. **Developer Experience**: Eliminates verbose `(FiberFailure)` stack traces from frontend consoles.

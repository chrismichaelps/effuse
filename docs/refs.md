---
title: Refs & DOM Access
---

# Refs & DOM Access

While Effuse's declarative model handles most DOM updates automatically, sometimes you need direct access to the underlying DOM elements—for example, to manage focus, play media, or integrate with third-party libraries. Effuse provides two ways to handle refs: **Ref Objects** and **Ref Callbacks**.

## Ref Objects

The `createRef` function creates a mutable ref object that can hold a DOM element.

```tsx
import { createRef, onMount } from '@effuse/core';

const MyComponent = define({
  script: () => {
    // Create a typed ref
    const inputRef = createRef<HTMLInputElement>();

    onMount(() => {
      // Access the element via .current
      inputRef.current?.focus();
    });

    return { inputRef };
  },
  template: ({ inputRef }) => <input ref={inputRef} />,
});
```

### Reactive Subscriptions

Unlike standard refs in other frameworks, Effuse's `createRef` allows you to **subscribe** to changes. This is useful for tracking when an element is mounted or unmounted.

```tsx
const boxRef = createRef<HTMLDivElement>();

// Callback fires whenever the element changes (mounts/unmounts)
boxRef.subscribe((el) => {
  if (el) {
    console.log('Element mounted:', el);
    // You can attach observers here (e.g., ResizeObserver)
  } else {
    console.log('Element unmounted');
  }
});
```

## Callback Refs

For more granular control, you can pass a function directly to the `ref` attribute. This function is called with the DOM element when it's mounted, and with `null` when it's unmounted.

```tsx
import type { RefCallback } from '@effuse/core';

const handleInputRef: RefCallback<HTMLInputElement> = (el) => {
  if (el) {
    console.log('Input mounted');
    el.focus();
  }
};

// In template:
<input ref={handleInputRef} />;
```

## Best Practices

- **Avoid declarative overuse**: Only use refs for imperative actions (focus, scroll, media playback) or measurements.
- **Cleanup**: If you attach event listeners or observers in a ref callback or subscription, ensure you clean them up (e.g., in `onUnmount` or by returning a cleanup function if using an effect-like pattern, though `subscribe` itself is a simple list of callbacks).

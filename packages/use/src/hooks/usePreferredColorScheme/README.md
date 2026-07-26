# usePreferredColorScheme

SSR-stable light, dark, and no-preference color-scheme detection.

```ts
const colorScheme = usePreferredColorScheme();

watchEffect(() => {
  document.documentElement.dataset.theme = colorScheme.scheme.value;
});
```

The server and pre-mount client state default to `unknown`; `ssrScheme` can
provide an application-owned hydration assumption. The hook observes both
dark and light media queries so `no-preference` is not collapsed into light.

Missing media-query support remains `unknown` and unsupported. Listener setup
failures are exposed as `PreferredColorSchemeError` and listeners are removed
on unmount.

# useDocumentVisibility

Lifecycle-owned document visibility with an explicit SSR state.

```ts
const visibility = useDocumentVisibility();

watchEffect(() => {
  if (visibility.isHidden.value) pauseExpensiveWork();
});
```

The default state is `unknown` on the server and before client mount. Pass
`ssrState` only when the application has a deliberate hydration assumption.
After mount, the hook synchronizes from `document.visibilityState` and owns its
`visibilitychange` listener until unmount.

Unsupported environments remain `unknown` with `isSupported` set to `false`.
Listener setup failures are captured as `DocumentVisibilityError`.

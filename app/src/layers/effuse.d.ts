import type { Signal, ReadonlySignal, EffuseLayerRegistry } from '@effuse/core';

declare module '../../../packages/core/src/layers/types.js' {
  interface EffuseLayerRegistry {
    docs: {
      props: { theme: Signal<string>; currentSlug: Signal<string> };
    };
    i18n: {
      props: {
        locale: Signal<unknown>;
        isLoading: Signal<unknown>;
        translations: Signal<unknown>;
      };
      provides: { i18n: unknown };
    };
    layout: {
      props: { isDarkMode: Signal<boolean>; isMobileMenuOpen: Signal<boolean> };
    };
    router: {
      provides: { router: unknown };
    };
    sidebar: {
      props: {
        isOpen: Signal<unknown>;
        width: Signal<number>;
        isCollapsed: Signal<unknown>;
      };
      provides: { docsUI: unknown };
    };
    todos: {
      props: {
        isLoading: Signal<boolean>;
        filter: Signal<unknown>;
        totalCount: ReadonlySignal<unknown>;
      };
      provides: { todosStore: unknown };
    };
  }
}

export { };

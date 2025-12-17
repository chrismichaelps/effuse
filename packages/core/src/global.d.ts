import type { JSX as EffuseJSX } from './jsx/runtime.js';

declare global {
	namespace JSX {
		type Element = EffuseJSX.Element;
		type ElementClass = EffuseJSX.ElementClass;
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface IntrinsicElements extends EffuseJSX.IntrinsicElements {}
		// eslint-disable-next-line @typescript-eslint/no-empty-object-type
		interface ElementChildrenAttribute
			extends EffuseJSX.ElementChildrenAttribute {}
	}
}

export {};

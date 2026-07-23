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

import type { Signal } from '../../reactivity/signal.js';
import type { ReadonlySignal } from '../../types/index.js';
import type { HTMLAttributes } from './html.js';
import type {
	InputType,
	ButtonType,
	AnchorTarget,
	FormMethod,
	FormEncType,
	AutoComplete,
	LoadingBehavior,
	DecodingBehavior,
	PreloadBehavior,
	CrossOrigin,
	TextWrap,
	TableScope,
	ReferrerPolicy,
} from './unions.js';

export interface AnchorAttributes extends HTMLAttributes<HTMLAnchorElement> {
	href?: string;
	target?: AnchorTarget;
	rel?: string;
	download?: string | boolean;
	hreflang?: string;
	ping?: string;
	referrerPolicy?: ReferrerPolicy;
	type?: string;
}

export interface ButtonAttributes extends HTMLAttributes<HTMLButtonElement> {
	type?: ButtonType;
	disabled?:
		| boolean
		| Signal<boolean>
		| ReadonlySignal<boolean>
		| (() => boolean);
	name?: string;
	value?: string;
	form?: string;
	formAction?: string;
	formEncType?: FormEncType;
	formMethod?: FormMethod;
	formNoValidate?: boolean;
	formTarget?: AnchorTarget;
}

export interface InputAttributes extends HTMLAttributes<HTMLInputElement> {
	type?: InputType;
	value?:
		| string
		| number
		| Signal<string>
		| Signal<number>
		| ReadonlySignal<string>
		| ReadonlySignal<number>;
	checked?: boolean | Signal<boolean> | ReadonlySignal<boolean>;
	disabled?:
		| boolean
		| Signal<boolean>
		| ReadonlySignal<boolean>
		| (() => boolean);
	placeholder?: string;
	name?: string;
	required?: boolean;
	readonly?: boolean;
	min?: string | number;
	max?: string | number;
	step?: string | number;
	pattern?: string;
	autoComplete?: AutoComplete;
	autoFocus?: boolean;
	maxLength?: number;
	minLength?: number;
	size?: number;
	multiple?: boolean;
	accept?: string;
	capture?: 'user' | 'environment';
	list?: string;
	form?: string;
	formAction?: string;
	formEncType?: FormEncType;
	formMethod?: FormMethod;
	formNoValidate?: boolean;
	formTarget?: AnchorTarget;
	height?: number | string;
	width?: number | string;
	src?: string;
	alt?: string;
	dirname?: string;
}

export interface TextareaAttributes extends HTMLAttributes<HTMLTextAreaElement> {
	value?: string | Signal<string> | ReadonlySignal<string>;
	defaultValue?: string;
	placeholder?: string;
	rows?: number;
	cols?: number;
	disabled?:
		| boolean
		| Signal<boolean>
		| ReadonlySignal<boolean>
		| (() => boolean);
	readonly?: boolean;
	required?: boolean;
	maxLength?: number;
	minLength?: number;
	wrap?: TextWrap;
	autoComplete?: AutoComplete;
	autoFocus?: boolean;
	name?: string;
	form?: string;
	dirname?: string;
}

export interface SelectAttributes extends HTMLAttributes<HTMLSelectElement> {
	value?: string | Signal<string> | ReadonlySignal<string>;
	disabled?:
		| boolean
		| Signal<boolean>
		| ReadonlySignal<boolean>
		| (() => boolean);
	multiple?: boolean;
	required?: boolean;
	size?: number;
	name?: string;
	form?: string;
	autoComplete?: AutoComplete;
	autoFocus?: boolean;
}

export interface OptionAttributes extends HTMLAttributes<HTMLOptionElement> {
	value?: string;
	selected?: boolean;
	disabled?: boolean;
	label?: string;
}

export interface OptgroupAttributes extends HTMLAttributes<HTMLOptGroupElement> {
	disabled?: boolean;
	label?: string;
}

export interface FormAttributes extends HTMLAttributes<HTMLFormElement> {
	action?: string;
	method?: FormMethod;
	encType?: FormEncType;
	noValidate?: boolean;
	target?: AnchorTarget;
	autoComplete?: 'on' | 'off';
	name?: string;
	rel?: string;
	acceptCharset?: string;
}

export interface LabelAttributes extends HTMLAttributes<HTMLLabelElement> {
	for?: string;
	htmlFor?: string;
}

export interface FieldsetAttributes extends HTMLAttributes<HTMLFieldSetElement> {
	disabled?: boolean;
	form?: string;
	name?: string;
}

export interface OutputAttributes extends HTMLAttributes<HTMLOutputElement> {
	for?: string;
	form?: string;
	name?: string;
}

export interface ProgressAttributes extends HTMLAttributes<HTMLProgressElement> {
	value?: number;
	max?: number;
}

export interface MeterAttributes extends HTMLAttributes<HTMLMeterElement> {
	value?: number;
	min?: number;
	max?: number;
	low?: number;
	high?: number;
	optimum?: number;
}

export interface ImgAttributes extends HTMLAttributes<HTMLImageElement> {
	src?: string;
	alt?: string;
	width?: number | string;
	height?: number | string;
	loading?: LoadingBehavior;
	decoding?: DecodingBehavior;
	srcSet?: string;
	sizes?: string;
	crossOrigin?: CrossOrigin;
	referrerPolicy?: ReferrerPolicy;
	isMap?: boolean;
	useMap?: string;
	fetchPriority?: 'high' | 'low' | 'auto';
}

export interface VideoAttributes extends HTMLAttributes<HTMLVideoElement> {
	src?: string;
	autoPlay?: boolean;
	controls?: boolean;
	loop?: boolean;
	muted?: boolean;
	poster?: string;
	width?: number | string;
	height?: number | string;
	preload?: PreloadBehavior;
	playsInline?: boolean;
	crossOrigin?: CrossOrigin;
	disablePictureInPicture?: boolean;
	disableRemotePlayback?: boolean;
}

export interface AudioAttributes extends HTMLAttributes<HTMLAudioElement> {
	src?: string;
	autoPlay?: boolean;
	controls?: boolean;
	loop?: boolean;
	muted?: boolean;
	preload?: PreloadBehavior;
	crossOrigin?: CrossOrigin;
	disableRemotePlayback?: boolean;
}

export interface SourceAttributes extends HTMLAttributes<HTMLSourceElement> {
	src?: string;
	srcSet?: string;
	media?: string;
	sizes?: string;
	type?: string;
	width?: number;
	height?: number;
}

export interface TrackAttributes extends HTMLAttributes<HTMLTrackElement> {
	default?: boolean;
	kind?: 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata';
	label?: string;
	src?: string;
	srclang?: string;
}

export interface CanvasAttributes extends HTMLAttributes<HTMLCanvasElement> {
	width?: number | string;
	height?: number | string;
}

export interface IframeAttributes extends HTMLAttributes<HTMLIFrameElement> {
	src?: string;
	srcdoc?: string;
	width?: number | string;
	height?: number | string;
	allow?: string;
	sandbox?: string;
	loading?: LoadingBehavior;
	referrerPolicy?: ReferrerPolicy;
	name?: string;
	allowFullscreen?: boolean;
}

export interface EmbedAttributes extends HTMLAttributes<HTMLEmbedElement> {
	src?: string;
	type?: string;
	width?: number | string;
	height?: number | string;
}

export interface ObjectAttributes extends HTMLAttributes<HTMLObjectElement> {
	data?: string;
	type?: string;
	name?: string;
	useMap?: string;
	form?: string;
	width?: number | string;
	height?: number | string;
}

export interface TableAttributes extends HTMLAttributes<HTMLTableElement> {
	cellPadding?: number | string;
	cellSpacing?: number | string;
	border?: number | string;
}

export interface ThAttributes extends HTMLAttributes<HTMLTableCellElement> {
	colSpan?: number;
	rowSpan?: number;
	scope?: TableScope;
	headers?: string;
	abbr?: string;
}

export interface TdAttributes extends HTMLAttributes<HTMLTableCellElement> {
	colSpan?: number;
	rowSpan?: number;
	headers?: string;
}

export interface ColAttributes extends HTMLAttributes<HTMLTableColElement> {
	span?: number;
}

export interface ColgroupAttributes extends HTMLAttributes<HTMLTableColElement> {
	span?: number;
}

export interface MetaAttributes extends HTMLAttributes<HTMLMetaElement> {
	charSet?: string;
	content?: string;
	httpEquiv?:
		| 'content-type'
		| 'default-style'
		| 'refresh'
		| 'x-ua-compatible'
		| (string & {});
	name?: string;
	media?: string;
}

export interface LinkAttributes extends HTMLAttributes<HTMLLinkElement> {
	href?: string;
	rel?: string;
	type?: string;
	media?: string;
	as?:
		| 'audio'
		| 'document'
		| 'embed'
		| 'fetch'
		| 'font'
		| 'image'
		| 'object'
		| 'script'
		| 'style'
		| 'track'
		| 'video'
		| 'worker';
	crossOrigin?: CrossOrigin;
	integrity?: string;
	referrerPolicy?: ReferrerPolicy;
	sizes?: string;
	disabled?: boolean;
	hreflang?: string;
	title?: string;
	fetchPriority?: 'high' | 'low' | 'auto';
	blocking?: 'render';
}

export interface StyleAttributes extends HTMLAttributes<HTMLStyleElement> {
	media?: string;
	blocking?: 'render';
}

export interface ScriptAttributes extends HTMLAttributes<HTMLScriptElement> {
	src?: string;
	type?: 'module' | 'importmap' | (string & {});
	async?: boolean;
	defer?: boolean;
	crossOrigin?: CrossOrigin;
	integrity?: string;
	noModule?: boolean;
	nonce?: string;
	referrerPolicy?: ReferrerPolicy;
	blocking?: 'render';
	fetchPriority?: 'high' | 'low' | 'auto';
}

export interface BaseAttributes extends HTMLAttributes<HTMLBaseElement> {
	href?: string;
	target?: AnchorTarget;
}

export interface DetailsAttributes extends HTMLAttributes<HTMLDetailsElement> {
	open?: boolean;
}

export interface DialogAttributes extends HTMLAttributes<HTMLDialogElement> {
	open?: boolean;
}

export type SummaryAttributes = HTMLAttributes;

export type MenuAttributes = HTMLAttributes;

export interface SVGAttributes<Target extends EventTarget = SVGSVGElement>
	extends HTMLAttributes<Target> {
	viewBox?: string;
	xmlns?: string;
	fill?: string;
	stroke?: string;
	strokeWidth?: number | string;
	width?: number | string;
	height?: number | string;
	preserveAspectRatio?: string;
	x?: number | string;
	y?: number | string;
}

export interface SVGPathAttributes extends SVGAttributes<SVGPathElement> {
	d?: string;
	fill?: string;
	stroke?: string;
	strokeWidth?: number | string;
	strokeLinecap?: 'butt' | 'round' | 'square';
	strokeLinejoin?: 'miter' | 'round' | 'bevel';
	strokeDasharray?: string | number;
	strokeDashoffset?: string | number;
	fillRule?: 'nonzero' | 'evenodd';
	clipRule?: 'nonzero' | 'evenodd';
	transform?: string;
	opacity?: number | string;
	pathLength?: number;
}

export interface SVGCircleAttributes extends SVGAttributes<SVGCircleElement> {
	cx?: number | string;
	cy?: number | string;
	r?: number | string;
}

export interface SVGEllipseAttributes extends SVGAttributes<SVGEllipseElement> {
	cx?: number | string;
	cy?: number | string;
	rx?: number | string;
	ry?: number | string;
}

export interface SVGLineAttributes extends SVGAttributes<SVGLineElement> {
	x1?: number | string;
	y1?: number | string;
	x2?: number | string;
	y2?: number | string;
}

export interface SVGRectAttributes extends SVGAttributes<SVGRectElement> {
	x?: number | string;
	y?: number | string;
	width?: number | string;
	height?: number | string;
	rx?: number | string;
	ry?: number | string;
}

export interface SVGPolygonAttributes extends SVGAttributes<SVGPolygonElement> {
	points?: string;
}

export interface SVGPolylineAttributes extends SVGAttributes<SVGPolylineElement> {
	points?: string;
}

export interface SVGTextAttributes extends SVGAttributes<SVGTextElement> {
	x?: number | string;
	y?: number | string;
	dx?: number | string;
	dy?: number | string;
	textAnchor?: 'start' | 'middle' | 'end';
	dominantBaseline?: string;
}

export interface SVGUseAttributes extends SVGAttributes<SVGUseElement> {
	href?: string;
	'xlink:href'?: string;
}

export interface SlotAttributes extends HTMLAttributes<HTMLSlotElement> {
	name?: string;
}

export interface TemplateAttributes extends HTMLAttributes<HTMLTemplateElement> {
	shadowrootmode?: 'open' | 'closed';
}

export interface AreaAttributes extends HTMLAttributes<HTMLAreaElement> {
	alt?: string;
	coords?: string;
	download?: string | boolean;
	href?: string;
	ping?: string;
	referrerPolicy?: ReferrerPolicy;
	rel?: string;
	shape?: 'rect' | 'circle' | 'poly' | 'default';
	target?: AnchorTarget;
}

export interface MapAttributes extends HTMLAttributes<HTMLMapElement> {
	name?: string;
}

export interface QuoteAttributes extends HTMLAttributes<HTMLQuoteElement> {
	cite?: string;
}

export interface TimeAttributes extends HTMLAttributes<HTMLTimeElement> {
	dateTime?: string;
}

export interface DataAttributes extends HTMLAttributes<HTMLDataElement> {
	value?: string;
}

export interface DelAttributes extends HTMLAttributes<HTMLModElement> {
	cite?: string;
	dateTime?: string;
}

export interface InsAttributes extends HTMLAttributes<HTMLModElement> {
	cite?: string;
	dateTime?: string;
}

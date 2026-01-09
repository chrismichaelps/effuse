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

export interface AnchorAttributes extends HTMLAttributes {
	href?: string;
	target?: AnchorTarget;
	rel?: string;
	download?: string | boolean;
	hreflang?: string;
	ping?: string;
	referrerPolicy?: ReferrerPolicy;
	type?: string;
}

export interface ButtonAttributes extends HTMLAttributes {
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

export interface InputAttributes extends HTMLAttributes {
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

export interface TextareaAttributes extends HTMLAttributes {
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

export interface SelectAttributes extends HTMLAttributes {
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

export interface OptionAttributes extends HTMLAttributes {
	value?: string;
	selected?: boolean;
	disabled?: boolean;
	label?: string;
}

export interface OptgroupAttributes extends HTMLAttributes {
	disabled?: boolean;
	label?: string;
}

export interface FormAttributes extends HTMLAttributes {
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

export interface LabelAttributes extends HTMLAttributes {
	for?: string;
	htmlFor?: string;
}

export interface FieldsetAttributes extends HTMLAttributes {
	disabled?: boolean;
	form?: string;
	name?: string;
}

export interface OutputAttributes extends HTMLAttributes {
	for?: string;
	form?: string;
	name?: string;
}

export interface ProgressAttributes extends HTMLAttributes {
	value?: number;
	max?: number;
}

export interface MeterAttributes extends HTMLAttributes {
	value?: number;
	min?: number;
	max?: number;
	low?: number;
	high?: number;
	optimum?: number;
}

export interface ImgAttributes extends HTMLAttributes {
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

export interface VideoAttributes extends HTMLAttributes {
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

export interface AudioAttributes extends HTMLAttributes {
	src?: string;
	autoPlay?: boolean;
	controls?: boolean;
	loop?: boolean;
	muted?: boolean;
	preload?: PreloadBehavior;
	crossOrigin?: CrossOrigin;
	disableRemotePlayback?: boolean;
}

export interface SourceAttributes extends HTMLAttributes {
	src?: string;
	srcSet?: string;
	media?: string;
	sizes?: string;
	type?: string;
	width?: number;
	height?: number;
}

export interface TrackAttributes extends HTMLAttributes {
	default?: boolean;
	kind?: 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata';
	label?: string;
	src?: string;
	srclang?: string;
}

export interface CanvasAttributes extends HTMLAttributes {
	width?: number | string;
	height?: number | string;
}

export interface IframeAttributes extends HTMLAttributes {
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

export interface EmbedAttributes extends HTMLAttributes {
	src?: string;
	type?: string;
	width?: number | string;
	height?: number | string;
}

export interface ObjectAttributes extends HTMLAttributes {
	data?: string;
	type?: string;
	name?: string;
	useMap?: string;
	form?: string;
	width?: number | string;
	height?: number | string;
}

export interface TableAttributes extends HTMLAttributes {
	cellPadding?: number | string;
	cellSpacing?: number | string;
	border?: number | string;
}

export interface ThAttributes extends HTMLAttributes {
	colSpan?: number;
	rowSpan?: number;
	scope?: TableScope;
	headers?: string;
	abbr?: string;
}

export interface TdAttributes extends HTMLAttributes {
	colSpan?: number;
	rowSpan?: number;
	headers?: string;
}

export interface ColAttributes extends HTMLAttributes {
	span?: number;
}

export interface ColgroupAttributes extends HTMLAttributes {
	span?: number;
}

export interface MetaAttributes extends HTMLAttributes {
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

export interface LinkAttributes extends HTMLAttributes {
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

export interface StyleAttributes extends HTMLAttributes {
	media?: string;
	blocking?: 'render';
}

export interface ScriptAttributes extends HTMLAttributes {
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

export interface BaseAttributes extends HTMLAttributes {
	href?: string;
	target?: AnchorTarget;
}

export interface DetailsAttributes extends HTMLAttributes {
	open?: boolean;
}

export interface DialogAttributes extends HTMLAttributes {
	open?: boolean;
}

export type SummaryAttributes = HTMLAttributes;

export type MenuAttributes = HTMLAttributes;

export interface SVGAttributes extends HTMLAttributes {
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

export interface SVGPathAttributes extends HTMLAttributes {
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

export interface SVGCircleAttributes extends SVGAttributes {
	cx?: number | string;
	cy?: number | string;
	r?: number | string;
}

export interface SVGEllipseAttributes extends SVGAttributes {
	cx?: number | string;
	cy?: number | string;
	rx?: number | string;
	ry?: number | string;
}

export interface SVGLineAttributes extends SVGAttributes {
	x1?: number | string;
	y1?: number | string;
	x2?: number | string;
	y2?: number | string;
}

export interface SVGRectAttributes extends SVGAttributes {
	x?: number | string;
	y?: number | string;
	width?: number | string;
	height?: number | string;
	rx?: number | string;
	ry?: number | string;
}

export interface SVGPolygonAttributes extends SVGAttributes {
	points?: string;
}

export interface SVGPolylineAttributes extends SVGAttributes {
	points?: string;
}

export interface SVGTextAttributes extends SVGAttributes {
	x?: number | string;
	y?: number | string;
	dx?: number | string;
	dy?: number | string;
	textAnchor?: 'start' | 'middle' | 'end';
	dominantBaseline?: string;
}

export interface SVGUseAttributes extends SVGAttributes {
	href?: string;
	'xlink:href'?: string;
}

export interface SlotAttributes extends HTMLAttributes {
	name?: string;
}

export interface TemplateAttributes extends HTMLAttributes {
	shadowrootmode?: 'open' | 'closed';
}

export interface AreaAttributes extends HTMLAttributes {
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

export interface MapAttributes extends HTMLAttributes {
	name?: string;
}

export interface QuoteAttributes extends HTMLAttributes {
	cite?: string;
}

export interface TimeAttributes extends HTMLAttributes {
	dateTime?: string;
}

export interface DataAttributes extends HTMLAttributes {
	value?: string;
}

export interface DelAttributes extends HTMLAttributes {
	cite?: string;
	dateTime?: string;
}

export interface InsAttributes extends HTMLAttributes {
	cite?: string;
	dateTime?: string;
}

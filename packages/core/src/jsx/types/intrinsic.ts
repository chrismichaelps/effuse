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

import type { HTMLAttributes } from './html.js';
import type {
	AnchorAttributes,
	ButtonAttributes,
	InputAttributes,
	TextareaAttributes,
	SelectAttributes,
	OptionAttributes,
	OptgroupAttributes,
	FormAttributes,
	LabelAttributes,
	FieldsetAttributes,
	OutputAttributes,
	ProgressAttributes,
	MeterAttributes,
	ImgAttributes,
	VideoAttributes,
	AudioAttributes,
	SourceAttributes,
	TrackAttributes,
	CanvasAttributes,
	IframeAttributes,
	EmbedAttributes,
	ObjectAttributes,
	TableAttributes,
	ThAttributes,
	TdAttributes,
	ColAttributes,
	ColgroupAttributes,
	MetaAttributes,
	LinkAttributes,
	StyleAttributes,
	ScriptAttributes,
	BaseAttributes,
	DetailsAttributes,
	DialogAttributes,
	SVGAttributes,
	SVGPathAttributes,
	SVGCircleAttributes,
	SVGEllipseAttributes,
	SVGLineAttributes,
	SVGRectAttributes,
	SVGPolygonAttributes,
	SVGPolylineAttributes,
	SVGTextAttributes,
	SVGUseAttributes,
	SlotAttributes,
	TemplateAttributes,
	AreaAttributes,
	MapAttributes,
	QuoteAttributes,
	TimeAttributes,
	DataAttributes,
	DelAttributes,
	InsAttributes,
} from './elements.js';

type CustomElementAttributes = Omit<HTMLAttributes<Element>, 'ref'> & {
	ref?: unknown;
};

export interface BaseIntrinsicElements {
	// Document Metadata
	html: HTMLAttributes<HTMLHtmlElement>;
	head: HTMLAttributes<HTMLHeadElement>;
	title: HTMLAttributes<HTMLTitleElement>;
	base: BaseAttributes;
	link: LinkAttributes;
	meta: MetaAttributes;
	style: StyleAttributes;

	// Sectioning Root
	body: HTMLAttributes<HTMLBodyElement>;

	// Content Sectioning
	article: HTMLAttributes;
	section: HTMLAttributes;
	nav: HTMLAttributes;
	aside: HTMLAttributes;
	header: HTMLAttributes;
	footer: HTMLAttributes;
	main: HTMLAttributes;
	address: HTMLAttributes;
	hgroup: HTMLAttributes;
	search: HTMLAttributes;

	// Heading Content
	h1: HTMLAttributes<HTMLHeadingElement>;
	h2: HTMLAttributes<HTMLHeadingElement>;
	h3: HTMLAttributes<HTMLHeadingElement>;
	h4: HTMLAttributes<HTMLHeadingElement>;
	h5: HTMLAttributes<HTMLHeadingElement>;
	h6: HTMLAttributes<HTMLHeadingElement>;

	// Text Content
	div: HTMLAttributes<HTMLDivElement>;
	p: HTMLAttributes<HTMLParagraphElement>;
	blockquote: QuoteAttributes;
	ol: HTMLAttributes<HTMLOListElement>;
	ul: HTMLAttributes<HTMLUListElement>;
	li: HTMLAttributes<HTMLLIElement>;
	dl: HTMLAttributes<HTMLDListElement>;
	dt: HTMLAttributes;
	dd: HTMLAttributes;
	figure: HTMLAttributes;
	figcaption: HTMLAttributes;
	hr: HTMLAttributes<HTMLHRElement>;
	pre: HTMLAttributes<HTMLPreElement>;
	menu: HTMLAttributes<HTMLMenuElement>;

	// Inline Text Semantics
	a: AnchorAttributes;
	abbr: HTMLAttributes;
	b: HTMLAttributes;
	bdi: HTMLAttributes;
	bdo: HTMLAttributes;
	br: HTMLAttributes<HTMLBRElement>;
	cite: HTMLAttributes;
	code: HTMLAttributes;
	data: DataAttributes;
	dfn: HTMLAttributes;
	em: HTMLAttributes;
	i: HTMLAttributes;
	kbd: HTMLAttributes;
	mark: HTMLAttributes;
	q: QuoteAttributes;
	rp: HTMLAttributes;
	rt: HTMLAttributes;
	ruby: HTMLAttributes;
	s: HTMLAttributes;
	samp: HTMLAttributes;
	small: HTMLAttributes;
	span: HTMLAttributes<HTMLSpanElement>;
	strong: HTMLAttributes;
	sub: HTMLAttributes;
	sup: HTMLAttributes;
	time: TimeAttributes;
	u: HTMLAttributes;
	var: HTMLAttributes;
	wbr: HTMLAttributes;

	// Image and Multimedia
	img: ImgAttributes;
	audio: AudioAttributes;
	video: VideoAttributes;
	source: SourceAttributes;
	track: TrackAttributes;
	picture: HTMLAttributes<HTMLPictureElement>;
	map: MapAttributes;
	area: AreaAttributes;

	// Embedded Content
	iframe: IframeAttributes;
	embed: EmbedAttributes;
	object: ObjectAttributes;
	param: HTMLAttributes;
	portal: HTMLAttributes;

	// Canvas / Graphics
	canvas: CanvasAttributes;

	// SVG and MathML
	svg: SVGAttributes;
	path: SVGPathAttributes;
	circle: SVGCircleAttributes;
	ellipse: SVGEllipseAttributes;
	line: SVGLineAttributes;
	polygon: SVGPolygonAttributes;
	polyline: SVGPolylineAttributes;
	rect: SVGRectAttributes;
	g: SVGAttributes<SVGGElement>;
	defs: SVGAttributes<SVGDefsElement>;
	symbol: SVGAttributes<SVGSymbolElement>;
	use: SVGUseAttributes;
	text: SVGTextAttributes;
	tspan: SVGTextAttributes;
	image: SVGAttributes<SVGImageElement>;
	clipPath: SVGAttributes<SVGClipPathElement>;
	mask: SVGAttributes<SVGMaskElement>;
	pattern: SVGAttributes<SVGPatternElement>;
	linearGradient: SVGAttributes<SVGLinearGradientElement>;
	radialGradient: SVGAttributes<SVGRadialGradientElement>;
	stop: SVGAttributes<SVGStopElement>;
	filter: SVGAttributes<SVGFilterElement>;
	feBlend: SVGAttributes<SVGFEBlendElement>;
	feColorMatrix: SVGAttributes<SVGFEColorMatrixElement>;
	feComponentTransfer: SVGAttributes<SVGFEComponentTransferElement>;
	feComposite: SVGAttributes<SVGFECompositeElement>;
	feConvolveMatrix: SVGAttributes<SVGFEConvolveMatrixElement>;
	feDiffuseLighting: SVGAttributes<SVGFEDiffuseLightingElement>;
	feDisplacementMap: SVGAttributes<SVGFEDisplacementMapElement>;
	feDropShadow: SVGAttributes<SVGFEDropShadowElement>;
	feFlood: SVGAttributes<SVGFEFloodElement>;
	feFuncA: SVGAttributes<SVGFEFuncAElement>;
	feFuncB: SVGAttributes<SVGFEFuncBElement>;
	feFuncG: SVGAttributes<SVGFEFuncGElement>;
	feFuncR: SVGAttributes<SVGFEFuncRElement>;
	feGaussianBlur: SVGAttributes<SVGFEGaussianBlurElement>;
	feImage: SVGAttributes<SVGFEImageElement>;
	feMerge: SVGAttributes<SVGFEMergeElement>;
	feMergeNode: SVGAttributes<SVGFEMergeNodeElement>;
	feMorphology: SVGAttributes<SVGFEMorphologyElement>;
	feOffset: SVGAttributes<SVGFEOffsetElement>;
	fePointLight: SVGAttributes<SVGFEPointLightElement>;
	feSpecularLighting: SVGAttributes<SVGFESpecularLightingElement>;
	feSpotLight: SVGAttributes<SVGFESpotLightElement>;
	feTile: SVGAttributes<SVGFETileElement>;
	feTurbulence: SVGAttributes<SVGFETurbulenceElement>;
	foreignObject: SVGAttributes<SVGForeignObjectElement>;
	marker: SVGAttributes<SVGMarkerElement>;
	metadata: SVGAttributes<SVGMetadataElement>;
	view: SVGAttributes<SVGViewElement>;
	desc: SVGAttributes<SVGDescElement>;
	switch: SVGAttributes<SVGSwitchElement>;
	animate: SVGAttributes<SVGAnimateElement>;
	animateMotion: SVGAttributes<SVGAnimateMotionElement>;
	animateTransform: SVGAttributes<SVGAnimateTransformElement>;
	set: SVGAttributes<SVGSetElement>;
	mpath: SVGAttributes<SVGMPathElement>;

	// MathML (basic support)
	math: HTMLAttributes<MathMLElement>;
	mi: HTMLAttributes<MathMLElement>;
	mo: HTMLAttributes<MathMLElement>;
	mn: HTMLAttributes<MathMLElement>;
	ms: HTMLAttributes<MathMLElement>;
	mtext: HTMLAttributes<MathMLElement>;
	mspace: HTMLAttributes<MathMLElement>;
	mfrac: HTMLAttributes<MathMLElement>;
	mrow: HTMLAttributes<MathMLElement>;
	msqrt: HTMLAttributes<MathMLElement>;
	mroot: HTMLAttributes<MathMLElement>;
	msub: HTMLAttributes<MathMLElement>;
	msup: HTMLAttributes<MathMLElement>;
	msubsup: HTMLAttributes<MathMLElement>;
	mover: HTMLAttributes<MathMLElement>;
	munder: HTMLAttributes<MathMLElement>;
	munderover: HTMLAttributes<MathMLElement>;
	mmultiscripts: HTMLAttributes<MathMLElement>;
	mtable: HTMLAttributes<MathMLElement>;
	mtr: HTMLAttributes<MathMLElement>;
	mtd: HTMLAttributes<MathMLElement>;

	// Scripting
	script: ScriptAttributes;
	noscript: HTMLAttributes;

	// Demarcating Edits
	del: DelAttributes;
	ins: InsAttributes;

	// Table Content
	table: TableAttributes;
	caption: HTMLAttributes;
	colgroup: ColgroupAttributes;
	col: ColAttributes;
	thead: HTMLAttributes;
	tbody: HTMLAttributes;
	tfoot: HTMLAttributes;
	tr: HTMLAttributes;
	th: ThAttributes;
	td: TdAttributes;

	// Forms
	form: FormAttributes;
	label: LabelAttributes;
	input: InputAttributes;
	button: ButtonAttributes;
	select: SelectAttributes;
	datalist: HTMLAttributes;
	optgroup: OptgroupAttributes;
	option: OptionAttributes;
	textarea: TextareaAttributes;
	fieldset: FieldsetAttributes;
	legend: HTMLAttributes;
	meter: MeterAttributes;
	output: OutputAttributes;
	progress: ProgressAttributes;

	// Interactive Elements
	details: DetailsAttributes;
	summary: HTMLAttributes;
	dialog: DialogAttributes;

	slot: SlotAttributes;
	template: TemplateAttributes;
	[key: string]: CustomElementAttributes;
}

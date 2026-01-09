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

export interface BaseIntrinsicElements {
	// Document Metadata
	html: HTMLAttributes;
	head: HTMLAttributes;
	title: HTMLAttributes;
	base: BaseAttributes;
	link: LinkAttributes;
	meta: MetaAttributes;
	style: StyleAttributes;

	// Sectioning Root
	body: HTMLAttributes;

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
	h1: HTMLAttributes;
	h2: HTMLAttributes;
	h3: HTMLAttributes;
	h4: HTMLAttributes;
	h5: HTMLAttributes;
	h6: HTMLAttributes;

	// Text Content
	div: HTMLAttributes;
	p: HTMLAttributes;
	blockquote: QuoteAttributes;
	ol: HTMLAttributes;
	ul: HTMLAttributes;
	li: HTMLAttributes;
	dl: HTMLAttributes;
	dt: HTMLAttributes;
	dd: HTMLAttributes;
	figure: HTMLAttributes;
	figcaption: HTMLAttributes;
	hr: HTMLAttributes;
	pre: HTMLAttributes;
	menu: HTMLAttributes;

	// Inline Text Semantics
	a: AnchorAttributes;
	abbr: HTMLAttributes;
	b: HTMLAttributes;
	bdi: HTMLAttributes;
	bdo: HTMLAttributes;
	br: HTMLAttributes;
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
	span: HTMLAttributes;
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
	picture: HTMLAttributes;
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
	g: SVGAttributes;
	defs: SVGAttributes;
	symbol: SVGAttributes;
	use: SVGUseAttributes;
	text: SVGTextAttributes;
	tspan: SVGTextAttributes;
	image: SVGAttributes;
	clipPath: SVGAttributes;
	mask: SVGAttributes;
	pattern: SVGAttributes;
	linearGradient: SVGAttributes;
	radialGradient: SVGAttributes;
	stop: SVGAttributes;
	filter: SVGAttributes;
	feBlend: SVGAttributes;
	feColorMatrix: SVGAttributes;
	feComponentTransfer: SVGAttributes;
	feComposite: SVGAttributes;
	feConvolveMatrix: SVGAttributes;
	feDiffuseLighting: SVGAttributes;
	feDisplacementMap: SVGAttributes;
	feDropShadow: SVGAttributes;
	feFlood: SVGAttributes;
	feFuncA: SVGAttributes;
	feFuncB: SVGAttributes;
	feFuncG: SVGAttributes;
	feFuncR: SVGAttributes;
	feGaussianBlur: SVGAttributes;
	feImage: SVGAttributes;
	feMerge: SVGAttributes;
	feMergeNode: SVGAttributes;
	feMorphology: SVGAttributes;
	feOffset: SVGAttributes;
	fePointLight: SVGAttributes;
	feSpecularLighting: SVGAttributes;
	feSpotLight: SVGAttributes;
	feTile: SVGAttributes;
	feTurbulence: SVGAttributes;
	foreignObject: SVGAttributes;
	marker: SVGAttributes;
	metadata: SVGAttributes;
	view: SVGAttributes;
	desc: SVGAttributes;
	switch: SVGAttributes;
	animate: SVGAttributes;
	animateMotion: SVGAttributes;
	animateTransform: SVGAttributes;
	set: SVGAttributes;
	mpath: SVGAttributes;

	// MathML (basic support)
	math: HTMLAttributes;
	mi: HTMLAttributes;
	mo: HTMLAttributes;
	mn: HTMLAttributes;
	ms: HTMLAttributes;
	mtext: HTMLAttributes;
	mspace: HTMLAttributes;
	mfrac: HTMLAttributes;
	mrow: HTMLAttributes;
	msqrt: HTMLAttributes;
	mroot: HTMLAttributes;
	msub: HTMLAttributes;
	msup: HTMLAttributes;
	msubsup: HTMLAttributes;
	mover: HTMLAttributes;
	munder: HTMLAttributes;
	munderover: HTMLAttributes;
	mmultiscripts: HTMLAttributes;
	mtable: HTMLAttributes;
	mtr: HTMLAttributes;
	mtd: HTMLAttributes;

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
	[key: string]: HTMLAttributes;
}

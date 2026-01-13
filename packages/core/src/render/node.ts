import { Data, Predicate } from 'effect';
import type { Signal } from '../types/index.js';
import type { ElementProps, Portals, PortalFn } from '../schema/index.js';
import { EFFUSE_NODE, NodeType } from '../constants.js';

export type { ElementProps, Portals, PortalFn };

export { EFFUSE_NODE, NodeType };

export type EffuseChild =
	| EffuseNode
	| string
	| number
	| boolean
	| null
	| undefined
	| Signal<EffuseChild>
	| (() => EffuseChild)
	| EffuseChild[];

export interface BlueprintContext<P = Record<string, unknown>> {
	readonly props: P;
	readonly state: Record<string, unknown>;
	readonly portals: Portals;
}

export interface BlueprintDef<P = Record<string, unknown>> {
	readonly _tag: 'Blueprint';
	readonly name?: string | undefined;
	readonly props?: P | undefined;
	state?(props: P): Record<string, unknown>;
	view(context: BlueprintContext<P>): EffuseChild;
	error?(error: Error): EffuseChild;
	loading?(): EffuseChild;
}

export interface Component<
	P = Record<string, unknown>,
> extends BlueprintDef<P> {
	(props?: P): EffuseNode;
}

export type EffuseNode = Data.TaggedEnum<{
	Element: {
		readonly [EFFUSE_NODE]: true;
		readonly tag: string;
		readonly props: ElementProps | null;
		readonly children: EffuseChild[];
		readonly key?: string | number | undefined;
	};
	Text: {
		readonly [EFFUSE_NODE]: true;
		readonly text: string;
		readonly key?: string | number | undefined;
	};
	Fragment: {
		readonly [EFFUSE_NODE]: true;
		readonly children: EffuseChild[];
		readonly key?: string | number | undefined;
	};
	List: {
		readonly [EFFUSE_NODE]: true;
		readonly children: EffuseChild[];
		readonly key?: string | number | undefined;
	};
	Blueprint: {
		readonly [EFFUSE_NODE]: true;
		readonly blueprint: BlueprintDef;
		readonly props: Record<string, unknown>;
		readonly portals: Portals | null;
		readonly key?: string | number | undefined;
	};
}>;

const { $match, Element, Text, Fragment, List, Blueprint } =
	Data.taggedEnum<EffuseNode>();

export const isEffuseNode = (u: unknown): u is EffuseNode =>
	Predicate.isObject(u) && Predicate.hasProperty(u, EFFUSE_NODE);

export type ElementNodeInput = Omit<ElementNode, '_tag'>;
export type TextNodeInput = Omit<TextNode, '_tag'>;
export type FragmentNodeInput = Omit<FragmentNode, '_tag'>;
export type ListNodeInput = Omit<ListNode, '_tag'>;
export type BlueprintNodeInput = Omit<BlueprintNode, '_tag'>;

export const CreateElementNode = (args: ElementNodeInput): ElementNode =>
	Element(args);

export const CreateTextNode = (args: TextNodeInput): TextNode => Text(args);

export const CreateFragmentNode = (args: FragmentNodeInput): FragmentNode =>
	Fragment(args);

export const CreateListNode = (args: ListNodeInput): ListNode => List(args);

export const CreateBlueprintNode = (args: BlueprintNodeInput): BlueprintNode =>
	Blueprint(args);

export const matchEffuseNode = $match;

export type ElementNode = Extract<EffuseNode, { _tag: 'Element' }>;
export type TextNode = Extract<EffuseNode, { _tag: 'Text' }>;
export type FragmentNode = Extract<EffuseNode, { _tag: 'Fragment' }>;
export type ListNode = Extract<EffuseNode, { _tag: 'List' }>;
export type BlueprintNode<P = Record<string, unknown>> = Extract<
	EffuseNode,
	{ _tag: 'Blueprint' }
> & { props: P; blueprint: BlueprintDef<P> };

export const createTextNode = (text: string): TextNode =>
	Text({
		[EFFUSE_NODE]: true,
		text,
	});

export const createFragmentNode = (children: EffuseChild[]): FragmentNode =>
	Fragment({
		[EFFUSE_NODE]: true,
		children,
	});

export const createListNode = (children: EffuseChild[]): ListNode =>
	List({
		[EFFUSE_NODE]: true,
		children,
	});

export const isSignalChild = (value: unknown): value is Signal<EffuseChild> => {
	return (
		Predicate.isObject(value) &&
		'value' in value &&
		Predicate.isObject((value as Record<string, unknown>)._subscribers)
	);
};

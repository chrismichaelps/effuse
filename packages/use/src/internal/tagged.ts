/** Public tagged-union contracts that keep the runtime implementation private. */
export type TaggedVariant<Tag extends string, Fields> = Readonly<{
	_tag: Tag;
}> &
	Fields;

export type TaggedUnion<Cases extends object> = {
	[K in Extract<keyof Cases, string>]: TaggedVariant<K, Cases[K]>;
}[Extract<keyof Cases, string>];

export type TaggedHandlers<Cases extends object, R> = {
	[K in Extract<keyof Cases, string>]: (
		value: TaggedVariant<K, Cases[K]>
	) => R;
};

export interface TaggedMatcher<Cases extends object> {
	<R>(cases: TaggedHandlers<Cases, R>): (value: TaggedUnion<Cases>) => R;
	<R>(value: TaggedUnion<Cases>, cases: TaggedHandlers<Cases, R>): R;
}

type TaggedConstructors<Cases extends object> = {
	readonly [K in Extract<keyof Cases, string>]: keyof Cases[K] extends never
		? () => TaggedVariant<K, Cases[K]>
		: (fields: Cases[K]) => TaggedVariant<K, Cases[K]>;
};

export type TaggedEnumConstructors<Cases extends object> =
	TaggedConstructors<Cases> & {
		readonly $is: <K extends Extract<keyof Cases, string>>(
			tag: K
		) => (value: unknown) => value is TaggedVariant<K, Cases[K]>;
		readonly $match: TaggedMatcher<Cases>;
	};

export interface TaggedErrorConstructor<Fields extends object, E extends Error> {
	new (fields: Fields): E;
}

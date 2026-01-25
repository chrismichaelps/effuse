import { describe, it, expect, vi } from 'vitest';
import { define } from '../../blueprint/define.js';
import type {
	DefineOptions,
	DefineOptionsWithInferredProps,
} from '../../blueprint/define.js';

interface MockBlueprintDef {
	_tag: string;
	state: (props: unknown) => unknown;
	view: (ctx: unknown) => unknown;
}

const extractBlueprint = (component: unknown): MockBlueprintDef => {
	return component as MockBlueprintDef;
};

describe('define function - props type inference', () => {
	describe('explicit generic typing (define<Props, Exposed>)', () => {
		it('should infer props type from explicit generic parameter', () => {
			interface UserProps {
				name: string;
				age: number;
			}

			interface UserExposed {
				displayName: string;
			}

			const UserComponent = define<UserProps, UserExposed>({
				script: ({ props }) => {
					const displayName = `${props.name} (${String(props.age)})`;
					return { displayName };
				},
				template: ({ displayName }) => displayName as unknown as null,
			});

			const blueprint = extractBlueprint(UserComponent);
			expect(blueprint._tag).toBe('Blueprint');

			const state = blueprint.state({ name: 'John', age: 30 });
			expect(state).toBeDefined();
		});

		it('should handle optional props correctly', () => {
			interface OptionalProps {
				required: string;
				optional?: number;
			}

			interface OptionalExposed {
				result: string;
			}

			const OptionalComponent = define<OptionalProps, OptionalExposed>({
				script: ({ props }) => {
					const value = props.optional ?? 0;
					return { result: `${props.required}-${String(value)}` };
				},
				template: ({ result }) => result as unknown as null,
			});

			const blueprint = extractBlueprint(OptionalComponent);
			const state = blueprint.state({ required: 'test' });
			expect(state).toBeDefined();
		});

		it('should handle complex nested props', () => {
			interface NestedProps {
				user: {
					profile: {
						firstName: string;
						lastName: string;
					};
					settings: {
						theme: 'light' | 'dark';
						notifications: boolean;
					};
				};
			}

			interface NestedExposed {
				fullName: string;
				theme: 'light' | 'dark';
			}

			const NestedComponent = define<NestedProps, NestedExposed>({
				script: ({ props }) => {
					const fullName = `${props.user.profile.firstName} ${props.user.profile.lastName}`;
					return { fullName, theme: props.user.settings.theme };
				},
				template: ({ fullName, theme }) =>
					`${fullName}-${theme}` as unknown as null,
			});

			const blueprint = extractBlueprint(NestedComponent);
			const state = blueprint.state({
				user: {
					profile: { firstName: 'John', lastName: 'Doe' },
					settings: { theme: 'dark', notifications: true },
				},
			});
			expect(state).toBeDefined();
		});

		it('should handle array props', () => {
			interface ArrayProps {
				items: readonly string[];
				numbers: number[];
			}

			interface ArrayExposed {
				itemCount: number;
				sum: number;
			}

			const ArrayComponent = define<ArrayProps, ArrayExposed>({
				script: ({ props }) => {
					return {
						itemCount: props.items.length,
						sum: props.numbers.reduce((a, b) => a + b, 0),
					};
				},
				template: ({ itemCount, sum }) =>
					`${String(itemCount)}-${String(sum)}` as unknown as null,
			});

			const blueprint = extractBlueprint(ArrayComponent);
			const state = blueprint.state({
				items: ['a', 'b', 'c'],
				numbers: [1, 2, 3],
			});
			expect(state).toBeDefined();
		});

		it('should handle union type props', () => {
			interface UnionProps {
				status: 'active' | 'inactive' | 'pending';
				value: string | number;
			}

			interface UnionExposed {
				statusLabel: string;
				displayValue: string;
			}

			const UnionComponent = define<UnionProps, UnionExposed>({
				script: ({ props }) => {
					const statusLabel =
						props.status === 'active'
							? 'Active'
							: props.status === 'inactive'
								? 'Inactive'
								: 'Pending';
					return { statusLabel, displayValue: String(props.value) };
				},
				template: ({ statusLabel }) => statusLabel as unknown as null,
			});

			const blueprint = extractBlueprint(UnionComponent);
			const state = blueprint.state({ status: 'active', value: 42 });
			expect(state).toBeDefined();
		});
	});

	describe('inline props type inference (define({ props: ... }))', () => {
		it('should infer props type from inline props object', () => {
			const InferredComponent = define({
				props: {
					name: '' as string,
					age: 0 as number,
					active: false as boolean,
				},
				script: ({ props }) => {
					return {
						display: `${props.name} - ${String(props.age)} - ${String(props.active)}`,
					};
				},
				template: ({ display }) => display as unknown as null,
			});

			const blueprint = extractBlueprint(InferredComponent);
			expect(blueprint._tag).toBe('Blueprint');

			const state = blueprint.state({ name: 'Test', age: 25, active: true });
			expect(state).toBeDefined();
		});

		it('should infer complex nested types from props object', () => {
			const NestedInferredComponent = define({
				props: {
					config: {
						theme: 'light' as 'light' | 'dark',
						settings: {
							enabled: true as boolean,
							count: 0 as number,
						},
					},
				},
				script: ({ props }) => {
					return {
						themeDisplay: props.config.theme,
						isEnabled: props.config.settings.enabled,
					};
				},
				template: ({ themeDisplay }) => themeDisplay as unknown as null,
			});

			const blueprint = extractBlueprint(NestedInferredComponent);
			const state = blueprint.state({
				config: {
					theme: 'dark',
					settings: { enabled: false, count: 10 },
				},
			});
			expect(state).toBeDefined();
		});

		it('should infer array types from props object', () => {
			const ArrayInferredComponent = define({
				props: {
					items: [] as string[],
					matrix: [] as number[][],
				},
				script: ({ props }) => {
					return {
						itemCount: props.items.length,
						matrixSize: props.matrix.length,
					};
				},
				template: ({ itemCount }) => String(itemCount) as unknown as null,
			});

			const blueprint = extractBlueprint(ArrayInferredComponent);
			const state = blueprint.state({
				items: ['a', 'b'],
				matrix: [
					[1, 2],
					[3, 4],
				],
			});
			expect(state).toBeDefined();
		});
	});

	describe('without props (define({ script, template }))', () => {
		it('should work without props field', () => {
			const NoPropsComponent = define({
				script: () => {
					return { message: 'Hello' };
				},
				template: ({ message }) => message as unknown as null,
			});

			const blueprint = extractBlueprint(NoPropsComponent);
			expect(blueprint._tag).toBe('Blueprint');

			const state = blueprint.state({});
			expect(state).toBeDefined();
		});

		it('should handle script context methods', () => {
			const mockOnMount = vi.fn();
			const mockOnUnmount = vi.fn();

			const LifecycleComponent = define({
				script: ({ onMount, onUnmount }) => {
					onMount(() => {
						mockOnMount();
						return undefined;
					});
					onUnmount(mockOnUnmount);
					return { ready: true };
				},
				template: ({ ready }) => String(ready) as unknown as null,
			});

			const blueprint = extractBlueprint(LifecycleComponent);
			const state = blueprint.state({});
			expect(state).toBeDefined();
		});
	});

	describe('exposed values to template', () => {
		it('should pass exposed values to template', () => {
			interface TestExposed {
				count: number;
				message: string;
				increment: () => void;
			}

			const exposedCapture: Partial<TestExposed> = {};

			const ExposedComponent = define<Record<string, never>, TestExposed>({
				script: () => {
					let count = 0;
					return {
						count,
						message: 'Hello',
						increment: () => {
							count++;
						},
					};
				},
				template: (exposed) => {
					exposedCapture.count = exposed.count;
					exposedCapture.message = exposed.message;
					exposedCapture.increment = exposed.increment;
					return null;
				},
			});

			const blueprint = extractBlueprint(ExposedComponent);
			const state = blueprint.state({});

			blueprint.view({ props: {}, state });
			expect(exposedCapture.count).toBe(0);
			expect(exposedCapture.message).toBe('Hello');
			expect(typeof exposedCapture.increment).toBe('function');
		});

		it('should pass children to template via TemplateArgs', () => {
			let capturedChildren: unknown = null;

			const ChildrenComponent = define({
				script: () => {
					return { slot: 'content' };
				},
				template: (exposed) => {
					capturedChildren = exposed.children;
					return exposed.slot as unknown as null;
				},
			});

			const blueprint = extractBlueprint(ChildrenComponent);
			const state = blueprint.state({});

			const mockChildren = { _tag: 'Fragment', children: [] };
			blueprint.view({ props: { children: mockChildren }, state });

			expect(capturedChildren).toBe(mockChildren);
		});
	});

	describe('template receives props', () => {
		it('should pass props as second argument to template', () => {
			interface TemplateTestProps {
				title: string;
				count: number;
			}

			interface TemplateTestExposed {
				computed: string;
			}

			let capturedProps: TemplateTestProps | null = null;

			const TemplatePropsComponent = define<
				TemplateTestProps,
				TemplateTestExposed
			>({
				script: ({ props }) => {
					return { computed: `${props.title}-${String(props.count)}` };
				},
				template: (_exposed, props) => {
					capturedProps = props;
					return null;
				},
			});

			const blueprint = extractBlueprint(TemplatePropsComponent);
			const testProps = { title: 'Test', count: 42 };
			const state = blueprint.state(testProps);

			blueprint.view({ props: testProps, state });

			expect(capturedProps).toEqual(testProps);
		});
	});

	describe('edge cases', () => {
		it('should handle empty object props', () => {
			const EmptyPropsComponent = define({
				props: {} as Record<string, never>,
				script: () => {
					return { empty: true };
				},
				template: ({ empty }) => String(empty) as unknown as null,
			});

			const blueprint = extractBlueprint(EmptyPropsComponent);
			const state = blueprint.state({});
			expect(state).toBeDefined();
		});

		it('should handle props with function types', () => {
			interface FunctionProps {
				onClick: () => void;
				onData: (data: string) => number;
			}

			interface FunctionExposed {
				handleClick: () => void;
				processData: (data: string) => number;
			}

			const FunctionPropsComponent = define<FunctionProps, FunctionExposed>({
				script: ({ props }) => {
					return {
						handleClick: props.onClick,
						processData: (data: string) => props.onData(data),
					};
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(FunctionPropsComponent);
			const mockOnClick = vi.fn();
			const mockOnData = vi.fn().mockReturnValue(42);

			const state = blueprint.state({
				onClick: mockOnClick,
				onData: mockOnData,
			});
			expect(state).toBeDefined();
		});

		it('should handle readonly props', () => {
			interface ReadonlyProps {
				readonly id: string;
				readonly items: readonly string[];
			}

			interface ReadonlyExposed {
				idDisplay: string;
				itemCount: number;
			}

			const ReadonlyPropsComponent = define<ReadonlyProps, ReadonlyExposed>({
				script: ({ props }) => {
					return {
						idDisplay: props.id,
						itemCount: props.items.length,
					};
				},
				template: ({ idDisplay }) => idDisplay as unknown as null,
			});

			const blueprint = extractBlueprint(ReadonlyPropsComponent);
			const state = blueprint.state({ id: 'test-id', items: ['a', 'b'] });
			expect(state).toBeDefined();
		});

		it('should handle generic-like props patterns', () => {
			interface GenericLikeProps {
				value: string;
				transform: (v: string) => string;
			}

			interface GenericExposed {
				display: string;
			}

			const StringValueComponent = define<GenericLikeProps, GenericExposed>({
				script: ({ props }) => {
					return { display: props.transform(props.value) };
				},
				template: ({ display }) => display as unknown as null,
			});

			const blueprint = extractBlueprint(StringValueComponent);
			const state = blueprint.state({
				value: 'hello',
				transform: (v: string) => v.toUpperCase(),
			});
			expect(state).toBeDefined();
		});

		it('should handle null and undefined in union props', () => {
			interface NullableProps {
				value: string | null;
				optional: number | undefined;
			}

			interface NullableExposed {
				hasValue: boolean;
				optionalValue: number;
			}

			const NullableComponent = define<NullableProps, NullableExposed>({
				script: ({ props }) => {
					return {
						hasValue: props.value !== null,
						optionalValue: props.optional ?? -1,
					};
				},
				template: ({ hasValue }) => String(hasValue) as unknown as null,
			});

			const blueprint = extractBlueprint(NullableComponent);
			const state = blueprint.state({ value: null, optional: undefined });
			expect(state).toBeDefined();
		});

		it('should handle script returning undefined', () => {
			const UndefinedReturnComponent = define({
				script: () => {
					return undefined;
				},
				template: () => null,
			});

			const blueprint = extractBlueprint(UndefinedReturnComponent);
			const state = blueprint.state({});
			expect(state).toBeDefined();
		});

		it('should handle script returning partial exposed values', () => {
			interface PartialExposed {
				required: string;
				optional?: number;
			}

			const PartialExposedComponent = define<
				Record<string, never>,
				PartialExposed
			>({
				script: () => {
					return { required: 'value' };
				},
				template: ({ required }) => required as unknown as null,
			});

			const blueprint = extractBlueprint(PartialExposedComponent);
			const state = blueprint.state({});
			expect(state).toBeDefined();
		});

		it('should handle deeply nested readonly props', () => {
			interface DeepReadonlyProps {
				readonly config: {
					readonly nested: {
						readonly deep: {
							readonly value: string;
						};
					};
				};
			}

			interface DeepExposed {
				deepValue: string;
			}

			const DeepReadonlyComponent = define<DeepReadonlyProps, DeepExposed>({
				script: ({ props }) => {
					return { deepValue: props.config.nested.deep.value };
				},
				template: ({ deepValue }) => deepValue as unknown as null,
			});

			const blueprint = extractBlueprint(DeepReadonlyComponent);
			const state = blueprint.state({
				config: { nested: { deep: { value: 'deep-value' } } },
			});
			expect(state).toBeDefined();
		});

		it('should handle tuple type props', () => {
			interface TupleProps {
				pair: [string, number];
				triple: readonly [boolean, string, number];
			}

			interface TupleExposed {
				pairStr: string;
				pairNum: number;
				tripleBool: boolean;
			}

			const TupleComponent = define<TupleProps, TupleExposed>({
				script: ({ props }) => {
					const [str, num] = props.pair;
					const [bool] = props.triple;
					return { pairStr: str, pairNum: num, tripleBool: bool };
				},
				template: ({ pairStr }) => pairStr as unknown as null,
			});

			const blueprint = extractBlueprint(TupleComponent);
			const state = blueprint.state({
				pair: ['hello', 42],
				triple: [true, 'world', 100],
			});
			expect(state).toBeDefined();
		});
	});

	describe('type inference verification', () => {
		it('should provide correct type inference in script context', () => {
			interface TypeTestProps {
				stringProp: string;
				numberProp: number;
				boolProp: boolean;
			}

			interface TypeTestExposed {
				strResult: string;
				numResult: number;
				boolResult: boolean;
			}

			const TypeTestComponent = define<TypeTestProps, TypeTestExposed>({
				script: ({ props }) => {
					const str: string = props.stringProp;
					const num: number = props.numberProp;
					const bool: boolean = props.boolProp;

					return {
						strResult: str.toUpperCase(),
						numResult: num * 2,
						boolResult: !bool,
					};
				},
				template: ({ strResult, numResult, boolResult }) =>
					`${strResult}-${String(numResult)}-${String(boolResult)}` as unknown as null,
			});

			const blueprint = extractBlueprint(TypeTestComponent);
			const state = blueprint.state({
				stringProp: 'test',
				numberProp: 21,
				boolProp: true,
			});
			expect(state).toBeDefined();
		});
	});

	describe('InferProps and InferExposed utility types', () => {
		it('should correctly infer props type from define options', () => {
			interface TestProps {
				name: string;
			}

			type Options = DefineOptions<TestProps, { display: string }>;

			const options: Options = {
				script: ({ props }) => ({ display: props.name }),
				template: ({ display }) => display as unknown as null,
			};

			expect(options.script).toBeDefined();
		});

		it('should correctly infer props from DefineOptionsWithInferredProps', () => {
			type Options = DefineOptionsWithInferredProps<
				{ id: number; label: string },
				{ formatted: string }
			>;

			const options: Options = {
				props: { id: 0, label: '' },
				script: ({ props }) => ({
					formatted: `${String(props.id)}: ${props.label}`,
				}),
				template: ({ formatted }) => formatted as unknown as null,
			};

			expect(options.props).toEqual({ id: 0, label: '' });
		});
	});

	describe('production-ready edge cases', () => {
		describe('complex JavaScript types in props', () => {
			it('should handle Date objects in props', () => {
				interface DateProps {
					createdAt: Date;
					updatedAt: Date | null;
				}

				interface DateExposed {
					formattedCreated: string;
					hasUpdate: boolean;
				}

				const DateComponent = define<DateProps, DateExposed>({
					script: ({ props }) => {
						return {
							formattedCreated: props.createdAt.toISOString(),
							hasUpdate: props.updatedAt !== null,
						};
					},
					template: ({ formattedCreated }) =>
						formattedCreated as unknown as null,
				});

				const blueprint = extractBlueprint(DateComponent);
				const now = new Date();
				const state = blueprint.state({ createdAt: now, updatedAt: null });
				expect(state).toBeDefined();
			});

			it('should handle Map and Set in props', () => {
				interface CollectionProps {
					items: Map<string, number>;
					tags: Set<string>;
				}

				interface CollectionExposed {
					itemCount: number;
					tagCount: number;
					hasItem: (key: string) => boolean;
				}

				const CollectionComponent = define<CollectionProps, CollectionExposed>({
					script: ({ props }) => {
						return {
							itemCount: props.items.size,
							tagCount: props.tags.size,
							hasItem: (key: string) => props.items.has(key),
						};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(CollectionComponent);
				const items = new Map([
					['a', 1],
					['b', 2],
				]);
				const tags = new Set(['tag1', 'tag2']);
				const state = blueprint.state({ items, tags });
				expect(state).toBeDefined();
			});

			it('should handle RegExp in props', () => {
				interface RegExpProps {
					pattern: RegExp;
					flags?: string;
				}

				interface RegExpExposed {
					test: (input: string) => boolean;
					source: string;
				}

				const RegExpComponent = define<RegExpProps, RegExpExposed>({
					script: ({ props }) => {
						return {
							test: (input: string) => props.pattern.test(input),
							source: props.pattern.source,
						};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(RegExpComponent);
				const state = blueprint.state({ pattern: /test/gi });
				expect(state).toBeDefined();
			});

			it('should handle Promise types in props', () => {
				interface AsyncProps {
					dataPromise: Promise<string>;
					loadFn: () => Promise<number>;
				}

				interface AsyncExposed {
					load: () => Promise<number>;
				}

				const AsyncComponent = define<AsyncProps, AsyncExposed>({
					script: ({ props }) => {
						return {
							load: props.loadFn,
						};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(AsyncComponent);
				const state = blueprint.state({
					dataPromise: Promise.resolve('data'),
					loadFn: () => Promise.resolve(42),
				});
				expect(state).toBeDefined();
			});

			it('should handle Symbol keys in props (via Record)', () => {
				const sym = Symbol('test');

				interface SymbolProps {
					regularKey: string;
					[sym]: number;
				}

				interface SymbolExposed {
					value: string;
				}

				const SymbolComponent = define<SymbolProps, SymbolExposed>({
					script: ({ props }) => {
						return { value: props.regularKey };
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(SymbolComponent);
				const state = blueprint.state({ regularKey: 'test', [sym]: 42 });
				expect(state).toBeDefined();
			});
		});

		describe('discriminated unions and type narrowing', () => {
			it('should handle discriminated union props', () => {
				type ActionProps =
					| { type: 'increment'; amount: number }
					| { type: 'decrement'; amount: number }
					| { type: 'reset' };

				interface ActionExposed {
					description: string;
				}

				const ActionComponent = define<ActionProps, ActionExposed>({
					script: ({ props }) => {
						let description: string;
						switch (props.type) {
							case 'increment':
								description = `Increment by ${String(props.amount)}`;
								break;
							case 'decrement':
								description = `Decrement by ${String(props.amount)}`;
								break;
							case 'reset':
								description = 'Reset';
								break;
						}
						return { description };
					},
					template: ({ description }) => description as unknown as null,
				});

				const blueprint = extractBlueprint(ActionComponent);

				const state1 = blueprint.state({ type: 'increment', amount: 5 });
				expect(state1).toBeDefined();

				const state2 = blueprint.state({ type: 'reset' });
				expect(state2).toBeDefined();
			});

			it('should handle intersection types', () => {
				interface Base {
					id: string;
				}

				interface WithName {
					name: string;
				}

				interface WithAge {
					age: number;
				}

				type CombinedProps = Base & WithName & WithAge;

				interface CombinedExposed {
					display: string;
				}

				const CombinedComponent = define<CombinedProps, CombinedExposed>({
					script: ({ props }) => {
						return {
							display: `${props.id}: ${props.name} (${String(props.age)})`,
						};
					},
					template: ({ display }) => display as unknown as null,
				});

				const blueprint = extractBlueprint(CombinedComponent);
				const state = blueprint.state({ id: '1', name: 'Test', age: 25 });
				expect(state).toBeDefined();
			});

			it('should handle Record types', () => {
				interface RecordProps {
					data: Record<string, number>;
					metadata: Record<'name' | 'version', string>;
				}

				interface RecordExposed {
					keys: string[];
					name: string;
				}

				const RecordComponent = define<RecordProps, RecordExposed>({
					script: ({ props }) => {
						return {
							keys: Object.keys(props.data),
							name: props.metadata.name,
						};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(RecordComponent);
				const state = blueprint.state({
					data: { a: 1, b: 2 },
					metadata: { name: 'test', version: '1.0' },
				});
				expect(state).toBeDefined();
			});

			it('should handle Partial and Required types', () => {
				interface FullConfig {
					theme: string;
					locale: string;
					debug: boolean;
				}

				interface ConfigProps {
					partial: Partial<FullConfig>;
					required: Required<{ opt?: string }>;
				}

				interface ConfigExposed {
					hasTheme: boolean;
					reqValue: string;
				}

				const ConfigComponent = define<ConfigProps, ConfigExposed>({
					script: ({ props }) => {
						return {
							hasTheme: props.partial.theme !== undefined,
							reqValue: props.required.opt,
						};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(ConfigComponent);
				const state = blueprint.state({
					partial: { theme: 'dark' },
					required: { opt: 'value' },
				});
				expect(state).toBeDefined();
			});
		});

		describe('lifecycle and context edge cases', () => {
			it('should handle multiple onMount callbacks', () => {
				const calls: string[] = [];

				const MultiMountComponent = define({
					script: ({ onMount }) => {
						onMount(() => {
							calls.push('first');
							return () => calls.push('cleanup-first');
						});
						onMount(() => {
							calls.push('second');
							return () => calls.push('cleanup-second');
						});
						onMount(() => {
							calls.push('third');
							return undefined;
						});
						return { ready: true };
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(MultiMountComponent);
				const state = blueprint.state({});
				expect(state).toBeDefined();
			});

			it('should handle multiple onUnmount callbacks', () => {
				const cleanupCalls: string[] = [];

				const MultiUnmountComponent = define({
					script: ({ onUnmount }) => {
						onUnmount(() => cleanupCalls.push('cleanup-1'));
						onUnmount(() => cleanupCalls.push('cleanup-2'));
						onUnmount(() => cleanupCalls.push('cleanup-3'));
						return { ready: true };
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(MultiUnmountComponent);
				const state = blueprint.state({});
				expect(state).toBeDefined();
			});

			it('should handle onBeforeMount and onBeforeUnmount', () => {
				const lifecycleOrder: string[] = [];

				const FullLifecycleComponent = define({
					script: ({ onMount, onUnmount, onBeforeMount, onBeforeUnmount }) => {
						onBeforeMount(() => lifecycleOrder.push('beforeMount'));
						onMount(() => {
							lifecycleOrder.push('mount');
							return () => lifecycleOrder.push('mountCleanup');
						});
						onBeforeUnmount(() => lifecycleOrder.push('beforeUnmount'));
						onUnmount(() => lifecycleOrder.push('unmount'));
						return { order: lifecycleOrder };
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(FullLifecycleComponent);
				const state = blueprint.state({});
				expect(state).toBeDefined();
			});

			it('should handle useCallback for memoized functions', () => {
				interface CallbackExposed {
					increment: () => void;
					decrement: () => void;
					getValue: () => number;
				}

				const CallbackComponent = define<
					Record<string, never>,
					CallbackExposed
				>({
					script: ({ useCallback }) => {
						let value = 0;
						const increment = useCallback(() => {
							value++;
						});
						const decrement = useCallback(() => {
							value--;
						});
						const getValue = useCallback(() => value);
						return { increment, decrement, getValue };
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(CallbackComponent);
				const state = blueprint.state({});
				expect(state).toBeDefined();
			});

			it('should handle useMemo for computed values', () => {
				interface MemoProps {
					items: number[];
				}

				interface MemoExposed {
					getSum: () => number;
					getAvg: () => number;
				}

				const MemoComponent = define<MemoProps, MemoExposed>({
					script: ({ props, useMemo }) => {
						const getSum = useMemo(() =>
							props.items.reduce((a, b) => a + b, 0)
						);
						const getAvg = useMemo(() => {
							const sum = props.items.reduce((a, b) => a + b, 0);
							return sum / props.items.length;
						});
						return { getSum, getAvg };
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(MemoComponent);
				const state = blueprint.state({ items: [1, 2, 3, 4, 5] });
				expect(state).toBeDefined();
			});
		});

		describe('event handler patterns', () => {
			it('should handle DOM-like event handlers', () => {
				interface EventProps {
					onClick: (e: { target: unknown }) => void;
					onSubmit: (e: { preventDefault: () => void }) => void;
					onInput: (value: string) => void;
				}

				interface EventExposed {
					handleClick: (e: { target: unknown }) => void;
					handleSubmit: (e: { preventDefault: () => void }) => void;
					handleInput: (value: string) => void;
				}

				const EventComponent = define<EventProps, EventExposed>({
					script: ({ props }) => {
						return {
							handleClick: props.onClick,
							handleSubmit: props.onSubmit,
							handleInput: props.onInput,
						};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(EventComponent);
				const state = blueprint.state({
					onClick: vi.fn(),
					onSubmit: vi.fn(),
					onInput: vi.fn(),
				});
				expect(state).toBeDefined();
			});

			it('should handle generic event emitter pattern', () => {
				interface EmitterProps {
					onEvent: (eventName: string, data: unknown) => void;
				}

				interface EmitterExposed {
					emit: (eventName: string, data: unknown) => void;
				}

				const EmitterComponent = define<EmitterProps, EmitterExposed>({
					script: ({ props }) => {
						return {
							emit: (eventName: string, data: unknown) => {
								props.onEvent(eventName, data);
							},
						};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(EmitterComponent);
				const state = blueprint.state({
					onEvent: vi.fn(),
				});
				expect(state).toBeDefined();
			});
		});

		describe('ref and forwarding patterns', () => {
			it('should handle ref-like props', () => {
				interface RefProps {
					elementRef: { current: HTMLElement | null };
				}

				interface RefExposed {
					setRef: (el: HTMLElement | null) => void;
				}

				const RefComponent = define<RefProps, RefExposed>({
					script: ({ props }) => {
						return {
							setRef: (el: HTMLElement | null) => {
								props.elementRef.current = el;
							},
						};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(RefComponent);
				const ref = { current: null };
				const state = blueprint.state({ elementRef: ref });
				expect(state).toBeDefined();
			});

			it('should handle callback ref pattern', () => {
				interface CallbackRefProps {
					onRef: (el: HTMLElement | null) => void;
				}

				interface CallbackRefExposed {
					attachRef: (el: HTMLElement | null) => void;
				}

				const CallbackRefComponent = define<
					CallbackRefProps,
					CallbackRefExposed
				>({
					script: ({ props }) => {
						return {
							attachRef: props.onRef,
						};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(CallbackRefComponent);
				const state = blueprint.state({ onRef: vi.fn() });
				expect(state).toBeDefined();
			});
		});

		describe('error handling scenarios', () => {
			it('should handle props that could cause runtime errors gracefully', () => {
				interface SafeProps {
					maybeNull: string | null;
					maybeUndefined: number | undefined;
					emptyArray: string[];
					emptyObject: Record<string, unknown>;
				}

				interface SafeExposed {
					safeString: string;
					safeNumber: number;
					firstItem: string | undefined;
					keys: string[];
				}

				const SafeComponent = define<SafeProps, SafeExposed>({
					script: ({ props }) => {
						return {
							safeString: props.maybeNull ?? 'default',
							safeNumber: props.maybeUndefined ?? 0,
							firstItem: props.emptyArray[0],
							keys: Object.keys(props.emptyObject),
						};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(SafeComponent);
				const state = blueprint.state({
					maybeNull: null,
					maybeUndefined: undefined,
					emptyArray: [],
					emptyObject: {},
				});
				expect(state).toBeDefined();
			});

			it('should handle deeply optional nested props', () => {
				interface DeepOptionalProps {
					config?: {
						nested?: {
							deep?: {
								value?: string;
							};
						};
					};
				}

				interface DeepOptionalExposed {
					safeValue: string;
				}

				const DeepOptionalComponent = define<
					DeepOptionalProps,
					DeepOptionalExposed
				>({
					script: ({ props }) => {
						return {
							safeValue: props.config?.nested?.deep?.value ?? 'fallback',
						};
					},
					template: ({ safeValue }) => safeValue as unknown as null,
				});

				const blueprint = extractBlueprint(DeepOptionalComponent);

				const state1 = blueprint.state({});
				expect(state1).toBeDefined();

				const state2 = blueprint.state({ config: {} });
				expect(state2).toBeDefined();

				const state3 = blueprint.state({
					config: { nested: { deep: { value: 'found' } } },
				});
				expect(state3).toBeDefined();
			});
		});

		describe('state management patterns', () => {
			it('should handle multiple exposed values with different types', () => {
				interface MixedExposed {
					stringValue: string;
					numberValue: number;
					boolValue: boolean;
					arrayValue: number[];
					objectValue: { key: string };
					functionValue: () => string;
					nullableValue: string | null;
				}

				const MixedComponent = define<Record<string, never>, MixedExposed>({
					script: () => {
						return {
							stringValue: 'hello',
							numberValue: 42,
							boolValue: true,
							arrayValue: [1, 2, 3],
							objectValue: { key: 'value' },
							functionValue: () => 'result',
							nullableValue: null,
						};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(MixedComponent);
				const state = blueprint.state({});
				expect(state).toBeDefined();
			});

			it('should handle exposed values that reference props', () => {
				interface ReferenceProps {
					initialCount: number;
					multiplier: number;
				}

				interface ReferenceExposed {
					count: number;
					multiplied: number;
					increment: () => void;
					reset: () => void;
				}

				const ReferenceComponent = define<ReferenceProps, ReferenceExposed>({
					script: ({ props }) => {
						let count = props.initialCount;
						return {
							count,
							multiplied: count * props.multiplier,
							increment: () => {
								count++;
							},
							reset: () => {
								count = props.initialCount;
							},
						};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(ReferenceComponent);
				const state = blueprint.state({ initialCount: 10, multiplier: 2 });
				expect(state).toBeDefined();
			});
		});

		describe('template edge cases', () => {
			it('should handle template with complex return types', () => {
				interface TemplateExposed {
					items: string[];
				}

				const ComplexTemplateComponent = define<
					Record<string, never>,
					TemplateExposed
				>({
					script: () => {
						return { items: ['a', 'b', 'c'] };
					},
					template: ({ items, children }) => {
						return {
							_tag: 'Fragment',
							children: [
								...items.map((item) => ({ _tag: 'Text', value: item })),
								children,
							].filter(Boolean),
						} as unknown as null;
					},
				});

				const blueprint = extractBlueprint(ComplexTemplateComponent);
				const state = blueprint.state({});
				const result = blueprint.view({ props: {}, state });
				expect(result).toBeDefined();
			});

			it('should handle template accessing both exposed and props', () => {
				interface BothProps {
					title: string;
				}

				interface BothExposed {
					subtitle: string;
				}

				let capturedTitle: string | null = null;
				let capturedSubtitle: string | null = null;

				const BothComponent = define<BothProps, BothExposed>({
					script: () => {
						return { subtitle: 'Subtitle' };
					},
					template: (exposed, props) => {
						capturedTitle = props.title;
						capturedSubtitle = exposed.subtitle;
						return null;
					},
				});

				const blueprint = extractBlueprint(BothComponent);
				const state = blueprint.state({ title: 'Title' });
				blueprint.view({ props: { title: 'Title' }, state });

				expect(capturedTitle).toBe('Title');
				expect(capturedSubtitle).toBe('Subtitle');
			});
		});

		describe('immutability and props freezing', () => {
			it('should receive frozen props in script context', () => {
				interface FreezeProps {
					mutable: { value: number };
				}

				interface FreezeExposed {
					originalValue: number;
				}

				const FreezeComponent = define<FreezeProps, FreezeExposed>({
					script: ({ props }) => {
						return {
							originalValue: props.mutable.value,
						};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(FreezeComponent);
				const state = blueprint.state({ mutable: { value: 42 } });
				expect(state).toBeDefined();
			});
		});

		describe('edge cases with empty and minimal definitions', () => {
			it('should handle minimal component with only required fields', () => {
				const MinimalComponent = define({
					script: () => undefined,
					template: () => null,
				});

				const blueprint = extractBlueprint(MinimalComponent);
				expect(blueprint._tag).toBe('Blueprint');
				const state = blueprint.state({});
				expect(state).toBeDefined();
			});

			it('should handle component with empty exposed object', () => {
				// eslint-disable-next-line @typescript-eslint/no-empty-object-type
				const EmptyExposedComponent = define<Record<string, never>, {}>({
					script: () => {
						return {};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(EmptyExposedComponent);
				const state = blueprint.state({});
				expect(state).toBeDefined();
			});

			it('should handle props with very long key names', () => {
				interface LongKeyProps {
					thisIsAVeryLongPropertyNameThatMightCauseIssuesInSomeEdgeCases: string;
					anotherExtremelyLongPropertyNameForTestingPurposes: number;
				}

				interface LongKeyExposed {
					combined: string;
				}

				const LongKeyComponent = define<LongKeyProps, LongKeyExposed>({
					script: ({ props }) => {
						return {
							combined: `${props.thisIsAVeryLongPropertyNameThatMightCauseIssuesInSomeEdgeCases}-${String(props.anotherExtremelyLongPropertyNameForTestingPurposes)}`,
						};
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(LongKeyComponent);
				const state = blueprint.state({
					thisIsAVeryLongPropertyNameThatMightCauseIssuesInSomeEdgeCases:
						'test',
					anotherExtremelyLongPropertyNameForTestingPurposes: 123,
				});
				expect(state).toBeDefined();
			});

			it('should handle props with numeric-like string keys', () => {
				interface NumericKeyProps {
					'0': string;
					'1': string;
					'123': number;
				}

				interface NumericKeyExposed {
					first: string;
				}

				const NumericKeyComponent = define<NumericKeyProps, NumericKeyExposed>({
					script: ({ props }) => {
						return { first: props['0'] };
					},
					template: () => null,
				});

				const blueprint = extractBlueprint(NumericKeyComponent);
				const state = blueprint.state({ '0': 'zero', '1': 'one', '123': 123 });
				expect(state).toBeDefined();
			});
		});
	});
});

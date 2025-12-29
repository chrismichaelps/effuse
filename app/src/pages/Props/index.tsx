import {
	define,
	signal,
	computed,
	useHead,
	unref,
	effect,
	type Signal,
	type ReadonlySignal,
} from '@effuse/core';
import { Ink } from '@effuse/ink';
import { DocsLayout } from '../../components/docs/DocsLayout';
import type { i18nStore as I18nStoreType } from '../../store/appI18n';

interface DisplayProps {
	label: string | ReadonlySignal<string>;
	value:
		| string
		| number
		| Signal<string | number>
		| ReadonlySignal<string | number>;
	color?: string | Signal<string>;
	onAction?: () => void;
}

interface StatDisplayExposed {
	label: ReadonlySignal<string>;
	value: ReadonlySignal<string | number>;
	color: ReadonlySignal<string>;
	onAction?: () => void;
	triggerUpdateText: ReadonlySignal<string | undefined>;
}

const StatDisplay = define<DisplayProps, StatDisplayExposed>({
	script: ({ props, useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;

		const colorSig = computed(() => unref(props.color) || 'blue');
		const labelSig = computed(() => unref(props.label));
		const valueSig = computed(() => unref(props.value) as string | number);
		const triggerUpdateText = computed(
			() => i18nStore.translations.value?.examples?.props?.triggerUpdate
		);

		return {
			label: labelSig,
			value: valueSig,
			color: colorSig,
			onAction: props.onAction,
			triggerUpdateText,
		};
	},
	template: ({
		label,
		value,
		color,
		onAction,
		triggerUpdateText,
	}: StatDisplayExposed) => (
		<div class="p-4 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col items-start">
			<div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
				{label.value}
			</div>
			<div class={`text-2xl font-bold text-${color.value}-600 mb-2`}>
				{value.value}
			</div>
			{onAction && (
				<button
					onClick={() => onAction()}
					class={`text-xs px-2 py-1 rounded bg-${color.value}-100 text-${color.value}-700 hover:bg-${color.value}-200 transition font-medium`}
				>
					{triggerUpdateText.value}
				</button>
			)}
		</div>
	),
});

export const PropsPage = define({
	script: ({ useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;

		const t = computed(() => i18nStore.translations.value?.examples?.props);

		effect(() => {
			useHead({
				title: `${t.value?.title as string} - Effuse Playground`,
				description: t.value?.description as string,
			});
		});

		const count = signal(0);
		const currentColor = signal('Default');
		const isActive = signal(false);

		const doubleCount = computed(() => count.value * 2);

		const increment = () => {
			count.value++;
		};
		const toggleActive = () => {
			isActive.value = !isActive.value;
		};
		const changeColor = () => {
			const colors = ['Blue', 'Red', 'Green', 'Purple', 'Orange', 'Default'];
			const currentIdx = colors.indexOf(currentColor.value);
			currentColor.value = colors[(currentIdx + 1) % colors.length];
		};

		const reset = () => {
			count.value = 0;
			currentColor.value = 'Default';
			isActive.value = false;
		};

		const codeSnippet = `
\`\`\`tsx
<StatDisplay value={count} onAction={increment} />
\`\`\`
`.trim();

		return {
			t,
			count,
			currentColor,
			isActive,
			doubleCount,
			increment,
			toggleActive,
			changeColor,
			reset,
			codeSnippet,
		};
	},
	template: ({
		t,
		count,
		currentColor,
		isActive,
		doubleCount,
		increment,
		toggleActive,
		changeColor,
		reset,
		codeSnippet,
	}) => (
		<DocsLayout currentPath="/props">
			<div class="space-y-8 p-6 max-w-4xl mx-auto">
				<div class="text-center space-y-2">
					<h1 class="text-3xl font-bold text-slate-900">{t.value?.title}</h1>
					<p class="text-slate-600">{t.value?.description}</p>
				</div>

				<div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
					<h2 class="text-lg font-semibold text-slate-800 mb-4">
						{t.value?.parentControls}
					</h2>
					<div class="flex flex-wrap gap-4">
						<button
							onClick={() => increment()}
							class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
						>
							{t.value?.incrementCount}
						</button>
						<button
							onClick={() => changeColor()}
							class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
						>
							{t.value?.changeColor}
						</button>
						<button
							onClick={() => toggleActive()}
							class={`px-4 py-2 text-white rounded-lg transition ${
								isActive.value
									? 'bg-green-600 hover:bg-green-700'
									: 'bg-slate-500 hover:bg-slate-600'
							}`}
						>
							{t.value?.toggleStatus}
						</button>
						<button
							onClick={() => reset()}
							class="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition ml-auto"
						>
							{t.value?.reset}
						</button>
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<StatDisplay
						label={t.value?.currentCount ?? ''}
						value={count}
						color="blue"
						onAction={increment}
					/>
					<StatDisplay
						label={t.value?.derivedValue ?? ''}
						value={doubleCount}
						color="indigo"
					/>
					<StatDisplay
						label={t.value?.currentColor ?? ''}
						value={currentColor}
						color="purple"
						onAction={changeColor}
					/>
					<StatDisplay
						label={t.value?.activeStatus ?? ''}
						value={
							isActive.value
								? (t.value?.active as string)
								: (t.value?.inactive as string)
						}
						color={isActive.value ? 'green' : 'red'}
						onAction={toggleActive}
					/>
				</div>

				<div class="mt-8 p-4 bg-slate-100 rounded-lg text-sm text-slate-600 overflow-x-auto">
					<p class="mb-2 font-sans font-semibold text-slate-700">
						{t.value?.howItWorks}
					</p>
					<Ink content={codeSnippet} />
				</div>
			</div>
		</DocsLayout>
	),
});

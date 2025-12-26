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
import { i18nStore } from '../../store/appI18n';

interface DisplayProps {
	label: string | ReadonlySignal<string>;
	value: Signal<string | number>;
	color?: string | Signal<string>;
	onAction?: () => void;
}

interface StatDisplayExposed extends Omit<DisplayProps, 'color' | 'label'> {
	label: ReadonlySignal<string>;
	color: ReadonlySignal<string>;
}

const StatDisplay = define<DisplayProps, StatDisplayExposed>({
	script: ({ props }) => {
		const colorSig = computed(() => unref(props.color) || 'blue');
		const labelSig = computed(() => unref(props.label));
		return {
			label: labelSig,
			value: props.value,
			color: colorSig,
			onAction: props.onAction,
		};
	},
	template: ({ label, value, color, onAction }: StatDisplayExposed) => (
		<div class="p-4 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col items-start">
			<div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
				{label}
			</div>
			<div class={`text-2xl font-bold text-${color.value}-600 mb-2`}>
				{value}
			</div>
			{onAction && (
				<button
					onClick={() => onAction()}
					class={`text-xs px-2 py-1 rounded bg-${color.value}-100 text-${color.value}-700 hover:bg-${color.value}-200 transition font-medium`}
				>
					{computed(
						() =>
							i18nStore.translations.value?.examples?.props
								?.triggerUpdate as string
					)}
				</button>
			)}
		</div>
	),
});

export const PropsPage = define({
	script: () => {
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
					<h1 class="text-3xl font-bold text-slate-900">
						{computed(() => t.value?.title as string)}
					</h1>
					<p class="text-slate-600">
						{computed(() => t.value?.description as string)}
					</p>
				</div>

				<div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
					<h2 class="text-lg font-semibold text-slate-800 mb-4">
						{computed(() => t.value?.parentControls as string)}
					</h2>
					<div class="flex flex-wrap gap-4">
						<button
							onClick={() => increment()}
							class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
						>
							{computed(() => t.value?.incrementCount as string)}
						</button>
						<button
							onClick={() => changeColor()}
							class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
						>
							{computed(() => t.value?.changeColor as string)}
						</button>
						<button
							onClick={() => toggleActive()}
							class={`px-4 py-2 text-white rounded-lg transition ${
								isActive.value
									? 'bg-green-600 hover:bg-green-700'
									: 'bg-slate-500 hover:bg-slate-600'
							}`}
						>
							{computed(() => t.value?.toggleStatus as string)}
						</button>
						<button
							onClick={() => reset()}
							class="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition ml-auto"
						>
							{computed(() => t.value?.reset as string)}
						</button>
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<StatDisplay
						label={computed(() => t.value?.currentCount as string)}
						value={count}
						color="blue"
						onAction={increment}
					/>
					<StatDisplay
						label={computed(() => t.value?.derivedValue as string)}
						value={doubleCount}
						color="indigo"
					/>
					<StatDisplay
						label={computed(() => t.value?.currentColor as string)}
						value={currentColor}
						color="purple"
						onAction={changeColor}
					/>
					<StatDisplay
						label={computed(() => t.value?.activeStatus as string)}
						value={computed(() =>
							isActive.value
								? (t.value?.active as string)
								: (t.value?.inactive as string)
						)}
						color={computed(() => (isActive.value ? 'green' : 'red'))}
						onAction={toggleActive}
					/>
				</div>

				<div class="mt-8 p-4 bg-slate-100 rounded-lg text-sm text-slate-600 overflow-x-auto">
					<p class="mb-2 font-sans font-semibold text-slate-700">
						{computed(() => t.value?.howItWorks as string)}
					</p>
					<Ink content={codeSnippet} />
				</div>
			</div>
		</DocsLayout>
	),
});

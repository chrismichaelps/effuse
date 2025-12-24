import {
	define,
	signal,
	computed,
	useHead,
	unref,
	type Signal,
	type ReadonlySignal,
} from '@effuse/core';
import { Ink } from '@effuse/ink';
import { DocsLayout } from '../../components/docs/DocsLayout';

interface DisplayProps {
	label: string;
	value: Signal<string | number>;
	color?: string | Signal<string>;
	onAction?: () => void;
}

interface StatDisplayExposed extends Omit<DisplayProps, 'color'> {
	color: ReadonlySignal<string>;
}

const StatDisplay = define<DisplayProps, StatDisplayExposed>({
	script: ({ props }) => {
		const colorSig = computed(() => unref(props.color) ?? 'blue');
		return {
			label: props.label,
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
					Trigger Update
				</button>
			)}
		</div>
	),
});

export const PropsPage = define({
	script: () => {
		useHead({
			title: 'Props Reactivity - Effuse Playground',
			description:
				'Demo showing how props flow between parent and child components with reactive signals.',
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
						Props Reactivity Demo
					</h1>
					<p class="text-slate-600">
						Modify the parent state below to see child components update in
						real-time.
						<br />
						Some child components also have buttons to trigger updates from the
						child up to the parent.
					</p>
				</div>

				<div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
					<h2 class="text-lg font-semibold text-slate-800 mb-4">
						Parent Controls
					</h2>
					<div class="flex flex-wrap gap-4">
						<button
							onClick={() => increment()}
							class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
						>
							Increment Count
						</button>
						<button
							onClick={() => changeColor()}
							class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
						>
							Change Color
						</button>
						<button
							onClick={() => toggleActive()}
							class={`px-4 py-2 text-white rounded-lg transition ${
								isActive.value
									? 'bg-green-600 hover:bg-green-700'
									: 'bg-slate-500 hover:bg-slate-600'
							}`}
						>
							Toggle Status
						</button>
						<button
							onClick={() => reset()}
							class="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition ml-auto"
						>
							Reset
						</button>
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<StatDisplay
						label="Current Count"
						value={count}
						color="blue"
						onAction={increment}
					/>
					<StatDisplay
						label="Derived Value (x2)"
						value={doubleCount}
						color="indigo"
					/>
					<StatDisplay
						label="Current Color"
						value={currentColor}
						color="purple"
						onAction={changeColor}
					/>
					<StatDisplay
						label="Active Status"
						value={computed(() => (isActive.value ? 'Active' : 'Inactive'))}
						color={computed(() => (isActive.value ? 'green' : 'red'))}
						onAction={toggleActive}
					/>
				</div>

				<div class="mt-8 p-4 bg-slate-100 rounded-lg text-sm text-slate-600 overflow-x-auto">
					<p class="mb-2 font-sans font-semibold text-slate-700">
						How it works:
					</p>
					<Ink content={codeSnippet} />
				</div>
			</div>
		</DocsLayout>
	),
});

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
import { triggerHaptic } from '../../components/Haptics';
import '../../styles/examples.css';

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

		const colorSig = computed(() => unref(props.color) || 'mint');
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
		<div
			class="stat-card"
			style={() => ({
				borderColor:
					color.value === 'mint' ? '' : `var(--accent-${color.value})`,
				background:
					color.value === 'mint' ? '' : `var(--accent-${color.value}-alpha-05)`,
			})}
		>
			<div class="stat-label">{label.value}</div>
			<div
				class="stat-value"
				style={() => ({
					color: color.value === 'mint' ? '' : `var(--accent-${color.value})`,
				})}
			>
				{value.value}
			</div>
			{onAction && (
				<button
					onClick={() => onAction()}
					class="btn-secondary"
					style={{
						marginTop: '1rem',
						padding: '0.4rem 0.8rem',
						fontSize: '0.75rem',
					}}
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
		const currentColor = signal('mint');
		const isActive = signal(false);

		const doubleCount = computed(() => count.value * 2);

		const increment = () => {
			count.value++;
		};
		const toggleActive = () => {
			isActive.value = !isActive.value;
		};
		const changeColor = () => {
			const colors = ['mint', 'purple', 'lilac', 'cyan'];
			const currentIdx = colors.indexOf(currentColor.value);
			currentColor.value = colors[(currentIdx + 1) % colors.length];
		};

		const reset = () => {
			count.value = 0;
			currentColor.value = 'mint';
			isActive.value = false;
		};

		const codeSnippet = `
\`\`\`tsx
<StatDisplay 
  value={count} 
  color="mint"
  onAction={increment} 
/>
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
			<div class="example-container animate-water-drop">
				<header class="example-header">
					<h1 class="example-title">{t.value?.title}</h1>
					<p class="example-description">{t.value?.description}</p>
				</header>

				<div class="example-card">
					<h2 class="example-card-title">{t.value?.parentControls}</h2>
					<div class="flex flex-wrap gap-4">
						<button
							onClick={() => {
								triggerHaptic('light');
								increment();
							}}
							class="btn-premium"
						>
							{t.value?.incrementCount}
						</button>
						<button
							onClick={() => {
								triggerHaptic('light');
								changeColor();
							}}
							class="btn-secondary"
						>
							{t.value?.changeColor}
						</button>
						<button
							onClick={() => {
								triggerHaptic('light');
								toggleActive();
							}}
							class="btn-secondary"
							style={() => ({
								borderColor: isActive.value ? 'var(--accent-mint)' : '',
								color: isActive.value ? 'var(--accent-mint)' : '',
							})}
						>
							{t.value?.toggleStatus}
						</button>
						<button
							onClick={() => {
								triggerHaptic('light');
								reset();
							}}
							class="btn-secondary"
							style={{ marginLeft: 'auto' }}
						>
							{t.value?.reset}
						</button>
					</div>
				</div>

				<div class="stat-grid">
					<StatDisplay
						label={t.value?.currentCount ?? ''}
						value={count}
						color="mint"
						onAction={increment}
					/>
					<StatDisplay
						label={t.value?.derivedValue ?? ''}
						value={doubleCount}
						color="lilac"
					/>
					<StatDisplay
						label={t.value?.currentColor ?? ''}
						value={currentColor}
						color={currentColor}
						onAction={changeColor}
					/>
					<StatDisplay
						label={t.value?.activeStatus ?? ''}
						value={
							isActive.value
								? (t.value?.active as string)
								: (t.value?.inactive as string)
						}
						color={isActive.value ? 'mint' : 'cyan'}
						onAction={toggleActive}
					/>
				</div>

				<div class="example-card" style={{ padding: '1.5rem' }}>
					<p class="stat-label" style={{ marginBottom: '1rem' }}>
						{t.value?.howItWorks}
					</p>
					<Ink content={codeSnippet} />
				</div>
			</div>
		</DocsLayout>
	),
});

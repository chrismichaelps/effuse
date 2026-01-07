import {
	define,
	signal,
	computed,
	useHead,
	effect,
	Show,
	For,
} from '@effuse/core';
import { Ink } from '@effuse/ink';
import { DocsLayout } from '../../components/docs/DocsLayout';
import { triggerHaptic } from '../../components/Haptics';
import type { i18nStore as I18nStoreType } from '../../store/appI18n';
import '../../styles/examples.css';

const ShowDemo = define({
	script: ({ useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;
		const t = computed(
			() => i18nStore.translations.value?.examples.controlFlow
		);

		const isLoggedIn = signal(false);
		const user = signal<{ name: string } | null>(null);

		const toggleLogin = () => {
			isLoggedIn.value = !isLoggedIn.value;
			user.value = isLoggedIn.value ? { name: 'John Doe' } : null;
		};

		return { isLoggedIn, user, toggleLogin, t };
	},
	template: ({ isLoggedIn, user, toggleLogin, t }) => (
		<div class="demo-section">
			<h3 class="demo-title">{() => t.value?.show.title}</h3>
			<p class="demo-description">{() => t.value?.show.description}</p>

			<div class="demo-controls">
				<button
					class="btn-secondary"
					onClick={() => {
						triggerHaptic('light');
						toggleLogin();
					}}
				>
					{() =>
						isLoggedIn.value ? t.value?.show.logout : t.value?.show.login
					}
				</button>
			</div>

			<div class="demo-result">
				<Show
					when={user}
					fallback={
						<span class="demo-fallback">{() => t.value?.show.pleaseLogin}</span>
					}
				>
					{(u) => (
						<span class="demo-success">
							{() => t.value?.show.welcome}, {u.name}!
						</span>
					)}
				</Show>
			</div>

			<Ink
				content={`
\`\`\`tsx
<Show when={user} fallback={<span>Please log in</span>}>
  {(u) => <span>Welcome, {u.name}!</span>}
</Show>
\`\`\`
`.trim()}
			/>
		</div>
	),
});

const SwitchDemo = define({
	script: ({ useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;
		const t = computed(
			() => i18nStore.translations.value?.examples.controlFlow
		);
		const status = signal<'idle' | 'loading' | 'success' | 'error'>('idle');

		const setStatus = (s: 'idle' | 'loading' | 'success' | 'error') => {
			status.value = s;
		};

		return { status, setStatus, t };
	},
	template: ({ status, setStatus, t }) => (
		<div class="demo-section">
			<h3 class="demo-title">{() => t.value?.switch.title}</h3>
			<p class="demo-description">{() => t.value?.switch.description}</p>

			<div class="demo-controls">
				{(['idle', 'loading', 'success', 'error'] as const).map((s) => (
					<button
						class={() => `btn-secondary ${status.value === s ? 'active' : ''}`}
						onClick={() => {
							triggerHaptic('light');
							setStatus(s);
						}}
					>
						{s}
					</button>
				))}
			</div>

			<div class="demo-result">
				<Show when={() => status.value === 'idle'}>
					{() => <span class="demo-idle">{() => t.value?.switch.idle}</span>}
				</Show>
				<Show when={() => status.value === 'loading'}>
					{() => (
						<span class="demo-loading">{() => t.value?.switch.loading}</span>
					)}
				</Show>
				<Show when={() => status.value === 'success'}>
					{() => (
						<span class="demo-success">{() => t.value?.switch.success}</span>
					)}
				</Show>
				<Show when={() => status.value === 'error'}>
					{() => <span class="demo-error">{() => t.value?.switch.error}</span>}
				</Show>
			</div>

			<Ink
				content={`
\`\`\`tsx
<Show when={() => status.value === 'loading'}>
  {() => <Spinner />}
</Show>
<Show when={() => status.value === 'success'}>
  {() => <SuccessMessage />}
</Show>
\`\`\`
`.trim()}
			/>
		</div>
	),
});

const ForDemo = define({
	script: ({ useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;
		const t = computed(
			() => i18nStore.translations.value?.examples.controlFlow
		);
		const items = signal<string[]>(['Apple', 'Banana', 'Cherry']);
		const newItem = signal('');

		const addItem = () => {
			if (newItem.value.trim()) {
				items.value = [...items.value, newItem.value.trim()];
				newItem.value = '';
			}
		};

		const removeItem = (index: number) => {
			items.value = items.value.filter((_, i) => i !== index);
		};

		return { items, newItem, addItem, removeItem, t };
	},
	template: ({ items, newItem, addItem, removeItem, t }) => (
		<div class="demo-section">
			<h3 class="demo-title">{() => t.value?.for.title}</h3>
			<p class="demo-description">{() => t.value?.for.description}</p>

			<div class="demo-controls">
				<input
					type="text"
					class="demo-input"
					placeholder={t.value?.for.addPlaceholder}
					value={newItem.value}
					onInput={(e) => {
						newItem.value = (e.target as HTMLInputElement).value;
					}}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							triggerHaptic('light');
							addItem();
						}
					}}
				/>
				<button
					class="btn-secondary"
					onClick={() => {
						triggerHaptic('light');
						addItem();
					}}
				>
					{() => t.value?.for.add}
				</button>
			</div>

			<div class="demo-result">
				<ul class="demo-list">
					<For
						each={items}
						keyExtractor={(item, i) => `${item}-${String(i)}`}
						fallback={
							<li class="demo-fallback">{() => t.value?.for.noItems}</li>
						}
					>
						{(item, index) => (
							<li class="demo-list-item">
								<span>{item.value}</span>
								<button
									class="demo-remove-btn"
									onClick={() => {
										triggerHaptic('light');
										removeItem(index.value);
									}}
								>
									×
								</button>
							</li>
						)}
					</For>
				</ul>
			</div>

			<Ink
				content={`
\`\`\`tsx
<For 
  each={items}
  keyExtractor={(item, i) => item.id}
  fallback={<Empty />}
>
  {(item, index) => <Item data={item.value} />}
</For>
\`\`\`
`.trim()}
			/>
		</div>
	),
});

const DynamicStyleDemo = define({
	script: ({ useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;
		const t = computed(
			() => i18nStore.translations.value?.examples.controlFlow
		);
		const colors = ['mint', 'purple', 'lilac', 'cyan', 'pink'];
		const currentIndex = signal(0);

		const nextColor = () => {
			currentIndex.value = (currentIndex.value + 1) % colors.length;
		};

		const currentColor = computed(() => colors[currentIndex.value]);

		return { currentColor, nextColor, t };
	},
	template: ({ currentColor, nextColor, t }) => (
		<div class="demo-section">
			<h3 class="demo-title">{() => t.value?.dynamic.title}</h3>
			<p class="demo-description">{() => t.value?.dynamic.description}</p>

			<div class="demo-controls">
				<button
					class="btn-secondary"
					onClick={() => {
						triggerHaptic('light');
						nextColor();
					}}
				>
					{() => t.value?.dynamic.changeColor}
				</button>
			</div>

			<div
				class="demo-result demo-color-box"
				style={() => ({
					backgroundColor: `var(--accent-${currentColor.value})`,
					color: 'white',
					padding: '2rem',
					borderRadius: '0.5rem',
					textAlign: 'center',
					transition: 'background-color 0.3s ease',
				})}
			>
				{() => t.value?.dynamic.current}: {currentColor.value}
			</div>

			<Ink
				content={`
\`\`\`tsx
<div style={() => ({
  backgroundColor: \`var(--accent-\${color.value})\`,
  transition: 'background-color 0.3s ease',
})}>
  {color.value}
</div>
\`\`\`
`.trim()}
			/>
		</div>
	),
});

export const ComponentsPage = define({
	script: ({ useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;
		const t = computed(
			() => i18nStore.translations.value?.examples.controlFlow
		);

		effect(() => {
			if (!t.value) return;
			useHead({
				title: `${t.value.title} - Effuse Playground`,
				description: t.value.description,
			});
		});

		return { t };
	},
	template: ({ t }) => (
		<DocsLayout currentPath="/components">
			<div class="example-container animate-water-drop">
				<header class="example-header">
					<h1 class="example-title">{() => t.value?.title}</h1>
					<p class="example-description">{() => t.value?.description}</p>
				</header>

				<div class="components-demo-grid">
					<ShowDemo />
					<SwitchDemo />
					<ForDemo />
					<DynamicStyleDemo />
				</div>
			</div>
		</DocsLayout>
	),
});

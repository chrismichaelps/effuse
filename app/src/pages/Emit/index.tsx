import {
	define,
	computed,
	For,
	useHead,
	signal,
	effect,
	useEmits,
	useEventSignal,
	type ReadonlySignal,
} from '@effuse/core';
import { Ink } from '@effuse/ink';
import { DocsLayout } from '../../components/docs/DocsLayout';
import type { i18nStore as I18nStoreType } from '../../store/appI18n';
import { triggerHaptic } from '../../components/Haptics';
import '../../styles/examples.css';

interface ChatMessage {
	id: string;
	text: string;
	author: string;
	timestamp: number;
	type: 'text' | 'system';
	translationKey?: string;
	translationData?: Record<string, string>;
}

interface UserPresence {
	userId: string;
	status: 'online' | 'away' | 'typing';
}

interface ChatEvents {
	message: ChatMessage;
	presence: UserPresence;
	typing: { userId: string; isTyping: boolean };
}

interface StatDisplayProps {
	label: string | ReadonlySignal<string>;
	value: string | number | ReadonlySignal<string | number>;
	color?: string;
}

interface StatDisplayExposed {
	label: string | ReadonlySignal<string>;
	value: string | number | ReadonlySignal<string | number>;
	color: string;
}

const StatDisplay = define<StatDisplayProps, StatDisplayExposed>({
	script: ({ props }) => ({
		label: props.label,
		value: props.value,
		color: props.color || 'mint',
	}),
	template: ({ label, value, color }: StatDisplayExposed) => (
		<div class="text-center">
			<div
				class="text-2xl font-bold"
				style={() => ({ color: `var(--accent-${color})` })}
			>
				{value}
			</div>
			<div class="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
				{label}
			</div>
		</div>
	),
});

const generateId = () =>
	`msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const EmitDemoPage = define({
	script: ({ useCallback, useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;
		const t = computed(() => i18nStore.translations.value?.examples?.emit);

		effect(() => {
			useHead({
				title: `${t.value?.title || 'Event Emits'} - Effuse Playground`,
				description:
					t.value?.description || 'Event emitter with reactive signal support.',
			});
		});

		const messages = signal<ChatMessage[]>([]);
		const currentUser = signal('Red');
		const inputText = signal('');
		const presence = signal<UserPresence[]>([
			{ userId: 'Red', status: 'online' },
			{ userId: 'Blue', status: 'online' },
			{ userId: 'Orange', status: 'away' },
			{ userId: 'White', status: 'online' },
		]);

		const emitCount = signal(0);

		const userStyles: Record<
			string,
			{ bg: string; text: string; accent: string }
		> = {
			Red: { bg: '#ff4b4b', text: '#fff', accent: 'var(--accent-cyan)' },
			Blue: { bg: '#4b73ff', text: '#fff', accent: 'var(--accent-mint)' },
			Orange: { bg: '#ff8c4b', text: '#fff', accent: 'var(--accent-lilac)' },
			White: { bg: '#f8fafc', text: '#0f172a', accent: 'var(--accent-mint)' },
			System: {
				bg: 'rgba(255,255,255,0.05)',
				text: '#94a3b8',
				accent: 'var(--border-subtle)',
			},
		};

		let chatContainer: HTMLDivElement | null = null;
		let inputEl: HTMLInputElement | null = null;

		const { emit, context } = useEmits<ChatEvents>({
			message: (msg: ChatMessage) => {
				messages.value = [...messages.value, msg];
				emitCount.value++;
			},
			presence: (p: UserPresence) => {
				presence.value = presence.value.map((u) =>
					u.userId === p.userId ? p : u
				);
			},
		});

		const lastMessage = useEventSignal<ChatEvents, ChatMessage>(
			context,
			'message'
		);

		effect(() => {
			if (messages.value.length && chatContainer) {
				requestAnimationFrame(() => {
					if (chatContainer) {
						chatContainer.scrollTop = chatContainer.scrollHeight;
					}
				});
			}
		});

		const handleSendMessage = useCallback(() => {
			const text = inputText.value.trim();
			if (!text) return;

			emit('message', {
				id: generateId(),
				text,
				author: currentUser.value,
				timestamp: Date.now(),
				type: 'text',
			});

			inputText.value = '';
			inputEl?.focus();
		});

		const handleSwitchUser = (user: string) => {
			currentUser.value = user;
			emit('message', {
				id: generateId(),
				text: `Switched to ${user}`,
				author: 'System',
				timestamp: Date.now(),
				type: 'system',
				translationKey: 'switchedTo',
				translationData: { user },
			});
			emit('presence', { userId: user, status: 'online' });
		};

		const resetSession = () => {
			messages.value = [];
			emitCount.value = 0;
		};

		const codeSnippet = `
\`\`\`tsx
const { emit, on, context } = useEmits<Events>({
  message: (msg) => {
    messages.value = [...messages.value, msg];
  },
});

emit('message', { text: 'Hello!', author: 'Dev' });
\`\`\``.trim();

		effect(() => {
			if (messages.value.length === 0) {
				emit('message', {
					id: generateId(),
					text: 'Session started. Event emitter ready!',
					author: 'System',
					timestamp: Date.now(),
					type: 'system',
					translationKey: 'sessionStarted',
				});
			}
		});

		return {
			messages,
			inputText,
			presence,
			currentUser,
			emitCount,
			lastMessage,
			setChatContainer: (el: unknown) => {
				chatContainer = el as HTMLDivElement;
			},
			setInputEl: (el: unknown) => {
				inputEl = el as HTMLInputElement;
			},
			handleSendMessage,
			handleSwitchUser,
			resetSession,
			codeSnippet,
			userStyles,
			t,
		};
	},

	template: ({
		messages,
		inputText,
		presence,
		currentUser,
		emitCount,
		setChatContainer,
		setInputEl,
		handleSendMessage,
		handleSwitchUser,
		resetSession,
		codeSnippet,
		userStyles,
		t,
	}) => (
		<DocsLayout currentPath="/emit">
			<div class="example-container animate-water-drop">
				<header class="example-header">
					<h1 class="example-title">{t.value?.title || ''}</h1>
					<p class="example-description">{t.value?.description || ''}</p>
				</header>

				<div class="flex flex-wrap justify-center gap-3 mb-10">
					<span
						class="example-badge"
						style="background: rgba(182, 157, 248, 0.1); color: var(--accent-lilac);"
					>
						useEmits
					</span>
					<span
						class="example-badge"
						style="background: rgba(141, 240, 204, 0.1); color: var(--accent-mint);"
					>
						useEventSignal
					</span>
				</div>

				<div class="example-card">
					<div class="flex gap-3">
						<input
							ref={setInputEl}
							type="text"
							placeholder={
								computed(() => t.value?.placeholder || '') as unknown as string
							}
							value={inputText}
							onInput={(e) =>
								(inputText.value = (e.target as HTMLInputElement).value)
							}
							onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
							class="example-input"
						/>
						<button
							type="button"
							onClick={() => {
								triggerHaptic('light');
								handleSendMessage();
							}}
							class={() =>
								inputText.value.trim().length > 0
									? 'btn-premium'
									: 'btn-premium opacity-50 cursor-not-allowed'
							}
						>
							{t.value?.send || ''}
						</button>
					</div>
					<div class="mt-4 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
						<span>{t.value?.actingAs || ''}</span>
						<span
							class="px-3 py-1 rounded-full text-white"
							style={() => ({ background: userStyles[currentUser.value]?.bg })}
						>
							{currentUser.value}
						</span>
					</div>
				</div>

				<div class="stat-grid">
					<StatDisplay
						label={t.value?.stats?.messages || ''}
						value={messages.value.length}
						color="mint"
					/>
					<StatDisplay
						label={t.value?.stats?.emits || ''}
						value={emitCount}
						color="lilac"
					/>
					<StatDisplay
						label={t.value?.stats?.online || ''}
						value={presence.value.filter((p) => p.status === 'online').length}
						color="cyan"
					/>
				</div>

				<div class="flex flex-wrap justify-center gap-3 mb-8">
					<For each={presence} keyExtractor={(p) => p.userId}>
						{(p) => (
							<button
								type="button"
								onClick={() => handleSwitchUser(p.value.userId)}
								class={() =>
									currentUser.value === p.value.userId
										? 'btn-premium'
										: 'btn-secondary'
								}
								style={() => ({
									background:
										currentUser.value === p.value.userId
											? userStyles[p.value.userId]?.bg || ''
											: '',
									borderColor:
										currentUser.value === p.value.userId
											? userStyles[p.value.userId]?.bg || ''
											: '',
								})}
							>
								{p.value.userId}
								{p.value.status === 'online' && (
									<span class="ml-2 inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
								)}
							</button>
						)}
					</For>
					<button
						type="button"
						onClick={() => resetSession()}
						class="btn-secondary"
						style="border-color: rgba(255, 100, 100, 0.2); color: #ff6b6b;"
					>
						{t.value?.reset || ''}
					</button>
				</div>

				<div class="example-card" style="padding: 0; overflow: hidden;">
					<div
						ref={setChatContainer}
						class="h-[400px] overflow-y-auto custom-scrollbar p-6 space-y-4"
					>
						{computed(() =>
							messages.value.length === 0 ? (
								<div class="h-full flex items-center justify-center text-slate-500 italic">
									{t.value?.noMessages}
								</div>
							) : null
						)}

						<For each={messages} keyExtractor={(m) => m.id}>
							{(msg) => {
								const isSystem = msg.value.type === 'system';
								const style =
									userStyles[isSystem ? 'System' : msg.value.author];

								return (
									<div
										class={() =>
											`flex flex-col ${isSystem ? 'items-center' : 'items-start'} gap-1 w-full`
										}
									>
										{!isSystem && (
											<div class="flex items-center gap-2 ml-1">
												<span class="text-[10px] font-black uppercase tracking-widest text-slate-500">
													{msg.value.author}
												</span>
												<span class="text-[10px] text-slate-600">
													{new Date(msg.value.timestamp).toLocaleTimeString()}
												</span>
											</div>
										)}
										<div
											class={() =>
												isSystem
													? 'px-4 py-1.5 rounded-full bg-white/5 text-xs text-slate-400'
													: 'px-5 py-3 rounded-2xl bg-white/5 text-slate-200 max-w-[80%]'
											}
											style={() => ({
												borderLeft: !isSystem
													? `3px solid ${style?.bg || 'var(--accent-mint)'}`
													: 'none',
											})}
										>
											{computed(() => {
												if (!msg.value.translationKey) return msg.value.text;
												let template =
													(t.value as any)?.[msg.value.translationKey] ||
													msg.value.text;
												if (msg.value.translationData) {
													Object.entries(msg.value.translationData).forEach(
														([key, val]) => {
															template = template.replace(`{{${key}}}`, val);
														}
													);
												}
												return template;
											})}
										</div>
									</div>
								);
							}}
						</For>
					</div>
				</div>

				<div class="example-card" style="padding: 1.5rem;">
					<p class="stat-label" style="margin-bottom: 1rem;">
						{t.value?.howItWorks || ''}
					</p>
					<Ink content={codeSnippet} />
				</div>
			</div>
		</DocsLayout>
	),
});

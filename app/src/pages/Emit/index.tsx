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
import { i18nStore } from '../../store/appI18n';

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
		color: props.color || 'blue',
	}),
	template: ({ label, value, color }: StatDisplayExposed) => {
		const colorClass =
			color === 'green'
				? 'text-emerald-600'
				: color === 'red'
					? 'text-rose-600'
					: color === 'slate'
						? 'text-slate-600'
						: 'text-blue-600';

		return (
			<div class="text-center">
				<div class={`text-2xl font-bold ${colorClass}`}>{value}</div>
				<div class="text-sm text-slate-500">{label}</div>
			</div>
		);
	},
});

const generateId = () =>
	`msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const EmitDemoPage = define({
	script: ({ useCallback }) => {
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
			{ bg: string; text: string; border?: string }
		> = {
			Red: { bg: 'bg-red-600', text: 'text-white' },
			Blue: { bg: 'bg-blue-600', text: 'text-white' },
			Orange: { bg: 'bg-orange-500', text: 'text-white' },
			White: {
				bg: 'bg-white',
				text: 'text-slate-900',
				border: 'border-slate-300',
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

		const handleMention = (user: string) => {
			inputText.value = `@${user} `;
			inputEl?.focus();
		};

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
// Define event types
interface Events {
  message: { text: string; author: string };
  userJoined: { userId: string };
}

// Create typed emitter
const { emit, on, context } = useEmits<Events>({
  message: (msg) => {
    messages.value = [...messages.value, msg];
  },
});

// Subscribe to events
const unsub = on('message', (msg) => console.log(msg.text));

// Emit events
emit('message', { text: 'Hello!', author: 'Dev' });

// Reactive signal for UI
const lastMessage = useEventSignal(context, 'message');
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
			handleMention,
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
		handleMention,
		handleSwitchUser,
		resetSession,
		codeSnippet,
		userStyles,
		t,
	}) => (
		<DocsLayout currentPath="/emit">
			<div class="py-12 px-4">
				<div class="max-w-3xl mx-auto">
					<header class="text-center mb-10">
						<h1 class="text-4xl font-bold text-slate-800 mb-3">
							{t.value?.title || ''}
						</h1>
						<p class="text-slate-600 text-lg">{t.value?.description || ''}</p>
					</header>

					<div class="flex flex-wrap justify-center gap-3 mb-10">
						<span class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm">
							useEmits
						</span>
						<span class="bg-green-600 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm">
							useEventSignal
						</span>
					</div>

					<div class="bg-white rounded-xl shadow-lg border border-slate-200 p-4 mb-6">
						<div class="flex gap-3">
							<input
								ref={setInputEl}
								type="text"
								id="message-input"
								placeholder={
									computed(
										() => t.value?.placeholder || ''
									) as unknown as string
								}
								value={inputText}
								onInput={(e) =>
									(inputText.value = (e.target as HTMLInputElement).value)
								}
								onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
								class="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							<button
								type="button"
								id="send-btn"
								onClick={() => handleSendMessage()}
								class={() =>
									inputText.value.trim().length > 0
										? 'px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors'
										: 'px-6 py-3 bg-blue-300 text-white rounded-lg font-semibold cursor-not-allowed transition-colors'
								}
							>
								{t.value?.send || ''}
							</button>
						</div>
						<div class="mt-3 flex items-center gap-2 text-sm text-slate-500">
							<span>{t.value?.actingAs || ''}</span>
							<span
								class={() => {
									const style = userStyles[currentUser.value];
									return `inline-block px-2 py-0.5 rounded font-bold shadow-sm transition-all border ${style?.bg || 'bg-slate-600'} ${style?.text || 'text-white'} ${style?.border || 'border-transparent'}`;
								}}
							>
								{currentUser}
							</span>
						</div>
					</div>

					<div class="bg-white rounded-xl shadow-lg border border-slate-200 p-4 mb-6">
						<div class="flex justify-center gap-8">
							<StatDisplay
								label={t.value?.stats?.messages || ''}
								value={messages.value.length}
								color="slate"
							/>
							<StatDisplay
								label={t.value?.stats?.emits || ''}
								value={emitCount}
								color="blue"
							/>
							<StatDisplay
								label={t.value?.stats?.online || ''}
								value={
									presence.value.filter((p) => p.status === 'online').length
								}
								color="green"
							/>
						</div>
					</div>

					<div class="flex justify-center gap-2 mb-6">
						<For each={presence} keyExtractor={(p) => p.userId}>
							{(p) => (
								<button
									type="button"
									onClick={() => handleSwitchUser(p.value.userId)}
									class={() => {
										const selectedUser = currentUser.value;
										const currentUserId = p.value.userId;
										const active = selectedUser === currentUserId;
										const style = userStyles[currentUserId];

										return active
											? `px-4 py-2 rounded-lg font-bold shadow-md transition-all border ${style?.bg || 'bg-slate-800'} ${style?.text || 'text-white'} ${style?.border || 'border-transparent'}`
											: 'px-4 py-2 rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all border border-transparent';
									}}
								>
									{p.value.userId}
									{p.value.status === 'online' && (
										<span class="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
									)}
								</button>
							)}
						</For>
						<button
							type="button"
							onClick={() => resetSession()}
							class="px-4 py-2 rounded-lg font-medium bg-red-100 text-red-600 hover:bg-red-200 ml-4"
						>
							{t.value?.reset || ''}
						</button>
					</div>

					<div class="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
						<div
							ref={setChatContainer}
							class="divide-y divide-slate-100 max-h-96 overflow-y-auto"
						>
							{computed(() =>
								messages.value.length === 0 ? (
									<div class="p-8 text-center text-slate-400">
										{t.value?.noMessages}
									</div>
								) : null
							)}

							<For each={messages} keyExtractor={(m) => m.id}>
								{(msg) => (
									<div class="px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors group">
										{msg.value.type === 'system' ? (
											<div class="w-full text-center">
												<span class="inline-block px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-sm">
													{computed(() => {
														if (!msg.value.translationKey)
															return msg.value.text;

														let template =
															(t.value as any)?.[msg.value.translationKey] ||
															msg.value.text;

														if (msg.value.translationData) {
															Object.entries(msg.value.translationData).forEach(
																([key, val]) => {
																	template = template.replace(
																		`{{${key}}}`,
																		val
																	);
																}
															);
														}

														return template;
													})}
												</span>
											</div>
										) : (
											<>
												<div
													class={() => {
														const style = userStyles[msg.value.author];
														return `w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 shadow-sm border ${style?.bg || 'bg-slate-400'} ${style?.text || 'text-white'} ${style?.border || 'border-transparent'}`;
													}}
												>
													{msg.value.author.slice(0, 1).toUpperCase()}
												</div>
												<div class="flex-1 min-w-0">
													<div class="flex items-center gap-2 mb-1">
														<span class="font-semibold text-slate-800">
															{msg.value.author}
														</span>
														<span class="text-xs text-slate-400">
															{new Date(
																msg.value.timestamp
															).toLocaleTimeString()}
														</span>
													</div>
													<p class="text-slate-700">{msg.value.text}</p>
												</div>
												<button
													type="button"
													onClick={() => handleMention(msg.value.author)}
													class="opacity-0 group-hover:opacity-100 px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200 transition"
												>
													{t.value?.mention || ''}
												</button>
											</>
										)}
									</div>
								)}
							</For>
						</div>
					</div>

					<div class="mt-8 p-4 bg-slate-100 rounded-lg text-sm text-slate-600 overflow-x-auto">
						<p class="mb-2 font-sans font-semibold text-slate-700">
							{t.value?.howItWorks || ''}
						</p>
						<Ink content={codeSnippet} />
					</div>
				</div>
			</div>
		</DocsLayout>
	),
});

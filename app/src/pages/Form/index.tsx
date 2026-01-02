import {
	define,
	useForm,
	useHead,
	v,
	signal,
	computed,
	For,
	Suspense,
	effect,
	isTaggedError,
} from '@effuse/core';
import { useMutation } from '@effuse/query';
import { DocsLayout } from '../../components/docs/DocsLayout';
import type { i18nStore as I18nStoreType } from '../../store/appI18n';
import { triggerHaptic } from '../../components/Haptics';
import { FormSubmissionError } from '../../errors/index.js';
import '../../styles/examples.css';

interface Post {
	id: number;
	userId: number;
	title: string;
	body: string;
}

interface CreatePostVariables {
	title: string;
	body: string;
	userId: number;
}

const API_BASE = 'https://jsonplaceholder.typicode.com';

const VALIDATION = {
	TITLE_MIN: 5,
	TITLE_MAX: 100,
	BODY_MIN: 10,
	BODY_MAX: 500,
	USER_ID_MIN: 1,
	USER_ID_MAX: 10,
} as const;

const STATUS_DISPLAY_DURATION_MS = 3000;

export const FormDemoPage = define({
	script: ({ useCallback, useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;

		const t = computed(() => i18nStore.translations.value?.examples?.form);

		effect(() => {
			useHead({
				title: `${t.value?.title as string} - Effuse Playground`,
				description: t.value?.description as string,
			});
		});

		const submittedPosts = signal<Post[]>([]);
		const submissionStatus = signal('');
		let nextPostId = 1;

		const createPostMutation = useMutation<Post, CreatePostVariables>({
			mutationKey: ['createPost'],
			mutationFn: async (variables: CreatePostVariables) => {
				const response = await fetch(`${API_BASE}/posts`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(variables),
				});
				if (!response.ok) {
					throw new FormSubmissionError({
						message: `Failed to create post (HTTP ${response.status})`,
						formId: 'create-post',
					});
				}
				const result = (await response.json()) as Post;
				return result;
			},
			onSuccess: (newPost: Post) => {
				const postWithUniqueId = { ...newPost, id: nextPostId++ };
				submittedPosts.value = [...submittedPosts.value, postWithUniqueId];
				submissionStatus.value = `Post #${String(postWithUniqueId.id)} created successfully`;
				setTimeout(() => {
					submissionStatus.value = '';
				}, STATUS_DISPLAY_DURATION_MS);
				form.reset();
			},
			onError: (error: unknown) => {
				console.log('[onError] Called with:', error);
				const message = isTaggedError(error)
					? error.toString()
					: error instanceof Error
						? error.message
						: 'Unknown error';
				submissionStatus.value = `Error: ${message}`;
			},
		});

		const form = useForm({
			initial: {
				title: signal(''),
				body: signal(''),
				email: signal(''),
				userId: signal(1),
			},
			validators: {
				title: v.compose(
					v.required('Title is required'),
					v.minLength(
						VALIDATION.TITLE_MIN,
						`Title must be at least ${VALIDATION.TITLE_MIN} characters`
					),
					v.maxLength(
						VALIDATION.TITLE_MAX,
						`Title must be at most ${VALIDATION.TITLE_MAX} characters`
					),
					v.trimmed('Title cannot have leading/trailing spaces')
				),
				body: v.compose(
					v.required('Body is required'),
					v.minLength(
						VALIDATION.BODY_MIN,
						`Body must be at least ${VALIDATION.BODY_MIN} characters`
					),
					v.maxLength(
						VALIDATION.BODY_MAX,
						`Body must be at most ${VALIDATION.BODY_MAX} characters`
					)
				),
				email: v.compose(
					v.required('Email is required'),
					v.email('Please enter a valid email address')
				),
				userId: v.compose(
					v.greaterThanOrEqualTo(
						VALIDATION.USER_ID_MIN,
						`User ID must be at least ${VALIDATION.USER_ID_MIN}`
					),
					v.lessThanOrEqualTo(
						VALIDATION.USER_ID_MAX,
						`User ID must be at most ${VALIDATION.USER_ID_MAX}`
					),
					v.integer('User ID must be a whole number')
				),
			},
			validationOptions: { debounce: 0, validateOn: 'change' },
		});

		const handleSubmit = useCallback(() => {
			if (!form.isValid.value) {
				return;
			}
			createPostMutation.mutate({
				title: String(form.fields.title.value),
				body: String(form.fields.body.value),
				userId: Number(form.fields.userId.value),
			});
		});

		const resetAll = useCallback(() => {
			form.reset();
			submittedPosts.value = [];
			submissionStatus.value = '';
			nextPostId = 1;
		});

		const titleError = computed(() => form.errors.value.title ?? '');
		const emailError = computed(() => form.errors.value.email ?? '');
		const bodyError = computed(() => form.errors.value.body ?? '');
		const userIdError = computed(() => form.errors.value.userId ?? '');
		const titleCharCount = computed(() => {
			const len = String(form.fields.title.value).length;
			return `${String(len)}/${VALIDATION.TITLE_MAX}`;
		});
		const bodyCharCount = computed(() => {
			const len = String(form.fields.body.value).length;
			return `${String(len)}/${VALIDATION.BODY_MAX}`;
		});
		const submitButtonText = computed(() =>
			createPostMutation.isPending.value
				? (t.value?.submittingButton as string)
				: (t.value?.createButton as string)
		);
		const isValidText = computed(() =>
			form.isValid.value
				? (t.value?.valid as string)
				: (t.value?.invalid as string)
		);
		const isDirtyText = computed(() =>
			form.isDirty.value
				? (t.value?.modified as string)
				: (t.value?.pristine as string)
		);
		const isSubmittingText = computed(() =>
			form.isSubmitting.value
				? (t.value?.yes as string)
				: (t.value?.no as string)
		);
		const canSubmit = computed(
			() => form.isValid.value && !createPostMutation.isPending.value
		);
		const isDisabled = computed(() => !canSubmit.value);
		const postsCount = computed(() => submittedPosts.value.length);

		return {
			t,
			form,
			titleError,
			emailError,
			bodyError,
			userIdError,
			titleCharCount,
			bodyCharCount,
			submitButtonText,
			submittedPosts,
			submissionStatus,
			isValidText,
			isDirtyText,
			isSubmittingText,
			isDisabled,
			postsCount,
			handleSubmit,
			resetAll,
		};
	},
	template: ({
		t,
		form,
		titleError,
		emailError,
		bodyError,
		userIdError,
		titleCharCount,
		bodyCharCount,
		submitButtonText,
		submittedPosts,
		submissionStatus,
		isValidText,
		isDirtyText,
		isSubmittingText,
		isDisabled,
		postsCount,
		handleSubmit,
		resetAll,
	}) => (
		<DocsLayout currentPath="/form">
			<div class="example-container animate-water-drop">
				<header class="example-header">
					<h1 class="example-title">{t.value?.title}</h1>
					<p class="example-description">{t.value?.description}</p>
				</header>

				<div class="flex flex-wrap justify-center gap-3 mb-10">
					<span class="example-badge">Schema Validation</span>
					<span class="example-badge">Reactive Signals</span>
					<span class="example-badge">useMutation</span>
				</div>

				<div class="example-card" style="padding: 0; overflow: hidden;">
					<div class="bg-white/5 px-6 py-4">
						<h2 class="text-xl font-semibold text-white">
							{t.value?.createPost}
						</h2>
						<p class="text-slate-400 text-sm mt-1">{t.value?.apiNote}</p>
					</div>
					<form
						class="p-6"
						onSubmit={(e: Event) => {
							e.preventDefault();
							handleSubmit();
						}}
					>
						<div class="mb-6">
							<label
								for="title"
								class="block text-sm font-semibold text-slate-400 mb-2"
							>
								{t.value?.titleLabel}
								<span class="text-mint ml-1" style="color: var(--accent-mint);">
									*
								</span>
							</label>
							<div class="relative">
								<input
									id="title"
									type="text"
									placeholder={t.value?.enterTitlePlaceholder ?? ''}
									value={form.fields.title.value}
									onInput={(e: Event) => {
										form.fields.title.value = (
											e.target as HTMLInputElement
										).value;
									}}
									onBlur={() => {
										form.touched.title.value = true;
									}}
									class="example-input"
								/>
								<span class="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 text-[10px] font-mono">
									{titleCharCount.value}
								</span>
							</div>
							<p class="text-rose-400 text-xs mt-1.5 min-h-4">
								{titleError.value}
							</p>
						</div>

						<div class="mb-6">
							<label
								for="email"
								class="block text-sm font-semibold text-slate-400 mb-2"
							>
								{t.value?.emailLabel}
								<span class="text-mint ml-1" style="color: var(--accent-mint);">
									*
								</span>
							</label>
							<input
								id="email"
								type="text"
								placeholder={t.value?.emailPlaceholder ?? ''}
								value={form.fields.email.value}
								onInput={(e: Event) => {
									form.fields.email.value = (
										e.target as HTMLInputElement
									).value;
								}}
								onBlur={() => {
									form.touched.email.value = true;
								}}
								class="example-input"
							/>
							<p class="text-rose-400 text-xs mt-1.5 min-h-4">
								{emailError.value}
							</p>
						</div>

						<div class="mb-6">
							<label
								for="body"
								class="block text-sm font-semibold text-slate-400 mb-2"
							>
								{t.value?.bodyLabel}
								<span class="text-mint ml-1" style="color: var(--accent-mint);">
									*
								</span>
							</label>
							<div class="relative">
								<textarea
									id="body"
									placeholder={t.value?.bodyPlaceholder ?? ''}
									value={form.fields.body.value}
									onInput={(e: Event) => {
										form.fields.body.value = (
											e.target as HTMLTextAreaElement
										).value;
									}}
									onBlur={() => {
										form.touched.body.value = true;
									}}
									class="example-input min-h-[120px] resize-y"
								/>
								<span class="absolute right-3 top-3 text-slate-500 text-[10px] font-mono">
									{bodyCharCount.value}
								</span>
							</div>
							<p class="text-rose-400 text-xs mt-1.5 min-h-4">
								{bodyError.value}
							</p>
						</div>

						<div class="mb-8">
							<label
								for="userId"
								class="block text-sm font-semibold text-slate-400 mb-2"
							>
								{t.value?.userIdLabel}
								<span class="text-mint ml-1" style="color: var(--accent-mint);">
									*
								</span>
							</label>
							<input
								id="userId"
								type="number"
								min="1"
								max="10"
								value={form.fields.userId.value}
								onInput={(e: Event) => {
									const val = parseInt(
										(e.target as HTMLInputElement).value,
										10
									);
									form.fields.userId.value = isNaN(val) ? 1 : val;
								}}
								onBlur={() => {
									form.touched.userId.value = true;
								}}
								class="example-input"
								style="max-width: 120px;"
							/>
							<p class="text-rose-400 text-xs mt-1.5 min-h-4">
								{userIdError.value}
							</p>
						</div>

						<div class="flex flex-wrap gap-6 p-4 bg-white/5 rounded-xl mb-8">
							<div class="flex items-center gap-2">
								<span class="text-slate-500 text-xs uppercase font-bold tracking-wider">
									{t.value?.valid}:
								</span>
								<span
									class="text-sm font-semibold"
									style={() =>
										form.isValid.value
											? { color: 'var(--accent-mint)' }
											: { color: '#ff6b6b' }
									}
								>
									{isValidText.value}
								</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="text-slate-500 text-xs uppercase font-bold tracking-wider">
									{t.value?.state}:
								</span>
								<span class="text-sm font-semibold text-slate-300">
									{isDirtyText.value}
								</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="text-slate-500 text-xs uppercase font-bold tracking-wider">
									{t.value?.submitting}:
								</span>
								<span class="text-sm font-semibold text-slate-300">
									{isSubmittingText.value}
								</span>
							</div>
						</div>

						<div class="flex gap-4">
							<button
								type="submit"
								disabled={isDisabled.value}
								onClick={() => triggerHaptic('medium')}
								class={() =>
									isDisabled.value
										? 'btn-premium opacity-50 cursor-not-allowed flex-1'
										: 'btn-premium flex-1'
								}
							>
								{submitButtonText.value}
							</button>
							<button
								type="button"
								onClick={() => {
									triggerHaptic('light');
									resetAll();
								}}
								class="btn-secondary"
							>
								{t.value?.reset}
							</button>
						</div>
					</form>

					{computed(() =>
						submissionStatus.value ? (
							<div class="px-6 pb-6">
								<div
									class="p-4 bg-mint/10 text-mint rounded-xl font-medium border border-mint/20 text-center animate-water-drop"
									style="background: rgba(141, 240, 204, 0.1); color: var(--accent-mint); border-color: rgba(141, 240, 204, 0.1);"
								>
									{submissionStatus.value}
								</div>
							</div>
						) : null
					)}
				</div>

				<Suspense
					fallback={
						<div class="example-card">
							<div class="h-8 bg-white/5 rounded w-1/4 mb-4 animate-shimmer" />
							<div class="space-y-3">
								<div class="h-4 bg-white/5 rounded w-full animate-shimmer" />
								<div class="h-4 bg-white/5 rounded w-5/6 animate-shimmer" />
							</div>
						</div>
					}
				>
					<div class="example-card" style="padding: 0; overflow: hidden;">
						<div class="bg-white/5 px-6 py-4 flex justify-between items-center">
							<h2 class="text-xl font-semibold text-white">
								{t.value?.createdPosts}
							</h2>
							<span class="example-badge">{postsCount.value}</span>
						</div>
						<div class="max-h-[400px] overflow-y-auto custom-scrollbar">
							<For
								each={submittedPosts}
								keyExtractor={(post) => post.id}
								fallback={
									<p class="text-slate-500 text-center py-12 italic">
										{t.value?.noPosts}
									</p>
								}
							>
								{(postSignal) => {
									const post = postSignal.value;
									return (
										<div class="px-6 py-5 hover:bg-white/[0.02] transition-colors">
											<div class="flex items-start justify-between gap-4">
												<div class="flex-1 min-w-0">
													<div class="flex items-center gap-2 mb-2">
														<span class="text-slate-500 text-xs font-mono">
															#{String(post.id)}
														</span>
														<h3 class="font-semibold text-slate-200 truncate">
															{post.title}
														</h3>
													</div>
													<p class="text-slate-400 text-sm line-clamp-2 leading-relaxed">
														{post.body}
													</p>
												</div>
												<span
													class="flex-shrink-0 example-badge"
													style="background: rgba(182, 157, 248, 0.1); color: var(--accent-lilac); border-color: rgba(182, 157, 248, 0.1);"
												>
													USER {String(post.userId)}
												</span>
											</div>
										</div>
									);
								}}
							</For>
						</div>
					</div>
				</Suspense>
			</div>
		</DocsLayout>
	),
});

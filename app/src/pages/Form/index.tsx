import {
	define,
	useForm,
	useHead,
	v,
	signal,
	computed,
	For,
	Suspense,
} from '@effuse/core';
import { useMutation } from '@effuse/query';
import { DocsLayout } from '../../components/docs/DocsLayout';

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
	script: ({ useCallback }) => {
		useHead({
			title: 'Form Demo - Effuse Playground',
			description:
				'Reactive form handling demo with useForm and useMutation hooks.',
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
					throw new Error('Failed to create post');
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
				const message =
					error instanceof Error ? error.message : 'Unknown error';
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
			createPostMutation.isPending.value ? 'Submitting...' : 'Create Post'
		);
		const isValidText = computed(() =>
			form.isValid.value ? 'Valid' : 'Invalid'
		);
		const isDirtyText = computed(() =>
			form.isDirty.value ? 'Modified' : 'Pristine'
		);
		const isSubmittingText = computed(() =>
			form.isSubmitting.value ? 'Yes' : 'No'
		);
		const canSubmit = computed(
			() => form.isValid.value && !createPostMutation.isPending.value
		);
		const isDisabled = computed(() => !canSubmit.value);
		const postsCount = computed(() => submittedPosts.value.length);
		return {
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
		};
	},
	template: ({
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
	}) => (
		<DocsLayout currentPath="/form">
			<div class="min-h-screen py-12 px-4">
				<div class="max-w-2xl mx-auto">
					<header class="text-center mb-10">
						<h1 class="text-4xl font-bold text-slate-800 mb-3">
							Form Management
						</h1>
						<p class="text-slate-600 text-lg">
							Demonstrating reactive form handling with{' '}
							<code class="bg-slate-200 px-2 py-1 rounded text-sm font-mono">
								useForm
							</code>{' '}
							and{' '}
							<code class="bg-slate-200 px-2 py-1 rounded text-sm font-mono">
								useMutation
							</code>{' '}
							hooks
						</p>
					</header>

					<div class="flex flex-wrap justify-center gap-3 mb-10">
						<span class="bg-green-600 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm">
							Effect Schema Validation
						</span>
						<span class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm">
							Reactive Signals
						</span>
						<span class="bg-purple-600 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm">
							useMutation
						</span>
					</div>

					<div class="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mb-8">
						<div class="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
							<h2 class="text-xl font-semibold text-white">Create New Post</h2>
							<p class="text-slate-300 text-sm mt-1">
								Using JSONPlaceholder API for demonstration
							</p>
						</div>
						<form
							class="p-6"
							onSubmit={(e: Event) => {
								e.preventDefault();
								handleSubmit();
							}}
						>
							<div class="mb-5">
								<label
									for="title"
									class="block text-sm font-semibold text-slate-700 mb-2"
								>
									Title
									<span class="text-red-500 ml-1">*</span>
								</label>
								<div class="relative">
									<input
										id="title"
										type="text"
										placeholder="Enter a descriptive title..."
										value={form.fields.title}
										onInput={(e: Event) => {
											form.fields.title.value = (
												e.target as HTMLInputElement
											).value;
										}}
										onBlur={() => {
											form.touched.title.value = true;
										}}
										class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-slate-50 hover:bg-white"
									/>
									<span class="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs font-mono">
										{titleCharCount}
									</span>
								</div>
								<p class="text-red-500 text-sm mt-1.5 min-h-5">{titleError}</p>
							</div>

							<div class="mb-5">
								<label
									for="email"
									class="block text-sm font-semibold text-slate-700 mb-2"
								>
									Email
									<span class="text-red-500 ml-1">*</span>
								</label>
								<input
									id="email"
									type="text"
									placeholder="you@example.com"
									value={form.fields.email}
									onInput={(e: Event) => {
										form.fields.email.value = (
											e.target as HTMLInputElement
										).value;
									}}
									onBlur={() => {
										form.touched.email.value = true;
									}}
									class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-slate-50 hover:bg-white"
								/>
								<p class="text-red-500 text-sm mt-1.5 min-h-5">{emailError}</p>
							</div>

							<div class="mb-5">
								<label
									for="body"
									class="block text-sm font-semibold text-slate-700 mb-2"
								>
									Body
									<span class="text-red-500 ml-1">*</span>
								</label>
								<div class="relative">
									<textarea
										id="body"
										placeholder="Write your post content here..."
										value={form.fields.body}
										onInput={(e: Event) => {
											form.fields.body.value = (
												e.target as HTMLTextAreaElement
											).value;
										}}
										onBlur={() => {
											form.touched.body.value = true;
										}}
										class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-slate-50 hover:bg-white min-h-32 resize-y"
									/>
									<span class="absolute right-3 top-3 text-slate-400 text-xs font-mono">
										{bodyCharCount}
									</span>
								</div>
								<p class="text-red-500 text-sm mt-1.5 min-h-5">{bodyError}</p>
							</div>

							<div class="mb-6">
								<label
									for="userId"
									class="block text-sm font-semibold text-slate-700 mb-2"
								>
									User ID (1-10)
									<span class="text-red-500 ml-1">*</span>
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
									class="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-slate-50 hover:bg-white"
								/>
								<p class="text-red-500 text-sm mt-1.5 min-h-5">{userIdError}</p>
							</div>

							<div class="flex flex-wrap gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 mb-6">
								<div class="flex items-center gap-2">
									<span class="text-slate-500 text-sm">Valid:</span>
									<span class="text-sm font-semibold text-slate-700">
										{isValidText}
									</span>
								</div>
								<div class="flex items-center gap-2">
									<span class="text-slate-500 text-sm">State:</span>
									<span class="text-sm font-semibold text-slate-700">
										{isDirtyText}
									</span>
								</div>
								<div class="flex items-center gap-2">
									<span class="text-slate-500 text-sm">Submitting:</span>
									<span class="text-sm font-semibold text-slate-700">
										{isSubmittingText}
									</span>
								</div>
							</div>

							<div class="flex gap-3">
								<button
									type="button"
									disabled={isDisabled}
									onClick={() => handleSubmit()}
									class="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
								>
									{submitButtonText}
								</button>
								<button
									type="button"
									onClick={() => {
										form.reset();
									}}
									class="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 border border-gray-200"
								>
									Reset
								</button>
							</div>
						</form>

						<div class="px-6 pb-6">
							<div class="p-4 bg-emerald-50 text-emerald-700 rounded-xl font-medium border border-emerald-200 empty:hidden">
								{submissionStatus}
							</div>
						</div>
					</div>

					<Suspense
						fallback={
							<div class="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
								<div class="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
									<h2 class="text-xl font-semibold text-white">
										Created Posts
									</h2>
								</div>
								<div class="p-6 text-center text-slate-400">
									Loading posts...
								</div>
							</div>
						}
					>
						<div class="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
							<div class="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex justify-between items-center">
								<h2 class="text-xl font-semibold text-white">Created Posts</h2>
								<span class="bg-slate-600 text-white text-sm px-3 py-1 rounded-full">
									{postsCount}
								</span>
							</div>
							<div class="divide-y divide-slate-200">
								<For
									each={submittedPosts}
									keyExtractor={(post) => post.id}
									fallback={
										<p class="text-slate-400 text-center py-8">
											No posts created yet. Submit the form above to get
											started.
										</p>
									}
								>
									{(postSignal) => {
										const post = postSignal.value;
										return (
											<div class="px-6 py-4 hover:bg-slate-50 transition-colors">
												<div class="flex items-start justify-between gap-4">
													<div class="flex-1 min-w-0">
														<div class="flex items-center gap-2 mb-1">
															<span class="text-slate-400 text-sm font-mono">
																#{String(post.id)}
															</span>
															<h3 class="font-semibold text-slate-800 truncate">
																{post.title}
															</h3>
														</div>
														<p class="text-slate-600 text-sm line-clamp-2">
															{post.body}
														</p>
													</div>
													<span class="flex-shrink-0 bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">
														User {String(post.userId)}
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
			</div>
		</DocsLayout>
	),
});

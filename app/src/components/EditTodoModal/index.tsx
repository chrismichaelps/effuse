import {
	define,
	computed,
	type Signal,
	type ReadonlySignal,
} from '@effuse/core';
import { i18nStore } from '../../store/appI18n';

interface EditTodoModalProps {
	isOpen: Signal<boolean>;
	title: Signal<string>;
	onTitleChange: (title: string) => void;
	onSave: () => void;
	onClose: () => void;
}

interface EditTodoModalExposed extends EditTodoModalProps {
	t: ReadonlySignal<any>;
}

export const EditTodoModal = define<EditTodoModalProps, EditTodoModalExposed>({
	script: ({ props }) => {
		const t = computed(() => i18nStore.translations.value?.examples?.todos);
		return {
			t,
			isOpen: props.isOpen,
			title: props.title,
			onTitleChange: props.onTitleChange,
			onSave: props.onSave,
			onClose: props.onClose,
		};
	},
	template: ({ t, isOpen, title, onTitleChange, onSave, onClose }) => {
		if (!isOpen.value) return null;
		return (
			<div class="fixed inset-0 z-50 flex items-center justify-center">
				<div
					class="absolute inset-0 bg-black bg-opacity-50"
					onClick={() => onClose()}
				/>

				<div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
					<div class="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
						<h2 class="text-xl font-semibold text-white">
							{t.value?.editTodo}
						</h2>
					</div>

					<div class="p-6">
						<label class="block mb-2 text-sm font-medium text-slate-700">
							{t.value?.todoTitle}
						</label>
						<input
							type="text"
							value={title}
							onInput={(e: Event) =>
								onTitleChange((e.target as HTMLInputElement).value)
							}
							onKeyDown={(e: KeyboardEvent) => {
								if (e.key === 'Enter') onSave();
								if (e.key === 'Escape') onClose();
							}}
							class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder={t.value?.enterTodoTitlePlaceholder ?? ''}
						/>
					</div>

					<div class="px-6 py-4 bg-slate-50 flex justify-end gap-3">
						<button
							type="button"
							onClick={() => onClose()}
							class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
						>
							{t.value?.cancel}
						</button>
						<button
							type="button"
							onClick={() => onSave()}
							class="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
						>
							{t.value?.saveChanges}
						</button>
					</div>
				</div>
			</div>
		);
	},
});

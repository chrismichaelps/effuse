import { define } from '@effuse/core';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export const AppLayout = define({
	script: () => {
		return {};
	},
	template: ({ children }) => (
		<div class="docs-layout-container min-h-screen flex flex-col bg-slate-50">
			<Header />
			<main class="flex-1">{children}</main>
			<Footer />
		</div>
	),
});

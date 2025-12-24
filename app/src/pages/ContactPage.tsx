import { define } from '@effuse/core';
import { useScrollReveal } from '../utils/ui';

export const ContactPage = define({
	script: ({ onMount }) => {
		useScrollReveal(onMount);
		return {};
	},
	template: () => (
		<div class="home-page relative overflow-hidden min-h-screen">
			<div class="vibrant-bg">
				<div class="aurora-blob blob-1"></div>
				<div class="aurora-blob blob-2"></div>
				<div class="aurora-blob blob-3"></div>
			</div>
			<section class="relative z-10 pt-32 pb-24 flex flex-col items-center justify-center min-h-[60vh]">
				<div class="max-w-2xl px-6 reveal-on-scroll text-center w-full">
					<h1 class="text-4xl md:text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500 pb-2">
						Get in Touch
					</h1>
					<p class="text-xl text-zinc-400 mb-12 max-w-lg mx-auto">
						I'm always open to new ideas and collaborations.
					</p>
					<div class="group relative inline-block w-full max-w-lg">
						<div class="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
						<div class="relative bg-zinc-900/90 backdrop-blur-xl rounded-2xl p-8 md:p-10 flex flex-col items-center gap-6">
							<a
								href="mailto:chrisperezsantiago1@gmail.com"
								class="text-xl md:text-2xl font-medium text-white hover:text-emerald-400 transition-colors block"
							>
								chrisperezsantiago1@gmail.com
							</a>
						</div>
					</div>
				</div>
			</section>
		</div>
	),
});

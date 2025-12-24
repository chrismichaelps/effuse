import { define, useHead } from '@effuse/core';
import '../Legal/styles.css';

export const DisclaimerPage = define({
	script: () => {
		useHead({
			title: 'Disclaimer - Effuse',
			description:
				'Disclaimer regarding the experimental nature of the Effuse framework.',
		});
		return {};
	},
	template: () => (
		<main class="legal-page">
			<div class="vibrant-bg">
				<div class="aurora-blob blob-1"></div>
				<div class="aurora-blob blob-2"></div>
				<div class="aurora-blob blob-3"></div>
			</div>
			<div class="legal-container">
				<header class="legal-header">
					<h1 class="legal-title">Disclaimer</h1>
				</header>

				<div class="legal-content">
					<section class="legal-section">
						<h2 class="legal-section-title">Experimental Nature</h2>
						<p class="legal-text">
							Effuse is an experimental UI framework created primarily for
							educational purposes and to explore new approaches to reactivity
							and component architecture.
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">Not a Competitor</h2>
						<p class="legal-text">
							This framework is <strong>not</strong> intended to compete with or
							replace established, production-grade solutions like React, Vue,
							Angular, Svelte, or SolidJS.
						</p>
						<p class="legal-text">
							While Effuse demonstrates modern reactive concepts, the major
							frameworks offer mature ecosystems, extensive tooling, and
							battle-tested stability that Effuse does not aim to replicate.
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">Use at Your Own Risk</h2>
						<p class="legal-text">
							Please use this framework with the understanding that it is
							experimental. APIs may change, and it may not be suitable for
							critical production applications.
						</p>
					</section>
				</div>
			</div>
		</main>
	),
});

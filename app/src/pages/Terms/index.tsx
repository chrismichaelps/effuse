import { define, useHead } from '@effuse/core';
import '../Legal/styles.css';

export const TermsPage = define({
	script: () => {
		useHead({
			title: 'Terms of Service - Effuse',
			description:
				'Terms of Service for using the Effuse framework and related services.',
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
					<h1 class="legal-title">Terms of Service</h1>
					<p class="legal-subtitle">Last updated: December 2025</p>
				</header>

				<div class="legal-content">
					<section class="legal-section">
						<h2 class="legal-section-title">1. Acceptance of Terms</h2>
						<p class="legal-text">
							By accessing and using the Effuse framework, documentation, and
							related services, you accept and agree to be bound by the terms
							and provisions of this agreement.
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">2. License</h2>
						<p class="legal-text">
							Effuse is released under the MIT License. You are free to use,
							copy, modify, merge, publish, distribute, sublicense, and/or sell
							copies of the Software, subject to the conditions of the MIT
							License.
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">3. Use of the Framework</h2>
						<p class="legal-text">
							You agree to use Effuse only for lawful purposes and in a way that
							does not infringe upon the rights of others.
						</p>
						<ul class="legal-list">
							<li>You may use Effuse for personal and commercial projects</li>
							<li>
								You must include the original copyright notice in any copies
							</li>
							<li>
								You may not use the Effuse name to endorse products without
								permission
							</li>
						</ul>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">4. Disclaimer of Warranties</h2>
						<p class="legal-text">
							The software is provided "as is", without warranty of any kind,
							express or implied, including but not limited to the warranties of
							merchantability, fitness for a particular purpose, and
							noninfringement.
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">5. Limitation of Liability</h2>
						<p class="legal-text">
							In no event shall the authors or copyright holders be liable for
							any claim, damages, or other liability, whether in an action of
							contract, tort, or otherwise, arising from, out of, or in
							connection with the software or the use or other dealings in the
							software.
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">6. Changes to Terms</h2>
						<p class="legal-text">
							These terms may be modified at any time. Changes will be posted on
							this page with an updated revision date.
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">7. Contact</h2>
						<p class="legal-text">
							If you have any questions about these Terms, please{' '}
							<a href="/contact" class="legal-link">
								contact me
							</a>
							.
						</p>
					</section>
				</div>
			</div>
		</main>
	),
});

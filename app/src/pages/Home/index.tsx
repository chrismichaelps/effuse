import { define, useHead } from '@effuse/core';
import { Link } from '@effuse/router';
import { FeatureCard } from '../../components/FeatureCard';
import { useScrollReveal } from '../../utils/ui';
import './styles.css';

export const HomePage = define({
	script: ({ onMount }) => {
		useHead({
			title: 'Effuse - Modern Reactive UI Framework',
			description:
				'A signal-based UI framework with fine-grained reactivity, type-safe components, and Effect-powered architecture.',
		});
		useScrollReveal(onMount);
		return {};
	},
	template: () => (
		<div class="home-page">
			<div class="vibrant-bg">
				<div class="aurora-blob blob-1"></div>
				<div class="aurora-blob blob-2"></div>
			</div>

			{/* Hero Section */}
			<section class="hero-section">
				<div class="hero-container reveal-on-scroll">
					<h1 class="hero-heading">
						A modern approach to
						<br />
						<span class="hero-gradient">Web Development</span>
					</h1>
					<p class="hero-subtext">
						Build reactive applications with fine-grained signals, type-safe
						components, and an Effect-powered architecture.
					</p>

					<div class="hero-ctas">
						<Link to="/docs/getting-started" class="cta-primary">
							Get Started
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M5 12h14M12 5l7 7-7 7" />
							</svg>
						</Link>
						<a
							href="https://github.com/chrismichaelps/effuse"
							target="_blank"
							rel="noopener noreferrer"
							class="cta-secondary"
						>
							<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
							</svg>
							View on GitHub
						</a>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section class="features-section">
				<div class="features-container reveal-on-scroll">
					<div class="features-header">
						<h2 class="features-title">Everything you need</h2>
						<p class="features-subtitle">
							Build modern, reactive applications with confidence.
						</p>
					</div>
					<div class="features-grid">
						<FeatureCard
							icon="/logo/signals.svg"
							title="Signals"
							description="Fine-grained reactivity. Only update what changes."
						/>
						<FeatureCard
							icon="/logo/components.svg"
							title="Components"
							description="Type-safe components with script and template."
						/>
						<FeatureCard
							icon="/logo/efficient.svg"
							title="Efficient"
							description="Optimized for performance and small bundle size."
						/>
					</div>
				</div>
			</section>

			{/* Code Example */}
			<section class="code-section">
				<div class="code-container reveal-on-scroll">
					<div class="code-window">
						<div class="code-header">
							<div class="code-dots">
								<span class="code-dot"></span>
								<span class="code-dot"></span>
								<span class="code-dot"></span>
							</div>
							<span class="code-filename">Counter.tsx</span>
						</div>
						<pre class="code-body">
							<code>{`import { define, signal } from '@effuse/core';
							
const Counter = define({
  script: () => {
    const count = signal(0);
    return { count, increment: () => count.value++ };
  },
  template: ({ count, increment }) => (
    <button onClick={increment}>
      Count: {count}
    </button>
  ),
});`}</code>
						</pre>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section class="cta-section">
				<div class="cta-container reveal-on-scroll">
					<h2 class="cta-title">Ready to start?</h2>
					<p class="cta-subtitle">
						Read the documentation and build your first app.
					</p>
					<Link to="/docs/getting-started" class="cta-primary">
						Read the Documentation
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M5 12h14M12 5l7 7-7 7" />
						</svg>
					</Link>
				</div>
			</section>
		</div>
	),
});

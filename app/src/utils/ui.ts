export const useScrollReveal = (onMount: (fn: () => any) => void) => {
	onMount(() => {
		if (typeof IntersectionObserver === 'undefined') return undefined;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						entry.target.classList.add('is-visible');
					}
				});
			},
			{ threshold: 0.1 }
		);

		document.querySelectorAll('.reveal-on-scroll').forEach((el) => {
			observer.observe(el);
		});

		return undefined;
	});
};

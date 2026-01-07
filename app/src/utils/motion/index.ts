export function animateFadeIn(element: HTMLElement, delay = 0): void {
	element.style.opacity = '0';
	element.style.transition = `opacity 0.5s ease ${delay}s`;

	requestAnimationFrame(() => {
		element.style.opacity = '1';
	});
}

export function animateSlideUp(element: HTMLElement, delay = 0): void {
	element.style.opacity = '0';
	element.style.transform = 'translateY(24px)';
	element.style.transition = `opacity 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) ${delay}s, transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) ${delay}s`;

	requestAnimationFrame(() => {
		element.style.opacity = '1';
		element.style.transform = 'translateY(0)';
	});
}

export function animateScaleIn(element: HTMLElement, delay = 0): void {
	element.style.opacity = '0';
	element.style.transform = 'scale(0.95)';
	element.style.transition = `opacity 0.4s ease ${delay}s, transform 0.4s ease ${delay}s`;

	requestAnimationFrame(() => {
		element.style.opacity = '1';
		element.style.transform = 'scale(1)';
	});
}

export function animateStagger(
	elements: HTMLElement[],
	staggerDelay = 0.05
): void {
	elements.forEach((el, i) => {
		animateSlideUp(el, i * staggerDelay);
	});
}

export function applyHoverGlow(element: HTMLElement): void {
	element.style.transition = 'box-shadow 0.3s ease';

	element.addEventListener('mouseenter', () => {
		element.style.boxShadow = '0 0 30px rgba(77, 178, 255, 0.15)';
	});

	element.addEventListener('mouseleave', () => {
		element.style.boxShadow = 'none';
	});
}

export function initMotionScrollReveal(): void {
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					const el = entry.target as HTMLElement;
					animateSlideUp(el);
					observer.unobserve(el);
				}
			});
		},
		{
			threshold: 0.1,
			rootMargin: '0px 0px -50px 0px',
		}
	);

	document.querySelectorAll('.motion-reveal').forEach((el) => {
		(el as HTMLElement).style.opacity = '0';
		observer.observe(el);
	});
}

export function animateDropdownOpen(element: HTMLElement): void {
	element.style.display = 'block';
	element.style.opacity = '0';
	element.style.transform = 'translateY(-8px) scale(0.95)';
	element.style.transition =
		'opacity 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';

	requestAnimationFrame(() => {
		element.style.opacity = '1';
		element.style.transform = 'translateY(0) scale(1)';
	});
}

export function animateDropdownClose(element: HTMLElement): Promise<void> {
	return new Promise((resolve) => {
		element.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
		element.style.opacity = '0';
		element.style.transform = 'translateY(-8px) scale(0.95)';

		setTimeout(() => {
			element.style.display = 'none';
			resolve();
		}, 150);
	});
}

export function animateStaggerChildren(
	container: HTMLElement,
	selector: string,
	delay = 0.03
): void {
	const items = container.querySelectorAll(selector);
	items.forEach((item, i) => {
		const el = item as HTMLElement;
		el.style.opacity = '0';
		el.style.transform = 'translateX(-10px)';
		el.style.transition = `opacity 0.2s ease ${i * delay}s, transform 0.2s ease ${i * delay}s`;

		requestAnimationFrame(() => {
			el.style.opacity = '1';
			el.style.transform = 'translateX(0)';
		});
	});
}

export function applyHoverTranslate(
	element: HTMLElement,
	translateX = 4
): void {
	element.style.transition = 'transform 0.15s ease';

	element.addEventListener('mouseenter', () => {
		element.style.transform = `translateX(${translateX}px)`;
	});

	element.addEventListener('mouseleave', () => {
		element.style.transform = 'translateX(0)';
	});
}

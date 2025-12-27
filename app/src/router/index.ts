import {
	createRouter,
	createWebHistory,
	installRouter,
	type RouteRecord,
} from '@effuse/router';
import { HomePage } from '../pages/Home';
import { FormDemoPage } from '../pages/Form';
import { TodosPage } from '../pages/Todos';
import { PropsPage } from '../pages/Props';
import { DocsPage } from '../pages/Docs';
import { TermsPage } from '../pages/Terms';
import { DisclaimerPage } from '../pages/Disclaimer';
import { PrivacyPage } from '../pages/Privacy';
import { ContactPage } from '../pages/Contact';
import { NotFoundPage } from '../pages/NotFound';
import { I18nPage } from '../pages/I18n';
import { AboutPage } from '../pages/About';
import { EmitDemoPage } from '../pages/Emit';

const routes: RouteRecord[] = [
	{
		path: '/',
		name: 'home',
		component: HomePage,
	},
	{
		path: '/terms',
		name: 'terms',
		component: TermsPage,
	},
	{
		path: '/privacy',
		name: 'privacy',
		component: PrivacyPage,
	},
	{
		path: '/contact',
		name: 'contact',
		component: ContactPage,
	},
	{
		path: '/disclaimer',
		name: 'disclaimer',
		component: DisclaimerPage,
	},
	{
		path: '/docs',
		name: 'docs',
		component: DocsPage,
	},
	{
		path: '/docs/:slug',
		name: 'docs-page',
		component: DocsPage,
	},
	{
		path: '/form',
		name: 'form-demo',
		component: FormDemoPage,
	},
	{
		path: '/about',
		name: 'about',
		component: AboutPage,
	},
	{
		path: '/todos',
		name: 'todos',
		component: TodosPage,
	},
	{
		path: '/props',
		name: 'props',
		component: PropsPage,
	},
	{
		path: '/i18n',
		name: 'i18n',
		component: I18nPage,
	},
	{
		path: '/emit',
		name: 'emit-demo',
		component: EmitDemoPage,
	},
	{
		path: '*',
		name: 'not-found',
		component: NotFoundPage,
	},
];

export const router = createRouter({
	history: createWebHistory(),
	routes,
});

export { installRouter };

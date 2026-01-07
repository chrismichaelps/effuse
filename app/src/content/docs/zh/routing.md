---
title: 路由管理
---

# 路由管理

Effuse Router 提供类型安全的声明式路由。

## 设置

```typescript
import {
	createRouter,
	createWebHistory,
	installRouter,
	type RouteRecord,
} from '@effuse/router';
import { HomePage } from './pages/Home';
import { DocsPage } from './pages/Docs';
import { ContactPage } from './pages/Contact';

const routes: RouteRecord[] = [
	{ path: '/', name: 'home', component: HomePage },
	{ path: '/docs/:slug', name: 'docs', component: DocsPage },
	{ path: '/contact', name: 'contact', component: ContactPage },
];

export const router = createRouter({
	history: createWebHistory(),
	routes,
});

// 在创建应用之前安装路由
installRouter(router);
```

## 使用 Link 导航

使用 `Link` 组件进行导航：

```tsx
import { define } from '@effuse/core';
import { Link } from '@effuse/router';

const Nav = define({
	script: () => ({}),
	template: () => (
		<nav>
			<Link to="/">Home</Link>
			<Link to="/docs/getting-started">Docs</Link>
			<Link to="/contact">Contact</Link>
		</nav>
	),
});
```

## RouterView

使用 `RouterView` 渲染匹配的组件：

```tsx
import { define } from '@effuse/core';
import { RouterView } from '@effuse/router';

const App = define({
	script: () => ({}),
	template: () => (
		<div class="app">
			<header>...</header>
			<main>
				<RouterView />
			</main>
			<footer>...</footer>
		</div>
	),
});
```

## 动态路由参数

使用 `useRoute` 钩子访问路由参数、查询字符串和哈希。首先，定义带有动态段的路由：

```typescript
const routes: RouteRecord[] = [
	{
		path: '/user/:userId',
		name: 'user-profile',
		component: UserProfile,
	},
];
```

在组件中访问参数：

```tsx
import { define } from '@effuse/core';
import { useRoute } from '@effuse/router';

const UserProfile = define({
	script: () => {
		const route = useRoute();

		return {
			userId: route.params.userId, // 匹配路径中的 :userId
			search: route.query.q, // 访问 URL 中的 ?q=...
		};
	},
	template: ({ userId, search }) => (
		<div class="user-profile">
			<h1>User Profile</h1>
			<p>User ID: {userId}</p>
			{search && <p>Searching for: {search}</p>}
		</div>
	),
});
```

## 编程式导航

使用 `useRouter` 钩子进行编程式导航：

```tsx
import { define } from '@effuse/core';
import { useRouter } from '@effuse/router';

const DashboardButton = define({
	script: () => {
		const router = useRouter();

		return {
			goToSettings: () => {
				router.push('/settings');
			},
		};
	},
	template: ({ goToSettings }) => (
		<button onClick={goToSettings}>Go to Settings</button>
	),
});
```

## 路由组合式函数

### `useRoute()`

返回当前路由对象。包含在导航发生时更新的响应式属性。

| 属性       | 类型                      | 描述                             |
| :--------- | :------------------------ | :------------------------------- |
| `path`     | `string`                  | 路由的路径名。                   |
| `fullPath` | `string`                  | 包含查询和哈希的完整 URL。       |
| `params`   | `Record<string, string>`  | 动态段的键值对。                 |
| `query`    | `Record<string, string>`  | 查询字符串的键值对。             |
| `hash`     | `string`                  | URL 哈希片段。                   |
| `matched`  | `NormalizedRouteRecord[]` | 用于嵌套路由的匹配路由记录数组。 |
| `name`     | `string or undefined`     | 路由记录的名称。                 |
| `meta`     | `Record<string, any>`     | 在路由或其父级上定义的元数据。   |

### `useRouter()`

返回用于编程控制的路由器实例。

| 成员            | 签名 / 类型                                         | 描述                                 |
| :-------------- | :-------------------------------------------------- | :----------------------------------- |
| `currentRoute`  | `Signal<Route>`                                     | 当前路由的响应式信号。               |
| `routes`        | `NormalizedRouteRecord[]`                           | 所有注册路由的只读数组。             |
| `isReady`       | `boolean`                                           | 路由器是否已完成初始化。             |
| `push`          | `(to: RouteLocation) => void`                       | 导航到新 URL，向历史记录添加新条目。 |
| `replace`       | `(to: RouteLocation) => void`                       | 通过替换当前条目导航到新 URL。       |
| `back`          | `() => void`                                        | 在历史记录中后退一步。               |
| `forward`       | `() => void`                                        | 在历史记录中前进一步。               |
| `go`            | `(delta: number) => void`                           | 后退或前进 n 步。                    |
| `beforeEach`    | `(guard: NavigationGuard) => () => void`            | 添加全局导航守卫。返回注销函数。     |
| `beforeResolve` | `(guard: NavigationGuard) => () => void`            | 添加导航解析前调用的守卫。           |
| `afterEach`     | `(hook: NavigationHook) => () => void`              | 添加导航后调用的全局钩子。           |
| `resolve`       | `(to: RouteLocation) => ResolvedRoute`              | 将路由位置解析为规范化的路由对象。   |
| `hasRoute`      | `(name: string) => boolean`                         | 检查是否存在具有给定名称的路由。     |
| `addRoute`      | `(route: RouteRecord, parentName?: string) => void` | 动态添加新路由。                     |
| `removeRoute`   | `(name: string) => void`                            | 按名称动态删除路由。                 |
| `getRoutes`     | `() => NormalizedRouteRecord[]`                     | 返回所有规范化的路由记录。           |

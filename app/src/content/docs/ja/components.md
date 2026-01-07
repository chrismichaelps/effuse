---
title: コンポーネント
---

# コンポーネント

Effuse のコンポーネントは、ロジックと UI を型安全な構造で組み合わせます。

## 基本構造

すべてのコンポーネントには `script` と `template` があります：

```tsx
import { define } from '@effuse/core';

const Greeting = define({
	script: () => {
		return { message: 'Hello, World!' };
	},
	template: ({ message }) => <h1>{message}</h1>,
});
```

## Props

コンポーネントは親から props を受け取ります。型安全性のためにジェネリクスを使用します：

```tsx
import { define, computed, unref, type Signal } from '@effuse/core';

interface ButtonProps {
	label: string;
	variant?: 'primary' | 'secondary';
	onClick?: () => void;
}

const Button = define<ButtonProps>({
	script: ({ props }) => ({
		label: props.label,
		variant: computed(() => unref(props.variant) ?? 'primary'),
		onClick: props.onClick,
	}),
	template: ({ label, variant, onClick }) => (
		<button class={`btn btn-${variant.value}`} onClick={onClick}>
			{label}
		</button>
	),
});

// 使用方法
<Button label="Click me" variant="primary" onClick={handleClick} />;
```

## ライフサイクルフック

コンポーネントはスクリプトコンテキストを通じてライフサイクルフックにアクセスできます：

```tsx
import { define, signal } from '@effuse/core';

const Timer = define({
	script: ({ onMount }) => {
		const seconds = signal(0);

		onMount(() => {
			const interval = setInterval(() => {
				seconds.value++;
			}, 1000);

			// クリーンアップ関数を返す
			return () => clearInterval(interval);
		});

		return { seconds };
	},
	template: ({ seconds }) => <p>Timer: {seconds} seconds</p>,
});
```

## 安定した参照のための useCallback

安定した参照が必要なイベントハンドラには、スクリプトコンテキストの `useCallback` を使用します：

```tsx
import { define, signal } from '@effuse/core';

const Form = define({
	script: ({ useCallback }) => {
		const inputValue = signal('');

		// イベントハンドラの安定した参照
		const handleInputChange = useCallback((e: Event) => {
			inputValue.value = (e.target as HTMLInputElement).value;
		});

		const handleSubmit = useCallback(() => {
			console.log('Submitted:', inputValue.value);
			inputValue.value = '';
		});

		return { inputValue, handleInputChange, handleSubmit };
	},
	template: ({ inputValue, handleInputChange, handleSubmit }) => (
		<div>
			<input value={inputValue} onInput={handleInputChange} />
			<button onClick={handleSubmit}>Submit</button>
		</div>
	),
});
```

## 子要素

ラッパーコンポーネントを作成するために子要素を渡します：

```tsx
import { define } from '@effuse/core';

const Card = define({
	script: () => ({}),
	template: ({ children }) => <div class="card">{children}</div>,
});

// 使用方法
<Card>
	<h2>Title</h2>
	<p>Content goes here</p>
</Card>;
```

## For によるリストレンダリング

効率的なリストレンダリングには `For` コンポーネントを使用します：

```tsx
import { define, signal, For } from '@effuse/core';

const TodoList = define({
	script: () => {
		const todos = signal([
			{ id: 1, text: 'Learn Effuse' },
			{ id: 2, text: 'Build an app' },
		]);

		return { todos };
	},
	template: ({ todos }) => (
		<ul>
			<For each={todos} keyExtractor={(t) => t.id}>
				{(todoSignal) => <li>{todoSignal.value.text}</li>}
			</For>
		</ul>
	),
});
```

### For の Props

| Prop           | 型                                             | 説明                                     |
| -------------- | ---------------------------------------------- | ---------------------------------------- |
| `each`         | `Signal<T[]>`                                  | イテレートする配列を含むシグナル         |
| `keyExtractor` | `(item: T, index: number) => string or number` | ユニークなキーを抽出する関数             |
| `fallback`     | `JSX.Element`                                  | 配列が空の時に表示する要素（オプション） |

## Show による条件付きレンダリング

シグナル値に基づく条件付きレンダリングには `Show` コンポーネントを使用します：

```tsx
import { define, signal, Show } from '@effuse/core';

const UserProfile = define({
	script: () => {
		const user = signal<{ name: string } | null>(null);
		const login = () => {
			user.value = { name: '太郎' };
		};
		const logout = () => {
			user.value = null;
		};

		return { user, login, logout };
	},
	template: ({ user, login, logout }) => (
		<div>
			<Show when={user} fallback={<button onClick={login}>ログイン</button>}>
				{(u) => (
					<div>
						<p>ようこそ、{u.name}さん！</p>
						<button onClick={logout}>ログアウト</button>
					</div>
				)}
			</Show>
		</div>
	),
});
```

### Show の Props

| Prop       | 型                           | 説明                         |
| ---------- | ---------------------------- | ---------------------------- |
| `when`     | `Signal<T>` または `() => T` | 評価する条件                 |
| `fallback` | `JSX.Element`                | 条件が偽の時に表示する要素   |
| `children` | `(value: T) => JSX.Element`  | 真の値を受け取るレンダー関数 |

## Dynamic コンポーネント

`Dynamic` コンポーネントを使用すると、シグナルに基づいて異なるコンポーネントを動的にレンダリングできます：

```tsx
import { define, signal, Dynamic } from '@effuse/core';

const TabPanel = define({
	script: () => {
		const tabs = { home: HomeTab, settings: SettingsTab, profile: ProfileTab };
		const activeTab = signal<keyof typeof tabs>('home');

		const currentComponent = computed(() => tabs[activeTab.value]);

		return { activeTab, currentComponent };
	},
	template: ({ activeTab, currentComponent }) => (
		<div>
			<nav>
				<button
					onClick={() => {
						activeTab.value = 'home';
					}}
				>
					ホーム
				</button>
				<button
					onClick={() => {
						activeTab.value = 'settings';
					}}
				>
					設定
				</button>
				<button
					onClick={() => {
						activeTab.value = 'profile';
					}}
				>
					プロフィール
				</button>
			</nav>
			<Dynamic component={currentComponent} fallback={<p>読み込み中...</p>} />
		</div>
	),
});
```

### Dynamic の Props

| Prop        | 型                                           | 説明                                           |
| ----------- | -------------------------------------------- | ---------------------------------------------- |
| `component` | `Signal<Component>` または `() => Component` | 動的にレンダリングするコンポーネント           |
| `props`     | `P`                                          | レンダリングされるコンポーネントに渡す Props   |
| `fallback`  | `JSX.Element`                                | コンポーネントが null の時に表示する要素       |
| `portals`   | `Portals`                                    | レンダリングされるコンポーネントのポータル設定 |

## 動的スタイリング

動的なスタイルとクラスにはリアクティブ関数を使用します：

```tsx
import { define, signal, computed } from '@effuse/core';

const ColorBox = define({
	script: () => {
		const colors = ['mint', 'purple', 'cyan'];
		const index = signal(0);
		const currentColor = computed(() => colors[index.value]);
		const nextColor = () => {
			index.value = (index.value + 1) % colors.length;
		};

		return { currentColor, nextColor };
	},
	template: ({ currentColor, nextColor }) => (
		<div>
			<button onClick={nextColor}>色を変更</button>
			<div
				style={() => ({
					backgroundColor: `var(--accent-${currentColor.value})`,
					padding: '2rem',
					transition: 'background-color 0.3s ease',
				})}
			>
				現在: {currentColor.value}
			</div>
		</div>
	),
});
```

### 動的クラス

```tsx
<div class={() => `card ${isActive.value ? 'active' : ''}`}>コンテンツ</div>
```

## Repeat コンポーネント

`Repeat` コンポーネントは、現在のインデックスにアクセスしながら、指定された回数コンテンツをレンダリングします：

```tsx
import { define, signal, Repeat } from '@effuse/core';

const SkeletonLoader = define({
	script: () => {
		const count = signal(3);
		return { count };
	},
	template: ({ count }) => (
		<div class="skeleton-list">
			<Repeat times={count} fallback={<p>アイテムがありません</p>}>
				{(index) => (
					<div class="skeleton-item">
						<div class="skeleton-avatar" />
						<div class="skeleton-content">
							<div class="skeleton-title" />
							<div class="skeleton-text" />
						</div>
						<span>アイテム {index + 1}</span>
					</div>
				)}
			</Repeat>
		</div>
	),
});
```

### Repeat Props

| Prop       | 型                               | 説明                                              |
| ---------- | -------------------------------- | ------------------------------------------------- |
| `times`    | `number` または `Signal<number>` | コンテンツを繰り返す回数                          |
| `children` | `(index: number) => Element`     | 現在のインデックスを受け取るレンダリング関数      |
| `fallback` | `JSX.Element`                    | カウントが0の場合にレンダリングするオプション要素 |

## Await コンポーネント

`Await` コンポーネントは、保留中、成功、エラーの状態を組み込みで処理する非同期データ取得を処理します：

```tsx
import { define, signal, Await } from '@effuse/core';

interface User {
	id: number;
	name: string;
	email: string;
}

const UserProfile = define({
	script: () => {
		const fetchUser = (id: number): Promise<User> =>
			fetch(`https://api.example.com/users/${id}`).then((res) => res.json());

		const userPromise = signal(fetchUser(1));

		const refetch = () => {
			userPromise.value = fetchUser(Math.floor(Math.random() * 10) + 1);
		};

		return { userPromise, refetch };
	},
	template: ({ userPromise, refetch }) => (
		<div>
			<button onClick={refetch}>新しいユーザーを取得</button>
			<Await
				promise={userPromise}
				pending={
					<div class="loading">
						<span class="spinner" />
						ユーザーデータを読み込み中...
					</div>
				}
				error={(err) => (
					<div class="error">
						<p>ユーザーの読み込みに失敗しました</p>
						<p class="error-detail">{String(err)}</p>
					</div>
				)}
			>
				{(user) => (
					<div class="user-card">
						<h3>{user.name}</h3>
						<p>{user.email}</p>
						<span>ID: {user.id}</span>
					</div>
				)}
			</Await>
		</div>
	),
});
```

### Await Props

| Prop       | 型                                                                 | 説明                                          |
| ---------- | ------------------------------------------------------------------ | --------------------------------------------- |
| `promise`  | `Promise<T>` または `() => Promise<T>` または `Signal<Promise<T>>` | 待機するPromise                               |
| `pending`  | `JSX.Element` または `() => JSX.Element`                           | Promiseが保留中の間にレンダリングする要素     |
| `error`    | `JSX.Element` または `(err: unknown) => JSX.Element`               | Promiseが拒否された場合にレンダリングする要素 |
| `children` | `(data: T) => JSX.Element`                                         | 成功時のレンダリング関数                      |

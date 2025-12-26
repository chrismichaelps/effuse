---
title: エフェクト
---

# Effects API

Effuse は副作用を処理し、状態変更を監視するための特定の関数を提供します。

## 1. effect

`effect` 関数は即座に実行され、追跡されたシグナルが変更されるたびに再実行されます。

```tsx
import { define, signal, effect } from '@effuse/core';

const DataFetcher = define({
	script: () => {
		const userId = signal(1);
		const userData = signal<any>(null);

		// 'userId' が変更されると自動的に実行
		effect(() => {
			fetch(`/api/users/${userId.value}`)
				.then((res) => res.json())
				.then((data) => {
					userData.value = data;
				});
		});

		return { userId, userData };
	},
	template: ({ userId, userData }) => (
		<div>
			<button onClick={() => userId.value++}>Next User</button>
			<pre>{JSON.stringify(userData.value, null, 2)}</pre>
		</div>
	),
});
```

## 2. Effect によるデータ同期

外部データをストア状態と同期する一般的なパターン：

```tsx
import { define, signal, effect } from '@effuse/core';
import { useInfiniteQuery } from '@effuse/query';
import { todosStore } from '../store/todosStore';

const TodosPage = define({
  script: () => {
    const todosQuery = useInfiniteQuery({
      queryKey: ['todos'],
      queryFn: async ({ pageParam }) => {
        const res = await fetch(`/api/todos?page=${pageParam}`);
        return res.json();
      },
      initialPageParam: 1,
    });

    const syncedPageCount = signal(0);

    // サーバーデータをストアに同期
    effect(() => {
      const pages = todosQuery.allPagesData.value;
      if (pages && pages.length > syncedPageCount.value) {
        if (syncedPageCount.value === 0) {
          todosStore.setTodos(pages.flat());
        } else {
          const newTodos = pages.slice(syncedPageCount.value).flat();
          todosStore.appendTodos(newTodos);
        }
        syncedPageCount.value = pages.length;
      }
    });

    return { todosQuery };
  },
  template: ...
});
```

## 3. watch

スクリプトコンテキストの `watch` 関数は特定のシグナルを監視し、変更時にコールバックをトリガーします：

```tsx
import { define, signal } from '@effuse/core';

const Logger = define({
	script: ({ watch }) => {
		const count = signal(0);

		// count が更新されたときのみログ
		watch(count, (newVal) => {
			console.log(`Count changed to: ${newVal}`);
		});

		return { count, increment: () => count.value++ };
	},
	template: ({ count, increment }) => (
		<button onClick={increment}>{count}</button>
	),
});
```

## 4. 副作用のための onMount

コンポーネントのマウント時に一度だけ実行される効果には `onMount` を使用します：

```tsx
import { define } from '@effuse/core';

const Analytics = define({
	script: ({ onMount }) => {
		onMount(() => {
			console.log('Component mounted');

			// クリーンアップ関数を返す
			return () => {
				console.log('Component unmounted');
			};
		});

		return {};
	},
	template: () => <div>Tracked Component</div>,
});
```

## ベストプラクティス

1. **リアクティブな副作用には effect を使用** - 依存関係が変更されたときに再実行すべき場合
2. **特定のシグナルには watch を使用** - 一つの値の変更のみを気にする場合
3. **初期化には onMount を使用** - 一度だけ発生すべき場合
4. **クリーンアップ関数を返す** - メモリリークを防ぐため onMount から

---
title: 副作用
---

# Effects API

Effuse 提供特定函数来处理副作用并监视状态更改。

## 1. effect

`effect` 函数立即运行，并在其跟踪的信号更改时重新运行。

```tsx
import { define, signal, effect } from '@effuse/core';

const DataFetcher = define({
	script: () => {
		const userId = signal(1);
		const userData = signal<any>(null);

		// 当 'userId' 更改时自动运行
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

## 2. 使用 Effect 同步数据

将外部数据与 store 状态同步的常见模式：

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

    // 将服务器数据同步到 store
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

脚本上下文中的 `watch` 函数观察特定信号并在更改时触发回调：

```tsx
import { define, signal } from '@effuse/core';

const Logger = define({
	script: ({ watch }) => {
		const count = signal(0);

		// 仅当 count 更新时记录日志
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

## 4. 使用 onMount 处理副作用

对于应该在组件挂载时只运行一次的效果，使用 `onMount`：

```tsx
import { define } from '@effuse/core';

const Analytics = define({
	script: ({ onMount }) => {
		onMount(() => {
			console.log('Component mounted');

			// 返回清理函数
			return () => {
				console.log('Component unmounted');
			};
		});

		return {};
	},
	template: () => <div>Tracked Component</div>,
});
```

## 最佳实践

1. **使用 effect 处理响应式副作用** - 当依赖项更改时应重新运行
2. **使用 watch 处理特定信号** - 当你只关心一个值的更改
3. **使用 onMount 进行初始化** - 只应发生一次的操作
4. **返回清理函数** - 从 onMount 返回以防止内存泄漏

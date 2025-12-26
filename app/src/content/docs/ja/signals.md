---
title: シグナル
---

# シグナル

シグナルは Effuse のリアクティビティシステムの基盤です。`@effuse/core` から直接インポートします。

## シグナルの作成

`@effuse/core` から `signal` をインポートしてリアクティブな状態を作成します：

```tsx
import { define, signal, computed } from '@effuse/core';

export const Counter = define({
	script: () => {
		// 初期値でシグナルを作成
		const count = signal(0);

		// 計算された派生状態を作成
		const doubleCount = computed(() => count.value * 2);

		// シグナルを変更する操作を定義
		const increment = () => count.value++;
		const decrement = () => count.value--;

		// シグナルと操作をテンプレートに返す
		return { count, doubleCount, increment, decrement };
	},
	template: ({ count, doubleCount, increment, decrement }) => (
		<div>
			<p>Count: {count}</p>
			<p>Double: {doubleCount}</p>
			<button onClick={decrement}>-</button>
			<button onClick={increment}>+</button>
		</div>
	),
});
```

## リアクティビティの種類

### 1. 書き込み可能なシグナル

基本の `signal()` は書き込み可能な参照を作成します。`.value` プロパティでアクセスと変更を行います。

```tsx
import { define, signal } from '@effuse/core';

const ColorPicker = define({
	script: () => {
		// プリミティブ
		const color = signal('blue');
		// オブジェクト/配列
		const palette = signal(['red', 'blue', 'green']);

		const updateColor = (newColor: string) => {
			color.value = newColor; // 更新をトリガー
		};

		return { color, palette, updateColor };
	},
	template: ({ color, updateColor }) => (
		<button onClick={() => updateColor('red')}>Current: {color}</button>
	),
});
```

### 2. 計算シグナル

計算シグナルは他のシグナルから値を導出します。依存関係が変更されると自動的に更新されます。

```tsx
import { define, signal, computed } from '@effuse/core';

const GradientBox = define({
	script: () => {
		const startColor = signal('red');
		const endColor = signal('blue');

		// 依存関係を自動的に追跡
		const gradient = computed(
			() => `linear-gradient(${startColor.value}, ${endColor.value})`
		);

		return { gradient };
	},
	template: ({ gradient }) => (
		<div style={`background: ${gradient.value}`}>Gradient</div>
	),
});
```

### 3. シグナルの監視

シグナルが変更されたときに副作用を実行するには、スクリプトコンテキストの `watch` ヘルパーを使用します。

```tsx
import { define, signal } from '@effuse/core';

const Logger = define({
	script: ({ watch }) => {
		const count = signal(0);

		// count が変更されるたびに実行
		watch(count, (value) => {
			console.log(`Count changed to: ${value}`);
		});

		return { count, increment: () => count.value++ };
	},
	template: ({ count, increment }) => (
		<button onClick={increment}>{count}</button>
	),
});
```

## テンプレートでのシグナルの使用

シグナルは JSX で直接使用でき、自動的に DOM を更新します：

```tsx
// 直接補間 - 自動的に更新
<p>Count: {count}</p>

// 関数を使用した動的クラス
<button class={() => isActive.value ? 'active' : 'inactive'}>
  Toggle
</button>

// computed を使用した条件付きレンダリング
{computed(() => isLoading.value ? <Spinner /> : <Content />)}
```

## ベストプラクティス

1. **直接インポート**: `signal` と `computed` を `@effuse/core` から直接インポート
2. **シグナルを公開**: `script` から値だけでなくシグナルオブジェクト自体を返す
3. **ハンドラで変更**: 状態変更ロジックは関数ハンドラ内に保持
4. **Computed を使用**: 手動同期より派生状態を優先

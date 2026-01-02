---
title: シグナル
---

# シグナル

シグナルはEffuseのリアクティビティシステムの基盤です。`@effuse/core` から直接インポートします。

## シグナルの作成

`@effuse/core` から `signal` をインポートしてリアクティブな状態を作成します：

```tsx
import { define, signal, computed } from '@effuse/core';

export const Counter = define({
	script: () => {
		// 初期値でシグナルを作成
		const count = signal(0);

		// computed で派生状態を作成
		const doubleCount = computed(() => count.value * 2);

		// シグナルを変更する操作を定義
		const increment = () => count.value++;
		const decrement = () => count.value--;

		// シグナルと操作をテンプレートに返す
		return { count, doubleCount, increment, decrement };
	},
	template: ({ count, doubleCount, increment, decrement }) => (
		<div>
			<p>カウント: {count}</p>
			<p>2倍: {doubleCount}</p>
			<button onClick={decrement}>-</button>
			<button onClick={increment}>+</button>
		</div>
	),
});
```

## リアクティビティの種類

### 1. 書き込み可能なシグナル

基本的な `signal()` は書き込み可能な参照を作成します。`.value` プロパティを通じてアクセスと変更を行います。

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
		<button onClick={() => updateColor('red')}>現在: {color}</button>
	),
});
```

### 2. Computedシグナル

Computedシグナルは他のシグナルから値を派生します。依存関係が変わると自動的に更新されます。

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
		<div style={`background: ${gradient.value}`}>グラデーション</div>
	),
});
```

### 3. シグナルの監視

scriptコンテキストの `watch` ヘルパーを使用して、シグナルが変更されたときに副作用を実行します。

```tsx
import { define, signal } from '@effuse/core';

const Logger = define({
	script: ({ watch }) => {
		const count = signal(0);

		// count が変更されるたびに実行
		watch(count, (value) => {
			console.log(`Count が変更されました: ${value}`);
		});

		return { count, increment: () => count.value++ };
	},
	template: ({ count, increment }) => (
		<button onClick={increment}>{count}</button>
	),
});
```

## テンプレートでのシグナルの使用

シグナルはJSXで直接使用できます - DOMを自動的に更新します：

```tsx
// 直接補間 - 自動的に更新
<p>カウント: {count}</p>

// 関数による動的クラス
<button class={() => isActive.value ? 'active' : 'inactive'}>
  トグル
</button>

// computedによる条件付きレンダリング
{computed(() => isLoading.value ? <Spinner /> : <Content />)}
```

## ベストプラクティス

1. **直接インポート**: `signal` と `computed` を `@effuse/core` から直接インポート
2. **シグナルを公開**: `script` から値だけでなくシグナルオブジェクト自体を返す
3. **ハンドラ内で変更**: 状態の変更ロジックは関数ハンドラ内に保持
4. **必要に応じてComputedを使用**: 手動同期より派生状態を優先

## コンパイラの最適化

Effuseコンパイラは多くのリアクティビティシナリオを自動的に処理します：

### テンプレートでの自動ラッピング

テンプレートで式を使用すると、コンパイラは自動的にそれらをcomputedシグナルでラップします。すべての派生値を手動でラップする必要はありません：

```tsx
// コンパイラがこれを自動的に処理
template: ({ firstName, lastName }) => (
  <p>フルネーム: {firstName} {lastName}</p>
)

// シンプルなケースでは明示的な computed() は不要
// コンパイラがバインディングを最適化
```

### 明示的な `computed()` を使用するタイミング

明示的な `computed()` を使用する場合：

1. **複雑な派生状態** - ロジックと組み合わせた複数のシグナル
2. **scriptから返す場合** - 複数のコンシューマーに公開される値
3. **パフォーマンス最適化** - 高コストな計算をキャッシュ

```tsx
script: () => {
  const items = signal<Item[]>([]);
  const filter = signal('all');

  // テンプレートに返す複雑なロジック用の明示的なcomputed
  const filteredItems = computed(() => {
    const f = filter.value;
    return items.value.filter(item =>
      f === 'all' ? true : item.status === f
    );
  });

  return { filteredItems, filter };
}
```

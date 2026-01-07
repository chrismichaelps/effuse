---
title: エラーハンドリング
---

# エラーハンドリング

Effuse は、**Tagged Errors**（タグ付きエラー）を使用した、強力なエラーハンドリングシステムを提供します。このシステムにより、アプリケーション全体で型安全かつ判別可能なエラー処理を実現します。

## TaggedError

`TaggedError` は、`_tag` プロパティを含む特殊なクラスです。これにより、クリーンで網羅的なパターンマッチングが可能になり、シリアライズ後もエラーの同一性が保たれます。

### 定義

```typescript
import { TaggedError } from '@effuse/core';

export class NetworkError extends TaggedError('NetworkError')<{
	readonly url: string;
	readonly status: number;
	readonly message: string;
}> {}
```

### 使い方

エラーがスローされた際、キャッチしたエラーに対して型ガード（Type Guards）を使用することで、特定のエラー型に絞り込むことができます。

```typescript
import { isTaggedError, hasTag } from '@effuse/core';

try {
	// ... エラーが発生する可能性のあるコード
} catch (error) {
	if (hasTag(error, 'NetworkError')) {
		// TypeScript は error が NetworkError であることを認識します
		console.error(`ステータス ${error.status}: ${error.message}`);
	} else if (isTaggedError(error)) {
		// その他のタグ付きエラー
		console.error(`タグ付きエラー: ${error._tag}`);
	}
}
```

## 型ガード

Effuse は、タグ付きエラーを操作するための 2 つの主要なユーティリティをエクスポートしています：

### `isTaggedError(value)`

値が `string` 型の `_tag` プロパティを持つ `Error` オブジェクトである場合に `true` を返します。

### `hasTag(value, tag)`

値が指定された特定のタグを持つ `TaggedError` である場合に `true` を返します。これは、`catch` ブロック内でエラーを絞り込むための最も一般的な方法です。

## なぜタグ付きエラーを使用するのか？

1. **型安全性**: `if` や `switch` ブロック内でのエラープロパティの自動絞り込み。
2. **シリアライゼーション**: 標準的な JS の `instanceof` は `JSON.parse()` 後に失敗しますが、`_tag` はただの文字列なのでシリアライズ後も保持されます。
3. **開発者体験**: 関数が返す可能性のあるエラーの「契約」を明確に定義できます。

---
title: イベントエミッション (useEmits)
---

# イベントエミッション (useEmits)

Effuseは、`useEmits`フックを通じて強力で型安全なイベントエミッションシステムを提供します。これにより、コンポーネントはEffuseの信号（シグナル）システムとの完全なリアクティビティを維持しながら、イベントを介して通信できます。

## コアコンセプト

エミットシステムは、主に次の3つの概念に基づいています。

1. **型安全なイベント**: TypeScriptの完全な推論のために、インターフェースでイベントの種類を定義します。
2. **リアクティブな信号**: 発行されたすべてのイベントは、UIバインディングのためにリアクティブな信号にも保存されます。
3. **購読パターン**: 自動クリーンアップ機能を使用して、イベントの購読と購読解除を行います。

## 基本的な使い方

### イベント型の定義

まず、イベントを記述するインターフェースを定義します。

```typescript
interface ChatEvents {
  message: { text: string; author: string; timestamp: number };
  userJoined: { userId: string; name: string };
  userLeft: { userId: string };
}
```

### エミッターの作成

`useEmits`フックを使用して、型付きイベントエミッターを作成します。

```typescript
import { define, useEmits } from '@effuse/core';

const ChatRoom = define({
  script: () => {
    const { emit, on, off, context } = useEmits<ChatEvents>({
      // オプション: 初期ハンドラーを登録する
      message: (msg) => console.log('新しいメッセージ:', msg.text),
    });

    // イベントを発行する
    const sendMessage = (text: string) => {
      emit('message', {
        text,
        author: 'ユーザー',
        timestamp: Date.now(),
      });
    };

    return { sendMessage };
  },
  template: ({ sendMessage }) => (
    <button onClick={() => sendMessage('こんにちは！')}>送信</button>
  ),
});
```

## APIリファレンス

### useEmits<T>

購読機能を備えた型付きイベントエミッターを作成します。

```typescript
function useEmits<T extends EventMap>(
  initialHandlers?: Partial<{ [K in keyof T]: EmitHandler<T[K]> }>
): {
  emit: EmitFn<T>;
  emitAsync: EmitFnAsync<T>;
  on: SubscribeFn<T>;
  off: (event: K, handler: EmitHandler<T[K]>) => void;
  context: EmitContextData<T>;
}
```

#### 戻り値

| プロパティ  | 型                             | 説明                                           |
| ----------- | ------------------------------ | ---------------------------------------------- |
| `emit`      | `EmitFn<T>`                    | ペイロードを付けてイベントを同期的に発行します |
| `emitAsync` | `EmitFnAsync<T>`               | イベントを非同期的に発行します（次のマイクロタスク） |
| `on`        | `SubscribeFn<T>`               | イベントを購読し、購読解除関数を返します       |
| `off`       | `(event, handler) => void`     | ハンドラーを手動で購読解除します               |
| `context`   | `EmitContextData<T>`           | `useEventSignal`で使用する内部コンテキスト    |

### useEventSignal<T, P>

特定のイベントが発行されるたびに更新されるリアクティブな信号を作成します。

```typescript
function useEventSignal<T extends EventMap, P>(
  ctx: EmitContextData<T>,
  event: string,
  options?: EmitOptions
): EventSignal<P>
```

#### オプション

| オプション | 型                            | 説明                                          |
| ---------- | ----------------------------- | --------------------------------------------- |
| `debounce` | `number`                      | 指定されたミリ秒だけ更新を遅らせます          |
| `throttle` | `number`                      | 更新を一定の間隔ごとに1回に制限します         |
| `once`     | `boolean`                     | 1回だけ更新し、その後停止します               |
| `filter`   | `(payload: unknown) => bool`  | 条件式が真を返す場合のみ更新します            |

#### 例

```typescript
const { emit, context } = useEmits<ChatEvents>();

// 最新のメッセージのためのリアクティブな信号を作成
const lastMessage = useEventSignal<ChatEvents, ChatEvents['message']>(
  context,
  'message',
  { debounce: 100 }
);

// テンプレートで使用 - 自動的に更新されます！
<p>最新: {lastMessage.value?.text}</p>
```

## イベント修飾子

Effuseは、イベントの処理方法を制御するためのユーティリティ関数を提供します。

### createDebounce

一定期間の無操作状態が続くまでコールバックの実行を遅らせます。

```typescript
import { createDebounce } from '@effuse/core';

const debounce = createDebounce<string>(300); // 300ミリ秒の遅延

debounce.apply('検索ワード', (value) => {
  performSearch(value);
});

// 保留中の実行をキャンセルする
debounce.cancel();
```

### createThrottle

コールバックの実行を一定の間隔ごとに1回に制限します。

```typescript
import { createThrottle } from '@effuse/core';

const throttle = createThrottle<MouseEvent>(100); // 最大100ミリ秒に1回

document.addEventListener('mousemove', (e) => {
  throttle.apply(e, (event) => {
    updatePosition(event.clientX, event.clientY);
  });
});

// スロットル状態をリセットする
throttle.reset();
```

### createOnce

コールバックが1回だけ実行されるようにします。

```typescript
import { createOnce } from '@effuse/core';

const once = createOnce<void>();

button.addEventListener('click', () => {
  once.apply(undefined, () => {
    initializeApp();
  });
});

// すでに実行されたか確認する
console.log(once.hasFired()); // 初回クリック後は true

// 再度実行できるようにリセットする
once.reset();
```

### createFilter

条件式に基づいてイベントを条件付きで処理します。

```typescript
import { createFilter } from '@effuse/core';

const filter = createFilter<number>((n) => n > 10);

filter.apply(5, (n) => console.log(n));   // スキップされる
filter.apply(15, (n) => console.log(n));  // ログ出力: 15
```

## サービスAPI

高度なユースケースでは、基盤となるエミットサービスにアクセスできます。

```typescript
import { getEmitService } from '@effuse/core';

const service = getEmitService();

// 独立したコンテキストを作成する
const ctx = service.createContext<MyEvents>();

// ハンドラーを登録する
const unsubscribe = service.registerHandler(ctx, 'eventName', handler);

// イベントを発行する
service.emit(ctx, 'eventName', payload);

// イベントのリアクティブな信号を取得する
const signal = service.getSignal(ctx, 'eventName');
```

## 型定義

```typescript
// 基本イベントマップの制約
type EventMap = Record<string, any>;

// ハンドラー関数の型
type EmitHandler<P> = (payload: P) => void;

// エミット関数の型
type EmitFn<T extends EventMap> = <K extends keyof T & string>(
  event: K,
  payload: T[K]
) => void;

// 非同期エミット関数の型
type EmitFnAsync<T extends EventMap> = <K extends keyof T & string>(
  event: K,
  payload: T[K]
) => Promise<void>;

// 購読関数の型
type SubscribeFn<T extends EventMap> = <K extends keyof T & string>(
  event: K,
  handler: EmitHandler<T[K]>
) => () => void;

// イベント信号 (読み取り専用)
type EventSignal<P> = ReadonlySignal<P | undefined>;
```

## ベストプラクティス

1. **最初に型を定義する**: 常にイベントのインターフェースを作成してください。
2. **購読解除関数を使用する**: クリーンアップ時に `on()` から返された関数を保存して呼び出してください。
3. **リアクティブな信号を優先する**: エフェクト内で購読する代わりに、UIバインディングには `useEventSignal` を使用してください。
4. **修飾子を適用する**: マウスの移動や入力などの高頻度イベントには、デバウンス/スロットルを使用してください。
5. **関連するイベントをバッチ処理する**: パフォーマンスのために、複数の同期的なエミットは自動的にバッチ処理されます。

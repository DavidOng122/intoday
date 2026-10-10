# IntoDay

**Capture first. Organize later.**

リサーチ中のリンク、メモ、画像、ファイルをすばやく保存し、Canvas 上で整理して再利用するデスクトップ向けワークスペースです。

[プロダクトサイト](https://www.intoday.cc/) · [Web アプリ](https://app.intoday.cc/) · [Demo](https://intoday-main.vercel.app/) · [English](#english)

## 主な機能

- テキスト、リンク、画像、ファイルのクイック保存
- Inbox に集約し、Canvas 上で Task や Pack を整理
- Pack 間の接続、ワークスペース横断検索、Markdown エクスポート
- Supabase 認証とユーザー別のクラウド同期
- インストール可能な PWA、日本語・英語・中国語・マレー語・タイ語 UI

## 技術と設計

- **Frontend:** React 19、JavaScript / JSX、Vite 7
- **Canvas / UI:** React Flow、Radix UI、独自コンポーネントと CSS
- **Backend:** Supabase Auth、PostgreSQL RPC / RLS / Triggers、private Storage
- **Hosting / Worker:** Vercel、Deno / TypeScript の Supabase Edge Function
- **Testing:** Node.js ロジックテスト、pgTAP データベーステスト

コードは機能別に分割し、UI、操作ロジック、データアクセスを分離しています。React Flow は表示・操作を担当し、Task / Pack のルールは IntoDay が管理します。

- **Task 同期:** revision ベースの CAS で古い更新を拒否し、operation ID で再送を冪等化。IndexedDB Pending Journal で未確認操作を復旧します。
- **Workspace:** 削除を DB トランザクションで処理し、新規・変更された Task 参照をサーバー側で検証します。歴史データの自動削除は行いません。
- **ファイル:** 削除要求を DB Outbox に記録し、独立 Worker が lease と安全確認付きで処理する設計です。現在の Demo では自動 Cleanup / Cron を停止しています。

オフライン書き込みは制限しています。リアルタイム共同編集や、Pack 全体の原子的な一括更新を保証する設計ではありません。

## 担当したこと

IntoDay はチーム開発のプロジェクトです。私（Vincent Low）は以下を担当しました。

- 課題定義、情報設計、Canvas / Inbox / Pack の UI/UX
- React の機能別実装、Pack 統合・ドロップ・接続ルール
- React Flow への移行、Radix UI の導入、約 15 名のベータユーザーによる検証

---

<a id="english"></a>

## English

IntoDay is a desktop-first workspace for capturing research materials, organizing them visually, and reusing them with their context intact.

[Product website](https://www.intoday.cc/) · [Live app](https://app.intoday.cc/) · [Demo](https://intoday-main.vercel.app/) · [日本語](#intoday)

### Features

- Quickly capture text, links, images, and files.
- Collect items in Inbox and organize Tasks and Packs on a Canvas.
- Connect Packs, search across workspaces, and export to Markdown.
- Authenticate and sync user-scoped data with Supabase.
- Installable PWA with Japanese, English, Chinese, Malay, and Thai UI.

### Technology and architecture

- **Frontend:** React 19, JavaScript / JSX, Vite 7
- **Canvas / UI:** React Flow, Radix UI, custom components and CSS
- **Backend:** Supabase Auth, PostgreSQL RPCs / RLS / triggers, private Storage
- **Hosting / Worker:** Vercel, Supabase Edge Function using Deno / TypeScript
- **Testing:** Node.js logic tests and pgTAP database tests

Feature-oriented modules separate presentation, interaction logic, and data access. React Flow handles Canvas rendering and interaction; IntoDay owns the Task / Pack business rules.

- **Task sync:** Revision-based CAS rejects stale writes; operation IDs make retries idempotent. An IndexedDB Pending Journal recovers unconfirmed operations.
- **Workspaces:** Deletion runs in a DB transaction. Server-side guards validate new or changed Task references without automatically deleting historical data.
- **Files:** A transactional outbox records cleanup intent for an independent leased Worker. Automatic Cleanup / Cron is paused for the current Demo.

Offline writes are restricted. The app does not claim real-time collaborative editing or atomic updates across an entire Pack.

### My contribution

IntoDay is a collaborative team project. My contribution covers:

- Problem definition, information architecture, and Canvas / Inbox / Pack UI/UX.
- Feature-oriented React implementation and Pack merge, drop, and connection rules.
- React Flow migration, Radix UI integration, and usability testing with approximately 15 beta users.

## Local setup / ローカル起動

Requires Node.js 22.12+ and npm 9+.

```bash
npm ci
```

Create `.env.local` with an isolated development Supabase instance:

```dotenv
VITE_SUPABASE_URL=your-development-supabase-url
VITE_SUPABASE_ANON_KEY=your-development-anon-key
VITE_CANVAS_CONNECTIONS_CLOUD_ENABLED=true
```

Use the repository migrations in version order and verify the development protocol gate: new Task writes return `cutover_pending` while `legacy_writes_allowed=true`. Never use production data for local testing or put service-role secrets in browser-exposed `VITE_*` values.

開発用 DB に Migration を番号順で適用し、プロトコル切替を確認してください。本番データや service-role secret をローカル検証・フロントエンド設定に使わないでください。

```bash
npm run dev         # Development server
npm run test:logic  # Logic tests
npm run lint        # ESLint
npm run build       # Production build
```

Database tests are in `supabase/tests/` and require an isolated local Supabase environment. Frontend commands do not apply production migrations or enable Cleanup / Cron.

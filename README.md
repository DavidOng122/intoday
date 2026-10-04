# IntoDay

**Capture first. Organize later.**

IntoDay は、リサーチ中に見つけた情報をすばやく保存し、視覚的に整理して、必要なときにその文脈ごと再利用するためのデスクトップ向けワークスペースです。

[プロダクトサイト](https://www.intoday.cc/) · [Web アプリ](https://app.intoday.cc/) · [English](#english)

> IntoDay はチームで開発しているプロジェクトです。私（Vincent Low）は、課題定義、情報設計、UI/UX デザイン、フロントエンド実装を担当しました。

## プロダクトの課題

リサーチ中のリンク、メモ、画像、ファイルは、ブラウザーのタブや複数のツールに分散しがちです。IntoDay は「まず保存し、あとで整理する」ワークフローで、作業を中断せずに情報を集め、関連するアイテムを必要なタイミングでまとめられるようにします。

```text
情報を保存 → Inbox に集約 → Workspace Canvas で整理 → Pack にまとめる → 検索・共有・再利用
```

## 主な機能

- テキスト、リンク、画像、ファイル、クリップボード画像のクイック保存
- 未整理のアイテムを一時保管し、Pack に移動できる Inbox
- Task や Pack を自由に配置・選択・グループ化できる Canvas
- Pack 同士の接続、ワークスペース横断検索、Markdown エクスポート
- Supabase による認証とデータ同期
- インストール可能な PWA。日本語、英語、中国語、マレー語、タイ語に対応

## UI ライブラリと Canvas の設計

IntoDay は大規模なデザインシステムを導入するのではなく、汎用的な UI interaction に focused なライブラリを利用しています。Radix UI がアクセシブルな操作の土台を提供し、見た目は IntoDay 独自のコンポーネントと CSS で構成しています。

| ライブラリ | IntoDay での用途 |
| --- | --- |
| [React Flow / XYFlow](https://reactflow.dev/) (`@xyflow/react`) | Canvas のノード・エッジ基盤。Task / Pack の配置とドラッグ、選択・複数選択・範囲選択、パン・ズーム、接続 Handle と接続操作、エッジの位置と描画を担当します。 |
| [Radix UI](https://www.radix-ui.com/primitives) | UI primitive。破壊的操作の確認に `AlertDialog`、モーダルに `Dialog`、アクションメニューに `DropdownMenu`、コンテキスト UI に `Popover`、検索画面のタブに `Tabs` を使用します。 |
| [Lucide](https://lucide.dev/) (`lucide-react`) | UI アイコン。 |

### React Flow と IntoDay の役割

React Flow は Canvas の汎用的なグラフ操作を担当します。IntoDay は独自の Task / Pack カード、カスタム接続エッジ、接続プレビューを React Flow 上に描画し、既存のプロダクト UI を保っています。

```text
React Flow
├── Node lifecycle、配置、ドラッグ
├── 選択、複数選択、範囲選択
├── Viewport、パン、ズーム、座標変換
├── 接続 Handle と接続操作
└── Edge の端点と描画 lifecycle

IntoDay
├── Task / Pack の見た目とコンテンツ
├── Pack のメンバー構成、グループ化、統合判断
├── Inbox / Search / ファイルから Canvas への配置
├── 衝突の解釈とドロップ後の処理
├── 接続の業務ルールと永続化
└── Workspace の状態と Supabase 同期
```

Task、Pack、Connection のドメインモデルとデータベーススキーマは IntoDay が所有します。Adapter が既存データを React Flow の Node / Edge 表現に変換し、React Flow は Canvas の表示・操作レイヤーとして使われます。たとえばドロップが「Pack の移動」「Task の Pack への追加」「Pack 同士の統合」のどれに当たるかは、IntoDay のプロダクトロジックが判断します。

Radix UI も見た目を決めるものではありません。ダイアログやメニューのコンテンツ、色、余白、ボタンスタイルは IntoDay の CSS で定義し、Radix は再利用可能な操作とアクセシビリティを担当します。

## 技術構成

- **フロントエンド:** React 19、JavaScript / JSX、Vite 7
- **Canvas:** React Flow / XYFlow
- **UI primitives:** Radix UI
- **バックエンド・認証:** Supabase
- **プロダクト分析:** PostHog、Vercel Analytics
- **PWA:** `vite-plugin-pwa`
- **UI ユーティリティ:** Lucide、Emoji Picker React

コードは `src/features/` を中心とした Feature-oriented Architecture で構成しています。Canvas Adapter、geometry、衝突判定、ドロップ判断、Connection の永続化を分離し、ロジックをテストできるようにしています。

## 担当したこと

- 「Capture first, organize later」のプロダクトモデルと情報設計
- Canvas、Inbox、Pack を中心とした UI/UX と操作フローの設計
- React による Feature-oriented なフロントエンド実装
- Pack 統合、衝突判定、接続ルールなどプロダクト固有の操作ロジック
- IntoDay 独自の Task / Pack 表現とドメインモデルを維持した React Flow への Canvas 基盤移行
- デザインシステムを置き換えずに Radix UI primitives を導入
- 約 15 名のベータユーザーによる検証と、フィードバックに基づく改善

## ローカルで実行する

**必要環境:** Node.js 20 以上、npm 9 以上

```bash
git clone https://github.com/vincentlow02/Intoday.git
cd Intoday
npm install
```

プロジェクトのルートに `.env.local` を作成し、Supabase の設定を追加します。

```dotenv
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

開発サーバーを起動します。

```bash
npm run dev
```

```bash
npm run lint        # ESLint
npm run test:logic  # ロジックテスト
npm run build       # プロダクションビルド
```

## プロジェクトの状況

IntoDay はデスクトップを中心としたベータ版です。現在は、情報の収集から整理までの体験、Canvas の操作性、クラウド同期の安定性を継続的に改善しています。

---

<a id="english"></a>

## English

**Capture first. Organize later.**

IntoDay is a desktop-first workspace for quickly capturing research materials, organizing them visually, and reusing them later with their context intact.

[Product website](https://www.intoday.cc/) · [Live app](https://app.intoday.cc/) · [日本語](#intoday)

> IntoDay is a collaborative team project. My contribution focuses on problem definition, information architecture, UI/UX design, and frontend implementation.

### The problem

Research links, notes, images, and files often get scattered across browser tabs and different tools. IntoDay supports a “capture first, organize later” workflow: collect information without interrupting the work, then group related items when it is useful.

```text
Capture → Inbox → Workspace Canvas → Packs → Search, share, and reuse
```

### Product features

- Quickly capture text, links, images, files, and clipboard images.
- Stage unorganized items in Inbox and move them into Packs.
- Freely arrange, select, and group Tasks and Packs on a visual Canvas.
- Connect Packs, search across workspaces, and export to Markdown.
- Authenticate and sync workspace data with Supabase.
- Installable PWA with Japanese, English, Chinese, Malay, and Thai UI.

### UI libraries and Canvas architecture

IntoDay uses focused libraries for reusable interaction infrastructure rather than adopting a full design system. Radix UI provides accessible interaction primitives, while the visual design remains custom to IntoDay.

| Library | How IntoDay uses it |
| --- | --- |
| [React Flow / XYFlow](https://reactflow.dev/) (`@xyflow/react`) | Canvas node and edge infrastructure: Task / Pack positioning and dragging, selection / multi-selection / marquee, viewport pan and zoom, connection handles and interactions, and edge positioning and rendering. |
| [Radix UI](https://www.radix-ui.com/primitives) | UI primitives: `AlertDialog` for destructive confirmation, `Dialog` for modal flows, `DropdownMenu` for action menus, `Popover` for contextual UI, and `Tabs` for search tabs. |
| [Lucide](https://lucide.dev/) (`lucide-react`) | Interface icons. |

#### React Flow and IntoDay have different responsibilities

React Flow handles general-purpose graph interactions. IntoDay renders its own Task and Pack cards, custom connection edges, and connection previews within the flow, preserving the product's visual design.

```text
React Flow
├── Node lifecycle, positioning, and dragging
├── Selection, multi-selection, and marquee
├── Viewport, pan, zoom, and coordinate conversion
├── Connection handles and interactions
└── Edge endpoints and rendering lifecycle

IntoDay
├── Task / Pack visuals and content
├── Pack membership, grouping, and merge decisions
├── Inbox / search / file placement on the Canvas
├── Collision interpretation and drop outcomes
├── Connection domain rules and persistence
└── Workspace state and Supabase synchronization
```

IntoDay owns the Task, Pack, and Connection domain models and database schema. An adapter maps existing domain data to React Flow nodes and edges; React Flow is the Canvas view and interaction layer, not the source of business data. Product decisions—whether a drop moves a Pack, adds a Task to a Pack, or merges Packs—remain IntoDay logic.

Radix UI does not dictate the app's appearance. IntoDay defines dialog and menu content, colors, spacing, and button styles in its own CSS; Radix provides reusable interaction behavior and accessibility.

### Tech stack

- **Frontend:** React 19, JavaScript / JSX, Vite 7
- **Canvas:** React Flow / XYFlow
- **UI primitives:** Radix UI
- **Backend and auth:** Supabase
- **Product analytics:** PostHog, Vercel Analytics
- **PWA:** `vite-plugin-pwa`
- **UI utilities:** Lucide, Emoji Picker React

The codebase follows a feature-oriented structure centered on `src/features/`. Canvas adapters, geometry, collision detection, drop decisions, and connection persistence are kept in separate, testable modules.

### My contribution

- Defined the “capture first, organize later” product model and information architecture.
- Designed the Canvas, Inbox, Pack interactions, and overall UI/UX.
- Implemented feature-oriented frontend modules with React.
- Built product-specific interaction logic for Pack merging, collision interpretation, and connection rules.
- Migrated the Canvas infrastructure to React Flow while preserving IntoDay's Task / Pack presentation and domain model.
- Integrated Radix UI primitives without replacing the existing visual system.
- Conducted usability testing with approximately 15 beta users and iterated based on their feedback.

### Local setup

**Requirements:** Node.js 20+ and npm 9+

```bash
git clone https://github.com/vincentlow02/Intoday.git
cd Intoday
npm install
```

Create a `.env.local` file in the project root and add your Supabase settings:

```dotenv
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Start the development server:

```bash
npm run dev
```

```bash
npm run lint        # ESLint
npm run test:logic  # Logic tests
npm run build       # Production build
```

### Project status

IntoDay is a desktop-first beta. Development continues on the capture-to-organization workflow, Canvas usability, and cloud-sync reliability.

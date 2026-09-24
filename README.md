# IntoDay

リサーチ情報をすばやく収集し、視覚的に整理・関連付けるためのデスクトップ型ワークスペースです。

[公式サイト](https://www.intoday.cc/) · [Web アプリ](https://app.intoday.cc/) · [English](#english)

> IntoDay はチームで開発しているプロジェクトです。私（Vincent Low）は、課題定義、情報設計、UI/UX デザイン、およびフロントエンド実装を担当しました。

## プロジェクト概要

リサーチ中のリンク、メモ、画像、ファイルなどは、複数のツールに分散しがちです。IntoDay は「まず保存し、あとで整理する」という流れによって、集中を妨げずに情報を集め、必要な文脈とともに再利用できるようにします。

```text
情報を保存 → Inbox に集約 → Workspace / Pack で整理 → 検索・共有・再利用
```

## 主な機能

- テキスト、リンク、画像、ファイル、クリップボード画像のクイック保存
- 未整理の情報を一時保管する Inbox
- カードを自由に配置・選択・グループ化できるデスクトップキャンバス
- 関連するカードをまとめる Pack と、ドラッグ＆ドロップによる整理
- Workspace、Pack、アイテムを横断する検索と Markdown 書き出し
- Supabase 認証・データ同期、ローカル状態との調整
- インストール可能な PWA と日英中・マレー語 UI

## 私の担当

- 「Capture first, organize later」というプロダクトコンセプトと情報設計
- キャンバス、Inbox、Pack を中心とした操作フローと UI デザイン
- React による機能単位のフロントエンド実装
- ドラッグ判定、座標計算、複数選択、Pack 統合などの操作ロジック
- 約 15 名のベータユーザーによる検証と、その結果に基づく改善

## 技術構成

`React 19` · `Vite 7` · `Supabase` · `JavaScript / JSX` · `PostHog` · `Vercel Analytics` · `Vite PWA`

コードは `src/features/` 配下を中心とした Feature-oriented Architecture で構成しています。キャンバスの座標・衝突判定、Inbox から Pack への状態遷移、データ正規化などは純粋関数として分離し、Node.js Test Runner で検証しています。

## ローカルでの実行

**必要環境:** Node.js 20+ / npm 9+

```bash
git clone https://github.com/vincentlow02/Intoday.git
cd Intoday
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` に Supabase の URL と匿名キーを設定してください。

```bash
npm run lint        # コード品質チェック
npm run test:logic  # 144 件のロジックテスト
npm run build:web   # プロダクションビルド
```

## 現在の状況

デスクトップ中心のベータ版です。現在は、情報収集から整理までの操作性、キャンバス上のドラッグ体験、およびクラウド同期の安定性を継続的に改善しています。

---

<a id="english"></a>

## English

IntoDay is a desktop-first workspace for quickly capturing, visually organizing, and connecting research materials.

[Product Website](https://www.intoday.cc/) · [Web App](https://app.intoday.cc/) · [日本語](#intoday)

> IntoDay is a collaborative team project. My contribution focuses on problem definition, information architecture, UI/UX design, and frontend implementation.

### Overview

Research links, notes, images, and files often become scattered across different tools. IntoDay supports a “capture first, organize later” workflow so users can stay focused while collecting information and restore its context when they need it.

```text
Capture → Inbox → Organize into Workspaces / Packs → Search, share, and reuse
```

### Key Features

- Quick capture for text, links, images, files, and clipboard images
- An Inbox for staging unorganized resources
- A desktop canvas for positioning, selecting, and grouping cards
- Packs and drag-and-drop workflows for organizing related resources
- Search across workspaces, packs, and items, with Markdown export
- Supabase authentication and cloud sync with local-state reconciliation
- Installable PWA with English, Japanese, Chinese, and Malay UI

### My Contribution

- Defined the “capture first, organize later” product model and information architecture
- Designed the canvas, Inbox, Pack interactions, and overall UI
- Implemented feature-oriented frontend modules with React
- Built interaction logic for collision detection, positioning, multi-selection, and Pack merging
- Conducted usability testing with approximately 15 beta users and iterated from the findings

### Tech Stack

`React 19` · `Vite 7` · `Supabase` · `JavaScript / JSX` · `PostHog` · `Vercel Analytics` · `Vite PWA`

The frontend follows a feature-oriented structure under `src/features/`. Canvas geometry, drag collision rules, Inbox-to-Pack transitions, and data normalization are separated into testable pure logic.

### Local Setup

**Requirements:** Node.js 20+ / npm 9+

```bash
git clone https://github.com/vincentlow02/Intoday.git
cd Intoday
npm install
cp .env.example .env.local
npm run dev
```

Add your Supabase URL and anonymous key to `.env.local`.

```bash
npm run lint        # Code quality
npm run test:logic  # 144 logic tests
npm run build:web   # Production build
```

### Current Status

IntoDay is a desktop-first beta. Current work focuses on refining the capture-to-organization flow, canvas drag interactions, and cloud-sync reliability.

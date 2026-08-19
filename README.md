# IntoDay

A research workspace for collecting, organizing, and connecting context over time.

[Product Website](https://www.intoday.cc/) • [Web Application](https://app.intoday.cc/)

> **Collaboration Note**: IntoDay is a collaborative team project. My contribution focuses on product problem definition, information architecture, UI/UX design, and frontend implementation.

---

## Why IntoDay

Research and creative work often fragment information across browser tabs, saved links, PDFs, screenshots, quick notes, and AI chat logs. While saving raw information is easy, the harder challenge is preserving **why something mattered** and **how different pieces of information relate to each other**.

IntoDay explores a structured research workflow where users can capture information quickly first, and then organize it into meaningful project context later.

---

## Core Workflow

```text
Capture Resources  ──>  Temporary Inbox  ──>  Workspaces & Packs  ──>  Connected Research Context
```

1. **Capture First**: Rapidly save links, notes, and references without breaking research focus.
2. **Staging (Inbox)**: Store unorganized items in a central staging queue.
3. **Organize Later**: Drag and group items into Workspaces and structured Packs on a visual canvas.
4. **Synthesize**: Review connected information cards to build long-term project context.

---

## Key Features

- **Desktop Workspace Canvas**: A spatial desktop canvas for placing, grouping, and arranging research cards.
- **Inbox Staging Queue**: A dedicated staging area for newly captured resources before organizing them into packs.
- **Resource Packs & Full View**: Expandable card containers for grouping related research notes, links, and assets.
- **Global Search Modal**: Keyboard-accessible search across research items, tags, and workspaces.
- **Drag-and-Drop Interactions**: Fluid drag-and-drop positioning built with `dnd-kit` and custom spatial collision math.
- **State Persistence & Cloud Sync**: Supabase-backed authentication and data persistence with offline-friendly local state reconciliation.
- **Desktop PWA Support**: Installable desktop Progressive Web Application via `vite-plugin-pwa`.

---

## My Contribution

I worked on IntoDay as a **Product Designer and Frontend Contributor**, collaborating with engineering team members from initial product definition through implementation and beta testing.

### Responsibilities & Core Work
- **Product Definition & Direction**: Identified core research fragmentation problems and refined the "capture first, organize later" product model.
- **Information Architecture & UX**: Designed user flows, spatial canvas mechanics, Inbox staging patterns, and resource Pack hierarchies.
- **Frontend Implementation**: Built modular React components (`src/features/`), implemented desktop canvas layout geometry, and integrated drag-and-drop staging workflows.
- **Design System & UI**: Created the visual interface, component styles, responsive layout behavior, and theme consistency.
- **Usability Testing & Iteration**: Conducted usability testing sessions with **~15 beta users**, gathering feedback to refine canvas drag interactions, Inbox sorting, and navigation flows.

---

## Product Iteration

IntoDay was built iteratively to validate core workflow concepts:

```text
User Problem Research  ──>  Information Architecture  ──>  Interaction Design  ──>  Frontend MVP  ──>  Beta Testing (15 Users)  ──>  Iteration
```

An early beta version was developed in approximately three weeks and tested with 15 target users. Usability feedback directly guided the transition toward a feature-based architecture and refined spatial card collision rules.

---

## Architecture & Engineering

The codebase uses a **Feature-Oriented Architecture** under `src/features/` to separate domain-specific UI, state hooks, and business logic from shared primitives.

```text
src/
├── features/
│   ├── canvas/       # Canvas layout geometry, selection, drag mechanics
│   ├── capture/      # Quick resource entry & staging
│   ├── inbox/        # Unsorted resource collection & Move-to-Pack logic
│   ├── pack/         # Grouped resource containers & full pack view
│   ├── search/       # Global search modal and keyword filtering
│   ├── session/      # Workspace session state & persistence
│   └── workspace/    # Workspace management & switching
├── components/       # Reusable UI primitives and layout containers
├── lib/              # Pure logic helpers, geometry math, & unit test suites
└── supabase.js       # Supabase client configuration & auth handlers
```

---

## Tech Stack

| Area | Technology |
|---|---|
| **Frontend Framework** | React 19, JavaScript / JSX |
| **Build Tooling** | Vite 7 |
| **Backend & Database** | Supabase |
| **Authentication** | Supabase Auth |
| **Interactions & Drag-and-Drop** | `dnd-kit`, Custom Canvas Geometry Math |
| **PWA Capability** | Vite PWA (`vite-plugin-pwa`) |
| **Analytics** | PostHog, Vercel Analytics |
| **Testing** | Node.js Test Runner (`npm run test:logic`) |
| **Version Control** | Git, GitHub |

---

## Quality Assurance & Testing

The repository uses automated linting, logic test suites, production build verification, and GitHub Actions CI:

- **ESLint Code Quality**: Enforces React 19 / JSX best practices across application source files (`npm run lint`).
- **124 Logic Tests**: Validates canvas coordinate collision geometry, drag overlap calculation, Inbox-to-Pack state transitions, and workspace normalization (`npm run test:logic`).
- **Production Build Verification**: Verifies bundle compilation via Vite 7 (`npm run build:web`).
- **Automated CI Workflow**: Executed automatically on every pull request and push to `main` via GitHub Actions (`.github/workflows/ci.yml`).

```bash
# Run ESLint check
npm run lint

# Run 124 logic tests
npm run test:logic

# Build web bundle
npm run build:web
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/DavidOng122/intoday.git
   cd intoday
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Copy `.env.example` to `.env.local` and fill in your Supabase credentials:
   ```bash
   cp .env.example .env.local
   ```

4. **Start the local development server**:
   ```bash
   npm run dev
   ```

5. **Run test suite & production build**:
   ```bash
   # Run unit tests
   npm run test:logic

   # Build production bundle
   npm run build:web
   ```

---

## Project Status

IntoDay is an actively developed product prototype. Ongoing refinement focuses on desktop workspace interaction flows, simplifying multi-resource organization, and improving long-term research synthesis.

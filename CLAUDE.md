# Query Selection Engine

## Project Overview
A demo product that visualizes how the orchestrator selects diverse queries across rounds using **farthest-first traversal** on query embeddings. Built to demonstrate that cosine similarity-based query selection produces maximally diverse search coverage.

## What This Product Does
1. User inputs a biomedical target query (e.g., "CDK12 inhibitors for TNBC") and desired pool size (N)
2. LLM expands the query into N queries across 5 expansion layers (shown layer by layer)
3. All queries are embedded into vectors and visualized as a 2D scatter plot
4. Round 1: System selects 5 most diverse queries using farthest-first traversal
5. User marks which queries were promising (checkbox) and which failed
6. Round 2+: System splits budget — exploit (dig deeper on promising) + explore (new diverse untried queries)
7. Each selection shows WHY that query was picked (distance from nearest tried query)
8. After each round, user can continue or stop. Max 5 rounds.

## Tech Stack
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend**: Python FastAPI
- **LLM**: GPT-4.1-mini (via OpenAI API) for query expansion
- **Embeddings**: all-MiniLM-L6-v2 (local, via sentence-transformers) for query vectors
- **2D Reduction**: UMAP for reducing embeddings to 2D scatter plot
- **Scatter Plot**: D3.js or Plotly.js for interactive 2D visualization
- **No database**: Fresh session each time, all state in memory

## UI Design
- **Theme**: Dark mode matching Convexia's brand
  - Background: #0a0a0a (near black)
  - Primary accent: #00c277 (Convexia green)
  - Secondary accent: #00ff99 (bright green for highlights)
  - Text: #ffffff (white) and #a0a0a0 (gray for secondary)
  - Cards/panels: #141414 with subtle #1a1a1a borders
  - Font: Inter or system sans-serif
- **Layout**: Split screen
  - Left panel (40%): Query list with status indicators (tried/untried/promising/failed)
  - Right panel (60%): 2D scatter plot with animated selections
  - Bottom bar: Round info, explanation panel, controls
- **Animations**:
  - New selected queries pulse/glow green
  - Tried queries fade to gray
  - Dashed lines draw from new selection to nearest tried query with distance label
  - Smooth transitions between rounds

## Project Structure
```
query-selection-engine/
├── CLAUDE.md                    # This file
├── frontend/                    # Next.js app
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── app/
│   │   ├── layout.tsx           # Root layout with dark theme, fonts
│   │   ├── page.tsx             # Main page
│   │   └── globals.css          # Tailwind + custom dark theme styles
│   ├── components/
│   │   ├── InputPanel.tsx       # Target query input + N slider + Generate button
│   │   ├── QueryList.tsx        # Left panel: scrollable list of all queries with status
│   │   ├── ScatterPlot.tsx      # Right panel: 2D UMAP scatter plot with D3/Plotly
│   │   ├── RoundControls.tsx    # Bottom: Mark results checkboxes + Next Round + Stop
│   │   ├── ExplanationPanel.tsx # Bottom: "WHY selected" explanations per query
│   │   ├── ExpansionLayers.tsx  # Animated layer-by-layer query generation display
│   │   └── Header.tsx           # App header with logo/title
│   ├── lib/
│   │   ├── api.ts               # API client for backend calls
│   │   └── types.ts             # TypeScript types shared across components
│   └── hooks/
│       └── useRoundState.ts     # React state management for rounds
├── backend/
│   ├── requirements.txt         # Python dependencies
│   ├── main.py                  # FastAPI app entry point
│   ├── query_expander.py        # LLM-based query expansion (5 layers)
│   ├── embedder.py              # Sentence-transformers embedding + UMAP
│   ├── selector.py              # Farthest-first traversal algorithm
│   └── models.py                # Pydantic models for API request/response
└── .env.example                 # Template for API keys
```

## API Endpoints

### POST /api/expand
Expand a target query into N queries across 5 layers.
- **Input**: `{ "target_query": "CDK12 inhibitors for TNBC", "pool_size": 50 }`
- **Output**: `{ "layers": [ { "name": "Core", "queries": [...] }, { "name": "Synonyms", "queries": [...] }, ... ], "all_queries": [...] }`
- Calls GPT-4.1-mini to generate queries per layer
- Layer by layer so frontend can animate

### POST /api/embed
Embed all queries and return 2D coordinates.
- **Input**: `{ "queries": ["q1 text", "q2 text", ...] }`
- **Output**: `{ "embeddings_2d": [ { "query": "...", "x": 0.5, "y": -0.3 }, ... ] }`
- Uses all-MiniLM-L6-v2 for embeddings
- UMAP reduces to 2D

### POST /api/select
Run farthest-first traversal to select K queries.
- **Input**: `{ "queries": [...], "tried_indices": [0, 3, 7], "promising_indices": [0], "k": 5 }`
- **Output**: `{ "selected": [ { "index": 12, "query": "...", "reason": "Distance 0.82 from nearest tried (q3: CDK12 clinical trials)", "nearest_tried_index": 3, "distance": 0.82, "is_exploit": false }, ... ] }`
- Exploit queries (promising from previous round) are auto-included
- Remaining K slots filled by farthest-first from untried pool
- Each selection includes explanation of why it was chosen

## Query Expansion Layers (for LLM prompt)

The LLM should generate queries in 5 distinct layers:

### LAYER 1: Core (Deterministic)
Direct combinations of target + indication + modality from user input.
Example: "CDK12 inhibitor triple negative breast cancer", "CDK12 small molecule TNBC"

### LAYER 2: Synonyms
Replace key terms with scientific synonyms.
Example: "cyclin-dependent kinase 12 inhibitor breast cancer", "CDK12 antagonist TNBC"

### LAYER 3: Translations
Translate core queries into Chinese, Japanese, Korean for non-English source coverage.
Example: "CDK12 抑制剂 三阴性乳腺癌", "CDK12 阻害剤 トリプルネガティブ乳がん"

### LAYER 4: Controlled Random (Bounded)
Creative variations that explore adjacent space — related targets, mechanisms, pathways.
Example: "CDK12 PROTAC degrader solid tumor", "CDK12 CDK13 dual inhibitor breast"

### LAYER 5: Modality × Target Alias (Deterministic)
Cross-product of modalities (small molecule, PROTAC, antibody, etc.) with target aliases.
Example: "CDK12 PROTAC TNBC", "cyclin-dependent kinase 12 degrader breast cancer"

## Farthest-First Traversal Algorithm

```python
def farthest_first_select(embeddings, tried_indices, k):
    """Select k queries most distant from all tried queries."""
    untried = [i for i in range(len(embeddings)) if i not in tried_indices]
    selected = []

    for _ in range(k):
        best_idx = None
        best_min_dist = -1

        for idx in untried:
            # Distance to nearest tried/selected query
            all_reference = tried_indices + selected
            min_dist = min(
                cosine_distance(embeddings[idx], embeddings[ref])
                for ref in all_reference
            )
            if min_dist > best_min_dist:
                best_min_dist = min_dist
                best_idx = idx

        selected.append(best_idx)
        untried.remove(best_idx)

    return selected
```

## Round Logic

Every query is in one of three states:
- **Promising** (user checked ✓) → auto re-selected next round, occupies an exploit slot
- **Failed** (user unchecked ✗) → permanently excluded, never selected again
- **Untried** (never selected in any round) → eligible for explore slots via farthest-first

```
Round N:
  1. Identify promising queries from Round N-1 (user-checked ✓)
  2. EXPLOIT slots = promising queries auto-included (they occupy slots in the batch of 5)
     - These don't trigger any backend computation — they are simply re-selected
     - In the real system they would "dig deeper" (more pages, sub-queries)
     - In this demo it just means: slot reserved, shown as exploit on the scatter plot
  3. EXPLORE slots = 5 - exploit_slots (minimum 1 explore slot always)
  4. Fill explore slots using farthest-first traversal on UNTRIED queries only
     - Failed queries are excluded from the candidate pool permanently
  5. Display selections on scatter plot with animations:
     - Exploit queries: highlighted in bright green with "EXPLOIT" badge
     - Explore queries: highlighted in cyan/teal with "EXPLORE" badge
     - Dashed lines from each explore query to nearest tried query + distance label
  6. User marks results (checkboxes: promising or not)
  7. User clicks "Next Round" or "Stop"
```

## Important Implementation Notes

- **Pool is static**: No new queries are added to the pool after initial expansion. Spawning sub-queries is not implemented in this demo.
- **Max 5 rounds**: After Round 5, auto-stop with summary.
- **Minimum 1 explore slot**: Even if all 5 previous queries were promising, reserve at least 1 slot for a new untried query.
- **First round**: All 5 selections are explore (no exploit yet since nothing has been tried).
- **UMAP stability**: Use `random_state=42` for reproducible 2D layouts across API calls. Compute UMAP once at embed time, reuse coordinates across rounds.
- **Distance metric**: Cosine distance (1 - cosine_similarity) for all calculations.
- **Explanation format**: "Selected because distance {d:.2f} from nearest tried query (q{n}: {query_text_truncated}). Fills biggest gap in search space."
- **Query pool size**: Default 50, user can select 20-100 via slider.
- **No persistence**: All state lives in frontend React state. Refreshing page resets everything.

## Environment Variables
```
OPENAI_API_KEY=sk-...      # For GPT-4.1-mini query expansion
```
No other API keys needed. Embeddings run locally.

## Running Locally
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev    # runs on localhost:3000
```

## Design Reference
- Match Convexia's visual identity: https://www.convexia.bio/
- Dark background, green accents, clean scientific aesthetic
- Glassmorphism on cards (subtle transparency + blur)
- Smooth animations on state changes

# HA Workflow Documentation Standard

This file defines the required format, section structure, visual standards, and writing rules
for all SentinelOne Hyperautomation workflow documentation. Apply this standard whenever a user
asks to "document", "write docs for", "generate documentation for", or "explain" an HA workflow
— whether the doc is produced alongside a new JSON or from an existing workflow.

The format is always identical regardless of whether the workflow JSON is being generated at the
same time or the doc is being written standalone from a pasted/uploaded workflow.

---

## Trigger phrases

Produce documentation (in addition to or instead of JSON) when the user says any of:
- "document this workflow", "write docs", "generate documentation"
- "explain this workflow", "write up what this does"
- "create a doc for this", "give me the docs"
- "document it", "document the playbook"
- When generating a new workflow JSON, ALWAYS produce documentation alongside it unless the
  user explicitly says they only want the JSON.

---

## Required sections — in this order

Every workflow doc must contain all of the following sections. None are optional except
`## Notes & Gotchas` (omit only if there are genuinely zero non-obvious behaviors).

1. `# Workflow Documentation: \`[Workflow Name]\``
2. `## Holistic Goal`
3. `## Pre-requisites to Configure`
4. `## Visual Flow` — Mermaid block + inline SVG widget (both required)
5. `## Block-by-Block Breakdown`
6. `## Notes & Gotchas`

Do NOT include a "Comparison" section — that was a one-time contextual addition, not a standard
section. Only add contextual cross-workflow comparisons when the user explicitly asks.

---

## Section specifications

### 1. Title

```markdown
# Workflow Documentation: `[Workflow Name]`
```

Use the exact workflow `name` field from the JSON, wrapped in backticks.

---

### 2. Holistic Goal

Two parts:

**Part A — Prose paragraph.** What this workflow does, why it exists, and what problem it
solves. Written for a SOC analyst or admin who has never seen it. Avoid jargon where possible.
Explain the end-to-end intent, not the implementation.

**Part B — One-liner summary.** Bold, on its own line, in the form:
> **Trigger → Core logic step(s) → Outcome.**

Example:
> **Form input → Run RemoteOps Script (broadcast) → Get Script Status (failures only) → Run RemoteOps Script (retry) → Email summary.**

---

### 3. Pre-requisites to Configure

Two sub-sections:

**3a. Integrations warning** (omit if workflow has zero integration-backed actions):

```markdown
> ⚠️ **Required integrations before importing:**
> - **[Integration Name]** — used by `[Action Name]`, `[Action Name]`. Configure at
>   **Hyperautomation → Integrations → [Integration Name] → Add Connection**.
>   After import, open each integration action and assign the connection.
```

Repeat one bullet per distinct integration. List every action name that uses it.

**3b. Configuration Variables table** (omit if workflow has no `Configuration` variable block):

```markdown
| Variable | Default | Purpose |
|---|---|---|
| `variable-name` | `"default value"` | What it controls and when to change it |
```

Include every variable in the `Configuration` block. Add the default value column — this was
missing in early docs and caused confusion during tenant setup.

---

### 4. Visual Flow

**ALWAYS produce both of the following. Neither is optional.**

#### 4a. Mermaid flowchart

Use `flowchart TD` direction. Rules:

- Every action in the workflow gets a node — no skipping
- Node labels: `ActionName\nkey detail` (use `\n` for subtitle lines)
- Conditions use diamond shape: `{Condition Name?}`
- Terminal nodes use circle: `((stop))`
- Branch labels on edges: `-- true -->`, `-- false -->`, `-- inner -->`
- Parallel paths that converge: show the convergence explicitly
- Loops: show the loop node, inner path, and exit path

```
flowchart TD
    MT[Manual Trigger\nfields: X, Y, Z] --> CFG[Configuration\nset IDs]
    CFG --> ACT[Integration Action\nAPI endpoint note]
    ACT --> COND{Is Condition Met?}
    COND -- true --> OUT1[Outcome A]
    COND -- false --> OUT2[Outcome B]
    OUT1 --> stop1((stop))
    OUT2 --> stop2((stop))
```

#### 4b. SVG widget

Render an inline color-coded node-and-edge flowchart using `show_widget`. This is a visual
companion to the Mermaid — same topology, but color-coded by action type so the reader can
instantly see the action category distribution at a glance.

**Color coding — mandatory, never deviate:**

| Action category | Fill color | Border color | Text |
|---|---|---|---|
| Trigger (manual, scheduled, alert) | `#7C3AED` (purple) | `#5B21B6` | white |
| Integration action (`tag: integration`) | `#2563EB` (blue) | `#1D4ED8` | white |
| Variable / Configuration | `#6B7280` (slate) | `#4B5563` | white |
| Condition / branch | `#D97706` (amber) | `#B45309` | white |
| Delay | `#9CA3AF` (light gray) | `#6B7280` | `#1F2937` dark |
| Send Email | `#059669` (green) | `#047857` | white |
| Loop | `#0891B2` (cyan) | `#0E7490` | white |
| HTTP Request (core, no integration) | `#475569` (slate-dark) | `#334155` | white |
| Webhook / Wait for Interaction | `#7C3AED` (purple, same as trigger) | `#5B21B6` | white |
| Terminal / stop | `#E5E7EB` (light) | `#9CA3AF` | `#6B7280` |

SVG layout rules:
- Flow top-to-bottom, nodes left-to-right within the same rank
- Use rounded rectangles (`rx="8"`) for all non-condition nodes
- Use diamonds (`polygon`) for condition nodes
- Use small circles for terminal nodes
- Edges: straight or L-shaped lines with arrowheads, labeled where branching
- Include a color legend in the bottom-left corner of the SVG
- Minimum node width: 160px, height: 44px
- Font: system sans-serif, 12px, centered
- Background: transparent (no fill on the root SVG)
- If the workflow has more than 20 actions, use a compact layout (smaller nodes, tighter spacing)
  and note "see Mermaid diagram for full detail" in the SVG caption

Always call `visualize:read_me` with `modules: ["diagram"]` before rendering the SVG.

---

### 5. Block-by-Block Breakdown

Number every block sequentially matching the flow order (not the `export_id` order). Use the
exact action name from the JSON as the heading.

#### For CORE actions — brief treatment:

```markdown
### N. `Action Name`

One sentence: what it does and why it exists at this point in the flow.
If it has non-obvious config (e.g. a JQ expression, a specific delay value), call it out.
```

Trivial actions (a plain delay, a variable that just stores a parentTaskId) need only one
sentence. Do not pad.

#### For INTEGRATION actions — full treatment:

```markdown
### N. `Action Name` *(integration)*

- **Integration**: [Integration name]
- **Method + Endpoint**: `POST /web/api/v2.1/path`
- **public_action_id**: `uuid-here`

Prose: what this action does, what filter/payload fields matter, what the response provides
to downstream actions. Explain any non-default parameters. If a payload field controls
branching logic downstream, call that out explicitly.

If the action has query parameters, add a table:

| Parameter | Value | Purpose |
|---|---|---|
| `paramName` | `{{local_var.x}}` | Why this matters |
```

#### For CONDITION actions:

```markdown
### N. `Condition Name` *(condition)*

What it evaluates. Then:
- **TRUE** → what happens
- **FALSE** → what happens (or "unconnected — workflow halts silently" if no false branch)
```

#### For LOOP actions:

```markdown
### N. `Loop Name` *(loop)*

What it iterates over (`{{action-slug.field}}`), how many iterations are expected,
and what the inner action(s) do. Note the exit condition if it's a while loop.
```

---

### 6. Notes & Gotchas

Omit this section entirely if there are no non-obvious behaviors. When it exists:

Use free-form prose under named sub-headings. Each sub-heading should be a specific,
descriptive question or statement — not a generic label like "Important Note".

Good sub-heading examples:
- `### Why query \`failed\` AND \`timeout\`?`
- `### The retry is fire-and-forget`
- `### RBAC enforcement is silent`
- `### Scaling beyond 100 failed agents`

Each entry should explain: what the behavior is, why it exists or was designed that way,
and what the operator should do about it. Keep it tight — 3–6 sentences per item.

Include a gotcha entry for:
- Any silent failure mode (e.g. a false condition branch that does nothing)
- Any hardcoded limit that will break at scale (e.g. `limit=100`)
- Any action that is "fire-and-forget" with no status verification
- Any integration action where `connection_id: null` requires post-import manual setup
- Any JQ or Function expression that has a non-obvious edge case

---

## Writing style rules

- **Voice**: direct, technical, written for a SOC engineer or SOAR admin. Not marketing copy.
- **Tense**: present tense throughout. "This action queries..." not "This action will query..."
- **Action names**: always in backticks when referenced inline: `Run RemoteOps Script Initial`
- **Variable names**: always in backticks: `local_var.parent-task-id`
- **API paths**: always in backticks with method: `POST /web/api/v2.1/remote-scripts/execute`
- **Integration annotation**: append *(integration)* to the heading of any integration-backed
  action in the Block-by-Block section
- **Condition annotation**: append *(condition)* to condition block headings
- **Loop annotation**: append *(loop)* to loop block headings
- **Emphasis**: use `**bold**` for the first mention of a key concept per section only.
  Don't bold random phrases for decoration.
- **Tables**: use for 3+ items that have a consistent structure (params, variables, fields).
  Don't use tables for 1–2 items — inline prose is cleaner.
- **Length**: say what needs to be said. Don't pad. A simple 5-action workflow should have a
  short doc. A 27-action workflow warrants a long one.

---

## Output format

Documentation is always delivered as a `.md` file written to `/mnt/user-data/outputs/` and
presented with `present_files`. The filename should be:
`[workflow-name-slugified]-documentation.md`

Example: workflow named `[AD On-prem] Create User` → `ad-on-prem-create-user-documentation.md`

When generating documentation alongside a JSON workflow, present both files together in a
single `present_files` call — JSON first, documentation second.

The SVG widget is rendered inline in the chat conversation using `show_widget` (not embedded
in the .md file). The Mermaid block lives in the .md file. Always render the SVG widget before
presenting the files so the user sees the visual first, then gets the download links.

---

## Full section template (copy-paste starting point)

```markdown
# Workflow Documentation: `[Workflow Name]`

## Holistic Goal

[Prose paragraph — what it does, why it exists, what problem it solves.]

**[Trigger] → [Core logic] → [Outcome].**

---

## Pre-requisites to Configure

> ⚠️ **Required integrations before importing:**
> - **[Integration]** — used by `[Action]`, `[Action]`. Configure at
>   **Hyperautomation → Integrations → [Integration] → Add Connection**.

### Configuration Variables

| Variable | Default | Purpose |
|---|---|---|
| `variable-name` | `"value"` | What it controls |

---

## Visual Flow

[Mermaid flowchart TD block]

*See color-coded diagram above.*

---

## Block-by-Block Breakdown

### 1. `[Action Name]`
...

### 2. `[Action Name]` *(integration)*
...

---

## Notes & Gotchas

### [Specific descriptive heading]
[Prose.]
```

---

## Checklist before outputting documentation

- [ ] All 6 sections present (or Notes & Gotchas explicitly omitted with reason)
- [ ] Mermaid covers every action in the workflow — none skipped
- [ ] SVG widget rendered inline in chat before file is presented
- [ ] SVG uses correct color coding per action type table above
- [ ] Color legend included in SVG
- [ ] Integration actions in Block-by-Block have method, endpoint, public_action_id, and param table
- [ ] Condition branches explicitly state TRUE → and FALSE → outcomes
- [ ] Configuration Variables table includes Default column
- [ ] Integration warning lists every action name that uses each integration
- [ ] Notes & Gotchas covers all silent failures, hardcoded limits, fire-and-forget actions
- [ ] File written to `/mnt/user-data/outputs/` with slugified filename
- [ ] SVG rendered first, then present_files called with JSON (if any) + .md together

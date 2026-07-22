---
name: sentinelone-hyperautomation
description: >
  Use this skill whenever a user wants to create, design, build, generate, write, or export a
  SentinelOne Hyperautomation workflow in JSON format. Triggers include: any mention of
  "Hyperautomation", "workflow", "automation", "SOAR", "playbook", "alert response", "trigger",
  "scheduled workflow", "webhook workflow", or any request to automate a SentinelOne-related
  security task. Also triggers when the user asks to import, export, test, validate, or submit
  a workflow to a SentinelOne console via API. Also triggers when the user asks to "document",
  "write docs for", "explain", or "create documentation for" any HA workflow — whether producing
  docs alongside new JSON or from an existing workflow. Always use this skill for any task
  involving SentinelOne workflow JSON or documentation — even if phrased casually. When in
  doubt about whether this skill applies, use it.
---

# SentinelOne Hyperautomation Skill

This skill enables Claude to design and generate valid SentinelOne Hyperautomation workflow
JSON, explain the logic behind workflows, and optionally submit them to a live console via API.

## How to use this skill

When a user asks to build a workflow, follow this process:

### Step 1 — Understand the intent
Ask (or infer from context):
- What should trigger the workflow? (alert, schedule, webhook, manual, email)
- What integrations are needed? (SentinelOne, M365, Slack, VirusTotal, etc.)
- What is the desired outcome? (enrich alert, disable user, send notification, etc.)
- Should the workflow run automatically or on-demand?

### Step 2 — Warn about integrations
**CRITICAL**: Before generating JSON, identify any integration-backed actions (tag = "integration").
These require pre-configured connections in the console that CANNOT be created via API.
Always tell the user: *"This workflow uses the [X, Y, Z] integrations. Before importing, you must
configure connections for these in your Hyperautomation → Integrations section."*

Integration-backed actions have `"tag": "integration"` and a non-null `integration_id`.
Core actions (Variable, Loop, Condition, Delay, Send Email, HTTP Request without integration,
Break Loop, Snippet, Wait for Slack, Create Interaction) have `"tag": "core_action"`.

### Step 3 — Generate the JSON
Read `references/workflow-schema.md` to produce a valid workflow JSON.
Read `references/building-blocks.md` for the correct action type structures.
Read `references/functions-reference.md` for available functions and their syntax.

### Step 4 — Validate before outputting
Self-check against `references/validation-rules.md` before presenting the workflow.

### Step 5 — API submission (optional)
If the user wants to submit to a live console, read `references/api-integration.md`.

**Environment variables**: Before making any API call, check whether `API_URL` and `API_TOKEN`
are set in the environment. If they are, validate them first using the two-step test described
in `references/api-integration.md` (system health check + token permission check). Only proceed
with import/trigger/activate after both checks pass. If the variables are not set, ask the user
to provide their console URL and personal Console User API token (not a Service User token —
see `references/api-integration.md` for the reason).

### Step 6 — Generate documentation
**Always produce documentation alongside any new workflow JSON unless the user explicitly says
they only want the JSON.** Also produce documentation when the user asks to document an existing
workflow from a pasted or uploaded JSON.

Before writing a single word of documentation, read `references/documentation-standard.md`.
That file is the authoritative source for section structure, SVG color coding, writing style,
block-by-block depth rules, and the output checklist. Do not improvise the doc format —
follow the standard exactly.

---

## Reference files — when to read each

| File | Read when... |
|------|-------------|
| `references/workflow-schema.md` | Always when generating JSON — defines the envelope and action structure |
| `references/building-blocks.md` | Need the exact shape of a specific action type (trigger, loop, condition, etc.) |
| `references/functions-reference.md` | Using `{{Function.X()}}` syntax or PowerQuery patterns |
| `references/validation-rules.md` | Before outputting any workflow — run the checklist |
| `references/api-integration.md` | User wants to import/export/submit to a live console |
| `references/documentation-standard.md` | Producing documentation for any HA workflow — read this FIRST before writing a single word of docs |

## Example workflows (in references/examples/)
Annotated real examples to use as structural references:
- `simple-linear.md` — simple trigger → action → note pattern
- `branching.md` — condition with true/false branches + success/fail notes
- `loop-pattern.md` — loop with APPEND and BREAK logic
- `integration-pattern.md` — integration-backed HTTP request with connection placeholders

---

## Quick reference — action name → slugified reference

When referencing a previous action in `{{...}}` syntax, use the kebab-case version of the
action's `name` field. Examples:
- Action named "Get Agents with Active Threat" → `{{get-agents-with-active-threat.body.data}}`
- Action named "SDL Query" → `{{sdl-query.body.matches[0].attributes.actor_user_email_addr}}`
- Action named "Singularity Response Trigger" → `{{singularity-response-trigger.data.id}}`
- Action named "Loop the list of IPv4" → `{{loop-the-list-of-ipv4.item}}`

The rule: lowercase, spaces become hyphens, special characters dropped.

---

## Integration warning template

Use this when the workflow contains integration-backed actions:

> ⚠️ **Pre-requisite integrations to configure before importing:**
> - **[Integration Name]** — used for [action name(s)]. Configure at Hyperautomation → Integrations → [Integration Name] → Add Connection.
> - *(repeat for each)*
>
> Once configured, note the connection name — you may need to update the `connection_name` field in the JSON before importing.

---

## Common mistakes to avoid

- ❌ Defining multiple variables in a single Variable action when one references another — they evaluate simultaneously and will fail with "variable not found"
  ✅ Always use one Variable action per variable when chaining references. One var → one action, always.

- ❌ Guarding a destructive action with a fail-OPEN approval gate (`... not_equals "dismissed"`) — a wait-for-interaction timeout yields an empty value that passes the test and auto-runs the action
  ✅ Fail CLOSED: test `... equals "approved"` and route the destructive action off the true branch (see `references/validation-rules.md` → Condition rules).

- ❌ Setting `parent_action` to the previous node's `export_id` to express flow order — this 422s on import; `parent_action` is loop-membership only
  ✅ `parent_action: null` on every non-loop node; wire flow via `connected_to.target` only (see `references/validation-rules.md` → Import / `parent_action` rules).

- ❌ Writing back to an alert (note/verdict/status) via the old `/web/api/v2.0/threats` REST endpoints — they are decommissioned (HTTP 405)
  ✅ Use the Unified Alerts GraphQL API (`POST /web/api/v2.1/unifiedalerts/graphql`); see `references/api-integration.md` → SentinelOne alert write-backs.

- ❌ Writing documentation without reading `references/documentation-standard.md` first — section order, SVG color coding, and block depth rules are all specified there
  ✅ Always read the documentation standard before producing any HA workflow doc.

- ❌ Skipping the SVG widget and only producing the Mermaid block
  ✅ Both are required. SVG rendered inline in chat first, Mermaid lives in the .md file.

- ❌ Producing documentation as inline chat text instead of a .md file
  ✅ Always write to `/mnt/user-data/outputs/[workflow-name-slugified]-documentation.md` and present with `present_files`.

- ❌ Omitting the Default column from the Configuration Variables table
  ✅ Always include Variable name, Default value, and Purpose columns.

- ❌ Writing integration block-by-block entries without the method, endpoint, and public_action_id
  ✅ Integration actions always get: integration name, method + endpoint, public_action_id, param table if applicable.
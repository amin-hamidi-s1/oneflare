import { useState, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import {
  BookOpen, Network, Compass, Wrench, Map, Flag, Swords, Search,
  Shield, Server, Workflow, Target, FileText,
  ShieldCheck, ShieldQuestion, Loader2, AlertTriangle, Info,
  Layers, Rocket, GitBranch, Settings2, ListTree,
} from 'lucide-react'

// ── Icon slug -> component (matches docs_registry.py's `icon` field) ───────
const DOC_ICONS = {
  book: BookOpen, network: Network, compass: Compass, wrench: Wrench,
  map: Map, flag: Flag, swords: Swords, search: Search,
  shield: Shield, server: Server, workflow: Workflow, target: Target,
}
const docIcon = (slug) => DOC_ICONS[slug] || FileText

// ── Section accent cycle — same 4 accents used across ScenarioDetail ───────
const ACCENTS = [
  { text: 'text-orange-400', border: 'border-orange-500/20', bg: 'bg-orange-500/5' },
  { text: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/5' },
  { text: 'text-blue-400',   border: 'border-blue-500/20',   bg: 'bg-blue-500/5'   },
  { text: 'text-green-400',  border: 'border-green-500/20',  bg: 'bg-green-500/5'  },
]

// Keyword -> icon for a section heading, so common doc sections (Security,
// Troubleshooting, Setup...) get a meaningful icon instead of a generic one.
// Falls back to round-robin through a generic icon set when nothing matches.
const KEYWORD_ICONS = [
  { test: /security|safety|risk/i,                          icon: AlertTriangle },
  { test: /troubleshoot|fix|error|issue|gotcha|known.build/i, icon: Wrench },
  { test: /setup|prerequisite|getting started|install|deploy|running|env/i, icon: Rocket },
  { test: /detection|siem|sentinelone|star\b/i,              icon: Shield },
  { test: /response|playbook|incident|hyperautomation/i,     icon: GitBranch },
  { test: /config|variable/i,                                icon: Settings2 },
]
const FALLBACK_ICONS = [Layers, ListTree, Info, Map]

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Split raw markdown into {title, intro, sections:[{heading, id, body}]}.
// Splits on top-level "## " headings only — verified none of the docs have
// "##" inside a fenced code block, so this is a safe plain-text split.
function parseDoc(markdown) {
  const lines = markdown.split('\n')
  let title = ''
  let start = 0
  if (lines[0]?.startsWith('# ')) {
    title = lines[0].slice(2).trim()
    start = 1
  }
  const body = lines.slice(start).join('\n')
  const chunks = body.split(/\n(?=## )/)
  const intro = chunks[0].startsWith('## ') ? '' : chunks.shift() ?? ''
  const sections = chunks.map((chunk, i) => {
    const headingLine = chunk.split('\n')[0]
    const heading = headingLine.replace(/^##\s+/, '').trim()
    const rest = chunk.split('\n').slice(1).join('\n')
    return { heading, id: `${slugify(heading)}-${i}`, body: rest }
  })
  return { title, intro: intro.trim(), sections }
}

function sectionIcon(heading, index) {
  const match = KEYWORD_ICONS.find(k => k.test.test(heading))
  return match ? match.icon : FALLBACK_ICONS[index % FALLBACK_ICONS.length]
}

// Flatten a React children tree down to its plain text, for keyword sniffing.
function extractText(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node?.props?.children != null) return extractText(node.props.children)
  return ''
}

// blockquotes render as a callout — color/icon picked from the leading word
function Callout({ children }) {
  const text = extractText(children)
  const isWarning = /warning|safety|danger|never|caution/i.test(text)
  const Icon = isWarning ? AlertTriangle : Info
  const cls = isWarning
    ? 'border-amber-500/25 bg-amber-500/5'
    : 'border-blue-500/20 bg-blue-500/5'
  const iconCls = isWarning ? 'text-amber-400' : 'text-blue-400'
  return (
    <div className={`rounded-xl border ${cls} p-4 flex gap-3`}>
      <Icon className={`w-4 h-4 ${iconCls} shrink-0 mt-0.5`} />
      <div className="text-sm text-slate-300 leading-relaxed [&>p]:mb-0">{children}</div>
    </div>
  )
}

const MD_COMPONENTS = { blockquote: Callout }

function RoleBanner({ role, authenticated }) {
  if (role === 'admin') {
    return (
      <div className="rounded-xl border border-purple-500/25 bg-purple-500/5 p-4 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-300 leading-relaxed">
          <strong className="text-purple-400">Signed in as admin.</strong>{' '}
          You're seeing every doc, including operator/admin-only guides.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 flex gap-3">
      <ShieldQuestion className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
      <p className="text-sm text-slate-300 leading-relaxed">
        <strong className="text-orange-400">Viewing as attendee.</strong>{' '}
        {authenticated
          ? "Your account isn't an admin/viewer on this console, so admin/operator guides are hidden."
          : 'Not signed in — showing the attendee doc set.'}
      </p>
    </div>
  )
}

function DocListItem({ doc, active, onClick }) {
  const Icon = docIcon(doc.icon)
  const accent = doc.min_role === 'admin' ? 'text-purple-400' : 'text-orange-400'
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? `bg-white/5 border ${doc.min_role === 'admin' ? 'border-purple-500/30 text-purple-300' : 'border-orange-500/30 text-orange-300'}`
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? accent : ''}`} />
      <span className="flex-1 truncate">{doc.title}</span>
    </button>
  )
}

function OnThisPage({ sections }) {
  if (sections.length < 2) return null
  return (
    <div className="hidden xl:block sticky top-20 self-start rounded-xl border border-[#2d1b4e] bg-[#1a0a2e]/60 p-4 space-y-1 w-56 shrink-0">
      <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-2">On this page</div>
      {sections.map((s, i) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
          className="block text-xs text-slate-400 hover:text-orange-400 transition-colors py-1 truncate"
        >
          {s.heading}
        </a>
      ))}
    </div>
  )
}

export default function Docs() {
  const [state, setState] = useState({ loading: true, error: null, role: 'attendee', authenticated: false, docs: [] })
  const [activeId, setActiveId] = useState(null)
  const [content, setContent] = useState({ loading: false, error: null, title: '', body: '' })

  useEffect(() => {
    let alive = true
    fetch('/api/docs')
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then(data => {
        if (!alive) return
        setState({ loading: false, error: null, role: data.role, authenticated: data.authenticated, docs: data.docs })
        if (data.docs.length > 0) setActiveId(data.docs[0].id)
      })
      .catch(err => {
        if (alive) setState(s => ({ ...s, loading: false, error: err.message }))
      })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!activeId) return
    let alive = true
    setContent({ loading: true, error: null, title: '', body: '' })
    fetch(`/api/docs/${activeId}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Not found' : `${r.status}`)
        return r.json()
      })
      .then(data => {
        if (alive) setContent({ loading: false, error: null, title: data.title, body: data.content })
      })
      .catch(err => {
        if (alive) setContent({ loading: false, error: err.message, title: '', body: '' })
      })
    return () => { alive = false }
  }, [activeId])

  const parsed = useMemo(() => (content.body ? parseDoc(content.body) : null), [content.body])

  const attendeeDocs = state.docs.filter(d => d.min_role === 'attendee')
  const adminDocs = state.docs.filter(d => d.min_role === 'admin')

  return (
    <div className="page-enter space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Docs</h1>
        <p className="text-sm text-slate-400 mt-1">
          Guides and reference material, filtered to what your role can see.
        </p>
      </div>

      {!state.loading && !state.error && (
        <RoleBanner role={state.role} authenticated={state.authenticated} />
      )}

      {state.loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading docs…
        </div>
      )}

      {state.error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">Couldn't load the docs list ({state.error}). Is the backend running?</p>
        </div>
      )}

      {!state.loading && !state.error && (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5 items-start">
          {/* Doc list — grouped like Scenarios' Quick Scenarios / Campaigns split */}
          <nav className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-400/80">Attendee</span>
                <div className="flex-1 h-px bg-orange-500/15" />
              </div>
              <div className="space-y-1">
                {attendeeDocs.map(doc => (
                  <DocListItem key={doc.id} doc={doc} active={activeId === doc.id} onClick={() => setActiveId(doc.id)} />
                ))}
              </div>
            </div>

            {adminDocs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-purple-400/80">Admin</span>
                  <div className="flex-1 h-px bg-purple-500/15" />
                </div>
                <div className="space-y-1">
                  {adminDocs.map(doc => (
                    <DocListItem key={doc.id} doc={doc} active={activeId === doc.id} onClick={() => setActiveId(doc.id)} />
                  ))}
                </div>
              </div>
            )}

            {state.docs.length === 0 && (
              <p className="text-xs text-slate-500 px-3">No docs available.</p>
            )}
          </nav>

          {/* Content */}
          <div className="flex gap-5 items-start min-w-0">
            <div className="flex-1 min-w-0 space-y-4">
              {content.loading && (
                <div className="rounded-xl bg-[#1a0a2e] border border-[#2d1b4e] p-6 flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              )}
              {content.error && (
                <div className="rounded-xl bg-[#1a0a2e] border border-[#2d1b4e] p-6 flex items-center gap-2 text-red-400 text-sm py-8 justify-center">
                  <AlertTriangle className="w-4 h-4" /> {content.error}
                </div>
              )}

              {!content.loading && !content.error && parsed && (
                <>
                  {/* Page title */}
                  <div className="rounded-xl bg-[#1a0a2e] border border-[#2d1b4e] p-6">
                    <h2 className="text-xl font-bold text-slate-100">{parsed.title || content.title}</h2>
                    {parsed.intro && (
                      <article className="docs-markdown text-sm text-slate-300 leading-relaxed mt-3">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={MD_COMPONENTS}>{parsed.intro}</ReactMarkdown>
                      </article>
                    )}
                  </div>

                  {/* One colored card per H2 section */}
                  {parsed.sections.map((s, i) => {
                    const accent = ACCENTS[i % ACCENTS.length]
                    const Icon = sectionIcon(s.heading, i)
                    return (
                      <div key={s.id} id={s.id} className={`rounded-xl bg-[#1a0a2e] border ${accent.border} p-6 scroll-mt-20`}>
                        <div className="flex items-center gap-2 mb-4">
                          <div className={`w-7 h-7 rounded-lg ${accent.bg} border ${accent.border} flex items-center justify-center shrink-0`}>
                            <Icon className={`w-3.5 h-3.5 ${accent.text}`} />
                          </div>
                          <h3 className={`text-sm font-semibold uppercase tracking-wider ${accent.text}`}>{s.heading}</h3>
                        </div>
                        <article className="docs-markdown text-sm text-slate-300 leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={MD_COMPONENTS}>{s.body}</ReactMarkdown>
                        </article>
                      </div>
                    )
                  })}
                </>
              )}

              {!content.loading && !content.error && !parsed && state.docs.length > 0 && (
                <div className="rounded-xl bg-[#1a0a2e] border border-[#2d1b4e] p-6 flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
                  <BookOpen className="w-4 h-4" /> Pick a doc from the list.
                </div>
              )}
            </div>

            {parsed && <OnThisPage sections={parsed.sections} />}
          </div>
        </div>
      )}
    </div>
  )
}

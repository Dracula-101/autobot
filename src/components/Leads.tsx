// People from his LinkedIn Targets list: today's picks, the searchable
// directory, and a sheet to message, save, or skip someone.

import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, ExternalLink, Search, Sparkles, Users, X } from 'lucide-react'
import {
  dailyPicks,
  formatDate,
  leadScore,
  live,
  logicalDay,
  ROLE_ASK,
  ROLE_LABEL,
  wallClock,
  type Contact,
  type Job,
  type Lead,
  type PickContext,
  type RoleKind,
} from '@core/index.ts'
import { useApp, useRows } from '../lib/app'
import { useActions } from '../lib/useActions'
import { initials } from '../lib/companies'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { cheer } from './Autobot'
import { Avatar, Empty, SectionTitle } from './ui'
import { CONTACT_STATUS, DraftBox } from './HuntSheets'

export const ROLE_TONE: Record<RoleKind, string> = {
  university: 'bg-mint/15 text-mint',
  recruiter: 'bg-sky/15 text-sky',
  manager: 'bg-violet/15 text-violet',
  engineer: 'bg-amber/15 text-amber',
  other: 'bg-surface-2 text-ink-3',
}

const ROLE_FILTERS: { value: RoleKind | 'all'; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'university', label: 'New-grad recruiters' },
  { value: 'recruiter', label: 'Recruiters' },
  { value: 'manager', label: 'Managers' },
  { value: 'engineer', label: 'Engineers' },
  { value: 'other', label: 'Other' },
]

const firstName = (name: string) => name.split(' ')[0]

export function RoleChip({ kind }: { kind: RoleKind }) {
  return <span className={`chip py-0.5 ${ROLE_TONE[kind]}`}>{ROLE_LABEL[kind]}</span>
}

/** "You both know Asha & Ben + 3 more" */
function mutualLine(l: Lead): string | null {
  if (!l.mutuals) return null
  const names = l.mutual_names.split(', ').filter(Boolean)
  if (!names.length) return `${l.mutuals} mutual connection${l.mutuals === 1 ? '' : 's'}`
  const shown = names.slice(0, 2)
  const more = l.mutuals - shown.length
  return `You both know ${shown.map(firstName).join(' & ')}${more > 0 ? ` + ${more} more` : ''}`
}

export function usePickContext(): PickContext {
  const { settings } = useApp()
  const jobs = useRows<Job>('jobs')
  return useMemo(
    () => ({ targets: settings.targetCompanies, jobCompanies: new Set(live(jobs).map((j) => j.company.toLowerCase())) }),
    [settings.targetCompanies, jobs],
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`chip min-h-[34px] shrink-0 px-3.5 text-[13px] ${on ? 'bg-primary text-primary-ink' : 'bg-surface text-ink-2 shadow-card'}`}
    >
      {children}
    </button>
  )
}

// ── Today's picks

export function TodaysPicks({ leads, onOpen }: { leads: Lead[]; onOpen: (l: Lead) => void }) {
  const { settings } = useApp()
  const actions = useActions()
  const toast = useToast()
  const ctx = usePickContext()
  const today = logicalDay(new Date(), settings.rolloverHour)
  const picks = useMemo(() => dailyPicks(leads, ctx, today, 3), [leads, ctx, today])
  if (!picks.length) return null

  const messaged = (l: Lead) => {
    const { undo } = actions.leadToContact(l, 'messaged')
    cheer()
    toast(`Nice — ${firstName(l.name)} is in your pipeline. I’ll remind you to follow up in 5 days.`, { undo })
  }
  const skip = (l: Lead) => {
    const undo = actions.hideLead(l)
    toast(`Skipped ${firstName(l.name)}`, { undo })
  }

  return (
    <section className="card p-4">
      <SectionTitle title="Today’s picks" hint="The best people on your LinkedIn list. New faces every day." />
      <ul className="divide-y divide-line">
        {picks.map((l) => {
          const mutual = mutualLine(l)
          return (
            <li key={l.id} className="py-3 first:pt-1 last:pb-0">
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => onOpen(l)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                  <Avatar text={initials(l.name)} className={ROLE_TONE[l.role_kind]} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-extrabold text-ink">{l.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] font-bold text-ink-3">
                      <RoleChip kind={l.role_kind} />
                      <span className="truncate">{l.company || 'Company unknown'}</span>
                    </span>
                    {mutual && (
                      <span className="mt-1 flex items-center gap-1 text-[12px] font-bold text-violet">
                        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="truncate">{mutual}</span>
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => skip(l)}
                  className="btn-ghost btn-sm -mr-1 h-9 w-9 shrink-0 px-0 text-ink-3"
                  aria-label={`Skip ${l.name}`}
                  title="Not relevant"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2 sm:pl-[52px]">
                <button type="button" className="btn-soft btn-sm" onClick={() => onOpen(l)}>
                  <Sparkles className="h-4 w-4 text-violet" /> Write a note
                </button>
                <button type="button" className="btn-soft btn-sm" onClick={() => messaged(l)}>
                  <Check className="h-4 w-4 text-mint" strokeWidth={3} /> Messaged
                </button>
                {l.url && (
                  <a
                    className="btn-soft btn-sm h-9 w-9 px-0"
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${l.name} on LinkedIn`}
                    title="Open LinkedIn"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── Directory

export function LeadsDirectory({
  leads,
  company,
  onCompany,
  onOpen,
}: {
  leads: Lead[]
  company: string
  onCompany: (c: string) => void
  onOpen: (l: Lead) => void
}) {
  const ctx = usePickContext()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<RoleKind | 'all'>('all')
  const [mutualsOnly, setMutualsOnly] = useState(false)
  const [usOnly, setUsOnly] = useState(true)
  const [showSkipped, setShowSkipped] = useState(false)
  const [limit, setLimit] = useState(40)

  const notInPipeline = useMemo(() => leads.filter((l) => !l.contact_id), [leads])
  const inPipeline = leads.length - notInPipeline.length
  const skipped = notInPipeline.filter((l) => l.hidden).length

  const companies = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of notInPipeline) if (!l.hidden && l.company) counts.set(l.company, (counts.get(l.company) ?? 0) + 1)
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name]) => name)
    if (company !== 'all' && !top.includes(company)) top.push(company)
    return top
  }, [notInPipeline, company])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return notInPipeline
      .filter((l) => (showSkipped ? l.hidden : !l.hidden))
      .filter((l) => company === 'all' || l.company.toLowerCase() === company.toLowerCase())
      .filter((l) => role === 'all' || l.role_kind === role)
      .filter((l) => !mutualsOnly || l.mutuals > 0)
      .filter((l) => !usOnly || l.us)
      .filter(
        (l) =>
          !needle ||
          l.name.toLowerCase().includes(needle) ||
          l.company.toLowerCase().includes(needle) ||
          l.headline.toLowerCase().includes(needle) ||
          l.location.toLowerCase().includes(needle),
      )
      .map((l) => ({ l, s: leadScore(l, ctx) }))
      .sort((a, b) => b.s - a.s || a.l.name.localeCompare(b.l.name))
      .map((x) => x.l)
  }, [notInPipeline, showSkipped, company, role, mutualsOnly, usOnly, q, ctx])

  if (!leads.length) {
    return (
      <div className="card">
        <Empty
          mood="thinking"
          title="Your LinkedIn list is empty"
          body="Profiles you clip into LinkedIn Targets show up here within the hour. Check the connection under Sources."
          action={
            <Link to="/me#sources" className="btn-soft">
              Open Sources
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          className="field pl-11"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setLimit(40)
          }}
          placeholder="Search name, company, title, city"
          aria-label="Search leads"
        />
      </label>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip on={company === 'all'} onClick={() => onCompany('all')}>
          All companies
        </Chip>
        {companies.map((c) => (
          <Chip key={c} on={company === c} onClick={() => onCompany(company === c ? 'all' : c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {ROLE_FILTERS.map((r) => (
          <Chip key={r.value} on={role === r.value} onClick={() => setRole(r.value)}>
            {r.label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip on={mutualsOnly} onClick={() => setMutualsOnly((v) => !v)}>
          <Users className="h-3.5 w-3.5" /> Mutual connections
        </Chip>
        <Chip on={usOnly} onClick={() => setUsOnly((v) => !v)}>
          US only
        </Chip>
      </div>

      <section className="card px-4 pt-1">
        <p className="pt-2 text-[12px] font-extrabold text-ink-3">
          {showSkipped ? 'Skipped people' : filtered.length === 1 ? '1 person' : `${filtered.length} people`} · best matches first
        </p>
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-[14px] font-semibold text-ink-3">Nobody matches. Try removing a filter.</p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.slice(0, limit).map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => onOpen(l)} className="flex w-full items-center gap-3 py-3 text-left">
                  <Avatar text={initials(l.name)} className={ROLE_TONE[l.role_kind]} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-extrabold text-ink">{l.name}</span>
                    <span className="block truncate text-[13px] font-bold text-ink-3">
                      {ROLE_LABEL[l.role_kind]} · {l.company || 'company unknown'}
                      {!l.us && ' · outside US'}
                    </span>
                  </span>
                  {l.mutuals > 0 && (
                    <span className="chip shrink-0 bg-violet/12 text-violet" title={`${l.mutuals} mutual connections`}>
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      <span className="num">{l.mutuals}</span>
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {filtered.length > limit && (
          <button type="button" className="btn-ghost mb-2 w-full" onClick={() => setLimit((n) => n + 40)}>
            Show more
          </button>
        )}
      </section>

      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-1 text-center text-[12px] font-bold text-ink-3">
        {inPipeline > 0 && <span>{inPipeline} already in your pipeline</span>}
        {(skipped > 0 || showSkipped) && (
          <button type="button" className="underline decoration-dotted underline-offset-4" onClick={() => setShowSkipped((v) => !v)}>
            {showSkipped ? 'Back to everyone' : `See ${skipped} skipped`}
          </button>
        )}
      </p>
    </div>
  )
}

// ── One person

export function LeadSheet({
  lead,
  onClose,
  onOpenContact,
}: {
  lead: Lead | null
  onClose: () => void
  onOpenContact: (c: Contact) => void
}) {
  const actions = useActions()
  const toast = useToast()
  const contacts = useRows<Contact>('contacts')
  if (!lead) return null
  const contact = lead.contact_id ? contacts.find((c) => c.id === lead.contact_id) : undefined
  const clipped = lead.clipped_at ? formatDate(wallClock(new Date(lead.clipped_at)).date) : null
  const names = lead.mutual_names.split(', ').filter(Boolean)

  const add = (status: 'to_contact' | 'messaged') => {
    const { undo } = actions.leadToContact(lead, status)
    if (status === 'messaged') cheer()
    toast(
      status === 'messaged'
        ? `Logged. I’ll remind you to follow up with ${firstName(lead.name)} in 5 days.`
        : `${firstName(lead.name)} is in your pipeline`,
      { undo },
    )
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={lead.name}
      footer={
        contact ? undefined : (
          <>
            <button type="button" className="btn-primary flex-1" onClick={() => add('messaged')} data-autofocus>
              I messaged them
            </button>
            <button type="button" className="btn-soft" onClick={() => add('to_contact')}>
              Save for later
            </button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Avatar text={initials(lead.name)} className={`h-12 w-12 text-[16px] ${ROLE_TONE[lead.role_kind]}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <RoleChip kind={lead.role_kind} />
              {lead.company && <span className="chip bg-surface-2 py-0.5 text-ink-2">{lead.company}</span>}
              {!lead.us && <span className="chip bg-amber/15 py-0.5 text-amber">Outside US</span>}
            </div>
            {lead.headline && <p className="mt-1.5 text-[14px] font-semibold leading-snug text-ink-2">{lead.headline}</p>}
            <p className="mt-1 text-[12px] font-bold text-ink-3">
              {[lead.location, clipped && `clipped ${clipped}`].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {lead.mutuals > 0 && (
          <div className="flex gap-2.5 rounded-2xl bg-violet/8 p-3 text-[13px] font-semibold text-ink-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden />
            <p>
              <b className="text-ink">
                {lead.mutuals} mutual connection{lead.mutuals === 1 ? '' : 's'}
              </b>
              {names.length > 0 && `: ${names.join(', ')}${lead.mutuals > names.length ? ` and ${lead.mutuals - names.length} more` : ''}`}.
              A mutual who knows you well can make the intro warm.
            </p>
          </div>
        )}

        <div className="rounded-2xl bg-surface-2/70 p-3">
          <p className="eyebrow">What to ask</p>
          <p className="mt-1 text-[14px] font-semibold text-ink-2">{ROLE_ASK[lead.role_kind]}</p>
        </div>

        {contact && !contact.deleted_at ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-mint/10 p-3">
            <p className="text-[14px] font-bold text-ink">
              In your pipeline ·{' '}
              <span className={`chip py-0.5 ${CONTACT_STATUS[contact.status].tone}`}>{CONTACT_STATUS[contact.status].label}</span>
            </p>
            <button type="button" className="btn-soft btn-sm" onClick={() => onOpenContact(contact)}>
              Open
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {lead.url && (
                <a className="btn-soft btn-sm" href={lead.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Open LinkedIn
                </a>
              )}
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  const undo = actions.hideLead(lead, !lead.hidden)
                  toast(lead.hidden ? `${firstName(lead.name)} is back in your list` : `Skipped ${firstName(lead.name)}`, { undo })
                  onClose()
                }}
              >
                {lead.hidden ? 'Bring back' : 'Not relevant'}
              </button>
            </div>
            <DraftBox key={lead.id} lead={lead} />
          </>
        )}
      </div>
    </Sheet>
  )
}

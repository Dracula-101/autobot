import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ExternalLink, MapPin, Plus, Star, Users } from 'lucide-react'
import {
  cellStates,
  live,
  logicalDay,
  relativeDay,
  type Checkin,
  type Contact,
  type ContactStatus,
  type Job,
  type JobStatus,
  type Lead,
  type LogEntry,
} from '@core/index.ts'
import { useApp, useRows } from '../lib/app'
import { COMPANIES, initials } from '../lib/companies'
import { PageHeader } from '../components/Shell'
import { Avatar, Empty, Segmented, SectionTitle } from '../components/ui'
import { CONTACT_STATUS, ContactSheet, JOB_STATUS, JobSheet } from '../components/HuntSheets'
import { CellTile } from '../components/Cells'
import { LeadSheet, LeadsDirectory, TodaysPicks } from '../components/Leads'

type Tab = 'leads' | 'people' | 'jobs' | 'companies'

const PIPELINE: ContactStatus[] = ['to_contact', 'messaged', 'replied', 'referred']
const JOB_FLOW: JobStatus[] = ['saved', 'applied', 'oa', 'interview', 'offer']

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[12px] font-extrabold text-ink-3">{label}</p>
      <p className="num mt-0.5 text-[22px] font-bold text-ink">{value}</p>
      {sub && <p className="text-[12px] font-bold text-ink-3">{sub}</p>}
    </div>
  )
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function alumniSearch(company: string) {
  const q = `${company} software engineer University of Colorado Boulder`
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`
}

export function HuntPage() {
  const { settings, updateSettings } = useApp()
  const [params, setParams] = useSearchParams()
  const contacts = live(useRows<Contact>('contacts'))
  const jobs = live(useRows<Job>('jobs'))
  const leadRows = useRows<Lead>('leads')
  const leads = useMemo(() => live(leadRows), [leadRows])
  const tab = (params.get('tab') as Tab) || (leads.length ? 'leads' : 'people')
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true })
  const [leadCompany, setLeadCompany] = useState('all')
  const [openLead, setOpenLead] = useState<string | null>(null)
  const lead = openLead ? (leads.find((l) => l.id === openLead) ?? null) : null
  const logs = useRows<LogEntry>('logs')
  const checkins = useRows<Checkin>('day_checkins')
  const today = logicalDay(new Date(), settings.rolloverHour)
  const hunt = cellStates(logs, today, checkins.map((c) => c.date).sort()[0]).hunt

  const [contactSheet, setContactSheet] = useState<{ contact?: Contact | null; prefill?: Partial<Contact> } | null>(null)
  const [jobSheet, setJobSheet] = useState<{ job?: Job | null } | null>(null)
  const [companyFilter, setCompanyFilter] = useState<'all' | 'colorado' | 'targets'>('all')

  const due = contacts.filter((c) => c.status === 'messaged' && c.follow_up_on && c.follow_up_on <= today)
  const interviews = jobs.filter((j) => j.status === 'oa' || j.status === 'interview').length
  const replies = contacts.filter((c) => c.status === 'replied' || c.status === 'referred').length

  const counts = useMemo(() => {
    const byCompany = new Map<string, { people: number; jobs: number; leads: number }>()
    const bump = (company: string, key: 'people' | 'jobs' | 'leads') => {
      const k = company.toLowerCase()
      const cur = byCompany.get(k) ?? { people: 0, jobs: 0, leads: 0 }
      byCompany.set(k, { ...cur, [key]: cur[key] + 1 })
    }
    for (const c of contacts) bump(c.company, 'people')
    for (const j of jobs) bump(j.company, 'jobs')
    for (const l of leads) if (!l.contact_id && !l.hidden) bump(l.company, 'leads')
    return byCompany
  }, [contacts, jobs, leads])

  const toggleTarget = (name: string) => {
    const set = new Set(settings.targetCompanies)
    if (set.has(name)) set.delete(name)
    else set.add(name)
    updateSettings({ targetCompanies: [...set] })
  }

  const companies = COMPANIES.filter((c) =>
    companyFilter === 'colorado' ? c.colorado : companyFilter === 'targets' ? settings.targetCompanies.includes(c.name) : true,
  ).sort((a, b) => Number(settings.targetCompanies.includes(b.name)) - Number(settings.targetCompanies.includes(a.name)))

  const ContactRow = ({ c }: { c: Contact }) => (
    <li>
      <button type="button" onClick={() => setContactSheet({ contact: c })} className="flex w-full items-center gap-3 py-3 text-left">
        <Avatar text={initials(c.name)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold text-ink">{c.name}</p>
          <p className="truncate text-[13px] font-bold text-ink-3">
            {[c.company, c.role].filter(Boolean).join(' · ') || 'No company yet'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`chip ${CONTACT_STATUS[c.status].tone}`}>{CONTACT_STATUS[c.status].label}</span>
          {c.status === 'messaged' && c.follow_up_on && (
            <span className={`text-[11px] font-extrabold ${c.follow_up_on <= today ? 'text-accent' : 'text-ink-3'}`}>
              follow up {relativeDay(c.follow_up_on, today)}
            </span>
          )}
        </div>
      </button>
    </li>
  )

  return (
    <div className="page">
      <PageHeader
        title="Hunt"
        subtitle="Referrals beat cold applying. Ask people, not portals."
        action={
          <button
            type="button"
            className="btn-primary btn-sm h-10"
            onClick={() => (tab === 'jobs' ? setJobSheet({ job: null }) : setContactSheet({ contact: null }))}
          >
            <Plus className="h-4 w-4" strokeWidth={3} /> {tab === 'jobs' ? 'Job' : 'Person'}
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <CellTile state={hunt} blurb="Every message, follow-up, and application charges it — one a day keeps it full." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
          <Stat label="Replies" value={replies} sub="people who wrote back" />
          <Stat label="Interviews" value={interviews} sub="in play" />
        </div>
      </div>

      {due.length > 0 && (
        <section className="card mt-4 p-4 ring-2 ring-accent/30">
          <SectionTitle title="Follow-ups due" hint="A short, friendly bump works more often than you’d think." />
          <ul className="divide-y divide-line">
            {due.map((c) => (
              <ContactRow key={c.id} c={c} />
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4">
        <TodaysPicks leads={leads} onOpen={(l) => setOpenLead(l.id)} />
      </div>

      <Segmented
        className="mb-4 mt-5"
        value={tab}
        onChange={setTab}
        options={[
          ...(leads.length ? [{ value: 'leads' as Tab, label: 'Leads' }] : []),
          { value: 'people', label: 'Pipeline' },
          { value: 'jobs', label: 'Jobs' },
          { value: 'companies', label: 'Companies' },
        ]}
      />

      {tab === 'leads' && (
        <LeadsDirectory leads={leads} company={leadCompany} onCompany={setLeadCompany} onOpen={(l) => setOpenLead(l.id)} />
      )}

      {tab === 'people' && (
        <div className="space-y-4">
          {contacts.length === 0 ? (
            <div className="card">
              <Empty
                mood="wink"
                title="Who could refer you?"
                body={
                  leads.length
                    ? 'Message someone from Today’s picks, or add a person yourself. CU Boulder alumni are the warmest intros.'
                    : 'Add one person at a company that sponsors. CU Boulder alumni are the warmest intros — check the Companies tab.'
                }
                action={
                  <button type="button" className="btn-primary" onClick={() => setContactSheet({ contact: null })}>
                    <Plus className="h-4 w-4" /> Add a person
                  </button>
                }
              />
            </div>
          ) : (
            PIPELINE.map((status) => {
              const list = contacts.filter((c) => c.status === status && !due.includes(c))
              if (!list.length) return null
              return (
                <section key={status} className="card px-4 pt-3">
                  <h3 className="flex items-center justify-between text-[15px] font-black text-ink">
                    {CONTACT_STATUS[status].label}
                    <span className="num text-[12px] text-ink-3">{list.length}</span>
                  </h3>
                  <ul className="divide-y divide-line">
                    {list.map((c) => (
                      <ContactRow key={c.id} c={c} />
                    ))}
                  </ul>
                </section>
              )
            })
          )}
        </div>
      )}

      {tab === 'jobs' && (
        <div className="space-y-4">
          {jobs.length === 0 ? (
            <div className="card">
              <Empty
                mood="happy"
                title="Save the first opening"
                body="Paste a posting link — Autobot fills in the company and flags sponsors."
                action={
                  <button type="button" className="btn-primary" onClick={() => setJobSheet({ job: null })}>
                    <Plus className="h-4 w-4" /> Save a job
                  </button>
                }
              />
            </div>
          ) : (
            [...JOB_FLOW, 'rejected' as JobStatus, 'closed' as JobStatus].map((status) => {
              const list = jobs.filter((j) => j.status === status)
              if (!list.length) return null
              return (
                <section key={status} className="card px-4 pt-3">
                  <h3 className="flex items-center justify-between text-[15px] font-black text-ink">
                    {JOB_STATUS[status].label}
                    <span className="num text-[12px] text-ink-3">{list.length}</span>
                  </h3>
                  <ul className="divide-y divide-line">
                    {list.map((j) => (
                      <li key={j.id}>
                        <button type="button" onClick={() => setJobSheet({ job: j })} className="flex w-full items-center gap-3 py-3 text-left">
                          <Avatar text={initials(j.company)} className="rounded-2xl" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-extrabold text-ink">{j.title || 'Untitled role'}</p>
                            <p className="truncate text-[13px] font-bold text-ink-3">
                              {j.company}
                              {j.location && ` · ${j.location}`}
                            </p>
                          </div>
                          {j.sponsors === 'yes' && <span className="chip bg-mint/15 text-mint">Sponsors</span>}
                          {j.sponsors === 'no' && <span className="chip bg-rose/12 text-rose">No sponsor</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })
          )}
        </div>
      )}

      {tab === 'companies' && (
        <div className="space-y-3">
          <p className="px-1 text-[13px] font-semibold text-ink-3">
            Big employers that have historically sponsored new-grad H-1Bs. Policies change — always confirm on the posting. Star
            your targets; Autobot prioritizes them.
          </p>
          <div className="flex gap-2">
            {(
              [
                ['all', 'All'],
                ['colorado', 'Colorado office'],
                ['targets', 'Starred'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCompanyFilter(value)}
                className={`chip min-h-[34px] px-3.5 text-[13px] ${companyFilter === value ? 'bg-primary text-primary-ink' : 'bg-surface text-ink-2 shadow-card'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <ul className="space-y-2">
            {companies.map((c) => {
              const count = counts.get(c.name.toLowerCase())
              const starred = settings.targetCompanies.includes(c.name)
              const saved = count ? [count.people && plural(count.people, 'person', 'people'), count.jobs && plural(count.jobs, 'job')].filter(Boolean).join(' · ') : ''
              return (
                <li key={c.name} className="card flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleTarget(c.name)}
                    aria-pressed={starred}
                    aria-label={starred ? `Unstar ${c.name}` : `Star ${c.name}`}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${starred ? 'bg-amber/20 text-amber' : 'bg-surface-2 text-ink-3'}`}
                  >
                    <Star className="h-[18px] w-[18px]" fill={starred ? 'currentColor' : 'none'} strokeWidth={2.4} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-extrabold text-ink">{c.name}</p>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] font-bold text-ink-3">
                      {c.colorado && (
                        <span className="inline-flex items-center gap-0.5 text-a-class">
                          <MapPin className="h-3 w-3" /> {c.colorado} ·
                        </span>
                      )}
                      {count?.leads ? (
                        <button
                          type="button"
                          className="font-extrabold text-a-hunt underline decoration-dotted underline-offset-4"
                          onClick={() => {
                            setLeadCompany(c.name)
                            setTab('leads')
                          }}
                        >
                          {plural(count.leads, 'lead')} on your list
                        </button>
                      ) : null}
                      {count?.leads && saved ? ' · ' : ''}
                      {saved || (count?.leads ? '' : 'Nobody saved yet')}
                    </p>
                  </div>
                  <a className="btn-soft btn-sm" href={alumniSearch(c.name)} target="_blank" rel="noreferrer" title="CU Boulder alumni there">
                    <Users className="h-4 w-4" /> Alumni
                  </a>
                  <a className="btn-ghost btn-sm h-9 w-9 px-0" href={c.careers} target="_blank" rel="noreferrer" aria-label={`${c.name} careers`}>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <LeadSheet
        lead={lead}
        onClose={() => setOpenLead(null)}
        onOpenContact={(c) => {
          setOpenLead(null)
          setContactSheet({ contact: c })
        }}
      />
      <ContactSheet
        open={Boolean(contactSheet)}
        onClose={() => setContactSheet(null)}
        contact={contactSheet?.contact ?? null}
        prefill={contactSheet?.prefill}
      />
      <JobSheet
        open={Boolean(jobSheet)}
        onClose={() => setJobSheet(null)}
        job={jobSheet?.job ?? null}
        onFindReferrer={(job) => {
          setJobSheet(null)
          setTab('people')
          setContactSheet({ contact: null, prefill: { company: job.company, job_id: job.id } })
        }}
      />
    </div>
  )
}

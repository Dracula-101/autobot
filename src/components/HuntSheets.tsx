import { useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, Mail, Sparkles, Trash2 } from 'lucide-react'
import { formatDate, logicalDay, relativeDay, type Contact, type ContactStatus, type Job, type JobStatus, type Lead } from '@core/index.ts'
import { useApp, useRows } from '../lib/app'
import { useActions } from '../lib/useActions'
import { api, type Draft } from '../lib/api'
import { COMPANIES, companyByName, companyFromEmail, parseJobUrl } from '../lib/companies'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { cheer } from './Autobot'

export const CONTACT_STATUS: Record<ContactStatus, { label: string; tone: string }> = {
  to_contact: { label: 'To reach out', tone: 'bg-surface-2 text-ink-2' },
  messaged: { label: 'Messaged', tone: 'bg-sky/15 text-sky' },
  replied: { label: 'Replied', tone: 'bg-violet/15 text-violet' },
  referred: { label: 'Referred', tone: 'bg-mint/15 text-mint' },
  closed: { label: 'Closed', tone: 'bg-surface-2 text-ink-3' },
}

export const JOB_STATUS: Record<JobStatus, { label: string; tone: string }> = {
  saved: { label: 'Saved', tone: 'bg-surface-2 text-ink-2' },
  applied: { label: 'Applied', tone: 'bg-sky/15 text-sky' },
  oa: { label: 'OA / Screen', tone: 'bg-amber/15 text-amber' },
  interview: { label: 'Interview', tone: 'bg-violet/15 text-violet' },
  offer: { label: 'Offer', tone: 'bg-mint/15 text-mint' },
  rejected: { label: 'Rejected', tone: 'bg-rose/12 text-rose' },
  closed: { label: 'Closed', tone: 'bg-surface-2 text-ink-3' },
}

function CompanyInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <>
      <input id={id} className="field" list="company-list" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Google" />
      <datalist id="company-list">
        {COMPANIES.map((c) => (
          <option key={c.name} value={c.name} />
        ))}
      </datalist>
    </>
  )
}

/** LinkedIn cuts connection notes off at 200 characters on free accounts. */
const NOTE_LIMIT = 200

export function DraftBox({ contact, lead, followUp = false }: { contact?: Contact; lead?: Lead; followUp?: boolean }) {
  const { cloud } = useApp()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channel = !contact || contact.channel === 'linkedin' ? 'linkedin' : 'email'
  // Someone clipped from LinkedIn isn't a connection yet: the first touch is a connection note.
  const note = !contact && Boolean(lead)
  const handle = contact?.handle ?? lead?.url ?? ''

  const generate = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.draft(
        contact
          ? { contactId: contact.id, jobId: contact.job_id ?? undefined, channel, followUp }
          : { leadId: lead?.id, channel: 'linkedin' },
      )
      setDraft(res.draft)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t draft that.')
    } finally {
      setBusy(false)
    }
  }

  if (!cloud) return null
  if (!draft) {
    return (
      <div className="space-y-2">
        <button type="button" className="btn-soft w-full" onClick={() => void generate()} disabled={busy}>
          <Sparkles className="h-4 w-4 text-violet" />
          {busy ? 'Writing…' : followUp ? 'Draft a follow-up' : note ? 'Draft a connection note' : 'Draft the referral ask'}
        </button>
        {error && <p className="text-[13px] font-bold text-rose">{error}</p>}
      </div>
    )
  }
  const text = channel === 'email' && draft.subject ? `Subject: ${draft.subject}\n\n${draft.body}` : draft.body
  const mailto =
    channel === 'email' && handle.includes('@')
      ? `mailto:${handle}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`
      : null
  const over = note && draft.body.length > NOTE_LIMIT
  return (
    <div className="space-y-2 rounded-2xl bg-violet/8 p-3">
      <p className="text-[12px] font-black uppercase tracking-[0.08em] text-violet">Autobot’s draft — edit freely</p>
      {channel === 'email' && (
        <input className="field" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} aria-label="Subject" />
      )}
      <textarea
        className="field resize-none"
        rows={note ? 4 : 8}
        value={draft.body}
        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        aria-label="Message"
      />
      {note && (
        <p className={`text-right text-[12px] font-bold ${over ? 'text-rose' : 'text-ink-3'}`}>
          <span className="num">{draft.body.length}</span> / {NOTE_LIMIT}
          {over ? ' — LinkedIn will cut this off, trim it' : ' · fits a connection note'}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-soft btn-sm"
          onClick={() => {
            void navigator.clipboard.writeText(text)
            toast('Copied')
          }}
        >
          <Copy className="h-4 w-4" /> Copy
        </button>
        {mailto && (
          <a className="btn-soft btn-sm" href={mailto}>
            <Mail className="h-4 w-4" /> Open email
          </a>
        )}
        {channel === 'linkedin' && handle.startsWith('http') && (
          <a className="btn-soft btn-sm" href={handle} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" /> Open LinkedIn
          </a>
        )}
        <button type="button" className="btn-ghost btn-sm" onClick={() => void generate()} disabled={busy}>
          {busy ? 'Rewriting…' : 'Try again'}
        </button>
      </div>
    </div>
  )
}

export function ContactSheet({
  open,
  onClose,
  contact,
  prefill,
}: {
  open: boolean
  onClose: () => void
  contact?: Contact | null
  prefill?: Partial<Contact>
}) {
  const actions = useActions()
  const toast = useToast()
  const { settings } = useApp()
  const today = logicalDay(new Date(), settings.rolloverHour)
  const jobs = useRows<Job>('jobs')
  const [form, setForm] = useState<Partial<Contact>>({})

  useEffect(() => {
    if (open) setForm(contact ?? { channel: 'linkedin', status: 'to_contact', ...prefill })
  }, [open, contact, prefill])

  const set = <K extends keyof Contact>(k: K, v: Contact[K]) => setForm((f) => ({ ...f, [k]: v }))
  const companyJobs = useMemo(
    () => jobs.filter((j) => form.company && j.company.toLowerCase() === form.company.toLowerCase()),
    [jobs, form.company],
  )

  const save = () => {
    if (!form.name?.trim()) return
    const saved = actions.saveContact({ ...form, name: form.name.trim(), company: form.company?.trim() ?? '' } as Contact)
    toast(contact ? 'Saved' : `Added ${saved.name}`)
    onClose()
  }

  const setStatus = (status: ContactStatus) => {
    if (!contact) return
    const undo = actions.setContactStatus(contact, status)
    if (status === 'messaged' || status === 'referred') cheer()
    toast(
      status === 'messaged'
        ? 'Logged. I’ll nudge you to follow up in 5 days.'
        : `${contact.name}: ${CONTACT_STATUS[status].label.toLowerCase()}`,
      { undo },
    )
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={contact ? contact.name : 'Add a person'}
      footer={
        <button type="button" className="btn-primary flex-1" onClick={save} disabled={!form.name?.trim()}>
          {contact ? 'Save changes' : 'Add to pipeline'}
        </button>
      }
    >
      <div className="space-y-4">
        {contact && (
          <>
            <div className="flex flex-wrap gap-2">
              {contact.status !== 'messaged' && (
                <button type="button" className="btn-primary btn-sm" onClick={() => setStatus('messaged')}>
                  I messaged them
                </button>
              )}
              {contact.status === 'messaged' && (
                <button
                  type="button"
                  className="btn-soft btn-sm"
                  onClick={() => {
                    const undo = actions.bumpFollowUp(contact)
                    toast('Follow-up logged — next check in 5 days', { undo })
                    onClose()
                  }}
                >
                  I followed up
                </button>
              )}
              {(['replied', 'referred', 'closed'] as ContactStatus[])
                .filter((s) => s !== contact.status)
                .map((s) => (
                  <button key={s} type="button" className="btn-soft btn-sm" onClick={() => setStatus(s)}>
                    {s === 'replied' ? 'They replied' : s === 'referred' ? 'They referred me 🎉' : 'Close'}
                  </button>
                ))}
            </div>
            {contact.follow_up_on && contact.status === 'messaged' && (
              <p className="text-[13px] font-bold text-ink-3">Follow up {relativeDay(contact.follow_up_on, today)}</p>
            )}
            <DraftBox contact={contact} followUp={contact.status === 'messaged'} />
          </>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="c-name">
              Name
            </label>
            <input id="c-name" className="field" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="Priya Shah" />
          </div>
          <div>
            <label className="label" htmlFor="c-company">
              Company
            </label>
            <CompanyInput id="c-company" value={form.company ?? ''} onChange={(v) => set('company', v)} />
          </div>
          <div>
            <label className="label" htmlFor="c-role">
              Their role
            </label>
            <input id="c-role" className="field" value={form.role ?? ''} onChange={(e) => set('role', e.target.value)} placeholder="SWE II" />
          </div>
        </div>
        <div>
          <p className="label">Reach them on</p>
          <div className="flex gap-2">
            {(['linkedin', 'email'] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => set('channel', ch)}
                className={`btn-sm flex-1 rounded-xl font-extrabold ${form.channel === ch ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink-3'}`}
              >
                {ch === 'linkedin' ? 'LinkedIn' : 'Email'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="c-handle">
            {form.channel === 'email' ? 'Work email' : 'LinkedIn profile URL'}
          </label>
          <input
            id="c-handle"
            className="field"
            value={form.handle ?? ''}
            onChange={(e) => {
              const handle = e.target.value
              setForm((f) => {
                const guessed = f.company ? undefined : companyFromEmail(handle)
                return { ...f, handle, ...(guessed ? { company: guessed } : {}) }
              })
            }}
            placeholder={form.channel === 'email' ? 'priya@google.com' : 'https://www.linkedin.com/in/…'}
            inputMode={form.channel === 'email' ? 'email' : 'url'}
          />
        </div>
        {companyJobs.length > 0 && (
          <div>
            <label className="label" htmlFor="c-job">
              For which opening?
            </label>
            <select id="c-job" className="field" value={form.job_id ?? ''} onChange={(e) => set('job_id', e.target.value || null)}>
              <option value="">Not tied to a posting</option>
              {companyJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title || 'Untitled role'}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="c-notes">
            Notes
          </label>
          <textarea
            id="c-notes"
            rows={3}
            className="field resize-none"
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="CU Boulder alum, works on Search infra"
          />
        </div>
        {contact && (
          <button
            type="button"
            className="btn-ghost w-full text-rose"
            onClick={() => {
              const undo = actions.deleteContact(contact)
              toast('Removed', { undo })
              onClose()
            }}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </button>
        )}
      </div>
    </Sheet>
  )
}

export function JobSheet({
  open,
  onClose,
  job,
  onFindReferrer,
}: {
  open: boolean
  onClose: () => void
  job?: Job | null
  onFindReferrer: (job: Job) => void
}) {
  const actions = useActions()
  const toast = useToast()
  const [form, setForm] = useState<Partial<Job>>({})

  useEffect(() => {
    if (open) setForm(job ?? { status: 'saved', sponsors: 'unknown' })
  }, [open, job])

  const set = <K extends keyof Job>(k: K, v: Job[K]) => setForm((f) => ({ ...f, [k]: v }))

  const onUrl = (url: string) => {
    const guess = parseJobUrl(url)
    setForm((f) => {
      const company = f.company || guess.company || ''
      return {
        ...f,
        url,
        company,
        title: f.title || guess.title || '',
        sponsors: f.sponsors === 'unknown' && companyByName(company) ? 'yes' : f.sponsors,
      }
    })
  }

  const save = () => {
    if (!form.company?.trim()) return
    actions.saveJob({ ...form, company: form.company.trim() } as Job)
    toast(job ? 'Saved' : 'Job saved')
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={job ? `${job.company}${job.title ? ` — ${job.title}` : ''}` : 'Save a job'}
      footer={
        <button type="button" className="btn-primary flex-1" onClick={save} disabled={!form.company?.trim()}>
          {job ? 'Save changes' : 'Save job'}
        </button>
      }
    >
      <div className="space-y-4">
        {job && (
          <div className="flex flex-wrap gap-2">
            {job.status === 'saved' && (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => {
                  const undo = actions.setJobStatus(job, 'applied')
                  cheer()
                  toast('Applied — logged toward this week', { undo })
                  onClose()
                }}
              >
                I applied
              </button>
            )}
            <button type="button" className="btn-soft btn-sm" onClick={() => onFindReferrer(job)}>
              Find a referrer
            </button>
            {job.url && (
              <a className="btn-soft btn-sm" href={job.url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Posting
              </a>
            )}
          </div>
        )}
        <div>
          <label className="label" htmlFor="j-url">
            Posting link
          </label>
          <input
            id="j-url"
            className="field"
            value={form.url ?? ''}
            onChange={(e) => onUrl(e.target.value)}
            placeholder="Paste a Greenhouse / Lever / Workday / careers link"
            inputMode="url"
          />
          <p className="mt-1 text-[12px] font-bold text-ink-3">Autobot fills in the company (and title when the link has one).</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="j-company">
              Company
            </label>
            <CompanyInput
              id="j-company"
              value={form.company ?? ''}
              onChange={(v) =>
                setForm((f) => ({ ...f, company: v, sponsors: f.sponsors === 'unknown' && companyByName(v) ? 'yes' : f.sponsors }))
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="j-title">
              Role
            </label>
            <input id="j-title" className="field" value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Software Engineer, New Grad" />
          </div>
          <div>
            <label className="label" htmlFor="j-loc">
              Location
            </label>
            <input id="j-loc" className="field" value={form.location ?? ''} onChange={(e) => set('location', e.target.value)} placeholder="Boulder, CO" />
          </div>
          <div>
            <label className="label" htmlFor="j-status">
              Status
            </label>
            <select id="j-status" className="field" value={form.status ?? 'saved'} onChange={(e) => set('status', e.target.value as JobStatus)}>
              {(Object.keys(JOB_STATUS) as JobStatus[]).map((s) => (
                <option key={s} value={s}>
                  {JOB_STATUS[s].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <p className="label">Sponsors visas?</p>
          <div className="flex gap-2">
            {(['yes', 'unknown', 'no'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => set('sponsors', v)}
                className={`btn-sm flex-1 rounded-xl font-extrabold ${form.sponsors === v ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink-3'}`}
              >
                {v === 'yes' ? 'Yes' : v === 'no' ? 'No' : 'Not sure'}
              </button>
            ))}
          </div>
          {form.company && companyByName(form.company) && (
            <p className="mt-1 text-[12px] font-bold text-ink-3">
              {form.company} has historically sponsored H-1B for new grads — confirm on the posting.
            </p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="j-notes">
            Notes
          </label>
          <textarea id="j-notes" rows={3} className="field resize-none" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </div>
        {job?.applied_on && <p className="text-[13px] font-bold text-ink-3">Applied {formatDate(job.applied_on, { weekday: true })}</p>}
        {job && (
          <button
            type="button"
            className="btn-ghost w-full text-rose"
            onClick={() => {
              const undo = actions.deleteJob(job)
              toast('Removed', { undo })
              onClose()
            }}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </button>
        )}
      </div>
    </Sheet>
  )
}

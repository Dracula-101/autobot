// Turning Pratik's external data into something Autobot can act on:
// LinkedIn-clipped profiles become leads (canonical company, role, mutual
// connections), and checker rows become assignments with due dates.

import type { Assignment, ClassBlock, Lead, RoleKind } from './types.ts'
import { hash128 } from './ids.ts'

// ── Leads ───────────────────────────────────────────────────────────────────

export interface RawProfile {
  id: number | string
  url?: string | null
  name?: string | null
  headline?: string | null
  location?: string | null
  current_company?: string | null
  summary?: string | null
  clipped_at?: string | null
}

export type LeadFields = Omit<Lead, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'contact_id' | 'hidden'>

/** Canonical names, checked in order; the earliest match in the text wins. */
const KNOWN: [name: string, pattern: RegExp][] = [
  ['Amazon', /\b(amazon|aws)\b/i],
  ['Tesla', /\btesla\b/i],
  ['Oracle', /\b(oracle|oci)\b/i],
  ['Google', /\b(google|alphabet)\b/i],
  ['Microsoft', /\bmicrosoft\b/i],
  ['Meta', /\bmeta\b(?! ?data)/i],
  ['Apple', /\bapple\b/i],
  ['NVIDIA', /\bnvidia\b/i],
  ['Salesforce', /\bsalesforce\b/i],
  ['Adobe', /\badobe\b/i],
  ['IBM', /\bibm\b/i],
  ['Intel', /\bintel\b/i],
  ['Qualcomm', /\bqualcomm\b/i],
  ['Uber', /\buber\b/i],
  ['Stripe', /\bstripe\b/i],
  ['Databricks', /\bdatabricks\b/i],
  ['Snowflake', /\bsnowflake\b/i],
  ['Scale AI', /\bscale ?ai\b|\bscale\.com\b/i],
  ['Palantir', /\bpalantir\b/i],
  ['Workday', /\bworkday\b/i],
  ['Cisco', /\bcisco\b/i],
  ['LinkedIn', /\blinkedin\b/i],
]

const SMALL_CAPS: Record<string, string> = {
  ᴀ: 'a', ʙ: 'b', ᴄ: 'c', ᴅ: 'd', ᴇ: 'e', ꜰ: 'f', ɢ: 'g', ʜ: 'h', ɪ: 'i', ᴊ: 'j', ᴋ: 'k', ʟ: 'l', ᴍ: 'm',
  ɴ: 'n', ᴏ: 'o', ᴘ: 'p', ǫ: 'q', ʀ: 'r', ꜱ: 's', ᴛ: 't', ᴜ: 'u', ᴠ: 'v', ᴡ: 'w', ʏ: 'y', ᴢ: 'z',
}

/** Fold stylized unicode (𝐀𝐦𝐚𝐳𝐨𝐧, ᴀᴍᴀᴢᴏɴ, fullwidth) to plain letters. */
export function fold(text: string): string {
  return text.normalize('NFKC').replace(/[ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡʏᴢ]/g, (c) => SMALL_CAPS[c] ?? c)
}

/** Drop "Ex-Microsoft", "Former …", "Previously …" segments before matching. */
function current(text: string): string {
  return fold(text)
    .split(/\s*[|•·]\s*/)
    .filter((part) => !/^\s*(ex[- ]|former|previously|prev\b|past\b)/i.test(part))
    .join(' | ')
}

function knownIn(text: string): string | null {
  const t = current(text)
  let best: { name: string; at: number } | null = null
  for (const [name, re] of KNOWN) {
    const m = re.exec(t)
    if (m && (!best || m.index < best.at)) best = { name, at: m.index }
  }
  return best?.name ?? null
}

/** Strip emoji, hiring blurbs and trailing qualifiers from a free-text company. */
function tidyCompany(raw: string): string {
  return fold(raw)
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
    .split(/\s*(?:[|,(!]|\bhiring\b|\s-\s)/i)[0]
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

export function companyOf(currentCompany: string, headline: string): string {
  const fromField = currentCompany ? knownIn(currentCompany) : null
  if (fromField) return fromField
  const fromHeadline = knownIn(headline)
  if (fromHeadline) return fromHeadline
  if (currentCompany) return tidyCompany(currentCompany)
  const m = /(?:\bat\b|@)\s*([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})/.exec(current(headline))
  return m ? tidyCompany(m[1]) : ''
}

export function roleOf(headline: string): RoleKind {
  const h = current(headline)
  const hiringSide = /\b(recruit\w*|talent|sourc(er|ing)|headhunt\w*|hiring|people partner|staffing|opportunit\w*)\b|\bTA\b/i.test(h)
  if (hiringSide && /\b(universit\w*|campus|early[- ]?career|new[- ]?grads?|interns?(hips?)?|students?|emerging talent|graduates?|entry[- ]level)\b/i.test(h)) {
    return 'university'
  }
  if (hiringSide) return 'recruiter'
  if (/\b(manager|director|head of|vp|vice president|lead|founder|cto|ceo|sdm|em)\b/i.test(h)) return 'manager'
  if (/\b(engineer\w*|developer|sde|swe|scientist|architect|programmer|devops|sre)\b/i.test(h)) return 'engineer'
  return 'other'
}

const NON_US =
  /\b(india|bengaluru|bangalore|hyderabad|pune|chennai|mumbai|delhi|gurgaon|gurugram|noida|kolkata|canada|toronto|vancouver|montreal|united kingdom|england|london|ireland|dublin|germany|berlin|munich|singapore|china|shanghai|beijing|japan|tokyo|mexico|brazil|australia|sydney|luxembourg|spain|madrid|barcelona|france|paris|netherlands|amsterdam|poland|romania|costa rica|philippines|vietnam|israel|tel aviv|south africa|egypt|uae|dubai|korea|seoul|taiwan|malaysia|argentina|colombia|chile|italy|sweden|norway|denmark|finland|czech|hungary|portugal|belgium|switzerland|austria|new zealand|turkey|saudi)\b/i

export function isUS(location: string): boolean {
  return !NON_US.test(location)
}

/** "A, B & 2 other mutual connections" / "A & B are…" / "A is a mutual connection" */
export function parseMutuals(summary: string): { count: number; names: string[] } {
  const s = (summary ?? '').trim()
  if (!/mutual connection/i.test(s)) return { count: 0, names: [] }
  const others = /&\s*(\d+)\s+other/i.exec(s)
  const head = s
    .replace(/\s*&\s*\d+\s+other mutual connections?.*$/i, '')
    .replace(/\s+(is|are)\s+(a\s+)?mutual connections?.*$/i, '')
  const names = head
    .split(/\s*,\s*|\s*&\s*|\s+and\s+/)
    .map((n) => n.trim())
    .filter((n) => n && !/mutual/i.test(n))
  return { count: names.length + (others ? Number(others[1]) : 0), names }
}

export function normalizeProfile(p: RawProfile): LeadFields {
  const headline = (p.headline ?? '').trim()
  const companyRaw = (p.current_company ?? '').trim()
  const mutuals = parseMutuals(p.summary ?? '')
  const location = (p.location ?? '').trim()
  return {
    source: 'linkedin',
    source_id: String(p.id),
    name: (p.name ?? '').trim() || 'Unknown',
    url: (p.url ?? '').trim(),
    headline,
    company: companyOf(companyRaw, headline),
    company_raw: companyRaw,
    role_kind: roleOf(headline),
    location,
    us: isUS(location),
    mutuals: mutuals.count,
    mutual_names: mutuals.names.join(', '),
    clipped_at: p.clipped_at ?? null,
  }
}

export const ROLE_LABEL: Record<RoleKind, string> = {
  university: 'New-grad recruiter',
  recruiter: 'Recruiter',
  manager: 'Hiring manager',
  engineer: 'Engineer',
  other: 'Other',
}

/** What each kind of person is best asked for. */
export const ROLE_ASK: Record<RoleKind, string> = {
  university: 'Ask which new-grad SDE reqs are open and whether they sponsor.',
  recruiter: 'Ask who covers new-grad hiring, or about a specific req.',
  manager: 'Short pitch for their team; ask for 15 minutes.',
  engineer: 'Ask for a referral to a specific opening.',
  other: 'Ask who the right person is.',
}

const ROLE_WEIGHT: Record<RoleKind, number> = { university: 50, recruiter: 30, manager: 25, engineer: 20, other: 0 }

export interface PickContext {
  targets: string[]
  jobCompanies: Set<string>
}

export function leadScore(l: Lead, ctx: PickContext): number {
  let score = ROLE_WEIGHT[l.role_kind]
  if (l.mutuals > 0) score += 15 + 5 * Math.min(l.mutuals, 3)
  if (ctx.targets.some((t) => t.toLowerCase() === l.company.toLowerCase())) score += 20
  if (ctx.jobCompanies.has(l.company.toLowerCase())) score += 10
  if (!l.us) score -= 40
  return score
}

export function isOpenLead(l: Lead): boolean {
  return !l.deleted_at && !l.hidden && !l.contact_id
}

/** Today's handful to message: best-scored, rotating daily, no more than two per company. */
export function dailyPicks(leads: Lead[], ctx: PickContext, date: string, n = 3): Lead[] {
  const jitter = (l: Lead) => parseInt(hash128(`${date}:${l.id}`).slice(0, 6), 16) / 0xffffff
  const ranked = leads
    .filter(isOpenLead)
    .map((l) => ({ l, s: leadScore(l, ctx) + jitter(l) * 12 }))
    .sort((a, b) => b.s - a.s)
  const perCompany = new Map<string, number>()
  const out: Lead[] = []
  for (const { l } of ranked) {
    const k = l.company.toLowerCase() || '?'
    if ((perCompany.get(k) ?? 0) >= 2) continue
    perCompany.set(k, (perCompany.get(k) ?? 0) + 1)
    out.push(l)
    if (out.length === n) break
  }
  return out
}

// ── Assignments ─────────────────────────────────────────────────────────────

export interface RawAssignment {
  id: number | string
  assignment_name?: string | null
  course_name?: string | null
  due_at?: string | null
  url?: string | null
  status?: string | null
  checked_at?: string | null
}

export type AssignmentFields = Omit<Assignment, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'done_at'>

export function normalizeAssignment(r: RawAssignment): AssignmentFields {
  return {
    source: 'checker',
    source_id: String(r.id),
    title: (r.assignment_name ?? '').trim() || 'Assignment',
    course: (r.course_name ?? '').trim(),
    due_at: r.due_at ?? null,
    url: (r.url ?? '').trim(),
    source_status: (r.status ?? '').trim(),
    checked_at: r.checked_at ?? null,
  }
}

const DONE_STATUS = /\b(submitted|completed?|graded|done|turned in|excused|finished)\b/i
const NOT_DONE = /\b(not|no|never)\s+(yet\s+)?(submitted|completed?|graded|done|turned in|finished)\b/i

export function assignmentDone(a: Pick<Assignment, 'done_at' | 'source_status'>): boolean {
  if (a.done_at) return true
  return DONE_STATUS.test(a.source_status) && !NOT_DONE.test(a.source_status)
}

/** Match "CSCI 5229-001: Computer Graphics" to his class short name ("Graphics"). */
export function courseShort(course: string, classes: ClassBlock[]): string {
  const num = /\b(\d{4})\b/.exec(course)?.[1]
  const hit = classes.find(
    (c) => (num && c.id.includes(num)) || course.toLowerCase().includes(c.name.toLowerCase()),
  )
  if (hit) return hit.short
  return course.replace(/^[A-Z]{2,5}\s*\d{4}(-\d+)?\s*[:-]\s*/, '').slice(0, 32) || course
}

/** Open assignments due from yesterday onward, soonest first. */
export function upcomingAssignments(list: Assignment[], now: Date, withinDays = 14): Assignment[] {
  const from = now.getTime() - 86_400_000
  const to = now.getTime() + withinDays * 86_400_000
  return list
    .filter((a) => !a.deleted_at && !assignmentDone(a) && a.due_at)
    .filter((a) => {
      const t = new Date(a.due_at!).getTime()
      return t >= from && t <= to
    })
    .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
}

/** "in 5h", "tomorrow", "in 3 days", "2h ago" */
export function dueIn(dueAt: string, now: Date): string {
  const mins = Math.round((new Date(dueAt).getTime() - now.getTime()) / 60_000)
  if (mins < 0) return mins > -60 ? `${-mins} min ago` : `${Math.round(-mins / 60)}h ago`
  if (mins < 60) return `in ${mins} min`
  if (mins < 24 * 60) return `in ${Math.round(mins / 60)}h`
  const days = Math.round(mins / (24 * 60))
  return days === 1 ? 'tomorrow' : `in ${days} days`
}

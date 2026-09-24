// Sample data for local mode (?demo), so every screen can be tried without an
// account. Generic on purpose — real knowledge lives only in Supabase.

import { addDays, logicalDay, stableId, weekStart } from '@core/index.ts'
import type { SyncRow, SyncStore } from './sync'

export function loadDemo(store: SyncStore) {
  if (store.rows('memories').length) return
  const today = logicalDay()
  const ws = weekStart(today)
  const id = (seed: string) => stableId(`demo:${seed}`)
  const rows = <T extends object>(list: T[]) => list as unknown as SyncRow[]

  store.upsert(
    'memories',
    rows([
      { id: id('m1'), category: 'job', content: 'Looking for new-grad SWE roles at companies that sponsor visas', source: 'seed', pinned: true },
      { id: id('m2'), category: 'habit', content: 'Stalls when working from his room — focuses best at the library', source: 'seed', pinned: false },
      { id: id('m3'), category: 'health', content: 'Takes one pill after waking and one at night; hair serum twice a day', source: 'seed', pinned: false },
      { id: id('m4'), category: 'schedule', content: 'Night owl: asleep around 2–3 AM, up around 10–11 AM', source: 'seed', pinned: false },
      { id: id('m5'), category: 'goal', content: 'Wants to get fitter and lose body fat this semester', source: 'seed', pinned: false },
    ]),
  )
  store.upsert(
    'contacts',
    rows([
      { id: id('c1'), name: 'Priya Shah', company: 'Google', role: 'SWE II', channel: 'linkedin', handle: '', status: 'messaged', last_contact_at: new Date().toISOString(), follow_up_on: today, notes: '' },
      { id: id('c2'), name: 'Marcus Lee', company: 'Stripe', role: 'Engineer', channel: 'email', handle: 'marcus@stripe.com', status: 'to_contact', follow_up_on: null, notes: '' },
      { id: id('c3'), name: 'Ana Ruiz', company: 'Microsoft', role: 'Senior SDE', channel: 'linkedin', handle: '', status: 'replied', follow_up_on: null, notes: 'Happy to refer once I pick a role' },
    ]),
  )
  store.upsert(
    'jobs',
    rows([
      { id: id('j1'), company: 'Google', title: 'Software Engineer, Early Career', url: 'https://www.google.com/about/careers/applications/', location: 'Boulder, CO', status: 'saved', sponsors: 'yes', applied_on: null, notes: '' },
      { id: id('j2'), company: 'Stripe', title: 'Software Engineer, New Grad', url: 'https://stripe.com/jobs', location: 'Remote', status: 'applied', sponsors: 'yes', applied_on: addDays(today, -2), notes: '' },
    ]),
  )
  store.upsert(
    'problems',
    rows([
      { id: id('p1'), slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy', pattern: 'arrays', result: 'solved', attempts: 1, interval_days: 7, next_review: addDays(today, 3), last_solved_on: addDays(today, -4), notes: '' },
      { id: id('p2'), slug: 'valid-anagram', title: 'Valid Anagram', difficulty: 'Easy', pattern: 'arrays', result: 'hints', attempts: 1, interval_days: 3, next_review: today, last_solved_on: addDays(today, -3), notes: '' },
      { id: id('p3'), slug: 'valid-parentheses', title: 'Valid Parentheses', difficulty: 'Easy', pattern: 'stack', result: 'solved', attempts: 2, interval_days: 14, next_review: addDays(today, 9), last_solved_on: addDays(today, -5), notes: '' },
    ]),
  )
  // Fake people and coursework — the real lists come from his other projects.
  const lead = (key: string, name: string, headline: string, company: string, role_kind: string, extra: object = {}) => ({
    id: id(`lead-${key}`),
    source: 'linkedin',
    source_id: key,
    name,
    url: 'https://www.linkedin.com/',
    headline,
    company,
    company_raw: company,
    role_kind,
    location: 'Seattle, Washington, United States',
    us: true,
    mutuals: 0,
    mutual_names: '',
    clipped_at: new Date().toISOString(),
    contact_id: null,
    hidden: false,
    ...extra,
  })
  store.upsert(
    'leads',
    rows([
      lead('1', 'Jordan Blake', 'University Recruiter, Early Careers @ Amazon', 'Amazon', 'university', { mutuals: 3, mutual_names: 'Sam Ortiz, Lee Park' }),
      lead('2', 'Riley Chen', 'Technical Recruiter | Hiring SDEs at AWS', 'Amazon', 'recruiter', { mutuals: 1, mutual_names: 'Sam Ortiz' }),
      lead('3', 'Morgan Diaz', 'Software Development Manager at Amazon', 'Amazon', 'manager'),
      lead('4', 'Casey Nguyen', 'New Grad Recruiting @ Tesla', 'Tesla', 'university', { location: 'Austin, Texas, United States' }),
      lead('5', 'Taylor Brooks', 'Senior Software Engineer at Tesla', 'Tesla', 'engineer', { mutuals: 2, mutual_names: 'Lee Park, Ana Ruiz' }),
      lead('6', 'Avery Singh', 'Talent Acquisition, OCI | Oracle', 'Oracle', 'recruiter', { location: 'Bengaluru, Karnataka, India', us: false }),
      lead('7', 'Quinn Foster', 'Engineering Manager, Oracle Cloud Infrastructure', 'Oracle', 'manager', { location: 'Denver, Colorado, United States' }),
    ]),
  )
  const at = (days: number, hour = 23, minute = 59) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(hour, minute, 0, 0)
    return d.toISOString()
  }
  const task = (key: string, title: string, course: string, due_at: string, extra: object = {}) => ({
    id: id(`asg-${key}`),
    source: 'checker',
    source_id: key,
    title,
    course,
    due_at,
    url: 'https://canvas.colorado.edu/',
    source_status: '',
    checked_at: new Date().toISOString(),
    done_at: null,
    ...extra,
  })
  store.upsert(
    'assignments',
    rows([
      task('1', 'HW3: Shading and Lighting', 'CSCI 5229-001: Computer Graphics', at(1)),
      task('2', 'Lab 4: systemd services', 'CSCI 5113: Linux System Administration', at(3, 12, 30)),
      task('3', 'Sprint 2 demo', 'CSCI 5040: Professional Masters Project', at(9, 17, 0)),
      task('4', 'Lab 3: Users and permissions', 'CSCI 5113: Linux System Administration', at(-3, 12, 30), { source_status: 'submitted' }),
    ]),
  )
  store.upsert(
    'logs',
    rows([
      { id: id('l1'), day: ws, kind: 'referral', amount: 2, note: null },
      { id: id('l2'), day: ws, kind: 'leetcode', amount: 3, note: null },
      { id: id('l3'), day: addDays(ws, 1), kind: 'application', amount: 3, note: null },
      { id: id('l4'), day: addDays(ws, 1), kind: 'workout', amount: 1, note: 'gym' },
    ]),
  )
}

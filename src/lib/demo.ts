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

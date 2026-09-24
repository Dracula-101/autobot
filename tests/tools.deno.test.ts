// deno test tests/tools.deno.test.ts
// Exercises Autobot's tools against a fake Supabase client that records writes.

import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1'
import { Toolbox } from '../supabase/functions/_shared/tools.ts'
import type { UserState } from '../supabase/functions/_shared/state.ts'
import { DEFAULT_SETTINGS, instantOf, planDay, seedRoutines } from '../supabase/functions/_shared/core/index.ts'
import type { Db } from '../supabase/functions/_shared/db.ts'

type Write = { table: string; op: string; row: Record<string, unknown>; filters: [string, unknown][] }

function fakeDb(writes: Write[]): Db {
  const chain = (table: string, op: string, row: Record<string, unknown>) => {
    const w: Write = { table, op, row, filters: [] }
    writes.push(w)
    const result = { error: null, data: null }
    const self: Record<string, unknown> = {
      eq: (k: string, v: unknown) => (w.filters.push([k, v]), self),
      is: (k: string, v: unknown) => (w.filters.push([k, v]), self),
      select: () => self,
      single: () => Promise.resolve(result),
      then: (resolve: (v: unknown) => void) => resolve(result),
    }
    return self
  }
  return {
    from: (table: string) => ({
      upsert: (row: Record<string, unknown>) => chain(table, 'upsert', row),
      insert: (row: Record<string, unknown>) => chain(table, 'insert', row),
      update: (row: Record<string, unknown>) => chain(table, 'update', row),
    }),
  } as unknown as Db
}

const USER = '00000000-0000-4000-8000-000000000001'
const TODAY = '2026-09-23'

function state(): UserState {
  return {
    userId: USER,
    name: 'Pratik',
    settings: structuredClone(DEFAULT_SETTINGS),
    now: instantOf(TODAY, 15 * 60),
    today: TODAY,
    memories: [],
    missions: planDay({ userId: USER, date: TODAY, settings: DEFAULT_SETTINGS, logs: [], reviewsDue: 0 }),
    routines: seedRoutines(USER),
    routineLogs: [],
    logs: [],
    contacts: [],
    jobs: [],
    problems: [],
    checkin: null,
    history: [],
  }
}

const call = (name: string, args: Record<string, unknown>) => ({ name, args })

Deno.test('remember saves once and ignores exact duplicates', async () => {
  const writes: Write[] = []
  const tb = new Toolbox(fakeDb(writes), state())
  const first = await tb.run(call('remember', { category: 'job', content: 'Targets new-grad SWE roles that sponsor H-1B' }))
  const again = await tb.run(call('remember', { category: 'job', content: 'targets new-grad swe roles that sponsor h-1b' }))
  assertEquals(first.ok, true)
  assertEquals(again.duplicate, true)
  assertEquals(writes.filter((w) => w.table === 'memories').length, 1)
  assertEquals(writes.filter((w) => w.table === 'activity').length, 1)
  assertMatch(tb.actions[0].label, /^Remembered: /)
})

Deno.test('finishing a target mission logs only the missing progress', async () => {
  const writes: Write[] = []
  const st = state()
  const referral = st.missions.find((m) => m.key === 'plan:referral')!
  st.logs.push({ id: 'l1', day: TODAY, kind: 'referral', amount: 1, ref_id: null })
  const tb = new Toolbox(fakeDb(writes), st)
  const res = await tb.run(call('update_mission', { ref: referral.id.slice(0, 8), status: 'done' }))
  assertEquals(res.ok, true)
  const log = writes.find((w) => w.table === 'logs')!
  assertEquals(log.row.amount, referral.amount - 1)
  assertEquals(log.row.ref_id, referral.id)
  assertMatch(tb.actions[0].label, /^Marked done: /)
})

Deno.test('log_problem autofills from the roadmap and schedules review', async () => {
  const writes: Write[] = []
  const tb = new Toolbox(fakeDb(writes), state())
  const res = await tb.run(call('log_problem', { title: 'two sum', result: 'solved' }))
  assertEquals(res.next_review, '2026-09-30')
  const problem = writes.find((w) => w.table === 'problems')!.row
  assertEquals(problem.title, 'Two Sum')
  assertEquals(problem.difficulty, 'Easy')
  assertEquals(problem.pattern, 'arrays')
  assert(writes.some((w) => w.table === 'logs' && w.row.kind === 'leetcode'))
})

Deno.test('messaging a contact logs a referral ask and schedules a follow-up', async () => {
  const writes: Write[] = []
  const tb = new Toolbox(fakeDb(writes), state())
  const res = await tb.run(
    call('save_contact', { name: 'Priya Shah', company: 'Google', status: 'messaged', channel: 'linkedin' }),
  )
  assertEquals(res.follow_up_on, '2026-09-28')
  assert(writes.some((w) => w.table === 'logs' && w.row.kind === 'referral' && w.row.amount === 1))
})

Deno.test('mark_routine picks the night serum in the evening', async () => {
  const writes: Write[] = []
  const st = state()
  st.now = instantOf(TODAY, 23 * 60)
  const tb = new Toolbox(fakeDb(writes), st)
  await tb.run(call('mark_routine', { ref: 'hair serum', done: true }))
  const log = writes.find((w) => w.table === 'routine_logs')!.row
  const nightSerum = st.routines.find((r) => r.stack === 'night' && r.name === 'Hair serum')!
  assertEquals(log.routine_id, nightSerum.id)
  assertEquals(log.deleted_at, null)
})

Deno.test('update_settings validates and writes the whole settings blob', async () => {
  const writes: Write[] = []
  const tb = new Toolbox(fakeDb(writes), state())
  assertEquals((await tb.run(call('update_settings', { key: 'sleep.bed', value: '2:00' }))).ok, true)
  assertEquals((await tb.run(call('update_settings', { key: 'sleep.bed', value: 'late' }))).ok, false)
  assertEquals((await tb.run(call('update_settings', { key: 'rolloverHour', value: '3' }))).ok, false)
  const saved = writes.find((w) => w.table === 'profiles')!.row.settings as typeof DEFAULT_SETTINGS
  assertEquals(saved.sleep.bed, '02:00')
})

// COLUMNS_JSON=/path/to/columns.json deno test --allow-env --allow-read tests/tools.deno.test.ts
Deno.test({
  name: 'every tool write uses columns that exist in the live schema',
  ignore: !Deno.env.get('COLUMNS_JSON'),
  fn: async () => {
    const columns = JSON.parse(await Deno.readTextFile(Deno.env.get('COLUMNS_JSON')!)) as Record<string, string[]>
    const writes: Write[] = []
    const st = state()
    const tb = new Toolbox(fakeDb(writes), st)
    const mission = st.missions.find((m) => m.target_key)!
    await tb.run(call('remember', { category: 'goal', content: 'Land a new-grad role' }))
    await tb.run(call('update_memory', { ref: st.memories[0].id.slice(0, 8), pinned: true }))
    await tb.run(call('forget', { ref: st.memories[0].id.slice(0, 8) }))
    await tb.run(call('add_mission', { title: 'Email Priya', area: 'hunt', target: 'referral', amount: 1 }))
    await tb.run(call('update_mission', { ref: mission.id.slice(0, 8), status: 'done' }))
    await tb.run(call('update_mission', { ref: mission.id.slice(0, 8), status: 'todo', when: 'tomorrow' }))
    await tb.run(call('log_progress', { kind: 'workout', amount: 1, note: 'racket' }))
    await tb.run(call('log_problem', { title: 'LRU Cache', result: 'hints' }))
    await tb.run(call('save_contact', { name: 'Priya', company: 'Google', status: 'messaged' }))
    await tb.run(call('save_job', { company: 'Stripe', title: 'SWE', status: 'applied' }))
    await tb.run(call('mark_routine', { ref: 'morning pill' }))
    await tb.run(call('update_settings', { key: 'targets.leetcode', value: '15' }))
    for (const w of writes) {
      const extra = Object.keys(w.row).filter((k) => !columns[w.table]?.includes(k))
      assertEquals(extra, [], `${w.table} ${w.op} has unknown columns`)
    }
    assert(writes.length > 15)
  },
})

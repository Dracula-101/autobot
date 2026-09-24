// Checks that every row the app writes only uses columns that exist in the
// live database. Needs a snapshot of the schema:
//   COLUMNS_JSON=/path/to/columns.json npx vitest run tests/schema-compat.test.ts
// (columns.json = { table: [column, ...] } from information_schema.columns)

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  normalizeAssignment,
  normalizeProfile,
  seedRoutines,
  type Assignment,
  type Contact,
  type Job,
  type Lead,
  type Mission,
} from '@core/index.ts'
import { SyncStore, TABLES } from '../src/lib/sync'
import { createActions } from '../src/lib/actions'

const path = process.env.COLUMNS_JSON

describe.skipIf(!path)('rows written by the app match the live schema', () => {
  const columns = path ? (JSON.parse(readFileSync(path, 'utf8')) as Record<string, string[]>) : {}

  it('covers every client write path', () => {
    const store = new SyncStore(null, '00000000-0000-4000-8000-000000000001')
    const a = createActions(store, DEFAULT_SETTINGS)

    store.upsert('routines', seedRoutines(store.userId))
    a.checkIn()
    a.ensurePlan()
    a.setEnergy('low')
    a.setEnergy('high')
    const mission = store.rows<Mission>('missions').find((m) => m.target_key)!
    a.toggleMission(mission)()
    a.toggleMission(mission)
    a.setMissionStatus(mission, 'doing')
    a.moveMission(mission, { moment: 'night' })
    a.addMission({ title: 'Test', area: 'life', size: 'S', moment: 'anytime' })
    a.deleteMission(mission)
    a.markRoutine(seedRoutines(store.userId)[0], true)
    a.saveRoutine({ name: 'Vitamin D', emoji: '☀️' })
    a.logProgress('workout', 1, 'racket')
    a.logProblem({ title: 'two sum', result: 'solved', notes: 'hash map' })
    const contact = a.saveContact({ name: 'Priya', company: 'Google' } as Contact)
    a.setContactStatus(contact, 'messaged')
    a.bumpFollowUp(contact)
    const job = a.saveJob({ company: 'Stripe', title: 'SWE' } as Job)
    a.setJobStatus(job, 'applied')
    a.saveMemory({ content: 'Likes the library', category: 'habit' })
    a.saveReview('2026-09-21', { win: 'Sent 8 asks' })
    store.upsert('chat_messages', { id: crypto.randomUUID(), role: 'user', content: 'hi', actions: [], meta: {} } as never)

    // Imported rows arrive from the server; the app only links, hides, or finishes them.
    const serverRow = { user_id: store.userId, created_at: '', updated_at: '', deleted_at: null }
    const lead = {
      ...normalizeProfile({ id: 7, name: 'Ana Test', headline: 'University Recruiter at Amazon', summary: 'Bo is a mutual connection' }),
      ...serverRow,
      id: crypto.randomUUID(),
      contact_id: null,
      hidden: false,
    } as Lead
    store.ingest('leads', [lead])
    const { contact: fromLead } = a.leadToContact(lead, 'messaged')
    a.deleteContact(fromLead)
    a.hideLead(store.get<Lead>('leads', lead.id)!)
    const assignment = {
      ...normalizeAssignment({ id: 3, assignment_name: 'HW3', course_name: 'CSCI 5229', due_at: '2026-09-26T05:59:00Z' }),
      ...serverRow,
      id: crypto.randomUUID(),
      done_at: null,
    } as Assignment
    store.ingest('assignments', [assignment])
    a.setAssignmentDone(assignment, true)

    for (const table of TABLES) {
      for (const row of store.all(table)) {
        const extra = Object.keys(row).filter((k) => !columns[table]?.includes(k))
        expect(extra, `${table} has unknown columns`).toEqual([])
      }
    }
    const profilePatch = { settings: {}, seeded_at: '', display_name: '' }
    expect(Object.keys(profilePatch).filter((k) => !columns.profiles.includes(k))).toEqual([])
  })
})

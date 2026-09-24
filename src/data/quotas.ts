import type { QuotaDef } from '../types'

export const WEEKLY_QUOTAS: QuotaDef[] = [
  { key: 'outreach', label: 'Outreach sent', target: 5, category: 'hunt' },
  { key: 'roles', label: 'Roles saved', target: 10, category: 'hunt' },
  { key: 'resume', label: 'Resume pass', target: 1, category: 'hunt' },
  { key: 'leetcode', label: 'LeetCode', target: 8, targetMax: 12, category: 'leetcode' },
  { key: 'racket', label: 'Racket / partner', target: 2, category: 'fitness' },
  { key: 'move', label: 'Other movement', target: 2, category: 'fitness' },
  { key: 'lectures', label: 'Tue/Thu lectures', target: 6, category: 'class' },
  { key: 'homework', label: 'Homework closed', target: 1, category: 'class' },
  { key: 'sleep', label: 'Sleep band OK', target: 1, category: 'health' },
  { key: 'scalp', label: 'Scalp care', target: 3, category: 'health' },
]

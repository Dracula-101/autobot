// Interview-prep roadmap: patterns in learning order, a curated problem list,
// and spaced-review scheduling.

import type { Problem, ProblemResult } from './types.ts'
import { addDays } from './time.ts'

export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export interface Pattern {
  key: string
  name: string
  /** When to reach for it */
  signal: string
  /** The core move, in one breath */
  idea: string
}

export const PATTERNS: Pattern[] = [
  {
    key: 'arrays',
    name: 'Arrays & Hashing',
    signal: 'Counting, grouping, “have I seen this before?”',
    idea: 'Trade memory for time: a hash map or set turns repeated scans into O(1) lookups.',
  },
  {
    key: 'two-pointers',
    name: 'Two Pointers',
    signal: 'Sorted input, pairs/triplets, in-place rearranging',
    idea: 'Walk inward (or fast/slow) so each step rules out a whole slice of candidates.',
  },
  {
    key: 'sliding-window',
    name: 'Sliding Window',
    signal: '“Longest/shortest substring or subarray such that…”',
    idea: 'Grow the right edge; shrink the left while the window breaks the rule.',
  },
  {
    key: 'stack',
    name: 'Stack',
    signal: 'Matching pairs, “next greater”, undoing the latest thing',
    idea: 'Keep unresolved items on a stack; resolve them when something newer settles them.',
  },
  {
    key: 'binary-search',
    name: 'Binary Search',
    signal: 'Sorted data, or a yes/no answer that flips once as a value grows',
    idea: 'Halve the search space each step — search on the answer, not just the array.',
  },
  {
    key: 'linked-list',
    name: 'Linked List',
    signal: 'Pointer surgery, cycles, merging',
    idea: 'Dummy heads and fast/slow pointers make most edge cases disappear.',
  },
  {
    key: 'trees',
    name: 'Trees',
    signal: 'Hierarchies, BSTs, “for every node…”',
    idea: 'Decide what each node needs from its children, then recurse (DFS) or go level by level (BFS).',
  },
  {
    key: 'tries',
    name: 'Tries',
    signal: 'Prefix lookups over many words',
    idea: 'A tree of characters: shared prefixes share nodes.',
  },
  {
    key: 'heap',
    name: 'Heap / Priority Queue',
    signal: '“Top k”, “k closest”, repeatedly grabbing the min or max',
    idea: 'Keep a heap of size k, or a min-heap of frontier items.',
  },
  {
    key: 'backtracking',
    name: 'Backtracking',
    signal: '“All combinations / permutations / ways to…”',
    idea: 'Choose, explore, un-choose. Prune early when a branch can’t work.',
  },
  {
    key: 'graphs',
    name: 'Graphs',
    signal: 'Grids, dependencies, connectivity',
    idea: 'BFS for shortest steps, DFS for reachability, topological sort for prerequisites.',
  },
  {
    key: 'advanced-graphs',
    name: 'Advanced Graphs',
    signal: 'Weighted shortest paths, minimum spanning trees',
    idea: 'Dijkstra with a heap; Prim or Kruskal (+ union-find) for spanning trees.',
  },
  {
    key: 'dp-1d',
    name: '1-D Dynamic Programming',
    signal: '“How many ways / max / min” along a sequence',
    idea: 'Define dp[i] in words first, find how it depends on smaller i, then fill it in order.',
  },
  {
    key: 'dp-2d',
    name: '2-D Dynamic Programming',
    signal: 'Two strings, grids, or choices with a capacity',
    idea: 'dp[i][j] over two dimensions; draw the table on paper before coding.',
  },
  {
    key: 'greedy',
    name: 'Greedy',
    signal: 'A locally best choice that provably never hurts',
    idea: 'Sort or scan once, always take the move that keeps the most options open.',
  },
  {
    key: 'intervals',
    name: 'Intervals',
    signal: 'Meetings, ranges, overlaps',
    idea: 'Sort by start, then merge or count overlaps in one pass.',
  },
  {
    key: 'math',
    name: 'Math & Geometry',
    signal: 'Matrices, digits, number tricks',
    idea: 'Work layer by layer or digit by digit; watch overflow.',
  },
  {
    key: 'bits',
    name: 'Bit Manipulation',
    signal: 'XOR tricks, counting bits, “without using + or *”',
    idea: 'x ^ x = 0, x & (x - 1) drops the lowest set bit.',
  },
]

export interface RoadmapProblem {
  slug: string
  title: string
  difficulty: Difficulty
  pattern: string
}

const E: Difficulty = 'Easy'
const M: Difficulty = 'Medium'
const H: Difficulty = 'Hard'

// [title, difficulty] per pattern, easiest first. Slugs follow LeetCode URLs.
const RAW: Record<string, [string, Difficulty, string?][]> = {
  arrays: [
    ['Contains Duplicate', E],
    ['Valid Anagram', E],
    ['Two Sum', E],
    ['Majority Element', E],
    ['Group Anagrams', M],
    ['Top K Frequent Elements', M],
    ['Product of Array Except Self', M],
    ['Valid Sudoku', M],
    ['Longest Consecutive Sequence', M],
    ['Sort Colors', M],
    ['Subarray Sum Equals K', M],
  ],
  'two-pointers': [
    ['Valid Palindrome', E],
    ['Move Zeroes', E],
    ['Remove Duplicates from Sorted Array', E],
    ['Two Sum II - Input Array Is Sorted', M, 'two-sum-ii-input-array-is-sorted'],
    ['3Sum', M, '3sum'],
    ['Container With Most Water', M],
    ['Trapping Rain Water', H],
  ],
  'sliding-window': [
    ['Best Time to Buy and Sell Stock', E],
    ['Maximum Average Subarray I', E],
    ['Longest Substring Without Repeating Characters', M],
    ['Longest Repeating Character Replacement', M],
    ['Permutation in String', M],
    ['Fruit Into Baskets', M],
    ['Minimum Window Substring', H],
    ['Sliding Window Maximum', H],
  ],
  stack: [
    ['Valid Parentheses', E],
    ['Min Stack', M],
    ['Evaluate Reverse Polish Notation', M],
    ['Daily Temperatures', M],
    ['Decode String', M],
    ['Asteroid Collision', M],
    ['Car Fleet', M],
    ['Largest Rectangle in Histogram', H],
  ],
  'binary-search': [
    ['Binary Search', E],
    ['First Bad Version', E],
    ['Search a 2D Matrix', M],
    ['Koko Eating Bananas', M],
    ['Find Minimum in Rotated Sorted Array', M],
    ['Search in Rotated Sorted Array', M],
    ['Find Peak Element', M],
    ['Time Based Key-Value Store', M],
    ['Median of Two Sorted Arrays', H],
  ],
  'linked-list': [
    ['Reverse Linked List', E],
    ['Merge Two Sorted Lists', E],
    ['Linked List Cycle', E],
    ['Middle of the Linked List', E],
    ['Reorder List', M],
    ['Remove Nth Node From End of List', M],
    ['Copy List with Random Pointer', M],
    ['Add Two Numbers', M],
    ['Find the Duplicate Number', M],
    ['LRU Cache', M],
    ['Merge k Sorted Lists', H],
    ['Reverse Nodes in k-Group', H],
  ],
  trees: [
    ['Invert Binary Tree', E],
    ['Maximum Depth of Binary Tree', E],
    ['Diameter of Binary Tree', E],
    ['Balanced Binary Tree', E],
    ['Same Tree', E],
    ['Subtree of Another Tree', E],
    ['Lowest Common Ancestor of a Binary Search Tree', M],
    ['Binary Tree Level Order Traversal', M],
    ['Binary Tree Right Side View', M],
    ['Count Good Nodes in Binary Tree', M],
    ['Validate Binary Search Tree', M],
    ['Kth Smallest Element in a BST', M],
    ['Lowest Common Ancestor of a Binary Tree', M],
    ['Construct Binary Tree from Preorder and Inorder Traversal', M],
    ['Binary Tree Maximum Path Sum', H],
    ['Serialize and Deserialize Binary Tree', H],
  ],
  tries: [
    ['Implement Trie (Prefix Tree)', M, 'implement-trie-prefix-tree'],
    ['Design Add and Search Words Data Structure', M],
    ['Word Search II', H],
  ],
  heap: [
    ['Kth Largest Element in a Stream', E],
    ['Last Stone Weight', E],
    ['K Closest Points to Origin', M],
    ['Kth Largest Element in an Array', M],
    ['Task Scheduler', M],
    ['Design Twitter', M],
    ['Find Median from Data Stream', H],
  ],
  backtracking: [
    ['Subsets', M],
    ['Combination Sum', M],
    ['Permutations', M],
    ['Subsets II', M],
    ['Combination Sum II', M],
    ['Generate Parentheses', M],
    ['Word Search', M],
    ['Palindrome Partitioning', M],
    ['Letter Combinations of a Phone Number', M],
    ['N-Queens', H],
  ],
  graphs: [
    ['Flood Fill', E],
    ['Number of Islands', M],
    ['Max Area of Island', M],
    ['Clone Graph', M],
    ['Rotting Oranges', M],
    ['01 Matrix', M, '01-matrix'],
    ['Pacific Atlantic Water Flow', M],
    ['Surrounded Regions', M],
    ['Course Schedule', M],
    ['Course Schedule II', M],
    ['Redundant Connection', M],
    ['Word Ladder', H],
  ],
  'advanced-graphs': [
    ['Network Delay Time', M],
    ['Min Cost to Connect All Points', M],
    ['Path With Minimum Effort', M],
    ['Cheapest Flights Within K Stops', M],
    ['Swim in Rising Water', H],
    ['Reconstruct Itinerary', H],
  ],
  'dp-1d': [
    ['Climbing Stairs', E],
    ['Min Cost Climbing Stairs', E],
    ['House Robber', M],
    ['House Robber II', M],
    ['Longest Palindromic Substring', M],
    ['Palindromic Substrings', M],
    ['Decode Ways', M],
    ['Coin Change', M],
    ['Maximum Product Subarray', M],
    ['Word Break', M],
    ['Longest Increasing Subsequence', M],
    ['Partition Equal Subset Sum', M],
  ],
  'dp-2d': [
    ['Unique Paths', M],
    ['Longest Common Subsequence', M],
    ['Best Time to Buy and Sell Stock with Cooldown', M],
    ['Coin Change II', M],
    ['Target Sum', M],
    ['Interleaving String', M],
    ['Edit Distance', M],
    ['Longest Increasing Path in a Matrix', H],
    ['Distinct Subsequences', H],
    ['Burst Balloons', H],
    ['Regular Expression Matching', H],
  ],
  greedy: [
    ['Maximum Subarray', M],
    ['Jump Game', M],
    ['Jump Game II', M],
    ['Gas Station', M],
    ['Hand of Straights', M],
    ['Merge Triplets to Form Target Triplet', M],
    ['Partition Labels', M],
    ['Valid Parenthesis String', M],
  ],
  intervals: [
    ['Summary Ranges', E],
    ['Insert Interval', M],
    ['Merge Intervals', M],
    ['Non-overlapping Intervals', M],
    ['Minimum Interval to Include Each Query', H],
  ],
  math: [
    ['Happy Number', E],
    ['Plus One', E],
    ['Rotate Image', M],
    ['Spiral Matrix', M],
    ['Set Matrix Zeroes', M],
    ['Pow(x, n)', M, 'powx-n'],
    ['Multiply Strings', M],
  ],
  bits: [
    ['Single Number', E],
    ['Number of 1 Bits', E],
    ['Counting Bits', E],
    ['Reverse Bits', E],
    ['Missing Number', E],
    ['Sum of Two Integers', M],
    ['Reverse Integer', M],
  ],
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const ROADMAP: RoadmapProblem[] = Object.entries(RAW).flatMap(([pattern, list]) =>
  list.map(([title, difficulty, slug]) => ({ slug: slug ?? slugify(title), title, difficulty, pattern })),
)

const BY_SLUG = new Map(ROADMAP.map((p) => [p.slug, p]))

export function roadmapProblem(slugOrTitle: string): RoadmapProblem | undefined {
  return BY_SLUG.get(slugOrTitle) ?? BY_SLUG.get(slugify(slugOrTitle))
}

export function patternName(key: string): string {
  return PATTERNS.find((p) => p.key === key)?.name ?? key
}

export function searchRoadmap(query: string, limit = 8): RoadmapProblem[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const scored = ROADMAP.map((p) => {
    const t = p.title.toLowerCase()
    const score = t === q ? 0 : t.startsWith(q) ? 1 : t.includes(q) ? 2 : -1
    return { p, score }
  }).filter((s) => s.score >= 0)
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.p)
}

/** Spaced repetition: stuck → tomorrow, hints → a few days, solved → widening gaps. */
export function scheduleReview(
  result: ProblemResult,
  prev: Pick<Problem, 'interval_days' | 'attempts'> | null,
  today: string,
): { interval_days: number; next_review: string } {
  let interval: number
  if (result === 'stuck') interval = 1
  else if (result === 'hints') interval = 3
  else interval = prev && prev.attempts > 0 ? Math.min(Math.max(prev.interval_days * 2, 7), 60) : 7
  return { interval_days: interval, next_review: addDays(today, interval) }
}

export function reviewsDue(problems: Problem[], today: string): Problem[] {
  return problems
    .filter((p) => !p.deleted_at && p.next_review && p.next_review <= today)
    .sort((a, b) => (a.next_review ?? '').localeCompare(b.next_review ?? ''))
}

/** Suggest the next unsolved roadmap problem, favoring the least-covered early pattern. */
export function nextRoadmapProblem(problems: Problem[]): RoadmapProblem | null {
  const solved = new Set(problems.filter((p) => !p.deleted_at).map((p) => p.slug))
  for (const pattern of PATTERNS) {
    const list = ROADMAP.filter((p) => p.pattern === pattern.key)
    const done = list.filter((p) => solved.has(p.slug)).length
    if (done < Math.min(3, list.length)) {
      const next = list.find((p) => !solved.has(p.slug))
      if (next) return next
    }
  }
  return ROADMAP.find((p) => !solved.has(p.slug)) ?? null
}

export function leetcodeUrl(slug: string): string {
  return `https://leetcode.com/problems/${slug}/`
}

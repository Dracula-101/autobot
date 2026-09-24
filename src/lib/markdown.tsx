// Small, safe Markdown for chat replies: paragraphs, **bold**, *italic*,
// `code`, fenced code, bullet/numbered lists, and links. Builds React nodes
// directly — no HTML strings.

import { Fragment, type ReactNode } from 'react'

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)\s]+\)|https?:\/\/[^\s)]+)/g

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const match of text.matchAll(INLINE)) {
    const token = match[0]
    const at = match.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    const k = `${key}-${i++}`
    if (token.startsWith('**') || token.startsWith('__')) {
      out.push(<strong key={k}>{inline(token.slice(2, -2), k)}</strong>)
    } else if (token.startsWith('`')) {
      out.push(
        <code key={k} className="rounded-md bg-surface-3/70 px-1.5 py-0.5 font-mono text-[0.86em]">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('[')) {
      const label = token.slice(1, token.indexOf(']'))
      const href = token.slice(token.indexOf('(') + 1, -1)
      out.push(
        <a key={k} href={href} target="_blank" rel="noreferrer" className="font-bold text-sky underline underline-offset-2">
          {label}
        </a>,
      )
    } else if (token.startsWith('http')) {
      out.push(
        <a key={k} href={token} target="_blank" rel="noreferrer" className="break-all font-bold text-sky underline underline-offset-2">
          {token.replace(/^https?:\/\//, '')}
        </a>,
      )
    } else {
      out.push(<em key={k}>{inline(token.slice(1, -1), k)}</em>)
    }
    last = at + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const blocks: ReactNode[] = []
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  let n = 0
  while (i < lines.length) {
    const line = lines[i]
    const key = `b${n++}`
    if (line.startsWith('```')) {
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      i++
      blocks.push(
        <pre key={key} className="overflow-x-auto rounded-xl bg-surface-3/60 p-3 font-mono text-[12.5px] leading-relaxed">
          {code.join('\n')}
        </pre>,
      )
      continue
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ''))
      blocks.push(
        <ul key={key} className="space-y-1 pl-1">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2">
              <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />
              <span className="min-w-0">{inline(item, `${key}-${j}`)}</span>
            </li>
          ))}
        </ul>,
      )
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''))
      blocks.push(
        <ol key={key} className="space-y-1 pl-1">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2">
              <span className="num shrink-0 text-[0.85em] opacity-60">{j + 1}.</span>
              <span className="min-w-0">{inline(item, `${key}-${j}`)}</span>
            </li>
          ))}
        </ol>,
      )
      continue
    }
    if (/^#{1,4}\s+/.test(line)) {
      blocks.push(
        <p key={key} className="font-extrabold">
          {inline(line.replace(/^#{1,4}\s+/, ''), key)}
        </p>,
      )
      i++
      continue
    }
    if (!line.trim()) {
      i++
      continue
    }
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]) &&
      !lines[i].startsWith('```') &&
      !/^#{1,4}\s+/.test(lines[i])
    ) {
      para.push(lines[i++])
    }
    blocks.push(
      <p key={key}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p, `${key}-${j}`)}
          </Fragment>
        ))}
      </p>,
    )
  }
  return <div className={`space-y-2 break-words [overflow-wrap:anywhere] ${className}`}>{blocks}</div>
}

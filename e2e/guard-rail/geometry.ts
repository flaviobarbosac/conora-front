import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export type Box = { name: string; x: number; y: number; w: number; h: number }

export function geometryPath(surface: string, screen: string): string {
  return path.join(process.cwd(), 'e2e', 'guard-rail', 'baselines', surface, `${screen}-geometry.json`)
}

export function readGeometry(file: string): Box[] | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Box[]
  } catch {
    return null
  }
}

export function writeGeometry(file: string, boxes: Box[]): void {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(boxes, null, 2)}\n`)
}

export function diffGeometry(before: Box[], after: Box[]): string[] {
  const problems: string[] = []
  const prior = new Map(before.map((box) => [box.name, box]))
  const next = new Map(after.map((box) => [box.name, box]))
  for (const [name, box] of next) {
    const old = prior.get(name)
    if (!old) {
      problems.push(`${name} apareceu em x=${box.x} y=${box.y}`)
      continue
    }
    if (old.x !== box.x || old.y !== box.y || old.w !== box.w || old.h !== box.h) {
      problems.push(
        `${name} estava em x=${old.x} y=${old.y} ${old.w}x${old.h} e agora está em x=${box.x} y=${box.y} ${box.w}x${box.h}`,
      )
    }
  }
  for (const [name, box] of prior) {
    if (!next.has(name)) problems.push(`${name} sumiu de x=${box.x} y=${box.y}`)
  }
  return problems
}

export function collectGeometry(): Box[] {
  const nodes = [...document.querySelectorAll('h1, h2, button, a, [aria-label]')]
  const boxes: Box[] = []
  const seen = new Map<string, number>()
  for (const node of nodes) {
    const element = node as HTMLElement
    const rect = element.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) continue
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) continue
    const label = (element.getAttribute('aria-label') || element.innerText || '').replace(/\s+/g, ' ').trim()
    if (!label) continue
    const base = label.slice(0, 80)
    const index = (seen.get(base) ?? 0) + 1
    seen.set(base, index)
    boxes.push({
      name: index === 1 ? base : `${base} #${index}`,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    })
  }
  boxes.sort((a, b) => a.y - b.y || a.x - b.x || a.name.localeCompare(b.name))
  return boxes
}

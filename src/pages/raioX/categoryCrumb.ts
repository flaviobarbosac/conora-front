const SEP = ' / '

/** Click path. Overflow cuts from the start and keeps the last clicked item. */
export function formatClickCrumb(names: string[], fits: (text: string) => boolean): string {
  if (names.length === 0) {
    return ''
  }
  const full = names.join(SEP)
  if (fits(full)) {
    return full
  }
  for (let start = 1; start < names.length; start++) {
    const text = `...${SEP}${names.slice(start).join(SEP)}`
    if (fits(text)) {
      return text
    }
  }
  return ellipsizeStart(names[names.length - 1], fits)
}

function ellipsizeStart(text: string, fits: (text: string) => boolean): string {
  const marked = `...${SEP}${text}`
  if (fits(marked)) {
    return marked
  }
  if (fits(text)) {
    return text
  }
  const prefix = '...'
  let low = 0
  let high = text.length
  let best = prefix
  while (low <= high) {
    const mid = (low + high) >> 1
    const candidate = prefix + text.slice(mid)
    if (fits(candidate)) {
      best = candidate
      high = mid - 1
    } else {
      low = mid + 1
    }
  }
  return best
}

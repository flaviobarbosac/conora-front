import type { VoiceEntryDraft } from '../api/finance'

export type EntrySlot = 'type' | 'amount' | 'date' | 'description' | 'categoryName' | 'accountName'

export type SpokenEntry = {
  type: 'Expense' | 'Income' | null
  amount: number | null
  date: string | null
  description: string | null
  categoryName: string | null
  accountName: string | null
  asked: EntrySlot | null
}

const QUESTIONS: Record<EntrySlot, string> = {
  type: 'É despesa ou receita?',
  amount: 'Qual é o valor?',
  date: 'Qual é a data?',
  description: 'A que se refere?',
  categoryName: 'Qual é a categoria?',
  accountName: 'Qual é a conta bancária?',
}

const MISSING_LABEL: Record<EntrySlot, string> = {
  type: 'se é despesa ou receita',
  amount: 'o valor',
  date: 'a data',
  description: 'a descrição',
  categoryName: 'a categoria',
  accountName: 'a conta bancária',
}

const NUMBER_WORDS: Record<string, number> = {
  mil: 1000,
  novecentos: 900,
  oitocentos: 800,
  setecentos: 700,
  seiscentos: 600,
  quinhentos: 500,
  quatrocentos: 400,
  trezentos: 300,
  duzentos: 200,
  cento: 100,
  cem: 100,
  noventa: 90,
  oitenta: 80,
  setenta: 70,
  sessenta: 60,
  cinquenta: 50,
  quarenta: 40,
  trinta: 30,
  vinte: 20,
  dezenove: 19,
  dezoito: 18,
  dezessete: 17,
  dezesseis: 16,
  quinze: 15,
  quatorze: 14,
  treze: 13,
  doze: 12,
  onze: 11,
  dez: 10,
  nove: 9,
  oito: 8,
  sete: 7,
  seis: 6,
  cinco: 5,
  quatro: 4,
  tres: 3,
  dois: 2,
  duas: 2,
  um: 1,
  uma: 1,
}

export function emptyEntry(): SpokenEntry {
  return {
    type: null,
    amount: null,
    date: null,
    description: null,
    categoryName: null,
    accountName: null,
    asked: null,
  }
}

export function fromDraft(draft: VoiceEntryDraft | null | undefined): SpokenEntry {
  const entry = emptyEntry()
  if (!draft) {
    return entry
  }
  entry.type = draft.type === 'Income' || draft.type === 'Expense' ? draft.type : null
  entry.amount = draft.amount ?? null
  entry.date = draft.date ?? null
  entry.description = draft.description
  entry.categoryName = draft.categoryName
  entry.accountName = draft.accountName
  return entry
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

function readAmount(text: string): number | null {
  const digits = text.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/)
  if (digits) {
    const raw = digits[1].replace(/\./g, '').replace(',', '.')
    const value = Number(raw)
    if (Number.isFinite(value) && value > 0) {
      return Math.round(value * 100) / 100
    }
  }
  const tokens = fold(text).split(/\s+/)
  let total = 0
  let found = false
  for (const token of tokens) {
    if (token === 'e' || token === 'reais' || token === 'real') {
      continue
    }
    const value = NUMBER_WORDS[token]
    if (value) {
      found = true
      total += value
      continue
    }
    if (found) {
      break
    }
  }
  return found && total > 0 ? total : null
}

function chunk(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text)
  const value = match?.[1]?.trim().replace(/[.,]+$/, '')
  return value ? value : null
}

function cleanLabel(value: string): string {
  const cut = value.split(/,|\.|\s+categoria\b|\s+conta\b|\s+hoje\b|\s+ontem\b|\s+no valor\b/i)[0] ?? ''
  return cut.trim()
}

/** Pulls every field present in one utterance. Missing fields stay null. */
export function parseUtterance(text: string): Partial<SpokenEntry> {
  const spoken = text.trim()
  const folded = fold(spoken)
  const parsed: Partial<SpokenEntry> = {}
  if (/\breceita\b|\brenda\b|\ba receber\b/.test(folded)) {
    parsed.type = 'Income'
  } else if (/\bdespesa\b|\ba pagar\b|\bpaguei\b|\bpaga\b|\bconta de\b/.test(folded)) {
    parsed.type = 'Expense'
  }
  const amount = readAmount(spoken)
  if (amount) {
    parsed.amount = amount
  }
  const dated = chunk(spoken, /\bdata\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})\b/i)
  if (dated) {
    parsed.date = dated
  } else if (folded.includes('hoje')) {
    parsed.date = 'hoje'
  } else if (folded.includes('ontem')) {
    parsed.date = 'ontem'
  }
  const about = chunk(spoken, /(?:descri[cç][aã]o|referente a)\s+(.+)/i)
    ?? chunk(spoken, /conta de\s+(.+?)\s+no valor/i)
  if (about) {
    parsed.description = cleanLabel(about)
  }
  const bank = chunk(spoken, /(?:pela conta do|paga pela conta do|conta do|conta banc[aá]ria|na conta)\s+(.+)/i)
  if (bank) {
    parsed.accountName = cleanLabel(bank)
  }
  if (folded.includes('conta pessoal')) {
    parsed.categoryName = 'Pessoal'
  }
  const plan = chunk(spoken, /plano de contas?\s+(.+)/i)
  if (plan) {
    parsed.categoryName = cleanLabel(plan)
  }
  const category = chunk(spoken, /categoria\s+(.+)/i)
  if (category) {
    parsed.categoryName = cleanLabel(category)
  }
  return parsed
}

function putSlot(entry: SpokenEntry, slot: EntrySlot, text: string): void {
  const folded = fold(text)
  if (slot === 'type') {
    if (/\breceita\b|\brenda\b|\ba receber\b/.test(folded)) {
      entry.type = 'Income'
    } else if (/\bdespesa\b|\ba pagar\b|\bpagar\b/.test(folded)) {
      entry.type = 'Expense'
    }
    return
  }
  if (slot === 'amount') {
    entry.amount = readAmount(text)
    return
  }
  if (slot === 'date') {
    if (folded.includes('hoje')) {
      entry.date = 'hoje'
    } else if (folded.includes('ontem')) {
      entry.date = 'ontem'
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(folded)) {
      entry.date = folded
    } else {
      entry.date = text.trim()
    }
    return
  }
  const value = text.trim().replace(/[?.!]+$/, '')
  if (!value) {
    return
  }
  entry[slot] = value
}

export function absorb(entry: SpokenEntry, text: string): SpokenEntry {
  const next: SpokenEntry = { ...entry }
  const parsed = parseUtterance(text)
  if (parsed.type) {
    next.type = parsed.type
  }
  if (parsed.amount) {
    next.amount = parsed.amount
  }
  if (parsed.date) {
    next.date = parsed.date
  }
  if (parsed.description) {
    next.description = parsed.description
  }
  if (parsed.categoryName) {
    next.categoryName = parsed.categoryName
  }
  if (parsed.accountName) {
    next.accountName = parsed.accountName
  }
  const slot = next.asked
  if (slot && next[slot] == null) {
    putSlot(next, slot, text)
  }
  return next
}

export function missingSlots(entry: SpokenEntry): EntrySlot[] {
  const slots: EntrySlot[] = []
  if (!entry.type) {
    slots.push('type')
  }
  if (entry.amount == null) {
    slots.push('amount')
  }
  if (!entry.date) {
    slots.push('date')
  }
  if (!entry.description) {
    slots.push('description')
  }
  if (!entry.categoryName) {
    slots.push('categoryName')
  }
  if (!entry.accountName) {
    slots.push('accountName')
  }
  return slots
}

export function missingSlot(entry: SpokenEntry): EntrySlot | null {
  return missingSlots(entry)[0] ?? null
}

export function questionFor(slot: EntrySlot): string {
  return QUESTIONS[slot]
}

/** One short line naming only the slots that are still empty. */
export function missingPrompt(entry: SpokenEntry): string {
  const slots = missingSlots(entry)
  if (slots.length === 0) {
    return ''
  }
  if (slots.length === 1) {
    return QUESTIONS[slots[0]]
  }
  const labels = slots.map((slot) => MISSING_LABEL[slot])
  const last = labels[labels.length - 1]
  return `Falta ${labels.slice(0, -1).join(', ')} e ${last}.`
}

export function looksLikeEntry(text: string): boolean {
  const parsed = parseUtterance(text)
  return parsed.amount != null || parsed.type != null || Boolean(parsed.categoryName) || Boolean(parsed.accountName)
}

export function toDraft(entry: SpokenEntry): VoiceEntryDraft {
  return {
    type: entry.type === 'Income' ? 'Income' : 'Expense',
    amount: entry.amount,
    date: entry.date,
    description: entry.description,
    categoryName: entry.categoryName,
    accountName: entry.accountName,
  }
}

export function looksLikeNavigation(text: string): boolean {
  const folded = fold(text)
  return folded.includes('ir pra') || folded.includes('ir para') || folded.includes('mover pra')
    || folded.includes('vai pra') || /\babre\b|\babrir\b/.test(folded)
}

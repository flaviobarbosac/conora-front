import { downloadBlob, formatMoney } from '../lib/format'

export type StatementExportRow = {
  name: string
  amount: string
  balance: string
}

const CSV_SEP = ';'

function csvCell(value: string) {
  const text = value.replace(/\r?\n/g, ' ')
  const safe = /^[=+\-@\t]/.test(text) ? `'${text}` : text
  return safe.includes(CSV_SEP) || safe.includes('"') ? `"${safe.replaceAll('"', '""')}"` : safe
}

export function statementCsv(rows: StatementExportRow[]) {
  const lines = [
    ['Nome', 'Valor', 'Saldo'].join(CSV_SEP),
    ...rows.map((row) => [csvCell(row.name), csvCell(row.amount), csvCell(row.balance)].join(CSV_SEP)),
  ]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function downloadStatementCsv(fileName: string, rows: StatementExportRow[]) {
  downloadBlob(new Blob([statementCsv(rows)], { type: 'text/csv;charset=utf-8' }), fileName)
}

export function statementFileName(itemName: string, extension: 'csv' | 'pdf') {
  const slug = itemName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `extrato-${slug || 'patrimonio'}.${extension}`
}

export function moneyCell(value: number) {
  return formatMoney(value)
}

const WIN1252: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
}

function pdfLiteral(value: string) {
  let out = ''
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0x3f
    const byte = code <= 0x7f ? code : (WIN1252[code] ?? (code <= 0xff ? code : 0x3f))
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      out += `\\${String.fromCharCode(byte)}`
    } else if (byte < 32 || byte > 126) {
      out += `\\${byte.toString(8).padStart(3, '0')}`
    } else {
      out += String.fromCharCode(byte)
    }
  }
  return out
}

function pdfDocument(title: string, rows: StatementExportRow[]) {
  const lines = [title, '', 'Nome    Valor    Saldo', ...rows.map((row) => `${row.name}    ${row.amount}    ${row.balance}`)]
  const perPage = 44
  const slices: string[][] = []
  for (let index = 0; index < lines.length; index += perPage) {
    slices.push(lines.slice(index, index + perPage))
  }

  const objects: string[] = []
  const pageIds: number[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push('')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')

  slices.forEach((pageLines) => {
    const commands = ['BT', '/F1 11 Tf', '14 TL', '48 800 Td']
    pageLines.forEach((line, lineIndex) => {
      commands.push(`(${pdfLiteral(line)}) Tj`)
      if (lineIndex < pageLines.length - 1) {
        commands.push('T*')
      }
    })
    commands.push('ET')
    const stream = commands.join('\n')
    const contentId = objects.length + 1
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    const pageId = objects.length + 1
    pageIds.push(pageId)
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    )
  })

  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`

  let body = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(body.length)
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n`
  body += '0000000000 65535 f \n'
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new TextEncoder().encode(body)
}

export function downloadStatementPdf(fileName: string, title: string, rows: StatementExportRow[]) {
  downloadBlob(new Blob([pdfDocument(title, rows)], { type: 'application/pdf' }), fileName)
}

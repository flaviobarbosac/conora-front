import { useMemo, useState } from 'react'
import type { IanReportPoint } from '../../api/finance'
import { formatCompetence, formatMoney } from '../../lib/format'
import { pieConicGradient, type PieSlice } from '../../lib/homeInsights'
import styles from './IanCharts.module.css'

export type LegendMode = 'description' | 'value'

const PIE_COLORS = ['#2f9e44', '#375984', '#f59f00', '#e03131', '#6aacff', '#868e96']

function legendText(point: IanReportPoint, mode: LegendMode): string {
  return mode === 'value' ? formatMoney(point.amount) : point.label
}

function shortMonthLabel(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym
  const [year, month] = ym.split('-').map(Number)
  const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short' })
  const clean = label.replace('.', '')
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

function formatAxisMoney(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace('.', ',')} mil`
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

/** Catmull-Rom → cubic bezier path (smooth like Recharts monotone). */
function smoothLinePath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return ''
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`
  if (coords.length === 2) {
    return `M ${coords[0].x} ${coords[0].y} L ${coords[1].x} ${coords[1].y}`
  }

  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] ?? coords[i]
    const p1 = coords[i]
    const p2 = coords[i + 1]
    const p3 = coords[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

function yTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0]
  const step = max / count
  const ticks: number[] = []
  for (let i = 0; i <= count; i++) ticks.push(step * i)
  return ticks
}

export function IanBarChart({ points, legendMode }: { points: IanReportPoint[]; legendMode: LegendMode }) {
  const max = Math.max(1, ...points.map((p) => Math.abs(p.amount)))
  return (
    <ul className={styles.barList} aria-label="Gráfico de barras">
      {points.map((point) => (
        <li key={point.key} className={styles.barRow}>
          <div className={styles.barMeta}>
            <span>{legendText(point, legendMode)}</span>
            {legendMode === 'description' ? <span>{formatMoney(point.amount)}</span> : null}
          </div>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${Math.min(100, (Math.abs(point.amount) / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function IanLineChart({ points, legendMode }: { points: IanReportPoint[]; legendMode: LegendMode }) {
  const [active, setActive] = useState<number | null>(null)
  const width = 640
  const height = 240
  const padLeft = 56
  const padRight = 16
  const padTop = 16
  const padBottom = 36
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom

  const max = Math.max(1, ...points.map((p) => Math.abs(p.amount)))
  const ticks = yTicks(max)

  const coords = useMemo(
    () =>
      points.map((point, index) => {
        const x = padLeft + (points.length <= 1 ? plotW / 2 : (index / (points.length - 1)) * plotW)
        const y = padTop + plotH - (Math.abs(point.amount) / max) * plotH
        return { x, y, point }
      }),
    [points, max, plotW, plotH],
  )

  const path = useMemo(
    () => smoothLinePath(coords.map((c) => ({ x: c.x, y: c.y }))),
    [coords],
  )

  const labelEvery = points.length > 8 ? 2 : 1
  const activePoint = active != null ? coords[active] : null

  return (
    <div className={styles.lineWrap}>
      <svg
        className={styles.lineSvg}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Gráfico de evolução"
        onMouseLeave={() => setActive(null)}
      >
        {ticks.map((tick) => {
          const y = padTop + plotH - (tick / max) * plotH
          return (
            <g key={tick}>
              <line
                className={styles.lineGrid}
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
              />
              <text className={styles.lineAxisLabel} x={padLeft - 8} y={y + 3} textAnchor="end">
                {formatAxisMoney(tick)}
              </text>
            </g>
          )
        })}

        <line
          className={styles.lineAxis}
          x1={padLeft}
          y1={padTop + plotH}
          x2={width - padRight}
          y2={padTop + plotH}
        />

        <path className={styles.linePath} d={path} />

        {coords.map((c, index) => (
          <g key={c.point.key}>
            {(index % labelEvery === 0 || index === coords.length - 1) && (
              <text
                className={styles.lineAxisLabel}
                x={c.x}
                y={height - 10}
                textAnchor="middle"
              >
                {shortMonthLabel(c.point.label)}
              </text>
            )}
            <circle
              className={index === active ? styles.lineDotActive : styles.lineDot}
              cx={c.x}
              cy={c.y}
              r={index === active ? 6 : 3}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              tabIndex={0}
              role="img"
              aria-label={`${formatCompetence(c.point.label)}: ${formatMoney(c.point.amount)}`}
            />
            {/* Wider hit target */}
            <circle
              cx={c.x}
              cy={c.y}
              r={12}
              fill="transparent"
              onMouseEnter={() => setActive(index)}
            />
          </g>
        ))}

        {activePoint ? (
          <g className={styles.lineTooltip} pointerEvents="none">
            <line
              className={styles.lineGuide}
              x1={activePoint.x}
              y1={padTop}
              x2={activePoint.x}
              y2={padTop + plotH}
            />
            <rect
              className={styles.lineTooltipBox}
              x={Math.min(activePoint.x + 10, width - padRight - 140)}
              y={Math.max(padTop, activePoint.y - 42)}
              width={132}
              height={36}
              rx={6}
            />
            <text
              className={styles.lineTooltipText}
              x={Math.min(activePoint.x + 18, width - padRight - 132)}
              y={Math.max(padTop, activePoint.y - 42) + 14}
            >
              {legendMode === 'value'
                ? formatMoney(activePoint.point.amount)
                : formatCompetence(activePoint.point.label)}
            </text>
            <text
              className={styles.lineTooltipTextStrong}
              x={Math.min(activePoint.x + 18, width - padRight - 132)}
              y={Math.max(padTop, activePoint.y - 42) + 28}
            >
              {legendMode === 'value'
                ? formatCompetence(activePoint.point.label)
                : formatMoney(activePoint.point.amount)}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  )
}

export function IanPieChart({ points, legendMode }: { points: IanReportPoint[]; legendMode: LegendMode }) {
  const slices: PieSlice[] = useMemo(() => {
    const total = points.reduce((sum, p) => sum + Math.abs(p.amount), 0) || 1
    return points.map((point, index) => ({
      key: point.key,
      label: point.label,
      amount: point.amount,
      pct: (Math.abs(point.amount) / total) * 100,
      color: PIE_COLORS[index % PIE_COLORS.length],
    }))
  }, [points])

  return (
    <div className={styles.pieLayout}>
      <div
        className={styles.pieChart}
        style={{ background: pieConicGradient(slices) }}
        role="img"
        aria-label="Gráfico de pizza"
      />
      <ul className={styles.pieLegend}>
        {slices.map((slice) => (
          <li key={slice.key} className={styles.pieLegendItem}>
            <span className={styles.swatch} style={{ background: slice.color }} aria-hidden />
            <span>
              {legendMode === 'value' ? formatMoney(slice.amount) : slice.label}
              {legendMode === 'description' ? ` · ${formatMoney(slice.amount)}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function IanChart({
  chartKind,
  points,
  legendMode,
}: {
  chartKind: string
  points: IanReportPoint[]
  legendMode: LegendMode
}) {
  if (points.length === 0 || chartKind === 'none') {
    return null
  }
  if (chartKind === 'line') {
    return <IanLineChart points={points} legendMode={legendMode} />
  }
  if (chartKind === 'pie') {
    return <IanPieChart points={points} legendMode={legendMode} />
  }
  return <IanBarChart points={points} legendMode={legendMode} />
}

export function LegendModeToggle({
  value,
  onChange,
}: {
  value: LegendMode
  onChange: (mode: LegendMode) => void
}) {
  return (
    <div className={styles.legendMode} role="group" aria-label="Legenda do gráfico">
      <span>Legenda:</span>
      <label>
        <input
          type="radio"
          name="ian-legend"
          checked={value === 'description'}
          onChange={() => onChange('description')}
        />
        Descrição
      </label>
      <label>
        <input type="radio" name="ian-legend" checked={value === 'value'} onChange={() => onChange('value')} />
        Valor
      </label>
    </div>
  )
}

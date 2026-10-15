import { useMemo, useState } from 'react'
import { pieConicGradient, type PieSlice } from '../../lib/homeInsights'
import chart from './IanCharts.module.css'

const COLORS = ['#375984', '#2f9e44', '#f59f00', '#e03131', '#6aacff', '#868e96']

export type KpiPoint = {
  key: string
  label: string
  value: number
}

function formatDefault(value: number): string {
  return value.toLocaleString('pt-BR')
}

export function KpiBarChart({
  points,
  format = formatDefault,
}: {
  points: KpiPoint[]
  format?: (value: number) => string
}) {
  const max = Math.max(1, ...points.map((point) => Math.abs(point.value)))
  if (points.length === 0) {
    return <p>Sem dados neste período.</p>
  }
  return (
    <ul className={chart.barList} aria-label="Gráfico de barras">
      {points.map((point, index) => (
        <li key={point.key} className={chart.barRow}>
          <div className={chart.barMeta}>
            <span>{point.label}</span>
            <span>{format(point.value)}</span>
          </div>
          <div className={chart.barTrack}>
            <div
              className={chart.barFill}
              style={{
                width: `${Math.min(100, (Math.abs(point.value) / max) * 100)}%`,
                background: COLORS[index % COLORS.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function KpiPieChart({
  points,
  format = formatDefault,
}: {
  points: KpiPoint[]
  format?: (value: number) => string
}) {
  const slices: PieSlice[] = useMemo(() => {
    const total = points.reduce((sum, point) => sum + Math.abs(point.value), 0) || 1
    return points.map((point, index) => ({
      key: point.key,
      label: point.label,
      amount: point.value,
      pct: (Math.abs(point.value) / total) * 100,
      color: COLORS[index % COLORS.length],
    }))
  }, [points])

  if (points.every((point) => point.value === 0)) {
    return <p>Sem dados neste período.</p>
  }

  return (
    <div className={chart.pieLayout}>
      <div className={chart.pieChart} style={{ background: pieConicGradient(slices) }} role="img" aria-label="Gráfico de pizza" />
      <ul className={chart.pieLegend}>
        {slices.map((slice) => (
          <li key={slice.key} className={chart.pieLegendItem}>
            <span className={chart.swatch} style={{ background: slice.color }} aria-hidden />
            <span>
              {slice.label} · {format(slice.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function KpiLineChart({
  points,
  format = formatDefault,
}: {
  points: KpiPoint[]
  format?: (value: number) => string
}) {
  const [active, setActive] = useState<number | null>(null)
  const width = 640
  const height = 220
  const padLeft = 36
  const padRight = 12
  const padTop = 16
  const padBottom = 32
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom
  const max = Math.max(1, ...points.map((point) => point.value))
  const coords = points.map((point, index) => {
    const x = padLeft + (points.length <= 1 ? plotW / 2 : (index / (points.length - 1)) * plotW)
    const y = padTop + plotH - (point.value / max) * plotH
    return { x, y, point }
  })
  const path = coords.map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`).join(' ')
  const current = active != null ? coords[active] : null

  return (
    <div className={chart.lineWrap}>
      <svg className={chart.lineSvg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de evolução">
        <path className={chart.linePath} d={path} />
        {coords.map((coord, index) => (
          <circle
            key={coord.point.key}
            className={chart.lineDot}
            cx={coord.x}
            cy={coord.y}
            r={4}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
          >
            <title>{`${coord.point.label}: ${format(coord.point.value)}`}</title>
          </circle>
        ))}
        {current ? (
          <text x={current.x} y={Math.max(12, current.y - 8)} textAnchor="middle" fontSize="12">
            {format(current.point.value)}
          </text>
        ) : null}
      </svg>
    </div>
  )
}

export type KpiSeries = {
  key: string
  label: string
  color: string
  values: number[]
}

export function KpiMultiLineChart({ categories, series }: { categories: string[]; series: KpiSeries[] }) {
  const width = 640
  const height = 240
  const padLeft = 36
  const padRight = 12
  const padTop = 16
  const padBottom = 28
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom
  const max = Math.max(1, ...series.flatMap((item) => item.values))

  return (
    <div className={chart.lineWrap}>
      <svg className={chart.lineSvg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de evolução">
        {series.map((item) => {
          const path = item.values
            .map((value, index) => {
              const x = padLeft + (categories.length <= 1 ? plotW / 2 : (index / (categories.length - 1)) * plotW)
              const y = padTop + plotH - (value / max) * plotH
              return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
            })
            .join(' ')
          return <path key={item.key} d={path} fill="none" stroke={item.color} strokeWidth={2} />
        })}
      </svg>
      <ul className={chart.pieLegend}>
        {series.map((item) => (
          <li key={item.key} className={chart.pieLegendItem}>
            <span className={chart.swatch} style={{ background: item.color }} aria-hidden />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

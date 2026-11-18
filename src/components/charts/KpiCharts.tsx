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

function niceTop(raw: number) {
  if (raw <= 1) return 1
  const exp = 10 ** Math.floor(Math.log10(raw))
  const frac = raw / exp
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10
  return nice * exp
}

function tickIndexes(count: number) {
  if (count <= 1) return [0]
  const slots = Math.min(count, 6)
  const indexes = new Set<number>()
  for (let index = 0; index < slots; index += 1) {
    indexes.add(Math.round((index * (count - 1)) / (slots - 1)))
  }
  return [...indexes]
}

export function KpiMultiLineChart({
  categories,
  series,
  showLegend = true,
  showAxes = false,
}: {
  categories: string[]
  series: KpiSeries[]
  showLegend?: boolean
  showAxes?: boolean
}) {
  const width = 640
  const height = showAxes ? 268 : 240
  const padLeft = showAxes ? 48 : 36
  const padRight = 16
  const padTop = 16
  const padBottom = showAxes ? 36 : 28
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom
  const rawMax = Math.max(1, ...series.flatMap((item) => item.values))
  const top = showAxes ? niceTop(rawMax) : rawMax
  const yTicks = showAxes
    ? [...new Set([0, 0.25, 0.5, 0.75, 1].map((part) => Math.round(top * part)))].sort((a, b) => a - b)
    : []
  const xTicks = showAxes ? tickIndexes(categories.length) : []
  const xOf = (index: number) =>
    padLeft + (categories.length <= 1 ? plotW / 2 : (index / (categories.length - 1)) * plotW)
  const yOf = (value: number) => padTop + plotH - (value / top) * plotH

  return (
    <div className={chart.lineWrap}>
      <svg className={chart.lineSvg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de evolução">
        {showAxes ? (
          <>
            <line className={chart.axis} x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} />
            <line className={chart.axis} x1={padLeft} y1={padTop + plotH} x2={padLeft + plotW} y2={padTop + plotH} />
            {yTicks.map((tick) => (
              <text key={tick} className={chart.axisLabel} x={padLeft - 6} y={yOf(tick) + 4} textAnchor="end">
                {tick}
              </text>
            ))}
            {xTicks.map((index) => (
              <text key={categories[index] ?? index} className={chart.axisLabel} x={xOf(index)} y={height - 8} textAnchor="middle">
                {categories[index]}
              </text>
            ))}
          </>
        ) : null}
        {series.map((item) => {
          const path = item.values
            .map((value, index) => `${index === 0 ? 'M' : 'L'} ${xOf(index).toFixed(1)} ${yOf(value).toFixed(1)}`)
            .join(' ')
          const last = item.values.length - 1
          return (
            <g key={item.key}>
              <path d={path} fill="none" stroke={item.color} strokeWidth={2} />
              {showAxes && last >= 0 ? (
                <text className={chart.pointLabel} x={xOf(last) + 4} y={yOf(item.values[last]) - 4} fill={item.color}>
                  {item.values[last]}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      {showLegend ? (
        <ul className={chart.pieLegend}>
          {series.map((item) => (
            <li key={item.key} className={chart.pieLegendItem}>
              <span className={chart.swatch} style={{ background: item.color }} aria-hidden />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

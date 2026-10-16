import type { KeyboardEvent } from 'react'
import { Icon } from './ui/Icon'
import styles from '../pages/page.module.css'

type Props = {
  listening?: boolean
  onScan: () => void
  onVoice: () => void
  onManual: () => void
}

const ONRA_O = `${import.meta.env.BASE_URL}brand/simbolo.png`

/** viewBox 0–100; radii from simbolo.png (~334–501 px on 1000). */
const CX = 50
const CY = 50
const R_OUT = 51
const R_IN = 32.5

/** Gaps in the O sit near 90°, 210°, 330° (from top, clockwise). */
const ARCS = {
  scan: { a0: 338, a1: 82 },
  manual: { a0: 98, a1: 202 },
  voice: { a0: 218, a1: 322 },
} as const

function polar(r: number, degFromTopCw: number): [number, number] {
  const rad = (degFromTopCw * Math.PI) / 180
  return [CX + r * Math.sin(rad), CY - r * Math.cos(rad)]
}

function annularSectorPath(a0: number, a1: number): string {
  let sweep = (a1 - a0 + 360) % 360
  if (sweep === 0) sweep = 360
  const large = sweep > 180 ? 1 : 0
  const [ox0, oy0] = polar(R_OUT, a0)
  const [ox1, oy1] = polar(R_OUT, a1)
  const [ix1, iy1] = polar(R_IN, a1)
  const [ix0, iy0] = polar(R_IN, a0)
  return [
    `M ${ox0.toFixed(2)} ${oy0.toFixed(2)}`,
    `A ${R_OUT} ${R_OUT} 0 ${large} 1 ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    `A ${R_IN} ${R_IN} 0 ${large} 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)}`,
    'Z',
  ].join(' ')
}

function arcMid(a0: number, a1: number): number {
  return (a0 + ((a1 - a0 + 360) % 360) / 2) % 360
}

function onActivate(e: KeyboardEvent, fn: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

export function HomeLaunchO({ listening = false, onScan, onVoice, onManual }: Props) {
  const scanMid = arcMid(ARCS.scan.a0, ARCS.scan.a1)
  const voiceMid = arcMid(ARCS.voice.a0, ARCS.voice.a1)
  const manualMid = arcMid(ARCS.manual.a0, ARCS.manual.a1)
  const rIcon = (R_OUT + R_IN) / 2

  const [scanX, scanY] = polar(rIcon, scanMid)
  const [voiceX, voiceY] = polar(rIcon, voiceMid)
  const [manualX, manualY] = polar(rIcon, manualMid)

  return (
    <div className={styles.homeLaunchOWrap}>
      <div className={styles.homeLaunchO} role="group" aria-label="Lançar no Conora">
        <img className={styles.homeLaunchOMark} src={ONRA_O} alt="" aria-hidden />

        <svg className={styles.homeLaunchOSvg} viewBox="0 0 100 100" aria-hidden={false}>
          <path
            className={`${styles.homeLaunchOArc} ${listening ? styles.homeLaunchOHitDim : ''}`}
            d={annularSectorPath(ARCS.scan.a0, ARCS.scan.a1)}
            role="button"
            tabIndex={listening ? -1 : 0}
            aria-label="Escanear recibo"
            aria-disabled={listening || undefined}
            onClick={listening ? undefined : onScan}
            onKeyDown={listening ? undefined : (e) => onActivate(e, onScan)}
          />
          <path
            className={styles.homeLaunchOArc}
            d={annularSectorPath(ARCS.voice.a0, ARCS.voice.a1)}
            role="button"
            tabIndex={listening ? -1 : 0}
            aria-label={listening ? 'Ouvindo…' : 'Lançar por voz'}
            aria-busy={listening || undefined}
            aria-disabled={listening || undefined}
            onClick={listening ? undefined : onVoice}
            onKeyDown={listening ? undefined : (e) => onActivate(e, onVoice)}
          />
          <path
            className={`${styles.homeLaunchOArc} ${listening ? styles.homeLaunchOHitDim : ''}`}
            d={annularSectorPath(ARCS.manual.a0, ARCS.manual.a1)}
            role="button"
            tabIndex={listening ? -1 : 0}
            aria-label="Lançar manualmente"
            aria-disabled={listening || undefined}
            onClick={listening ? undefined : onManual}
            onKeyDown={listening ? undefined : (e) => onActivate(e, onManual)}
          />
        </svg>

        <span
          className={`${styles.homeLaunchOIcon} ${styles.homeLaunchOIconScan} ${listening ? styles.homeLaunchOHitDim : ''}`}
          style={{ left: `${scanX}%`, top: `${scanY}%` }}
          aria-hidden
        >
          <Icon name="camera" size={24} />
        </span>
        <span
          className={`${styles.homeLaunchOIcon} ${styles.homeLaunchOIconVoice} ${listening ? styles.homeLaunchOIconPulse : ''}`}
          style={{ left: `${voiceX}%`, top: `${voiceY}%` }}
          aria-hidden
        >
          <Icon name="mic" size={24} />
        </span>
        <span
          className={`${styles.homeLaunchOIcon} ${styles.homeLaunchOIconManual} ${listening ? styles.homeLaunchOHitDim : ''}`}
          style={{ left: `${manualX}%`, top: `${manualY}%` }}
          aria-hidden
        >
          <Icon name="pen" size={24} />
        </span>
      </div>
    </div>
  )
}

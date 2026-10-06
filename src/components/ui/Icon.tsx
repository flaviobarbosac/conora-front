import { ICON_CATALOG, type IconName } from '../../icons/catalog'

type Size = 16 | 20 | 24
type Variant = 'linear' | 'duo' | 'tile'

type Props = {
  name: IconName
  variant?: Variant
  size?: Size
  decorative?: boolean
  className?: string
}

export function Icon({ name, variant = 'linear', size = 24, decorative = true, className }: Props) {
  const def = ICON_CATALOG[name]
  const sizeClass = size === 16 ? 'icon--16' : size === 20 ? 'icon--20' : ''
  const svg = (
    <svg
      className={['icon', sizeClass, variant === 'duo' ? 'icon--duo' : '', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={variant === 'tile' ? 2 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : def.label}
    >
      {def.base.map((d) => (
        <path key={d} d={d} />
      ))}
      {def.accent.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )

  if (variant === 'tile') {
    return <span className="icon--tile">{svg}</span>
  }

  return svg
}

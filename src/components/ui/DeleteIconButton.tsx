import type { ButtonHTMLAttributes } from 'react'
import { Icon } from './Icon'
import { Button } from './Button'
import styles from './DeleteIconButton.module.css'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label?: string
}

export function DeleteIconButton({ label = 'Excluir', className, ...props }: Props) {
  return (
    <Button
      variant="ghost"
      className={[styles.button, className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon name="trash" size={20} decorative />
    </Button>
  )
}

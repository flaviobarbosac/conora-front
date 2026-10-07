import { forwardRef, type ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', className, type = 'button', ...props },
  ref,
) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ')
  return <button ref={ref} type={type} className={classes} {...props} />
})

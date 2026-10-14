import { useEffect, useState } from 'react'
import { familyApi, type SharingScope } from '../api/finance'
import { useLoad } from '../hooks/useLoad'
import { readSharingView, writeSharingView } from '../lib/sharingView'
import { Select } from './ui/Select'

type Props = {
  onChange?: (scope: SharingScope) => void
}

/** Family/Personal view switch — only when the user is in a group. */
export function SharingViewToggle({ onChange }: Props) {
  const group = useLoad(() => familyApi.group(), [])
  const [scope, setScope] = useState<SharingScope>(readSharingView)

  useEffect(() => {
    function sync() {
      setScope(readSharingView())
    }
    window.addEventListener('conora:sharing-view', sync)
    return () => window.removeEventListener('conora:sharing-view', sync)
  }, [])

  if (!group.data?.groupId) {
    return null
  }

  return (
    <Select
      label="Visão"
      name="sharingView"
      value={scope}
      onChange={(event) => {
        const next = event.target.value as SharingScope
        writeSharingView(next)
        setScope(next)
        onChange?.(next)
      }}
    >
      <option value="Family">Família (consolidado)</option>
      <option value="Personal">Pessoal</option>
    </Select>
  )
}

import { Navigate } from 'react-router-dom'
import { currentCompetence } from '../lib/format'

/** Legacy /importar route — classification now lives under lançamentos. */
export function ImportPage() {
  return <Navigate to={`/lancamentos/extrato?mes=${encodeURIComponent(currentCompetence())}`} replace />
}

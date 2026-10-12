import { registerPlugin } from '@capacitor/core'

export type ConoraShareResult = {
  found?: boolean
  fileName?: string
  mimeType?: string
  dataUrl?: string
}

type ConoraSharePlugin = {
  consumePendingShare: () => Promise<ConoraShareResult>
}

export const ConoraShare = registerPlugin<ConoraSharePlugin>('ConoraShare')

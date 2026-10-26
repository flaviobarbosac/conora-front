import type { PluginListenerHandle } from '@capacitor/core'
import { isNativeApp } from './platform'

const LANG = 'pt-BR'

export async function ensureNativeSpeechPermission(): Promise<boolean> {
  if (!isNativeApp()) {
    return false
  }
  const { SpeechRecognition } = await import('@capgo/capacitor-speech-recognition')
  const status = await SpeechRecognition.requestPermissions()
  if (status.speechRecognition !== 'granted') {
    return false
  }
  const { available } = await SpeechRecognition.available()
  return available
}

export type NativeSpeechHandlers = {
  stop: () => Promise<void>
}

/** Starts native STT with live partials. Caller owns pause/resume via stop + start again. */
export async function startNativeSpeech(options: {
  onPartial: (text: string) => void
  onError: (message: string) => void
  continuous?: boolean
}): Promise<NativeSpeechHandlers> {
  const { SpeechRecognition } = await import('@capgo/capacitor-speech-recognition')
  const handles: PluginListenerHandle[] = []

  handles.push(
    await SpeechRecognition.addListener('partialResults', (event) => {
      const text = (
        event.accumulatedText ??
        event.matches?.[0] ??
        event.accumulated ??
        ''
      ).trim()
      if (text) {
        options.onPartial(text)
      }
    }),
  )

  handles.push(
    await SpeechRecognition.addListener('error', (event) => {
      const code = event.code?.toLowerCase?.() ?? ''
      if (code.includes('permission') || code.includes('denied')) {
        options.onError('Permita o microfone para falar com o Ian.')
        return
      }
      options.onError(event.message || 'Não foi possível usar o microfone.')
    }),
  )

  await SpeechRecognition.start({
    language: LANG,
    maxResults: 1,
    partialResults: true,
    popup: false,
    continuousPTT: options.continuous ?? true,
    muteRecognizerBeep: true,
  })

  if (options.continuous) {
    await SpeechRecognition.setPTTState({ held: true }).catch(() => undefined)
  }

  return {
    stop: async () => {
      try {
        await SpeechRecognition.setPTTState({ held: false })
      } catch {
        /* ignore */
      }
      try {
        await SpeechRecognition.forceStop()
      } catch {
        try {
          await SpeechRecognition.stop()
        } catch {
          /* ignore */
        }
      }
      for (const handle of handles) {
        await handle.remove().catch(() => undefined)
      }
    },
  }
}

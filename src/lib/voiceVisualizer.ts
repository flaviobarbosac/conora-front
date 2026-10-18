const BARS = 16

/** Opens the mic and reports bar levels until the returned function is called. */
export function startVoiceVisualizer(onLevels: (levels: number[]) => void): () => void {
  let stopped = false
  let audio: AudioContext | null = null
  let stream: MediaStream | null = null
  let frame = 0

  void (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      audio = new AudioContext()
      const source = audio.createMediaStreamSource(stream)
      const analyser = audio.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const step = Math.max(1, Math.floor(data.length / BARS))
      const tick = () => {
        if (stopped) {
          return
        }
        analyser.getByteFrequencyData(data)
        const levels: number[] = []
        for (let index = 0; index < BARS; index += 1) {
          levels.push(Math.max(0.12, (data[index * step] ?? 0) / 255))
        }
        onLevels(levels)
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    } catch {
      /* The transcript still works if the analyser cannot open the mic. */
    }
  })()

  return () => {
    stopped = true
    cancelAnimationFrame(frame)
    stream?.getTracks().forEach((track) => track.stop())
    void audio?.close()
  }
}

export const VOICE_BAR_COUNT = BARS

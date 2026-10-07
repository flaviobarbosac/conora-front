declare module 'send-intent' {
  export const SendIntent: {
    checkSendIntentReceived: () => Promise<{ url?: string; title?: string; type?: string }>
  }
}

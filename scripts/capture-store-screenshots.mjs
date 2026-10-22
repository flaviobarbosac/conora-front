// Captures App Store screenshots of the local app (dev server + local API) with the demo account
// seeded by Conora-backEnd/tools/seed-demo.py. Local development only.
//
// Usage: node scripts/capture-store-screenshots.mjs <output-dir> [appUrl] [apiUrl]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const outDir = process.argv[2]
const appUrl = (process.argv[3] ?? 'http://localhost:5173').replace(/\/$/, '')
const apiUrl = (process.argv[4] ?? 'http://localhost:5080').replace(/\/$/, '')
if (!outDir) {
  console.error('Usage: node scripts/capture-store-screenshots.mjs <output-dir> [appUrl] [apiUrl]')
  process.exit(1)
}

// Local-only demo credentials from tools/seed-demo.py.
const DEMO_EMAIL = 'demo.loja@conora.local'
const DEMO_PASSWORD = 'Demo-Conora-2026!'

// App Store sizes: iPhone 6.9" (1320x2868) and iPad 13" (2064x2752).
const DEVICES = [
  { folder: 'iphone-6.9', width: 440, height: 956, scale: 3, mobile: true },
  { folder: 'ipad-13', width: 1032, height: 1376, scale: 2, mobile: true },
]

const SCREENS = [
  { name: '01-inicio', path: '/' },
  { name: '02-lancamentos', path: '/lancamentos' },
  { name: '03-orcamento', path: '/orcamento' },
  { name: '04-raio-x', path: '/raio-x' },
  { name: '05-contas', path: '/contas' },
]

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9333

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login() {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  })
  if (!response.ok) throw new Error(`Demo login failed: ${response.status}. Run tools/seed-demo.py first.`)
  return response.json()
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id
      pending.set(msgId, { resolve, reject })
      ws.send(JSON.stringify({ id: msgId, method, params }))
    })
  return new Promise((resolve) => ws.addEventListener('open', () => resolve({ send, close: () => ws.close() })))
}

async function main() {
  const auth = await login()
  const profileDir = join(tmpdir(), `conora-shots-${Date.now()}`)
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    '--hide-scrollbars',
    '--lang=pt-BR',
    'about:blank',
  ])

  let target
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250)
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      target = list.find((t) => t.type === 'page')
    } catch {
      // Chrome not ready yet.
    }
  }
  if (!target) throw new Error('Chrome did not start.')

  const cdp = await connect(target.webSocketDebuggerUrl)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  // Seed the session once on the app origin.
  await cdp.send('Page.navigate', { url: `${appUrl}/login` })
  await sleep(2500)
  await cdp.send('Runtime.evaluate', {
    expression: `sessionStorage.setItem('conora.accessToken', ${JSON.stringify(auth.accessToken)}); localStorage.setItem('conora.refreshToken', ${JSON.stringify(auth.refreshToken)})`,
  })

  for (const device of DEVICES) {
    const dir = join(outDir, device.folder)
    mkdirSync(dir, { recursive: true })
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: device.width,
      height: device.height,
      deviceScaleFactor: device.scale,
      mobile: device.mobile,
    })
    await cdp.send('Emulation.setUserAgentOverride', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    })

    for (const screen of SCREENS) {
      await cdp.send('Page.navigate', { url: `${appUrl}${screen.path}` })
      await sleep(8000)
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      const file = join(dir, `${screen.name}.png`)
      writeFileSync(file, Buffer.from(shot.data, 'base64'))
      console.log(file)
    }
  }

  cdp.close()
  chrome.kill()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  consoleApi,
  type ConsoleGeoConfig,
  type ConsoleGeoCoordenada,
  type ConsoleGeoEstado,
  type ConsoleGeoMap,
  type ConsoleGeoUser,
} from '../api/finance'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { useLoad } from '../hooks/useLoad'
import { useRegisterDirty } from '../hooks/useUnsavedChanges'
import {
  CAMPOS_PIN,
  CORES_PLANO,
  CENTRO_BRASIL,
  CENTRO_UF,
  chaveLocal,
  coordenadaValida,
  corDoPlano,
  enderecoGeocode,
  htmlDoCartao,
  normalizarUf,
  podeGeocodificar,
  textoDoPin,
} from '../lib/consoleGeo'
import { createMap, createMarker, fitPoints, geocodeAddress, loadGoogleMaps, type GoogleMap, type LatLng } from '../lib/googleMaps'
import { showSaveToast } from '../lib/saveToast'
import styles from './ConsoleMapPage.module.css'

type Bundle = { mapa: ConsoleGeoMap; config: ConsoleGeoConfig }
type Selecao = { uf: string | null; municipio: string | null; bairro: string | null }

const VAZIO: Selecao = { uf: null, municipio: null, bairro: null }
let cache: { at: number; value: Bundle } | null = null

async function loadConfig(): Promise<ConsoleGeoConfig> {
  try {
    return await consoleApi.geoConfig()
  } catch {
    return await consoleApi.geoConfig()
  }
}

async function loadBundle(): Promise<Bundle> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value
  const [mapa, config] = await Promise.all([consoleApi.geo(), loadConfig()])
  const value = { mapa, config }
  cache = { at: Date.now(), value }
  return value
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function assinatura(config: Pick<ConsoleGeoConfig, 'pinLabelCampo' | 'pinLabelTexto' | 'mostrarRotulo' | 'camposVisiveis'>) {
  return JSON.stringify({
    pinLabelCampo: config.pinLabelCampo,
    pinLabelTexto: config.pinLabelTexto ?? '',
    mostrarRotulo: config.mostrarRotulo,
    camposVisiveis: config.camposVisiveis,
  })
}

export function ConsoleMapPage() {
  const load = useLoad(loadBundle, [])
  const mapaRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<GoogleMap | null>(null)
  const markersRef = useRef<Array<{ setMap: (map: GoogleMap | null) => void }>>([])
  const triedRef = useRef(new Set<string>())
  const [mapa, setMapa] = useState<ConsoleGeoMap | null>(null)
  const [config, setConfig] = useState<ConsoleGeoConfig | null>(null)
  const [draft, setDraft] = useState<ConsoleGeoConfig | null>(null)
  const [locais, setLocais] = useState<Record<string, LatLng>>({})
  const [selecao, setSelecao] = useState<Selecao>(VAZIO)
  const [locating, setLocating] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [scriptErro, setScriptErro] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroConfig, setErroConfig] = useState<string | null>(null)

  useEffect(() => {
    if (!load.data) return
    setMapa(load.data.mapa)
    setConfig(load.data.config)
    setDraft(load.data.config)
  }, [load.data])

  const dirty = Boolean(config && draft && assinatura(config) !== assinatura(draft))
  useRegisterDirty('console-mapa', dirty)

  const usuarios = mapa?.usuarios ?? []
  const pontoDe = (usuario: ConsoleGeoUser): LatLng | null => {
    const local = locais[usuario.id]
    const lat = local?.lat ?? usuario.latitude
    const lng = local?.lng ?? usuario.longitude
    return coordenadaValida(lat, lng) ? { lat: lat as number, lng: lng as number } : null
  }

  useEffect(() => {
    const key = config?.googleMapsApiKey
    const element = mapaRef.current
    if (!key || !element || mapRef.current) return
    let cancel = false
    loadGoogleMaps(key)
      .then(() => {
        if (cancel || !mapaRef.current || mapRef.current) return
        mapRef.current = createMap(mapaRef.current)
        setMapReady(true)
      })
      .catch(() => {
        if (!cancel) setScriptErro(true)
      })
    return () => {
      cancel = true
    }
  }, [config?.googleMapsApiKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !config) return
    for (const marker of markersRef.current) marker.setMap(null)
    markersRef.current = usuarios.flatMap((usuario) => {
      const ponto = pontoDe(usuario)
      if (!ponto) return []
      const texto = textoDoPin(
        usuario,
        config.pinLabelTexto,
        config.camposVisiveis.filter((campo) => campo !== 'categoria' && campo !== 'logradouro'),
        config.pinLabelCampo,
      )
      const marker = createMarker(
        map,
        ponto,
        corDoPlano(usuario.plano),
        config.mostrarRotulo ? texto : null,
        texto,
        htmlDoCartao(usuario, config.camposVisiveis),
      )
      return [marker]
    })
  }, [mapReady, usuarios, locais, config])

  useEffect(() => {
    if (!mapReady || !mapa) return
    const pending = mapa.usuarios.filter((usuario) => podeGeocodificar(usuario) && !triedRef.current.has(usuario.id))
    if (pending.length === 0) return
    let cancel = false
    ;(async () => {
      setLocating(true)
      const found: ConsoleGeoCoordenada[] = []
      for (let index = 0; index < pending.length; index += 1) {
        if (cancel) return
        if (index > 0) await wait(150)
        const usuario = pending[index]
        const ponto = await geocodeAddress(enderecoGeocode(usuario))
        if (cancel) return
        triedRef.current.add(usuario.id)
        if (!ponto || !coordenadaValida(ponto.lat, ponto.lng)) continue
        found.push({ usuarioId: usuario.id, latitude: ponto.lat, longitude: ponto.lng })
        setLocais((current) => ({ ...current, [usuario.id]: ponto }))
      }
      if (!cancel && found.length > 0) {
        try {
          for (let index = 0; index < found.length; index += 200) {
            await consoleApi.geoCoordenadas(found.slice(index, index + 200))
          }
          setMapa((current) => {
            if (!current) return current
            const ids = new Set(found.map((item) => item.usuarioId))
            const usuariosAtualizados = current.usuarios.map((usuario) => {
              const salvo = found.find((item) => item.usuarioId === usuario.id)
              if (!salvo || usuario.latitude != null) return usuario
              return { ...usuario, latitude: salvo.latitude, longitude: salvo.longitude }
            })
            const next = {
              ...current,
              comCoordenada: current.comCoordenada + usuariosAtualizados.filter((usuario, index) => ids.has(usuario.id) && current.usuarios[index].latitude == null).length,
              usuarios: usuariosAtualizados,
            }
            if (cache) cache = { at: cache.at, value: { ...cache.value, mapa: next } }
            return next
          })
        } catch {
          // The pin stays for this session when the save fails.
        }
      }
      if (!cancel) setLocating(false)
    })()
    return () => {
      cancel = true
    }
  }, [mapReady, mapa])

  const maxEstado = useMemo(
    () => Math.max(1, ...(mapa?.estados.map((estado) => estado.quantidade) ?? [1])),
    [mapa],
  )

  function pontosNaUf(uf: string) {
    return usuarios.flatMap((usuario) => {
      if (normalizarUf(usuario.uf) !== uf) return []
      const ponto = pontoDe(usuario)
      return ponto ? [ponto] : []
    })
  }

  function pontosNoLocal(uf: string, municipio: string, bairro?: string) {
    return usuarios.flatMap((usuario) => {
      if (normalizarUf(usuario.uf) !== uf) return []
      if (chaveLocal(usuario.municipio) !== chaveLocal(municipio)) return []
      if (bairro != null && chaveLocal(usuario.bairro) !== chaveLocal(bairro)) return []
      const ponto = pontoDe(usuario)
      return ponto ? [ponto] : []
    })
  }

  function enquadrar(pontos: LatLng[], zoomUm: number, fallback?: LatLng, zoomFallback = 6) {
    const map = mapRef.current
    if (!map) return
    if (pontos.length === 1) {
      map.setCenter(pontos[0])
      map.setZoom(zoomUm)
      return
    }
    if (pontos.length > 1) {
      fitPoints(map, pontos)
      return
    }
    if (!fallback) return
    map.setCenter(fallback)
    map.setZoom(zoomFallback)
  }

  function irBrasil() {
    setSelecao(VAZIO)
    mapRef.current?.setCenter(CENTRO_BRASIL)
    mapRef.current?.setZoom(4)
  }

  function irEstado(estado: ConsoleGeoEstado) {
    if (selecao.uf === estado.uf && !selecao.municipio) {
      irBrasil()
      return
    }
    setSelecao({ uf: estado.uf, municipio: null, bairro: null })
    enquadrar(pontosNaUf(estado.uf), 7, CENTRO_UF[estado.uf], 6)
  }

  async function irMunicipio(estado: ConsoleGeoEstado, nome: string) {
    setSelecao({ uf: estado.uf, municipio: nome, bairro: null })
    const pontos = pontosNoLocal(estado.uf, nome)
    if (pontos.length > 0) {
      enquadrar(pontos, 12)
      return
    }
    const cidade = nome.trim() || estado.nome
    const ponto = await geocodeAddress(`${cidade}, ${estado.uf}, Brasil`)
    if (ponto && mapRef.current) {
      mapRef.current.setCenter(ponto)
      mapRef.current.setZoom(12)
      return
    }
    const centro = CENTRO_UF[estado.uf]
    if (centro && mapRef.current) {
      mapRef.current.setCenter(centro)
      mapRef.current.setZoom(6)
    }
  }

  async function irBairro(estado: ConsoleGeoEstado, municipio: string, nome: string) {
    setSelecao({ uf: estado.uf, municipio, bairro: nome })
    const pontos = pontosNoLocal(estado.uf, municipio, nome)
    if (pontos.length > 0) {
      enquadrar(pontos, 15)
      return
    }
    const ponto = await geocodeAddress(`${nome}, ${municipio}, ${estado.uf}, Brasil`)
    if (!ponto || !mapRef.current) return
    mapRef.current.setCenter(ponto)
    mapRef.current.setZoom(14)
  }

  async function salvar() {
    if (!draft) return
    setSalvando(true)
    setErroConfig(null)
    try {
      const salvo = await consoleApi.saveGeoConfig({
        pinLabelCampo: draft.pinLabelCampo,
        pinLabelTexto: draft.pinLabelTexto,
        mostrarRotulo: draft.mostrarRotulo,
        camposVisiveis: draft.camposVisiveis,
      })
      setConfig(salvo)
      setDraft(salvo)
      if (cache) cache = { at: cache.at, value: { ...cache.value, config: salvo } }
      showSaveToast('Aparência do pin salva.')
    } catch {
      setErroConfig('Não foi possível salvar a aparência do pin.')
    } finally {
      setSalvando(false)
    }
  }

  function cancelar() {
    setDraft(config)
    setErroConfig(null)
  }

  function alternarCampo(campo: string) {
    setDraft((current) => {
      if (!current) return current
      const tem = current.camposVisiveis.includes(campo)
      return {
        ...current,
        camposVisiveis: tem
          ? current.camposVisiveis.filter((item) => item !== campo)
          : [...current.camposVisiveis, campo],
      }
    })
  }

  const semChave = Boolean(config && !config.googleMapsApiKey)
  const erroCarga = load.error ? 'Não foi possível carregar os dados do mapa.' : null

  return (
    <section className={styles.page}>
      <div className={styles.mapWrap}>
        <div ref={mapaRef} className={styles.map} />
        {load.loading ? <div className={styles.overlay}>Carregando</div> : null}
        {erroCarga ? <div className={styles.overlay}>{erroCarga}</div> : null}
        {scriptErro ? <div className={styles.overlay}>Não foi possível carregar o Google Maps. Confira a chave.</div> : null}
        {semChave ? <div className={styles.overlay}>A chave do Google Maps não está configurada no servidor.</div> : null}
        {locating ? <p className={styles.locating}>Localizando endereços</p> : null}
      </div>

      <aside className={styles.list}>
        <p className={styles.legend}>
          {mapa ? `${mapa.comCoordenada} de ${mapa.total} no mapa` : '—'}
        </p>
        {mapa && mapa.total === 0 ? <p className={styles.empty}>Nenhum usuário cadastrado.</p> : null}
        {mapa && mapa.total > 0 && mapa.estados.length === 0 ? (
          <p className={styles.hint}>Nenhum estado reconhecido. Quem não tem UF continua no total e pode ter pin.</p>
        ) : null}

        <button type="button" className={selecao.uf ? styles.item : styles.itemActive} onClick={irBrasil}>
          Brasil
        </button>

        {mapa?.estados.map((estado) => {
          const aberto = selecao.uf === estado.uf
          return (
            <div key={estado.uf}>
              <button type="button" className={aberto ? styles.itemActive : styles.item} onClick={() => irEstado(estado)}>
                <span>{estado.nome}</span>
                <span>{estado.quantidade}</span>
              </button>
              <span className={styles.bar} style={{ width: `${(estado.quantidade / maxEstado) * 100}%` }} />
              {aberto
                ? estado.municipios.map((municipio) => {
                    const municipioAberto = selecao.municipio === municipio.nome
                    const rotulo = municipio.nome || 'Sem município'
                    return (
                      <div key={`${estado.uf}-${municipio.nome}`}>
                        <button
                          type="button"
                          className={municipioAberto ? styles.subActive : styles.sub}
                          onClick={() => void irMunicipio(estado, municipio.nome)}
                        >
                          <span>{rotulo}</span>
                          <span>{municipio.quantidade}</span>
                        </button>
                        {municipioAberto
                          ? municipio.bairros.map((bairro) => (
                              <button
                                key={`${municipio.nome}-${bairro.nome}`}
                                type="button"
                                className={selecao.bairro === bairro.nome ? styles.bairroActive : styles.bairro}
                                onClick={() => void irBairro(estado, municipio.nome, bairro.nome)}
                              >
                                <span>{bairro.nome || 'Sem bairro'}</span>
                                <span>{bairro.quantidade}</span>
                              </button>
                            ))
                          : null}
                      </div>
                    )
                  })
                : null}
            </div>
          )
        })}

        {draft ? (
          <details className={styles.accordion}>
          <summary>Aparência do pin</summary>
          <form
            className={styles.config}
            onSubmit={(event) => {
              event.preventDefault()
              void salvar()
            }}
          >
            <ul className={styles.colors}>
              {CORES_PLANO.map(([nome, cor]) => (
                <li key={nome}>
                  <span className={styles.swatch} style={{ background: cor }} />
                  {nome}
                </li>
              ))}
            </ul>
            <label className={styles.check}>
              Campo do rótulo
              <select
                value={draft.pinLabelCampo}
                onChange={(event) => setDraft({ ...draft, pinLabelCampo: event.target.value })}
              >
                {CAMPOS_PIN.map(([campo, rotulo]) => (
                  <option key={campo} value={campo}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Texto fixo"
              name="pinLabelTexto"
              value={draft.pinLabelTexto ?? ''}
              onChange={(event) => setDraft({ ...draft, pinLabelTexto: event.target.value })}
            />
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={draft.mostrarRotulo}
                onChange={(event) => setDraft({ ...draft, mostrarRotulo: event.target.checked })}
              />
              Mostrar rótulo
            </label>
            <fieldset className={styles.fields}>
              <legend>Campos do cartão</legend>
              {CAMPOS_PIN.map(([campo, rotulo]) => (
                <label key={campo}>
                  <input
                    type="checkbox"
                    checked={draft.camposVisiveis.includes(campo)}
                    onChange={() => alternarCampo(campo)}
                  />
                  {rotulo}
                </label>
              ))}
            </fieldset>
            {erroConfig ? <p className={styles.hint}>{erroConfig}</p> : null}
            <div className={styles.actions}>
              <Button type="submit" disabled={!dirty || salvando}>
                Salvar
              </Button>
              <Button type="button" variant="secondary" disabled={!dirty || salvando} onClick={cancelar}>
                Cancelar
              </Button>
            </div>
          </form>
          </details>
        ) : null}
      </aside>
    </section>
  )
}

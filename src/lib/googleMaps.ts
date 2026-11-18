export type LatLng = { lat: number; lng: number }

export type GoogleMap = {
  setCenter: (point: LatLng) => void
  setZoom: (zoom: number) => void
  fitBounds: (bounds: unknown) => void
}

type GoogleMarker = {
  setMap: (map: GoogleMap | null) => void
  addListener: (event: string, handler: () => void) => void
}

type GoogleMapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap
  Marker: new (options: Record<string, unknown>) => GoogleMarker
  InfoWindow: new (options: { content: string }) => { open: (map: GoogleMap, marker: GoogleMarker) => void }
  LatLngBounds: new () => { extend: (point: LatLng) => void }
  Geocoder: new () => {
    geocode: (
      request: { address: string; region?: string },
      callback: (
        results: Array<{ geometry: { location: { lat: () => number; lng: () => number } } }> | null,
        status: string,
      ) => void,
    ) => void
  }
  ColorScheme?: { LIGHT: string }
}

declare global {
  interface Window {
    google?: { maps: GoogleMapsApi }
  }
}

let loading: Promise<void> | null = null

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve()
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.dataset.conoraMaps = '1'
    script.async = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&language=pt-BR&region=BR`
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      reject(new Error('maps'))
    }
    document.head.appendChild(script)
  })
  return loading
}

export function mapsApi(): GoogleMapsApi {
  const maps = window.google?.maps
  if (!maps) throw new Error('maps')
  return maps
}

export function geocodeAddress(address: string): Promise<LatLng | null> {
  const geocoder = new (mapsApi().Geocoder)()
  return new Promise((resolve) => {
    geocoder.geocode({ address, region: 'BR' }, (results, status) => {
      const point = results?.[0]?.geometry.location
      if (status !== 'OK' || !point) {
        resolve(null)
        return
      }
      resolve({ lat: point.lat(), lng: point.lng() })
    })
  })
}

export function createMap(element: HTMLElement): GoogleMap {
  const maps = mapsApi()
  return new maps.Map(element, {
    center: { lat: -14.235, lng: -51.925 },
    zoom: 4,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    colorScheme: maps.ColorScheme?.LIGHT,
  })
}

export function createMarker(
  map: GoogleMap,
  position: LatLng,
  color: string,
  label: string | null,
  title: string,
  html: string,
): GoogleMarker {
  const maps = mapsApi()
  const marker = new maps.Marker({
    map,
    position,
    title,
    label: label ? { text: label.slice(0, 32), color: '#1a1a1a', fontSize: '11px' } : undefined,
    icon: {
      path: 0,
      scale: 9,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 1.5,
    },
  })
  const windowInfo = new maps.InfoWindow({ content: html })
  marker.addListener('click', () => windowInfo.open(map, marker))
  return marker
}

export function fitPoints(map: GoogleMap, points: LatLng[]) {
  const bounds = new (mapsApi().LatLngBounds)()
  for (const point of points) bounds.extend(point)
  map.fitBounds(bounds)
}

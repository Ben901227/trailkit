import type { RawTileLayer } from './parseKml'

/**
 * Google Earth delivers raster layers as "super-overlays": a NetworkLink to a
 * pyramid of remote KML files, each holding one GroundOverlay and links to its
 * children. Following that would mean fetching KML per viewport tile — and the
 * happyman links are plain http, which a page served over https cannot load at
 * all.
 *
 * Both services that show up in these files also publish ordinary XYZ tiles, so
 * the link is translated to the tile URL instead. Only URL shapes that have
 * been checked against the live services are translated; anything else is
 * reported rather than guessed at, because a wrong guess yields a layer that
 * silently renders nothing.
 */

/** happyman layers that exist under /map/<id>/{z}/{x}/{y}.png. */
const HAPPYMAN_LAYERS = new Set([
  'rudy',
  'rudy_bn',
  'rudy_dn',
  'rudy_tn',
  'rudy_en',
  'moi_osm',
  'happyman',
  'forest',
])

const SINICA_BOUNDS: [number, number, number, number] = [119.2, 21.8, 122.15, 25.7]

export interface NetworkLinkResult {
  layers: RawTileLayer[]
  /** Links that could not be translated, described for the user. */
  unsupported: string[]
}

/** "rudy - (53, 36, 6)" is one grid tile of a layer; the layer is what we want. */
function cleanName(name: string): string {
  return name.replace(/\s*-\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)\s*$/, '').trim()
}

function translate(href: string): string | null {
  const sinica = /gis\.sinica\.edu\.tw\/(?:googlemap|tileserver)\/([A-Za-z0-9_]+)\//.exec(href)
  if (sinica) {
    return `https://gis.sinica.edu.tw/tileserver/file-exists.php?img=${sinica[1]}-png-{z}-{x}-{y}`
  }

  const happyman = /tile\.happyman\.idv\.tw\/mp\/kml\/([A-Za-z0-9_]+)\//.exec(href)
  if (happyman && HAPPYMAN_LAYERS.has(happyman[1] as string)) {
    return `https://tile.happyman.idv.tw/map/${happyman[1]}/{z}/{x}/{y}.png`
  }

  return null
}

export function extractNetworkLayers(xml: Document): NetworkLinkResult {
  const layers: RawTileLayer[] = []
  const unsupported: string[] = []
  const seen = new Set<string>()

  const nodes = xml.getElementsByTagName('NetworkLink')
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i]
    if (!el) continue
    const href = el.getElementsByTagName('href')[0]?.textContent?.trim()
    if (!href) continue

    const name = cleanName(el.getElementsByTagName('name')[0]?.textContent ?? `圖層 ${i + 1}`)
    const url = translate(href)

    if (!url) {
      const label = `NetworkLink「${name}」（外部圖層，未支援）`
      if (!unsupported.includes(label)) unsupported.push(label)
      continue
    }
    // The same layer appears once per grid tile the export happened to cover.
    if (seen.has(url)) continue
    seen.add(url)

    layers.push({
      name,
      url,
      minzoom: 0,
      maxzoom: 16,
      opacity: 1,
      ...(url.includes('sinica') ? { bounds: SINICA_BOUNDS } : {}),
    })
  }

  return { layers, unsupported }
}

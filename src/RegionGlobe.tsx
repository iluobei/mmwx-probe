import { useEffect, useMemo, useRef, useState } from 'react'
import { geoCentroid, geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo'
import type { GeoProjection } from 'd3-geo'
import countries from 'i18n-iso-countries'
import { feature } from 'topojson-client'
import world from 'world-atlas/countries-110m.json'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { arcPath, arcPointAt, pickArcPairs, sampleArc } from './globe-arcs'

function countryCode(region: string): string {
  const points = [...region.trim()].map(char => char.codePointAt(0) || 0)
  if (points.length === 2 && points.every(point => point >= 0x1f1e6 && point <= 0x1f1ff)) {
    return points.map(point => String.fromCharCode(point - 0x1f1e6 + 65)).join('')
  }
  const code = region.trim().split(/[·,\s]+/)[0]?.toUpperCase() || ''
  return /^[A-Z]{2}$/.test(code) ? code : ''
}

const regionCoordinates: Record<string, [number, number]> = {
  HK: [114.17, 22.32], MO: [113.54, 22.20], SG: [103.82, 1.35],
}

// 地球默认朝向(对着东亚)
const DEFAULT_ROTATION: [number, number] = [-105, -18]

type RegionArc = { key: string; from: [number, number]; to: [number, number]; phase: number }

// 地区之间的 3D 弧线:渐变描边 + 一层模糊光晕,弧上有光点从一头跑到另一头。
function RegionArcs({ arcs, projection }: { arcs: RegionArc[]; projection: GeoProjection }) {
  const geometry = useMemo(() => arcs.map(arc => {
    const points = sampleArc(projection, arc.from, arc.to)
    // 光点走完一条弧的时间:远的走得久一些
    return { ...arc, points, d: arcPath(points), duration: 1800 + 1600 * (geoDistance(arc.from, arc.to) / Math.PI) }
  }), [arcs, projection])
  const packets = useRef<Array<SVGGElement | null>>([])
  const latest = useRef(geometry)
  useEffect(() => { latest.current = geometry }, [geometry])
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const render = (now: number) => {
      latest.current.forEach((arc, index) => {
        const el = packets.current[index]
        if (!el) return
        const t = (now / arc.duration + arc.phase) % 1
        const at = arcPointAt(arc.points, t)
        if (!at) { el.setAttribute('opacity', '0'); return }
        // 两头淡入淡出,别从端点上「蹦」出来
        el.setAttribute('opacity', Math.min(1, t / .08, (1 - t) / .08).toFixed(2))
        el.setAttribute('transform', `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`)
      })
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [])
  return <g className="globe-arcs">
    <defs>{geometry.map(arc => {
      const first = arc.points[0]
      const last = arc.points[arc.points.length - 1]
      return first && last ? <linearGradient key={arc.key} id={`globe-arc-${arc.key}`} gradientUnits="userSpaceOnUse" x1={first.x} y1={first.y} x2={last.x} y2={last.y}><stop offset="0" className="arc-from" /><stop offset="1" className="arc-to" /></linearGradient> : null
    })}</defs>
    <g filter="url(#globe-arc-blur)">{geometry.map(arc => <path key={arc.key} className="arc-glow" d={arc.d} stroke={`url(#globe-arc-${arc.key})`} />)}</g>
    {geometry.map(arc => <path key={arc.key} className="arc-core" d={arc.d} stroke={`url(#globe-arc-${arc.key})`} />)}
    {geometry.map((arc, index) => <g key={arc.key} ref={el => { packets.current[index] = el }} opacity="0"><circle className="arc-packet-glow" r="5" /><circle className="arc-packet" r="2.2" /></g>)}
  </g>
}

export function RegionGlobe({ regions }: { regions: string[] }) {
  const [rotation, setRotation] = useState<[number, number]>(DEFAULT_ROTATION)
  const drag = useRef<{ x: number; y: number; rotation: [number, number] } | undefined>(undefined)
  // 地区集合不变时保持 key 稳定；节点地区变化时同步刷新地图高亮。
  const regionKey = [...regions].filter(Boolean).sort().join('\u0001')
  const activeRegions = useMemo(() => {
    const result = new Map<string, number>()
    for (const region of regionKey.split('\u0001')) {
      const code = countryCode(region)
      if (code) result.set(code, (result.get(code) || 0) + 1)
    }
    return result
  }, [regionKey])
  const collection = useMemo(() => feature(
    world as unknown as Topology,
    (world as unknown as Topology).objects.countries as GeometryCollection,
  ) as unknown as FeatureCollection<Geometry, { name?: string }>, [])
  const projection = useMemo(() => geoOrthographic().translate([320, 190]).scale(168).clipAngle(90).precision(.5).rotate(rotation), [rotation])
  const path = useMemo(() => geoPath(projection), [projection])
  const pointPath = useMemo(() => geoPath(projection).pointRadius(3.5), [projection])
  const haloPath = useMemo(() => geoPath(projection).pointRadius(8), [projection])
  const locations = useMemo(() => [...activeRegions].map(([code, count]) => {
    const numeric = countries.alpha2ToNumeric(code)
    const country = collection.features.find(item => String(item.id || '').padStart(3, '0') === numeric)
    const coordinates = regionCoordinates[code] || (country ? geoCentroid(country) as [number, number] : undefined)
    return coordinates ? { code, count, coordinates } : undefined
  }).filter((item): item is { code: string; count: number; coordinates: [number, number] } => !!item), [activeRegions, collection])
  const arcs = useMemo(() => pickArcPairs(locations, [-DEFAULT_ROTATION[0], -DEFAULT_ROTATION[1]]).map(([from, to], index) => ({
    key: `${from.code}-${to.code}`,
    from: from.coordinates,
    to: to.coordinates,
    // 错开各条弧上光点的出发时刻;不用随机数,重绘后节奏不跳
    phase: (index * .382) % 1,
  })), [locations])
  return <div className="globe-stage">
    <svg className="region-globe" viewBox="0 -40 640 460" role="img" aria-label="服务器地区地球分布"
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, rotation } }}
      onPointerMove={event => { if (!drag.current) return; const dx = event.clientX - drag.current.x; const dy = event.clientY - drag.current.y; setRotation([drag.current.rotation[0] + dx * .35, Math.max(-75, Math.min(75, drag.current.rotation[1] - dy * .35))]) }}
      onPointerUp={() => { drag.current = undefined }} onPointerCancel={() => { drag.current = undefined }}>
      <defs><radialGradient id="globe-ocean" cx="35%" cy="28%"><stop offset="0" stopColor="var(--globe-ocean-light)" /><stop offset="1" stopColor="var(--globe-ocean-dark)" /></radialGradient><filter id="globe-glow"><feGaussianBlur stdDeviation="7" /></filter><filter id="globe-arc-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5" /></filter></defs>
      <circle className="globe-glow" cx="320" cy="190" r="171" filter="url(#globe-glow)" />
      <path className="globe-ocean" d={path({ type: 'Sphere' }) || ''} />
      <path className="globe-grid" d={path(geoGraticule10()) || ''} />
      {collection.features.map((country: Feature<Geometry, { name?: string }>) => {
        const id = String(country.id || '').padStart(3, '0')
        const code = countries.numericToAlpha2(id)
        const count = code ? activeRegions.get(code) || 0 : 0
        return <path key={id} className={count ? 'globe-country active' : 'globe-country'} d={path(country) || ''}><title>{country.properties?.name || id}{count ? ` · ${count} 台服务器` : ''}</title></path>
      })}
      <RegionArcs arcs={arcs} projection={projection} />
      <g className="globe-points">{locations.map(location => <g key={location.code} className="laser-origin"><path className="region-point-halo" d={haloPath({ type: 'Point', coordinates: location.coordinates }) || ''} /><path className="region-point" d={pointPath({ type: 'Point', coordinates: location.coordinates }) || ''}><title>{location.code} · {location.count} 台服务器</title></path></g>)}</g>
      <path className="globe-outline" d={path({ type: 'Sphere' }) || ''} />
    </svg>
    <p>拖动地球查看地区 · 已点亮 {activeRegions.size} 个国家或地区</p>
  </div>
}

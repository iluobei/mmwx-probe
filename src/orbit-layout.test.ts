import {
  CITY_REGION_COORDINATES,
  GLOBE_CENTER,
  LABEL_MIN_GAP,
  layoutOrbit,
  MAX_ORBIT_LABELS,
} from './orbit-layout'
import type { PremiumProbeRegion } from './BlackGoldGlobe'

// 与主面板 src/features/premium-probe/orbit-layout.test.ts 同一组用例(外置探针不装 @types/node,
// 所以不用 node:test,沿用本仓库测试的写法:失败直接抛错)。

function ok(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

const region = (code: string): PremiumProbeRegion => ({
  code,
  label: code,
  total: 1,
  online: 1,
})

// 亚洲几个地区 + 一个欧美的,坐标都在 CITY_REGION_COORDINATES 或世界地图里
const coordinates = new Map<string, [number, number]>([
  ['HK', CITY_REGION_COORDINATES.HK],
  ['SG', CITY_REGION_COORDINATES.SG],
  ['JP', [138.0, 36.0]],
  ['US', [-98.0, 39.0]],
  ['DE', [10.0, 51.0]],
])

const ORBIT_RADIUS = 145

// 这就是 #566:标签原来按数组下标平分角度,转地球纹丝不动。
{
  const regions = [region('HK'), region('US'), region('DE')]
  const a = layoutOrbit(regions, coordinates, [-108, -16], ORBIT_RADIUS)
  const b = layoutOrbit(regions, coordinates, [-8, -16], ORBIT_RADIUS)
  const moved = a.filter(
    (p, i) => Math.abs(p.radians - b[i].radians) > 1e-6
  ).length
  ok(moved >= 2, `转动地球时应有多个标签换了方位,实际只有 ${moved} 个`)
}

// 标签方位指向该地区的真实投影位置:视角正对香港时它应落在球心附近
{
  const [lon, lat] = CITY_REGION_COORDINATES.HK
  const [hk] = layoutOrbit([region('HK')], coordinates, [-lon, -lat], ORBIT_RADIUS)
  ok(hk.front, '正对视角时该地区应在正面')
  ok(
    Math.hypot(hk.rimX - GLOBE_CENTER.x, hk.rimY - GLOBE_CENTER.y) < 2,
    '正对视角时该地区应落在球心'
  )
}

// 转到背面的地区标记为 behind,点钉在边缘
{
  const [lon, lat] = CITY_REGION_COORDINATES.HK
  const [hk] = layoutOrbit(
    [region('HK')],
    coordinates,
    [-(lon + 180), lat],
    ORBIT_RADIUS
  )
  ok(!hk.front, '对跖视角时该地区应在背面')
  const dist = Math.hypot(hk.rimX - GLOBE_CENTER.x, hk.rimY - GLOBE_CENTER.y)
  ok(Math.abs(dist - 112) < 1e-6, `背面点应钉在边缘,实际半径 ${dist}`)
}

// 扎堆的地区被推开到最小间隔以上:港新只差 20 多度经度,不推开会叠成一坨
{
  const points = layoutOrbit(
    [region('HK'), region('SG'), region('JP')],
    coordinates,
    [-114, -22],
    ORBIT_RADIUS
  )
  const angles = points.map((p) => p.radians).sort((a, b) => a - b)
  for (let i = 1; i < angles.length; i++) {
    ok(
      angles[i] - angles[i - 1] >= LABEL_MIN_GAP - 1e-9,
      `第 ${i} 个标签间隔 ${angles[i] - angles[i - 1]} 小于下限 ${LABEL_MIN_GAP}`
    )
  }
}

// 没有坐标的地区退回按序号平分,不会跑到球心
{
  const points = layoutOrbit(
    [region('HK'), region('ZZ')],
    coordinates,
    [-108, -16],
    ORBIT_RADIUS
  )
  const zz = points[1]
  ok(Number.isFinite(zz.radians), '兜底方位应是有限值')
  ok(
    Math.hypot(zz.x - GLOBE_CENTER.x, zz.y - GLOBE_CENTER.y) > 100,
    '兜底的标签也该在环上'
  )
}

// 冰岛实报:9 个地区时第 8、9 个(冰岛、法国)从前被写死的 7 个上限截掉了。
{
  ok(MAX_ORBIT_LABELS >= 9, `上限只有 ${MAX_ORBIT_LABELS}`)
  const nine = ['SG', 'HK', 'US', 'JP', 'PH', 'NO', 'IE', 'IS', 'FR']
  const coords = new Map(coordinates)
  coords.set('PH', [122.0, 13.0])
  coords.set('NO', [10.2, 59.1])
  coords.set('IE', [-6.3, 53.3])
  coords.set('IS', [-21.9, 64.1])
  coords.set('FR', [2.3, 46.6])
  const angles = layoutOrbit(nine.map(region), coords, [-108, -16], ORBIT_RADIUS)
    .map((p) => p.radians)
    .sort((a, b) => a - b)
  for (let i = 1; i < angles.length; i++) {
    ok(
      angles[i] - angles[i - 1] >= LABEL_MIN_GAP - 1e-9,
      `第 ${i} 个标签间隔 ${angles[i] - angles[i - 1]} 小于下限 ${LABEL_MIN_GAP}`
    )
  }
}

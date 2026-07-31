import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Activity, ArrowDown, ArrowUp, Clock, Cpu, HardDrive, LayoutGrid, List, MemoryStick, PieChart, Wifi } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProbeBucket, ProbePingSeries, ProbeServer } from './types'
import { useProbe } from './use-probe'
import { Twemoji } from './Twemoji'

const colors = ['#8b5cf6', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#ec4899']
const ranges = [
  { key: '1h', label: '1 小时', bucketLabel: (index: number, count: number) => `-${(count - index) * 5}m` },
  { key: '6h', label: '6 小时', bucketLabel: (index: number, count: number) => `-${(((count - index) * 10) / 60).toFixed(1)}h` },
  { key: '24h', label: '24 小时', bucketLabel: (index: number, count: number) => `-${(((count - index) * 30) / 60).toFixed(0)}h` },
] as const
type RangeKey = typeof ranges[number]['key']

function bytes(value = 0, decimal = true): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = Math.max(0, value)
  let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(decimal && i >= 2 ? 1 : 0)} ${units[i]}`
}

function speed(value = 0): string { return `${bytes(value)}/s` }
function pct(used = 0, total = 0): number { return total > 0 ? Math.min(100, used * 100 / total) : 0 }

function Meter({ icon, label, value, percent }: { icon: React.ReactNode; label: string; value: string; percent: number }) {
  return <div className="metric">
    <div className="metric-head"><span>{icon}{label}</span><strong>{value}</strong></div>
    <div className="meter"><i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div>
  </div>
}

function averagePing(series: ProbePingSeries[]): ProbePingSeries {
  const count = series[0]?.buckets.length || 0
  const buckets: ProbeBucket[] = Array.from({ length: count }, (_, index) => {
    const values = series.map(item => item.buckets[index]).filter(Boolean)
    const ms = values.filter(v => v.ms >= 0).map(v => v.ms)
    const loss = values.filter(v => v.loss >= 0).map(v => v.loss)
    return {
      ms: ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : -1,
      loss: loss.length ? loss.reduce((a, b) => a + b, 0) / loss.length : -1,
    }
  })
  const current = series.filter(item => item.current_ms >= 0).map(item => item.current_ms)
  return {
    key: '__avg__', label: '平均',
    current_ms: current.length ? current.reduce((a, b) => a + b, 0) / current.length : -1,
    loss_pct: series.length ? series.reduce((sum, item) => sum + item.loss_pct, 0) / series.length : 0,
    buckets,
  }
}

function TrendDialog({ serverIndex, initial, targetKey, title, mode, close }: {
  serverIndex: number; initial: ProbePingSeries[]; targetKey: string; title: string; mode: 'latency' | 'loss'; close: () => void
}) {
  const [range, setRange] = useState<RangeKey>('1h')
  const [series, setSeries] = useState<ProbePingSeries[]>(initial)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void fetch(`/api/series?server=${serverIndex}&range=${range}&all=1`, { cache: 'no-store', signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<{ success: boolean; series?: ProbePingSeries; all_series?: ProbePingSeries[] }>
      })
      .then(payload => {
        if (payload.success) setSeries([...(payload.series ? [{ ...payload.series, key: '__avg__', label: '平均' }] : []), ...(payload.all_series || [])])
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [range, serverIndex])

  const rangeMeta = ranges.find(item => item.key === range) || ranges[0]
  const rows = useMemo(() => Array.from({ length: series[0]?.buckets.length || 0 }, (_, index) => {
    const row: Record<string, string | number | null> = { time: rangeMeta.bucketLabel(index, series[0]?.buckets.length || 0) }
    for (const item of series) {
      const bucket = item.buckets[index]
      const value = mode === 'loss' ? bucket?.loss : bucket?.ms
      row[item.key || item.label] = value !== undefined && value >= 0 ? value : null
    }
    return row
  }), [series, mode, rangeMeta])

  return createPortal(<div className="modal-backdrop" role="presentation" onMouseDown={close}>
    <section className="modal" onMouseDown={event => event.stopPropagation()}>
      <header><h2>{title} · {mode === 'loss' ? '丢包率趋势' : '延迟趋势'}</h2><button aria-label="关闭" onClick={close}>×</button></header>
      <div className="ranges">{ranges.map(item => <button type="button" className={range === item.key ? 'active' : ''} onClick={() => setRange(item.key)} key={item.key}>{item.label}</button>)}</div>
      <div className="chart">{loading && <div className="loading-overlay">加载中…</div>}<ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <XAxis dataKey="time" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.max(1, Math.floor(rows.length / 8))} />
          <YAxis width={52} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} unit={mode === 'loss' ? '%' : 'ms'} domain={mode === 'loss' ? [0, 100] : undefined} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(value, _name, item) => [`${Number(value).toFixed(mode === 'loss' ? 1 : 0)}${mode === 'loss' ? '%' : 'ms'}`, series.find(line => (line.key || line.label) === item.dataKey)?.label || String(item.dataKey)]} />
          {series.map((item, index) => { const key = item.key || item.label; const active = key === targetKey; return <Line key={key} type="monotone" dataKey={key} name={item.label} stroke={key === '__avg__' ? 'var(--foreground, #2f2350)' : colors[index % colors.length]} strokeWidth={active ? 2.5 : 1} strokeOpacity={active ? 1 : .45} dot={false} connectNulls={false} isAnimationActive={false} /> })}
        </LineChart>
      </ResponsiveContainer></div>
      {series.length > 1 && <div className="legend">{series.map((item, index) => { const key = item.key || item.label; return <span className={key === targetKey ? 'active' : ''} key={key}><i style={{ background: key === '__avg__' ? 'var(--foreground, #2f2350)' : colors[index % colors.length] }} />{item.label}</span> })}</div>}
    </section>
  </div>, document.body)
}

function PingPanel({ ping, serverIndex }: { ping: ProbePingSeries[]; serverIndex: number }) {
  const [mode, setMode] = useState<'latency' | 'loss' | null>(null)
  const [selected, setSelected] = useState('__avg__')
  const average = averagePing(ping)
  const lines = [{ ...average, key: '__avg__' }, ...ping]
  const current = selected === '__avg__' ? average : ping.find(item => (item.key || item.label) === selected) || average
  const blocks = (kind: 'latency' | 'loss') => current.buckets.map((bucket, index) => {
    const value = kind === 'loss' ? bucket.loss : bucket.ms
    const level = value < 0 ? 'none' : kind === 'loss' ? (value >= 20 ? 'bad' : value > 0 ? 'warn' : 'good') : (value >= 200 ? 'warn' : 'good')
    return <i key={index} className={level} />
  })
  return <>
    <div className="ping-grid">
      <div className="ping-head"><span><Clock size={14} /><select value={selected} onChange={event => setSelected(event.target.value)}><option value="__avg__">平均</option>{ping.map(item => <option key={item.key || item.label} value={item.key || item.label}>{item.label}</option>)}</select></span><strong>{current.current_ms < 0 ? '超时' : `${current.current_ms.toFixed(0)} ms`}</strong></div>
      <div className="ping-head"><span><Wifi size={14} />丢包率</span><strong className={current.loss_pct > 0 ? 'warning' : ''}>{current.loss_pct.toFixed(1)}%</strong></div>
      <button className="ping-blocks" type="button" aria-label="查看延迟趋势" onClick={() => setMode('latency')}>{blocks('latency')}</button>
      <button className="ping-blocks" type="button" aria-label="查看丢包率趋势" onClick={() => setMode('loss')}>{blocks('loss')}</button>
    </div>
    {mode && <TrendDialog serverIndex={serverIndex} initial={lines} targetKey={selected} title={current.label} mode={mode} close={() => setMode(null)} />}
  </>
}

function ServerCard({ server, index }: { server: ProbeServer; index: number }) {
  return <article className="server-card">
    <div className="server-title"><span className={server.online ? 'status online' : 'status'} /><h2><Twemoji>{server.name || `服务器 ${index + 1}`}</Twemoji></h2><span>{server.online ? '在线' : '离线'}</span></div>
    <div className="metrics">
      {server.cpu_pct !== undefined && <Meter icon={<Cpu size={14} />} label="CPU" value={`${server.cpu_pct.toFixed(1)}%`} percent={server.cpu_pct} />}
      {server.mem_total !== undefined && <Meter icon={<MemoryStick size={14} />} label="内存" value={`${pct(server.mem_used, server.mem_total).toFixed(1)}%`} percent={pct(server.mem_used, server.mem_total)} />}
      {server.disk_total !== undefined && <Meter icon={<HardDrive size={14} />} label="硬盘" value={`${pct(server.disk_used, server.disk_total).toFixed(1)}%`} percent={pct(server.disk_used, server.disk_total)} />}
      {server.traffic_used !== undefined && <Meter icon={<PieChart size={14} />} label="流量" value={server.traffic_limit ? `${bytes(server.traffic_used, false)} / ${bytes(server.traffic_limit, false)}` : bytes(server.traffic_used, false)} percent={pct(server.traffic_used, server.traffic_limit)} />}
    </div>
    {(server.upload_speed !== undefined || server.download_speed !== undefined) && <div className="speed"><span className="download"><ArrowDown size={16} />{speed(server.download_speed)}</span><span className="upload"><ArrowUp size={16} />{speed(server.upload_speed)}</span></div>}
    {!!server.ping?.length && <PingPanel ping={server.ping} serverIndex={index} />}
  </article>
}

function TableMetric({ percent }: { percent?: number }) {
  if (percent === undefined) return <span className="dash">—</span>
  return <div className="table-metric"><span>{percent.toFixed(1)}%</span><div className="meter"><i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} /></div></div>
}

function TablePing({ ping, serverIndex }: { ping?: ProbePingSeries[]; serverIndex: number }) {
  const [open, setOpen] = useState(false)
  if (!ping?.length) return <span className="dash">—</span>
  const average = averagePing(ping)
  const lines = [{ ...average, key: '__avg__' }, ...ping]
  return <>
    <button className="table-ping" type="button" onClick={() => setOpen(true)}>
      <span><strong>{average.current_ms < 0 ? '超时' : `${average.current_ms.toFixed(0)} ms`}</strong><b>{average.loss_pct.toFixed(1)}%</b></span>
      <em>{average.buckets.map((bucket, index) => <i key={index} className={bucket.ms < 0 && bucket.loss < 0 ? 'none' : bucket.ms < 0 ? 'bad' : bucket.ms >= 200 ? 'warn' : 'good'} />)}</em>
    </button>
    {open && <TrendDialog serverIndex={serverIndex} initial={lines} targetKey="__avg__" title="平均" mode="latency" close={() => setOpen(false)} />}
  </>
}

function ServerTable({ servers }: { servers: ProbeServer[] }) {
  return <section className="server-table-wrap"><div className="table-scroll"><table className="server-table">
    <thead><tr><th>服务器</th><th>状态</th><th>CPU</th><th>内存</th><th>硬盘</th><th>网速</th><th>流量</th><th>延迟</th></tr></thead>
    <tbody>{servers.map((server, index) => {
      const memory = server.mem_total ? pct(server.mem_used, server.mem_total) : undefined
      const disk = server.disk_total ? pct(server.disk_used, server.disk_total) : undefined
      return <tr key={`${server.name}-${index}`}>
        <td className="table-name"><Twemoji>{server.name || `服务器 ${index + 1}`}</Twemoji></td>
        <td><span className="table-status"><i className={server.online ? 'online' : ''} />{server.online ? '在线' : '离线'}</span></td>
        <td><TableMetric percent={server.cpu_pct} /></td>
        <td><TableMetric percent={memory} /></td>
        <td><TableMetric percent={disk} /></td>
        <td><span className="table-speed"><span><ArrowUp size={14} />{speed(server.upload_speed)}</span><span><ArrowDown size={14} />{speed(server.download_speed)}</span></span></td>
        <td><div className="table-traffic"><span>{server.traffic_limit ? `${bytes(server.traffic_used, false)} / ${bytes(server.traffic_limit, false)}` : bytes(server.traffic_used, false)}</span>{!!server.traffic_limit && <div className="meter"><i style={{ width: `${pct(server.traffic_used, server.traffic_limit)}%` }} /></div>}</div></td>
        <td><TablePing ping={server.ping} serverIndex={index} /></td>
      </tr>
    })}</tbody>
  </table></div></section>
}

export function App() {
  const { data, error } = useProbe()
  const [view, setView] = useState<'card' | 'list'>(() => (localStorage.getItem('probe-view') as 'card' | 'list') || 'card')
  const setMode = (next: 'card' | 'list') => { setView(next); localStorage.setItem('probe-view', next) }
  if (!data && !error) return <main className="center"><Activity className="pulse" />正在连接主控…</main>
  if (error && !data) return <main className="center error">主控暂时不可用<br /><small>{error}</small></main>
  if (!data?.enabled) return <main className="center">探针尚未启用</main>
  const title = data.title?.trim() || '服务器状态'
  const servers = data.servers || []
  return <div className="app-shell">
    <header className="topbar"><div>{data.logo && <img src={data.logo} alt="" />}<h1>{title}</h1></div><nav><button aria-label="卡片视图" title="卡片视图" className={view === 'card' ? 'active' : ''} onClick={() => setMode('card')}><LayoutGrid size={18} /></button><button aria-label="列表视图" title="列表视图" className={view === 'list' ? 'active' : ''} onClick={() => setMode('list')}><List size={18} /></button></nav></header>
    <main className={`servers ${view}`}>{servers.length ? view === 'card' ? servers.map((server, index) => <ServerCard key={`${server.name}-${index}`} server={server} index={index} />) : <ServerTable servers={servers} /> : <div className="empty">暂无服务器数据</div>}</main>
    <footer>
      Powered by{' '}
      <a href="https://github.com/mmwx-group" target="_blank" rel="noreferrer">
        MMWX Group
      </a>
    </footer>
  </div>
}

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, TrendingUp, CircleDollarSign, PieChart, Sparkles } from "lucide-react";

type PropertyRow = { id: string; title: string; module: string; value: string; status: string };
type FinancialRow = { id: string; type: string; amount: string; date: string };
type TaskRow = { id: string; date: string; done: boolean; type: string };
type ModuleRow = { name: string; value: number; count: number };

type Props = {
  properties: PropertyRow[];
  financials: FinancialRow[];
  tasks: TaskRow[];
  modules: ModuleRow[];
  onOpenModule: (name: string) => void;
};

const PALETTE = ["#20d9ef", "#2578ff", "#7a6dff", "#28c78a", "#ffbf68", "#fc7796", "#57b4d4", "#a7b8cd"];
const INFLOW = new Set(["Sale", "Advance", "Loan Disbursal", "Receipt"]);
const OUTFLOW = new Set(["Purchase", "Loan Repayment", "Interest", "Instalment", "Brokerage", "Expense", "Settlement"]);
const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const compact = (value: number) => value >= 10000000 ? "₹" + (value / 10000000).toFixed(1) + " Cr" : value >= 100000 ? "₹" + (value / 100000).toFixed(1) + " L" : INR.format(value);

export default function PortfolioAnalytics({ properties, financials, tasks, modules, onOpenModule }: Props) {
  const [focus, setFocus] = useState<"allocation" | "pipeline" | "cashflow">("allocation");
  const [chartType, setChartType] = useState<"donut" | "bar" | "line">("donut");
  const [metric, setMetric] = useState<"value" | "count">("value");
  const [period, setPeriod] = useState<3 | 6 | 12>(6);
  const [selected, setSelected] = useState("");
  const [showLabels, setShowLabels] = useState(true);

  const moduleRows = useMemo(() => modules.map((module, index) => {
    const items = properties.filter(property => property.module === module.name);
    return {
      ...module,
      count: items.length,
      value: items.reduce((sum, property) => sum + (Number(property.value) || 0), 0),
      color: PALETTE[index % PALETTE.length]
    };
  }).filter(row => row.count > 0 || row.value > 0), [modules, properties]);

  const stageRows = useMemo(() => {
    const map = new Map<string, number>();
    properties.forEach(property => {
      const status = String(property.status || "Unspecified").trim() || "Unspecified";
      map.set(status, (map.get(status) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value], index) => ({ name, value, color: PALETTE[index % PALETTE.length] })).sort((a, b) => b.value - a.value);
  }, [properties]);

  const cashflowRows = useMemo(() => {
    const now = new Date();
    return Array.from({ length: period }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - (period - 1 - index), 1);
      const key = month.getFullYear() + "-" + String(month.getMonth() + 1).padStart(2, "0");
      const rows = financials.filter(row => String(row.date || "").slice(0, 7) === key);
      const inflow = rows.filter(row => INFLOW.has(row.type)).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      const outflow = rows.filter(row => OUTFLOW.has(row.type)).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      return { key, name: month.toLocaleDateString("en-IN", { month: "short" }), fullName: month.toLocaleDateString("en-IN", { month: "long", year: "numeric" }), inflow, outflow, net: inflow - outflow, count: rows.length };
    });
  }, [financials, period]);

  const trackedValue = properties.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const totalInflow = financials.filter(item => INFLOW.has(item.type)).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalOutflow = financials.filter(item => OUTFLOW.has(item.type)).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const openTasks = tasks.filter(task => !task.done).length;
  const overdueTasks = tasks.filter(task => !task.done && task.date < new Date().toISOString().slice(0, 10)).length;
  const chartItems = focus === "allocation" ? moduleRows.map(row => ({ name: row.name, value: metric === "value" ? row.value : row.count, count: row.count, color: row.color })) : stageRows;
  const totalChart = chartItems.reduce((sum, item) => sum + item.value, 0);
  const visibleItems = chartItems.filter(item => item.value > 0);
  const title = focus === "allocation" ? metric === "value" ? "Asset allocation" : "Records by workspace" : focus === "pipeline" ? "Portfolio status mix" : "Cashflow movement";
  const subtitle = focus === "allocation" ? "Select any segment to open that module." : focus === "pipeline" ? "Real status values from your saved records." : "Recorded inflows and outflows by month; no forecast is fabricated.";
  const activeModuleName = selected && moduleRows.some(row => row.name === selected) ? selected : "";

  const setFocusView = (next: "allocation" | "pipeline" | "cashflow") => {
    setFocus(next);
    setSelected("");
    if (next === "cashflow") setChartType("bar");
  };

  const empty = focus === "allocation" ? properties.length === 0 : focus === "pipeline" ? properties.length === 0 : financials.length === 0;

  return <section className="ax-analytics-panel">
    <div className="ax-panel-topline"><span className="ax-kicker"><Sparkles size={13}/> AXIVESTRA INTELLIGENCE</span><span className="ax-live-status"><i/> LIVE FROM YOUR RECORDS</span></div>
    <div className="ax-analytics-heading">
      <div><h2>Portfolio intelligence</h2><p>Interactive views of your properties, capital flows and operational pipeline.</p></div>
      <div className="ax-chart-type" role="group" aria-label="Chart type">
        <button className={chartType === "donut" ? "active" : ""} onClick={() => setChartType("donut")} title="Ring chart" aria-label="Ring chart"><PieChart size={16}/></button>
        <button className={chartType === "bar" ? "active" : ""} onClick={() => setChartType("bar")} title="Bar chart" aria-label="Bar chart"><BarChart3 size={16}/></button>
        <button className={chartType === "line" ? "active" : ""} onClick={() => setChartType("line")} title="Line chart" aria-label="Line chart"><TrendingUp size={16}/></button>
      </div>
    </div>
    <div className="ax-analytics-tabs" role="tablist" aria-label="Analytics view">
      <button className={focus === "allocation" ? "active" : ""} onClick={() => setFocusView("allocation")} role="tab" aria-selected={focus === "allocation"}>Asset allocation</button>
      <button className={focus === "pipeline" ? "active" : ""} onClick={() => setFocusView("pipeline")} role="tab" aria-selected={focus === "pipeline"}>Pipeline health</button>
      <button className={focus === "cashflow" ? "active" : ""} onClick={() => setFocusView("cashflow")} role="tab" aria-selected={focus === "cashflow"}>Cashflow</button>
      {focus === "cashflow" && <select value={period} onChange={event => setPeriod(Number(event.target.value) as 3 | 6 | 12)} aria-label="Cashflow period"><option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option></select>}
      {focus === "allocation" && <div className="ax-metric-switch"><button className={metric === "value" ? "active" : ""} onClick={() => { setMetric("value"); setSelected(""); }}>Value</button><button className={metric === "count" ? "active" : ""} onClick={() => { setMetric("count"); setSelected(""); }}>Count</button></div>}
    </div>
    <div className="ax-analytics-grid">
      <div className="ax-chart-stage">
        {empty ? <div className="ax-chart-empty"><div className="ax-empty-orbit"><PieChart size={28}/></div><strong>Waiting for your data</strong><p>{focus === "cashflow" ? "Add financial transactions to compare monthly inflows and outflows." : "Add your first property/deal record to activate interactive charts."}</p><small>Empty states are intentional—no sample data is counted as real.</small></div>
        : focus === "cashflow" ? <CashflowChart rows={cashflowRows} type={chartType} showLabels={showLabels} onSelect={setSelected} selected={selected}/>
        : chartType === "donut" ? <DonutChart items={visibleItems} total={totalChart} selected={selected} onSelect={setSelected} centerLabel={focus === "allocation" ? "TRACKED VALUE" : "RECORDS"} centerValue={focus === "allocation" && metric === "value" ? compact(totalChart) : String(totalChart)} showLabels={showLabels}/>
        : chartType === "bar" ? <HorizontalBars items={visibleItems} selected={selected} onSelect={setSelected} showLabels={showLabels}/>
        : <TrendChart items={visibleItems} selected={selected} onSelect={setSelected} showLabels={showLabels}/>}
      </div>
      <aside className="ax-chart-inspector">
        <div className="ax-inspector-head"><span>LIVE SUMMARY</span><CircleDollarSign size={18}/></div>
        {focus === "cashflow" ? <>
          <strong className="ax-inspector-total">{compact(totalInflow - totalOutflow)}</strong><small>Net recorded cashflow · all time</small>
          <div className="ax-inspector-pair"><span><i className="inflow-dot"/> Total inflows</span><strong>{compact(totalInflow)}</strong></div>
          <div className="ax-inspector-pair"><span><i className="outflow-dot"/> Total outflows</span><strong>{compact(totalOutflow)}</strong></div>
          <div className="ax-inspector-pair"><span>Transactions</span><strong>{financials.length}</strong></div>
        </> : focus === "pipeline" ? <>
          <strong className="ax-inspector-total">{properties.length}</strong><small>Saved property / deal records</small>
          <div className="ax-inspector-pair"><span>Open records</span><strong>{properties.filter(row => !["Completed", "Closed"].includes(row.status)).length}</strong></div>
          <div className="ax-inspector-pair"><span>Closed records</span><strong>{properties.filter(row => ["Completed", "Closed"].includes(row.status)).length}</strong></div>
          <div className="ax-inspector-pair"><span>Tasks open</span><strong>{openTasks}</strong></div>
        </> : <>
          <strong className="ax-inspector-total">{compact(trackedValue)}</strong><small>Total entered asset value</small>
          <div className="ax-inspector-pair"><span>Active modules</span><strong>{moduleRows.filter(row => row.count > 0).length}</strong></div>
          <div className="ax-inspector-pair"><span>Missing value</span><strong>{properties.filter(row => !(Number(row.value) > 0)).length}</strong></div>
          <div className="ax-inspector-pair"><span>Modules available</span><strong>{modules.length}</strong></div>
        </>}
        <div className="ax-inspector-divider"/>
        <label className="ax-toggle-row"><input type="checkbox" checked={showLabels} onChange={event => setShowLabels(event.target.checked)}/> Show chart labels</label>
        <button className="ax-inspector-action" onClick={() => {
          if (focus === "cashflow") return;
          if (focus === "pipeline") { onOpenModule("All Properties"); return; }
          const name = selected || activeModuleName || visibleItems[0]?.name;
          if (name) onOpenModule(name);
        }} disabled={focus === "cashflow" || (focus === "allocation" && !visibleItems.length)}>Explore selected data <ArrowUpRight size={15}/></button>
      </aside>
    </div>
    {focus === "allocation" && <div className="ax-chart-legend">
      {visibleItems.slice(0, 8).map((item, index) => <button key={item.name} className={selected === item.name ? "selected" : ""} onClick={() => { setSelected(selected === item.name ? "" : item.name); if (modules.some(module => module.name === item.name)) onOpenModule(item.name); }}>
        <i style={{ background: item.color || PALETTE[index % PALETTE.length] }}/><span>{item.name}</span><strong>{metric === "value" ? compact(item.value) : item.value}</strong>
      </button>)}
      {visibleItems.length === 0 && <span className="ax-muted">No module allocation until you add records.</span>}
    </div>}
  </section>;
}

function DonutChart({ items, total, selected, onSelect, centerLabel, centerValue, showLabels }: {
  items: { name: string; value: number; color: string; count?: number }[];
  total: number; selected: string; onSelect: (value: string) => void; centerLabel: string; centerValue: string; showLabels: boolean;
}) {
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <div className="ax-donut-wrap"><svg viewBox="0 0 220 220" role="img" aria-label="Interactive donut chart">
    <circle cx="110" cy="110" r={radius} fill="none" stroke="#12253b" strokeWidth="23"/>
    {items.map(item => {
      const length = total > 0 ? circumference * item.value / total : 0;
      const currentOffset = offset;
      offset += length;
      return <circle key={item.name} cx="110" cy="110" r={radius} fill="none" stroke={item.color} strokeWidth={selected && selected !== item.name ? 15 : 23} strokeDasharray={length + " " + Math.max(0, circumference - length)} strokeDashoffset={-currentOffset} transform="rotate(-90 110 110)" strokeLinecap="butt" tabIndex={0} role="button" aria-label={item.name + ": " + item.value} onClick={() => onSelect(selected === item.name ? "" : item.name)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") onSelect(selected === item.name ? "" : item.name); }} className="ax-donut-segment"><title>{item.name}: {item.value.toLocaleString("en-IN")}</title></circle>;
    })}
    <circle cx="110" cy="110" r="52" fill="#0e2034"/>
    <text x="110" y="103" textAnchor="middle" fill="#8aa4bd" fontSize="9" letterSpacing="1.4">{centerLabel}</text>
    <text x="110" y="125" textAnchor="middle" fill="#f2f8ff" fontSize="17" fontWeight="700">{centerValue.length > 12 ? centerValue.slice(0, 11) + "…" : centerValue}</text>
  </svg>
  {showLabels && <div className="ax-donut-callout"><span>{items.length} categories</span><span>{items.reduce((sum, item) => sum + (item.count || 0), 0)} records represented</span></div>}</div>;
}

function HorizontalBars({ items, selected, onSelect, showLabels }: {
  items: { name: string; value: number; color: string }[]; selected: string; onSelect: (value: string) => void; showLabels: boolean;
}) {
  const max = Math.max(1, ...items.map(item => item.value));
  return <div className="ax-horizontal-bars">{items.slice(0, 10).map(item => <button key={item.name} className={"ax-bar-row " + (selected === item.name ? "selected" : "")} onClick={() => onSelect(selected === item.name ? "" : item.name)}>
    <span className="ax-bar-label">{item.name}</span><span className="ax-bar-track"><i style={{ width: (item.value / max * 100) + "%", background: item.color }}/></span>{showLabels && <strong>{item.value.toLocaleString("en-IN")}</strong>}
  </button>)}</div>;
}

function TrendChart({ items, selected, onSelect, showLabels }: {
  items: { name: string; value: number; color: string }[]; selected: string; onSelect: (value: string) => void; showLabels: boolean;
}) {
  const max = Math.max(1, ...items.map(item => item.value));
  const width = 640, height = 260, left = 38, right = 18, top = 28, bottom = 40;
  const points = items.map((item, index) => ({ ...item, x: left + (items.length < 2 ? (width - left - right) / 2 : index * (width - left - right) / (items.length - 1)), y: top + (1 - item.value / max) * (height - top - bottom) }));
  return <div className="ax-line-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Interactive trend chart">
    {[0, 1, 2, 3, 4].map(n => <g key={n}><line x1={left} x2={width-right} y1={top + n * (height-top-bottom) / 4} y2={top + n * (height-top-bottom) / 4} stroke="#1c3550" strokeDasharray="4 6"/><text x={left-8} y={top+n*(height-top-bottom)/4+4} fill="#7893ac" textAnchor="end" fontSize="10">{Math.round(max * (1-n/4))}</text></g>)}
    <polyline points={points.map(point => point.x + "," + point.y).join(" ")} fill="none" stroke="#2ee7ff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
    {points.map(point => <g key={point.name} onClick={() => onSelect(selected === point.name ? "" : point.name)} role="button" tabIndex={0} className="ax-chart-point"><circle cx={point.x} cy={point.y} r={selected === point.name ? 7 : 5} fill="#2ee7ff" stroke="#071728" strokeWidth="3"/>{showLabels && <text x={point.x} y={point.y-13} textAnchor="middle" fill="#e4f5ff" fontSize="11">{point.value}</text>}<text x={point.x} y={height-15} textAnchor="middle" fill="#8da6be" fontSize="11">{point.name.length > 10 ? point.name.slice(0,9)+"…" : point.name}</text></g>)}
  </svg></div>;
}

function CashflowChart({ rows, type, showLabels, onSelect, selected }: {
  rows: { key: string; name: string; fullName: string; inflow: number; outflow: number; net: number; count: number }[];
  type: "donut" | "bar" | "line"; showLabels: boolean; onSelect: (value: string) => void; selected: string;
}) {
  const max = Math.max(1, ...rows.flatMap(row => [row.inflow, row.outflow]));
  const width = 640, height = 280, left = 40, right = 16, top = 25, bottom = 42;
  const xAt = (index: number) => left + (index + 0.5) * (width-left-right) / rows.length;
  const yAt = (value: number) => top + (1 - value / max) * (height-top-bottom);
  if (type === "donut") {
    const inflow = rows.reduce((sum, row) => sum + row.inflow, 0);
    const outflow = rows.reduce((sum, row) => sum + row.outflow, 0);
    return <DonutChart items={[{name:"Inflow",value:inflow,color:"#20d9ef"},{name:"Outflow",value:outflow,color:"#fc7796"}].filter(item => item.value > 0)} total={inflow+outflow} selected={selected} onSelect={onSelect} centerLabel="NET CASHFLOW" centerValue={compact(inflow-outflow)} showLabels={showLabels}/>;
  }
  if (type === "line") {
    const points = (key: "inflow" | "outflow") => rows.map((row, index) => ({ x: xAt(index), y: yAt(row[key]), name: row.name, value: row[key], key: row.key }));
    const inflowPoints = points("inflow"), outflowPoints = points("outflow");
    return <div className="ax-line-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly cashflow line chart">
      {[0,1,2,3,4].map(n=><g key={n}><line x1={left} x2={width-right} y1={top+n*(height-top-bottom)/4} y2={top+n*(height-top-bottom)/4} stroke="#1c3550" strokeDasharray="4 6"/><text x={left-8} y={top+n*(height-top-bottom)/4+4} textAnchor="end" fill="#7893ac" fontSize="10">{compact(max*(1-n/4))}</text></g>)}
      <polyline points={inflowPoints.map(point=>point.x+","+point.y).join(" ")} fill="none" stroke="#20d9ef" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points={outflowPoints.map(point=>point.x+","+point.y).join(" ")} fill="none" stroke="#fc7796" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      {inflowPoints.map(point=><g key={"in-"+point.key} onClick={()=>onSelect(selected===point.key?"":point.key)} className="ax-chart-point"><circle cx={point.x} cy={point.y} r={5} fill="#20d9ef"/>{showLabels&&<text x={point.x} y={point.y-12} textAnchor="middle" fill="#dffcff" fontSize="9">{compact(point.value)}</text>}</g>)}
      {outflowPoints.map(point=><g key={"out-"+point.key} onClick={()=>onSelect(selected===point.key?"":point.key)} className="ax-chart-point"><circle cx={point.x} cy={point.y} r={5} fill="#fc7796"/>{showLabels&&<text x={point.x} y={point.y+18} textAnchor="middle" fill="#ffdce3" fontSize="9">{compact(point.value)}</text>}</g>)}
      {rows.map((row,index)=><text key={row.key} x={xAt(index)} y={height-15} textAnchor="middle" fill="#8da6be" fontSize="11">{row.name}</text>)}
    </svg></div>;
  }
  const slot=(width-left-right)/rows.length, barWidth=Math.min(22,slot*.27);
  return <div className="ax-cashflow-bars"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly cashflow bar chart">
    {[0,1,2,3,4].map(n=><g key={n}><line x1={left} x2={width-right} y1={top+n*(height-top-bottom)/4} y2={top+n*(height-top-bottom)/4} stroke="#1c3550" strokeDasharray="4 6"/><text x={left-8} y={top+n*(height-top-bottom)/4+4} textAnchor="end" fill="#7893ac" fontSize="10">{compact(max*(1-n/4))}</text></g>)}
    {rows.map((row,index)=><g key={row.key} onClick={()=>onSelect(selected===row.key?"":row.key)} className="ax-chart-point">
      <rect x={xAt(index)-barWidth-2} y={yAt(row.inflow)} width={barWidth} height={height-bottom-yAt(row.inflow)} rx="3" fill="#20d9ef" opacity={selected && selected !== row.key ? 0.7 : 1}/>
      <rect x={xAt(index)+2} y={yAt(row.outflow)} width={barWidth} height={height-bottom-yAt(row.outflow)} rx="3" fill="#fc7796" opacity={selected&&selected!==row.key?.7:1}/>
      {showLabels&&<text x={xAt(index)} y={height-15} textAnchor="middle" fill="#8da6be" fontSize="11">{row.name}</text>}
      <title>{row.fullName}: inflow {compact(row.inflow)}, outflow {compact(row.outflow)}</title>
    </g>)}
  </svg><div className="ax-chart-legend-inline"><span><i className="inflow-dot"/> Inflow</span><span><i className="outflow-dot"/> Outflow</span></div></div>;
}

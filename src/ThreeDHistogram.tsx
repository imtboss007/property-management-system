import { useState, type KeyboardEvent } from "react";

export type ThreeDHistogramItem = {
  id?: string;
  name: string;
  value: number;
  color?: string;
  secondaryValue?: number;
  secondaryColor?: string;
  fullName?: string;
};

type Props = {
  items: ThreeDHistogramItem[];
  selected?: string;
  onSelect: (value: string) => void;
  showLabels?: boolean;
  formatValue?: (value: number) => string;
  primaryLabel?: string;
  secondaryLabel?: string;
};

const DEFAULT_COLORS = ["#35d5e8", "#4c8cff", "#9a85ff", "#39d6a2", "#f0bd69", "#ff829d", "#66b6db", "#9fb7d5"];
const fallbackFormat = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value);

function keyboardActivate(event: KeyboardEvent<SVGGElement>, activate: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate();
  }
}

/**
 * Lightweight isometric histogram built with SVG polygons.
 * It uses the existing saved-record analytics values and avoids a WebGL dependency,
 * keeping the same chart usable in Electron, browsers and Android WebView.
 */
export default function ThreeDHistogram({
  items,
  selected = "",
  onSelect,
  showLabels = true,
  formatValue = fallbackFormat,
  primaryLabel = "Value / count",
  secondaryLabel = "Secondary series"
}: Props) {
  const [rotation,setRotation]=useState(0);
  const [tilt,setTilt]=useState(0);
  const [zoom,setZoom]=useState(1);
  const visible = items.slice(0, 9);
  const max = Math.max(1, ...visible.flatMap(item => [Number(item.value) || 0, Number(item.secondaryValue) || 0]));
  const width = Math.max(650, 148 + visible.length * 72);
  const height = 306;
  const left = 52;
  const right = 28;
  const top = 26;
  const floor = 242;
  const plotWidth = width - left - right;
  const slot = plotWidth / Math.max(1, visible.length);
  const barWidth = visible.some(item => Number(item.secondaryValue) > 0) ? Math.min(19, slot * 0.27) : Math.min(28, slot * 0.42);
  const depthX = 10;
  const depthY = -7;
  const selectedKey = selected;
  const yFor = (value: number) => floor - Math.max(0, value) / max * 154;
  const colors = visible.map((item, index) => item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);

  return <div className="ax-3d-histogram-wrap">
<div className="ax-3d-histogram-controls" aria-label="Chart perspective controls"><button type="button" onClick={()=>setRotation(value=>value-10)} title="Rotate chart left">↶</button><button type="button" onClick={()=>setRotation(value=>value+10)} title="Rotate chart right">↷</button><button type="button" onClick={()=>setTilt(value=>Math.max(-12,value-3))} title="Tilt chart upward">Tilt −</button><button type="button" onClick={()=>setTilt(value=>Math.min(22,value+3))} title="Tilt chart downward">Tilt +</button><button type="button" onClick={()=>setZoom(value=>Math.max(.7,Number((value-.1).toFixed(1))))} title="Zoom out">−</button><span>{Math.round(zoom*100)}%</span><button type="button" onClick={()=>setZoom(value=>Math.min(1.4,Number((value+.1).toFixed(1))))} title="Zoom in">+</button><button type="button" onClick={()=>{setRotation(0);setTilt(0);setZoom(1);}}>Reset view</button></div>
    <div className="ax-3d-histogram-meta">
      <span><i className="ax-3d-key-front"/> {primaryLabel}</span>
      {visible.some(item => Number(item.secondaryValue) > 0) && <span><i className="ax-3d-key-side"/> {secondaryLabel}</span>}
      <span className="ax-3d-histogram-hint">Select a column to inspect its record group</span>
    </div>
    <div className="ax-3d-histogram-scroll">
      <svg className="ax-3d-histogram" style={{transform:`perspective(1100px) rotateZ(${rotation}deg) rotateX(${tilt}deg) scale(${zoom})`,transformOrigin:"center center"}} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Interactive three-dimensional portfolio histogram">
        <defs>
          <linearGradient id="ax-3d-floor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#12344a"/>
            <stop offset="1" stopColor="#091b2b"/>
          </linearGradient>
          <linearGradient id="ax-3d-grid-glow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2bd4e5" stopOpacity=".30"/>
            <stop offset="1" stopColor="#487fff" stopOpacity=".05"/>
          </linearGradient>
        </defs>
        <polygon points={`${left},${floor} ${width-right},${floor} ${width-right+12},${floor+15} ${left+12},${floor+15}`} fill="url(#ax-3d-floor)" opacity=".78"/>
        {[0, 1, 2, 3, 4].map(index => {
          const y = top + index * (floor - top) / 4;
          const value = max * (1 - index / 4);
          return <g key={index}>
            <line x1={left} x2={width-right} y1={y} y2={y} stroke="#34546b" strokeDasharray="3 6" strokeOpacity=".72"/>
            <text x={left-11} y={y+4} textAnchor="end" fill="#789bb2" fontSize="10">{formatValue(value)}</text>
          </g>;
        })}
        <line x1={left} x2={width-right} y1={floor} y2={floor} stroke="url(#ax-3d-grid-glow)" strokeWidth="1.3"/>
        {visible.map((item, index) => {
          const key = item.id || item.name;
          const isSelected = selectedKey === key || selectedKey === item.name;
          const groupCenter = left + slot * (index + .5);
          const hasSecondary = Number(item.secondaryValue) > 0;
          const bars = [
            { value: Math.max(0, Number(item.value) || 0), color: colors[index], suffix: "primary" },
            ...(hasSecondary ? [{ value: Math.max(0, Number(item.secondaryValue) || 0), color: item.secondaryColor || "#ff829d", suffix: "secondary" }] : [])
          ].filter(bar => bar.value > 0);
          const groupWidth = bars.length > 1 ? barWidth * 2 + 7 : barWidth;
          const startX = groupCenter - groupWidth / 2;
          return <g key={key}
            className={`ax-3d-histogram-group ${isSelected ? "is-selected" : ""}`}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`${item.fullName || item.name}: ${formatValue(Number(item.value) || 0)}${hasSecondary ? " and " + formatValue(Number(item.secondaryValue) || 0) : ""}`}
            onClick={() => onSelect(isSelected ? "" : key)}
            onKeyDown={event => keyboardActivate(event, () => onSelect(isSelected ? "" : key))}
            style={{ animationDelay: `${index * 55}ms` }}
          >
            <ellipse cx={groupCenter+4} cy={floor+5} rx={groupWidth*.85} ry="5" fill="#020d16" opacity=".55"/>
            {bars.map((bar, barIndex) => {
              const x = startX + barIndex * (barWidth + 7);
              const y = yFor(bar.value);
              const front = `${x},${y} ${x+barWidth},${y} ${x+barWidth},${floor} ${x},${floor}`;
              const side = `${x+barWidth},${y} ${x+barWidth+depthX},${y+depthY} ${x+barWidth+depthX},${floor+depthY} ${x+barWidth},${floor}`;
              const topFace = `${x},${y} ${x+depthX},${y+depthY} ${x+barWidth+depthX},${y+depthY} ${x+barWidth},${y}`;
              return <g key={bar.suffix} className="ax-3d-histogram-bar" style={{ opacity: selectedKey && !isSelected ? .36 : 1 }}>
                <polygon points={side} fill={bar.color} opacity=".43" stroke={bar.color} strokeOpacity=".34"/>
                <polygon points={front} fill={bar.color} opacity=".94" stroke="#d8fbff" strokeOpacity=".12"/>
                <polygon points={topFace} fill={bar.color} opacity="1" stroke="#d8fbff" strokeOpacity=".42"/>
                {showLabels && <text x={x+barWidth/2+depthX/2} y={Math.max(13, y-10)} textAnchor="middle" fill="#e6f7ff" fontSize="9" fontWeight="700">{formatValue(bar.value)}</text>}
                <title>{item.fullName || item.name} · {bar.suffix}: {formatValue(bar.value)}</title>
              </g>;
            })}
            <text x={groupCenter} y={floor+35} textAnchor="middle" fill={isSelected ? "#8ef1f4" : "#87a8be"} fontSize="10" fontWeight={isSelected ? "800" : "600"}>
              {item.name.length > 12 ? item.name.slice(0, 11) + "…" : item.name}
            </text>
            <title>{item.fullName || item.name}: {formatValue(Number(item.value) || 0)}</title>
          </g>;
        })}
      </svg>
    </div>
    <div className="ax-3d-histogram-foot">
      <span>Perspective view · values from saved AXIVESTRA records</span>
      <span>{visible.length} groups shown{items.length > visible.length ? ` · ${items.length-visible.length} more in the legend` : ""}</span>
    </div>
  </div>;
}

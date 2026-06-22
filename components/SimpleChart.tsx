/**
 * SVG-based chart components built on react-native-svg.
 * Works on both Expo web and native without extra packages.
 */
import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, {
  Rect, G, Line, Path, Circle, Defs,
  LinearGradient, Stop, Text as SvgText,
  Polyline,
} from "react-native-svg";

/* ─────────────────────────────── BAR CHART ─────────────────────────────── */

interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  barColor?: string;
  labelColor?: string;
  gridColor?: string;
  formatValue?: (v: number) => string;
}

export function BarChart({
  data,
  height = 200,
  barColor = "#5865F2",
  labelColor = "#72767d",
  gridColor = "#ffffff14",
  formatValue,
}: BarChartProps) {
  const [width, setWidth] = useState(320);

  if (!data || data.length === 0) return null;

  const pad = { top: 28, right: 8, bottom: 36, left: 6 };
  const chartW = Math.max(width - pad.left - pad.right, 10);
  const chartH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map(d => d.value), 1);

  const slotW = chartW / data.length;
  const gap = Math.max(slotW * 0.28, 4);
  const barW = slotW - gap;

  const gridVals = [0.25, 0.5, 0.75, 1.0];

  return (
    <View
      onLayout={e => setWidth(Math.max(e.nativeEvent.layout.width, 50))}
      style={{ height }}
    >
      <Svg width={width} height={height}>
        {/* horizontal grid lines */}
        {gridVals.map(pct => {
          const gy = pad.top + chartH * (1 - pct);
          return (
            <Line
              key={pct}
              x1={pad.left}
              y1={gy}
              x2={width - pad.right}
              y2={gy}
              stroke={gridColor}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          );
        })}

        {/* bars */}
        {data.map((d, i) => {
          const bH = Math.max((d.value / max) * chartH, d.value > 0 ? 4 : 0);
          const bX = pad.left + i * slotW + gap / 2;
          const bY = pad.top + chartH - bH;
          const color = d.color ?? barColor;

          return (
            <G key={i}>
              {/* bar body */}
              <Rect
                x={bX}
                y={bY}
                width={barW}
                height={bH}
                fill={color}
                rx={3}
                ry={3}
                opacity={0.88}
              />
              {/* top highlight strip */}
              {bH > 8 && (
                <Rect
                  x={bX}
                  y={bY}
                  width={barW}
                  height={4}
                  fill={color}
                  rx={3}
                  ry={3}
                  opacity={0.5}
                />
              )}
              {/* value label above bar */}
              {d.value > 0 && (
                <SvgText
                  x={bX + barW / 2}
                  y={bY - 5}
                  fill={color}
                  fontSize={9}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {formatValue ? formatValue(d.value) : String(Math.round(d.value))}
                </SvgText>
              )}
              {/* x-axis label */}
              <SvgText
                x={bX + barW / 2}
                y={height - 6}
                fill={labelColor}
                fontSize={10}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            </G>
          );
        })}

        {/* baseline */}
        <Line
          x1={pad.left}
          y1={pad.top + chartH}
          x2={width - pad.right}
          y2={pad.top + chartH}
          stroke={gridColor}
          strokeWidth={1.5}
        />
      </Svg>
    </View>
  );
}

/* ─────────────────────────────── LINE CHART ─────────────────────────────── */

interface LineChartProps {
  data: BarDatum[];
  height?: number;
  lineColor?: string;
  labelColor?: string;
  gridColor?: string;
  formatValue?: (v: number) => string;
  showDots?: boolean;
  gradientId?: string;
}

export function LineChart({
  data,
  height = 200,
  lineColor = "#5865F2",
  labelColor = "#72767d",
  gridColor = "#ffffff14",
  formatValue,
  showDots = true,
  gradientId = "lineGrad",
}: LineChartProps) {
  const [width, setWidth] = useState(320);

  if (!data || data.length === 0) return null;

  const pad = { top: 24, right: 12, bottom: 36, left: 12 };
  const chartW = Math.max(width - pad.left - pad.right, 10);
  const chartH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map(d => d.value), 1);
  const n = data.length;

  function px(i: number) {
    return pad.left + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
  }
  function py(v: number) {
    return pad.top + chartH - Math.max((v / max) * chartH, 0);
  }

  const pts = data.map((d, i) => ({ x: px(i), y: py(d.value), v: d.value, lbl: d.label }));
  const polyPoints = pts.map(p => `${p.x},${p.y}`).join(" ");
  const areaPath =
    `M ${pts[0].x} ${pad.top + chartH} ` +
    pts.map(p => `L ${p.x} ${p.y}`).join(" ") +
    ` L ${pts[pts.length - 1].x} ${pad.top + chartH} Z`;

  const gridVals = [0.25, 0.5, 0.75, 1.0];

  return (
    <View
      onLayout={e => setWidth(Math.max(e.nativeEvent.layout.width, 50))}
      style={{ height }}
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
            <Stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* grid lines */}
        {gridVals.map(pct => {
          const gy = pad.top + chartH * (1 - pct);
          return (
            <Line
              key={pct}
              x1={pad.left}
              y1={gy}
              x2={width - pad.right}
              y2={gy}
              stroke={gridColor}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          );
        })}

        {/* area fill */}
        <Path d={areaPath} fill={`url(#${gradientId})`} />

        {/* line */}
        <Polyline
          points={polyPoints}
          fill="none"
          stroke={lineColor}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* dots + labels */}
        {pts.map((p, i) => (
          <G key={i}>
            {showDots && p.v > 0 && (
              <>
                <Circle cx={p.x} cy={p.y} r={5} fill={lineColor} opacity={0.25} />
                <Circle cx={p.x} cy={p.y} r={3} fill={lineColor} />
              </>
            )}
            <SvgText
              x={p.x}
              y={height - 6}
              fill={labelColor}
              fontSize={10}
              textAnchor="middle"
            >
              {p.lbl}
            </SvgText>
          </G>
        ))}
      </Svg>
    </View>
  );
}

/* ─────────────────────────────── DONUT CHART ────────────────────────────── */

interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  labelColor?: string;
  mutedColor?: string;
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const s = { x: cx + r * Math.cos(startAngle), y: cy + r * Math.sin(startAngle) };
  const e = { x: cx + r * Math.cos(endAngle), y: cy + r * Math.sin(endAngle) };
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function DonutChart({
  data,
  size = 140,
  thickness = 28,
  centerLabel,
  labelColor = "#ffffff",
  mutedColor = "#72767d",
}: DonutChartProps) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = (size - 8) / 2;
  const innerR = outerR - thickness;
  const gap = 0.025; // radians gap between segments

  let angle = -Math.PI / 2;
  const segments = data.map(d => {
    const sweep = (d.value / total) * (2 * Math.PI) - gap;
    const sa = angle + gap / 2;
    const ea = sa + sweep;
    angle += (d.value / total) * (2 * Math.PI);

    const outerArcStart = { x: cx + outerR * Math.cos(sa), y: cy + outerR * Math.sin(sa) };
    const outerArcEnd = { x: cx + outerR * Math.cos(ea), y: cy + outerR * Math.sin(ea) };
    const innerArcStart = { x: cx + innerR * Math.cos(ea), y: cy + innerR * Math.sin(ea) };
    const innerArcEnd = { x: cx + innerR * Math.cos(sa), y: cy + innerR * Math.sin(sa) };
    const large = sweep > Math.PI ? 1 : 0;

    const path = [
      `M ${outerArcStart.x} ${outerArcStart.y}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${outerArcEnd.x} ${outerArcEnd.y}`,
      `L ${innerArcStart.x} ${innerArcStart.y}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${innerArcEnd.x} ${innerArcEnd.y}`,
      "Z",
    ].join(" ");

    return { ...d, path, pct: ((d.value / total) * 100).toFixed(1) };
  });

  return (
    <View style={ds.container}>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size}>
          {segments.map((seg, i) => (
            <Path key={i} d={seg.path} fill={seg.color} />
          ))}
          {centerLabel ? (
            <SvgText
              x={cx}
              y={cy + 5}
              fill={labelColor}
              fontSize={13}
              fontWeight="700"
              textAnchor="middle"
            >
              {centerLabel}
            </SvgText>
          ) : null}
        </Svg>
      </View>
      <View style={ds.legend}>
        {segments.map((seg, i) => (
          <View key={i} style={ds.legendRow}>
            <View style={[ds.legendDot, { backgroundColor: seg.color }]} />
            <Text style={[ds.legendLabel, { color: labelColor }]} numberOfLines={1}>
              {seg.label}
            </Text>
            <Text style={[ds.legendPct, { color: mutedColor }]}>
              {seg.pct}
              {"%"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ──────────────────────────── HORIZONTAL BAR ────────────────────────────── */

interface HBarDatum {
  label: string;
  value: number;
  color?: string;
  meta?: string;
}

interface HBarChartProps {
  data: HBarDatum[];
  barColor?: string;
  bgColor?: string;
  labelColor?: string;
  metaColor?: string;
  valueColor?: string;
  formatValue?: (v: number) => string;
}

export function HorizontalBarChart({
  data,
  barColor = "#5865F2",
  bgColor = "#ffffff0e",
  labelColor = "#ffffff",
  metaColor = "#72767d",
  valueColor = "#5865F2",
  formatValue,
}: HBarChartProps) {
  const [width, setWidth] = useState(320);
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <View
      onLayout={e => setWidth(Math.max(e.nativeEvent.layout.width, 50))}
      style={{ gap: 10 }}
    >
      {data.map((d, i) => {
        const pct = d.value / max;
        const color = d.color ?? barColor;
        return (
          <View key={i} style={ds.hBarRow}>
            <View style={ds.hBarMeta}>
              <Text style={[ds.hBarLabel, { color: labelColor }]} numberOfLines={1}>
                {d.label}
              </Text>
              {d.meta ? (
                <Text style={[ds.hBarSub, { color: metaColor }]}>{d.meta}</Text>
              ) : null}
            </View>
            <View style={[ds.hBarTrack, { backgroundColor: bgColor, flex: 1 }]}>
              <View
                style={{
                  height: "100%",
                  width: `${Math.max(pct * 100, d.value > 0 ? 2 : 0)}%`,
                  backgroundColor: color,
                  borderRadius: 4,
                  opacity: 0.85,
                }}
              />
            </View>
            <Text style={[ds.hBarVal, { color: valueColor }]}>
              {formatValue ? formatValue(d.value) : String(Math.round(d.value))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* ─────────────────────────────── PieChart alias ─────────────────────────── */
export { DonutChart as PieChart };

/* ─────────────────────────────── styles ────────────────────────────────── */
const ds = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 16 },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  legendLabel: { flex: 1, fontSize: 12, fontWeight: "500" },
  legendPct: { fontSize: 12, fontWeight: "700" },
  hBarRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  hBarMeta: { width: 100 },
  hBarLabel: { fontSize: 12, fontWeight: "600" },
  hBarSub: { fontSize: 10, marginTop: 1 },
  hBarTrack: { height: 10, borderRadius: 5, overflow: "hidden" },
  hBarVal: { width: 70, textAlign: "right", fontSize: 12, fontWeight: "700" },
});

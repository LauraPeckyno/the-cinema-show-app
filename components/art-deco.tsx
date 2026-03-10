import React from "react";
import { View, StyleSheet, Text } from "react-native";
import Svg, { Path, Line, Circle, Rect, G, Defs, LinearGradient, Stop } from "react-native-svg";

const GOLD = "#C8A951";
const GOLD_DARK = "#8B7635";
const CRIMSON = "#8B0000";

/**
 * Art Deco horizontal divider with geometric fan pattern
 */
export function ArtDecoDivider({ width = 300, color = GOLD }: { width?: number; color?: string }) {
  const h = 24;
  const cx = width / 2;
  return (
    <View style={styles.dividerContainer}>
      <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
        {/* Center diamond */}
        <Path
          d={`M ${cx} 2 L ${cx + 10} ${h / 2} L ${cx} ${h - 2} L ${cx - 10} ${h / 2} Z`}
          fill={color}
          opacity={0.9}
        />
        {/* Left lines */}
        <Line x1={cx - 16} y1={h / 2} x2={20} y2={h / 2} stroke={color} strokeWidth={1.5} opacity={0.7} />
        <Line x1={cx - 16} y1={h / 2 - 3} x2={40} y2={h / 2 - 3} stroke={color} strokeWidth={0.5} opacity={0.4} />
        <Line x1={cx - 16} y1={h / 2 + 3} x2={40} y2={h / 2 + 3} stroke={color} strokeWidth={0.5} opacity={0.4} />
        {/* Right lines */}
        <Line x1={cx + 16} y1={h / 2} x2={width - 20} y2={h / 2} stroke={color} strokeWidth={1.5} opacity={0.7} />
        <Line x1={cx + 16} y1={h / 2 - 3} x2={width - 40} y2={h / 2 - 3} stroke={color} strokeWidth={0.5} opacity={0.4} />
        <Line x1={cx + 16} y1={h / 2 + 3} x2={width - 40} y2={h / 2 + 3} stroke={color} strokeWidth={0.5} opacity={0.4} />
        {/* End caps - small diamonds */}
        <Path d={`M 12 ${h / 2} L 16 ${h / 2 - 4} L 20 ${h / 2} L 16 ${h / 2 + 4} Z`} fill={color} opacity={0.5} />
        <Path d={`M ${width - 12} ${h / 2} L ${width - 16} ${h / 2 - 4} L ${width - 20} ${h / 2} L ${width - 16} ${h / 2 + 4} Z`} fill={color} opacity={0.5} />
      </Svg>
    </View>
  );
}

/**
 * Art Deco corner ornament — place in each corner of a container
 */
export function ArtDecoCorner({
  position,
  size = 40,
  color = GOLD,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  size?: number;
  color?: string;
}) {
  const flipX = position.includes("right") ? -1 : 1;
  const flipY = position.includes("bottom") ? -1 : 1;

  const posStyle: any = {};
  if (position.includes("top")) posStyle.top = 0;
  if (position.includes("bottom")) posStyle.bottom = 0;
  if (position.includes("left")) posStyle.left = 0;
  if (position.includes("right")) posStyle.right = 0;

  return (
    <View style={[styles.cornerContainer, posStyle]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G transform={`translate(${flipX === -1 ? size : 0}, ${flipY === -1 ? size : 0}) scale(${flipX}, ${flipY})`}>
          {/* Outer L-shape */}
          <Path d={`M 0 0 L ${size * 0.7} 0 L ${size * 0.7} ${size * 0.08} L ${size * 0.08} ${size * 0.08} L ${size * 0.08} ${size * 0.7} L 0 ${size * 0.7} Z`} fill={color} opacity={0.8} />
          {/* Inner L-shape */}
          <Path d={`M ${size * 0.15} ${size * 0.15} L ${size * 0.5} ${size * 0.15} L ${size * 0.5} ${size * 0.2} L ${size * 0.2} ${size * 0.2} L ${size * 0.2} ${size * 0.5} L ${size * 0.15} ${size * 0.5} Z`} fill={color} opacity={0.5} />
          {/* Diagonal accent */}
          <Line x1={size * 0.12} y1={size * 0.12} x2={size * 0.35} y2={size * 0.35} stroke={color} strokeWidth={1} opacity={0.4} />
          {/* Small diamond */}
          <Path d={`M ${size * 0.3} ${size * 0.1} L ${size * 0.33} ${size * 0.07} L ${size * 0.36} ${size * 0.1} L ${size * 0.33} ${size * 0.13} Z`} fill={color} opacity={0.6} />
        </G>
      </Svg>
    </View>
  );
}

/**
 * Art Deco frame border — wraps content with decorative corners and border
 */
export function ArtDecoFrame({
  children,
  color = GOLD,
  cornerSize = 36,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  cornerSize?: number;
  style?: any;
}) {
  return (
    <View style={[styles.frameContainer, { borderColor: color + "40" }, style]}>
      <ArtDecoCorner position="top-left" size={cornerSize} color={color} />
      <ArtDecoCorner position="top-right" size={cornerSize} color={color} />
      <ArtDecoCorner position="bottom-left" size={cornerSize} color={color} />
      <ArtDecoCorner position="bottom-right" size={cornerSize} color={color} />
      <View style={styles.frameContent}>{children}</View>
    </View>
  );
}

/**
 * Art Deco section header with decorative lines
 */
export function ArtDecoHeader({
  title,
  color = GOLD,
  textColor = "#ECEDEE",
}: {
  title: string;
  color?: string;
  textColor?: string;
}) {
  return (
    <View style={styles.headerContainer}>
      <View style={[styles.headerLine, { backgroundColor: color + "60" }]} />
      <View style={styles.headerDiamond}>
        <Svg width={12} height={12} viewBox="0 0 12 12">
          <Path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill={color} opacity={0.8} />
        </Svg>
      </View>
      <Text style={[styles.headerText, { color: textColor }]}>{title}</Text>
      <View style={styles.headerDiamond}>
        <Svg width={12} height={12} viewBox="0 0 12 12">
          <Path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill={color} opacity={0.8} />
        </Svg>
      </View>
      <View style={[styles.headerLine, { backgroundColor: color + "60" }]} />
    </View>
  );
}

/**
 * Art Deco sunburst/fan decoration
 */
export function ArtDecoSunburst({
  size = 80,
  color = GOLD,
}: {
  size?: number;
  color?: string;
}) {
  const rays = 9;
  const cx = size / 2;
  const cy = size;

  return (
    <View style={styles.sunburstContainer}>
      <Svg width={size} height={size / 2 + 4} viewBox={`0 0 ${size} ${size / 2 + 4}`}>
        {Array.from({ length: rays }).map((_, i) => {
          const angle = (Math.PI / (rays - 1)) * i;
          const x2 = cx + Math.cos(Math.PI + angle) * (size / 2 - 4);
          const y2 = cy + Math.sin(Math.PI + angle) * (size / 2 - 4);
          return (
            <Line
              key={i}
              x1={cx}
              y1={cy}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={i === Math.floor(rays / 2) ? 2 : 1}
              opacity={0.3 + (1 - Math.abs(i - rays / 2) / (rays / 2)) * 0.5}
            />
          );
        })}
        {/* Base arc */}
        <Path
          d={`M 4 ${cy} A ${size / 2 - 4} ${size / 2 - 4} 0 0 1 ${size - 4} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          opacity={0.6}
        />
        {/* Inner arc */}
        <Path
          d={`M ${size * 0.2} ${cy} A ${size * 0.3} ${size * 0.3} 0 0 1 ${size * 0.8} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={1}
          opacity={0.4}
        />
      </Svg>
    </View>
  );
}

/**
 * Simple art deco ticket stub border element
 */
export function ArtDecoTicketBorder({ color = GOLD }: { color?: string }) {
  return (
    <View style={styles.ticketBorderContainer}>
      <View style={[styles.ticketDash, { borderColor: color + "50" }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  dividerContainer: {
    alignItems: "center",
    marginVertical: 8,
  },
  cornerContainer: {
    position: "absolute",
    zIndex: 10,
  },
  frameContainer: {
    position: "relative",
    borderWidth: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  frameContent: {
    padding: 16,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  headerLine: {
    flex: 1,
    height: 1,
  },
  headerDiamond: {
    marginHorizontal: 8,
  },
  headerText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginHorizontal: 4,
  },
  sunburstContainer: {
    alignItems: "center",
  },
  ticketBorderContainer: {
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  ticketDash: {
    borderTopWidth: 2,
    borderStyle: "dashed",
  },
});

import {RoundedBox, Text} from "@react-three/drei";
import * as THREE from "three";
import {RankingItem} from "../data";
import {sceneConfig} from "../config/sceneConfig";
import {columnHeight, displayValue, numericValue} from "../value";

export function Column({item, index, total, maxValue}: {item: RankingItem; index: number; total: number; maxValue: number}) {
  const height = item.height ?? (() => {
    return columnHeight(item.value, maxValue);
  })();
  const width = item.width ?? sceneConfig.columnWidth;
  const depth = item.depth ?? sceneConfig.columnDepth;
  const x = item.x ?? (index - (total - 1) / 2) * (width + sceneConfig.columnGap);
  const y = item.y ?? height / 2 + sceneConfig.floorY - sceneConfig.columnGroundEmbed;
  const z = item.z ?? 0;
  const labelWidth = width * 0.94;
  const labelDepth = depth / 2 + 0.055;
  const rowHeight = 0.34;
  const panelHeight = rowHeight * 3;
  const panelBottom = height / 2 - 0.30;
  const panelCenterY = panelBottom - panelHeight / 2;
  const textY = [panelBottom - rowHeight / 2, panelBottom - rowHeight * 1.5, panelBottom - rowHeight * 2.5];
  const border = 0;
  return <group position={[x, y, z]}>
    <RoundedBox args={[width, height, depth]} radius={sceneConfig.bevel} smoothness={5} castShadow={sceneConfig.shadow} receiveShadow={sceneConfig.shadow}>
      <meshStandardMaterial color={item.color ?? sceneConfig.columnColor} metalness={sceneConfig.columnMetalness} roughness={sceneConfig.columnRoughness} transparent={false} opacity={1} depthWrite />
    </RoundedBox>
    {/* A flush inset top face keeps the yellow highlight without reading as a separate lid. */}
    <mesh position={[0, height / 2 + 0.006, 0]}>
      <boxGeometry args={[width * 0.82, 0.012, depth * 0.82]} />
      <meshStandardMaterial color={sceneConfig.topGlowColor} emissive={sceneConfig.topGlowColor} emissiveIntensity={sceneConfig.topGlowIntensity} />
    </mesh>
    {/* Inset three-row label card: warm top row, dark lower rows, and a single divider. 第一排字体背景颜色 */}
    <RoundedBox position={[0, textY[0], labelDepth + 0.035]} args={[labelWidth, rowHeight, 0.028]} radius={0.018} smoothness={4}>
      <meshBasicMaterial color="#4169E1" />
    </RoundedBox>
    <RoundedBox position={[0, (textY[1] + textY[2]) / 2, labelDepth + 0.035]} args={[labelWidth, rowHeight * 2, 0.028]} radius={0.018} smoothness={4}>
      <meshBasicMaterial color="#7c8585" />
    </RoundedBox>
    <Text position={[0, textY[0], labelDepth + 0.085]} fontSize={0.22} fontWeight={700} color="#fff7df" anchorX="center" anchorY="middle">{item.name}</Text>
    <Text position={[0, textY[1], labelDepth + 0.085]} fontSize={0.19} fontWeight={700} color="#ffe9a6" anchorX="center" anchorY="middle">{[displayValue(item.value), item.unit?.trim()].filter(Boolean).join(" ")}</Text>
    <Text position={[0, textY[2], labelDepth + 0.085]} fontSize={0.18} fontWeight={700} color="#fff7df" anchorX="center" anchorY="middle">{`NO.${item.rank}`}</Text>
  </group>;
}

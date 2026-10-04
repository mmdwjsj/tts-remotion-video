export const sceneConfig = {
  backgroundColor: "#06152d",
  backgroundImage: undefined as string | undefined,
  floorSize: 160,
  floorTileSize: 3.2,
  floorLightColor: "#D3D3D3",
  floorDarkColor: "#A8A8A8",
  floorY: -0.08,
  // Grout width in texture pixels. Keep it wide enough to survive minification
  // when the floor is viewed at a shallow angle or from the overview camera.
  floorGroutWidth: 6,
  // 柱子宽度
  // 柱子宽度
  columnWidth: 1.5,
  columnDepth: 1.4,
  // 柱子间隔
  // 柱子间隔
  columnGap: 1.15,
  baseHeight: 2,
  // Sink the rounded column base slightly into the floor. RoundedBox corners
  // otherwise leave a visible air gap that reads as a detached front shadow.
  // 柱子向地面嵌入深度，主要用于消除柱子底部缝隙，不会改变视觉柱高比例
  columnGroundEmbed: 0.05,
  // 柱子最低基础高度 
  minHeight: 2,
  // 柱子最高基础高度
  maxHeight: 15,
  // Existing square-root compression; preserve its shape and use 3 decimals
  // for the resulting geometry.
  heightCompression: 0.5,
  heightPrecision: 3,
  bevel: 0.12,
  // Columns are fully opaque so labels and scene elements cannot show through.
  opacity: 1,
  shadow: true,
  shadowMapSize: 2048,
  shadowCameraLeft: -22,
  shadowCameraRight: 22,
  shadowCameraTop: 18,
  shadowCameraBottom: -8,
  shadowCameraNear: 0.5,
  shadowCameraFar: 60,
  shadowBias: -0.00005,
  shadowNormalBias: 0.002,
  columnColor: "#d8b36a",
  columnMetalness: 0.82,
  columnRoughness: 0.24,
  topGlowColor: "#c89435",
  topGlowIntensity: 0.8,
  topInfoHeight: 0.85,
  labelTopOffset: 0.42,
  labelLineGap: 0.32,
};

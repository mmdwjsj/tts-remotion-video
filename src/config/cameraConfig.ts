export const cameraConfig = {
  introDuration: 150,
  introApproachDuration: 75,
  // 镜头与柱子的距离  镜头前后距离
  cameraDistanceZ: 11,
  // Keep the restored three-quarter/front view; a large offset makes the
  // camera look down from above as columns get taller.
  // 镜头比观察目标高多少
  cameraHeightOffset: 0.65,
  //  镜头左右偏移
  cameraSideOffsetX: 0,
  // 观察点相对柱顶向下偏移
  lookAtHeightOffset: -0.75,
  // Aim slightly below the top so the active column/data sits in the upper-middle.
  // 镜头俯仰目标偏移
  lookAtPitch: 0,
  moveDuration: 88,
  largeHeightGap: 2.2,
  largeGapMoveDuration: 52,
  endingOverviewDuration: 90,
  overviewX: 0,
  overviewY: 12,
  overviewZ: 60,
  overviewLookAtY: 5.5,
  // 镜头视野角度
  fov: 42,
};

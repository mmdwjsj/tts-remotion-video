import {useCurrentFrame, useVideoConfig, Easing} from "remotion";
import {useThree} from "@react-three/fiber";
import * as THREE from "three";
import {cameraConfig} from "../config/cameraConfig";
import {RankingItem, TimelineSegment} from "../data";
import {sceneConfig} from "../config/sceneConfig";
import {columnHeight, numericValue} from "../value";
import {BRAND_OUTRO_FRAMES} from "../timing";

export function Camera({items, timeline, startOffsetFrames = 0, contentDurationFrames}: {items: RankingItem[]; timeline?: TimelineSegment[]; startOffsetFrames?: number; contentDurationFrames: number}) {
  const absoluteFrame = useCurrentFrame();
  const frame = Math.max(0, absoluteFrame - startOffsetFrames);
  const {camera} = useThree();
  // Keep camera travel in the same order as the rendered columns and the
  // narration timeline: rank 3 -> rank 2 -> rank 1 moves left to right.
  const ordered = [...items].sort((a, b) => b.rank - a.rank);
  const maxValue = Math.max(...ordered.map((item) => numericValue(item.value)));
  const xFor = (item: (typeof ordered)[number]) => {
    const index = ordered.findIndex((entry) => entry.name === item.name);
    return (index - (ordered.length - 1) / 2) * (sceneConfig.columnWidth + sceneConfig.columnGap);
  };
  const heightFor = (item: (typeof ordered)[number]) => {
    if (item.height !== undefined) return item.height;
    return columnHeight(item.value, maxValue);
  };
  const focus = (item: (typeof ordered)[number]) => {
    const targetX = xFor(item);
    const targetY = heightFor(item) + cameraConfig.lookAtHeightOffset;
    camera.position.set(targetX + cameraConfig.cameraSideOffsetX, targetY + cameraConfig.cameraHeightOffset, cameraConfig.cameraDistanceZ);
    camera.lookAt(new THREE.Vector3(targetX, targetY + cameraConfig.lookAtPitch, 0));
  };
  if (absoluteFrame < startOffsetFrames) {
    // （左右，高度，距离）
    camera.position.set(0, cameraConfig.overviewY, cameraConfig.overviewZ);
    camera.lookAt(new THREE.Vector3(0, cameraConfig.overviewLookAtY, 0));
    return null;
  }
  const outroFrame = absoluteFrame - startOffsetFrames - contentDurationFrames;
  if (outroFrame >= 0) {
    // Ease away from the final focused column into the full-scene overview,
    // mirroring the gradual camera approach used at the beginning.
    const last = ordered[ordered.length - 1] ?? ordered[0];
    const lastX = xFor(last);
    const lastY = heightFor(last) + cameraConfig.lookAtHeightOffset;
    const p = Easing.inOut(Easing.cubic)(
      Math.min(1, Math.max(0, outroFrame / Math.max(BRAND_OUTRO_FRAMES, 1))),
    );
    const focusedPosition = new THREE.Vector3(
      lastX + cameraConfig.cameraSideOffsetX,
      lastY + cameraConfig.cameraHeightOffset,
      cameraConfig.cameraDistanceZ,
    );
    const overviewPosition = new THREE.Vector3(
      cameraConfig.overviewX,
      cameraConfig.overviewY,
      cameraConfig.overviewZ,
    );
    camera.position.copy(focusedPosition.lerp(overviewPosition, p));
    camera.lookAt(new THREE.Vector3().lerpVectors(
      new THREE.Vector3(lastX, lastY, 0),
      new THREE.Vector3(0, cameraConfig.overviewLookAtY, 0),
      p,
    ));
    return null;
  }

  // Keep each column framed for the entire spoken phrase. Movement happens
  // only in the following silent interval, as defined by the audio timeline.
  if (timeline?.length) {
    const fps = 30;
    const seconds = frame / fps;
    const rankingSegments = timeline.filter((segment) => segment.rank !== undefined);
    const intro = timeline.find((segment) => segment.id === "intro");
    if (!rankingSegments.length) return null;
    const first = ordered.find((item) => item.rank === rankingSegments[0].rank) ?? ordered[0];
    if (intro && seconds < intro.start + intro.speechDuration) {
      const p = Easing.inOut(Easing.cubic)(Math.min(1, Math.max(0, (seconds - intro.start) / Math.max(intro.speechDuration, 1 / fps))));
      const firstY = heightFor(first) + cameraConfig.lookAtHeightOffset;
      const brandPosition = new THREE.Vector3(cameraConfig.overviewX, cameraConfig.overviewY, cameraConfig.overviewZ);
      const brandTarget = new THREE.Vector3(0, cameraConfig.overviewLookAtY, 0);
      const columnPosition = new THREE.Vector3(xFor(first) + cameraConfig.cameraSideOffsetX, firstY + cameraConfig.cameraHeightOffset, cameraConfig.cameraDistanceZ);
      const columnTarget = new THREE.Vector3(xFor(first), firstY + cameraConfig.lookAtPitch, 0);
      camera.position.copy(brandPosition.lerp(columnPosition, p));
      camera.lookAt(brandTarget.lerp(columnTarget, p));
      return null;
    }
    if (intro && seconds < intro.start + intro.duration) {
      focus(first);
      return null;
    }
    for (let index = 0; index < rankingSegments.length; index++) {
      const segment = rankingSegments[index];
      const current = ordered.find((item) => item.rank === segment.rank) ?? first;
      const speechEnd = segment.start + segment.speechDuration;
      const segmentEnd = segment.start + segment.duration;
      if (seconds < speechEnd) {
        focus(current);
        return null;
      }
      if (seconds < segmentEnd) {
        const nextSegment = rankingSegments[index + 1];
        if (!nextSegment) {
          focus(current);
          return null;
        }
        const next = ordered.find((item) => item.rank === nextSegment.rank) ?? current;
        const p = Easing.inOut(Easing.cubic)(Math.min(1, Math.max(0, (seconds - speechEnd) / Math.max(segment.intervalDuration, 1 / fps))));
        const targetX = THREE.MathUtils.lerp(xFor(current), xFor(next), p);
        const targetY = THREE.MathUtils.lerp(heightFor(current), heightFor(next), p) + cameraConfig.lookAtHeightOffset;
        camera.position.set(targetX + cameraConfig.cameraSideOffsetX, targetY + cameraConfig.cameraHeightOffset, cameraConfig.cameraDistanceZ);
        camera.lookAt(new THREE.Vector3(targetX, targetY + cameraConfig.lookAtPitch, 0));
        return null;
      }
    }
    focus(ordered.find((item) => item.rank === rankingSegments[rankingSegments.length - 1].rank) ?? ordered[ordered.length - 1]);
    return null;
  }
  const durations = ordered.slice(0, -1).map((item, index) => {
    const gap = Math.abs(heightFor(ordered[index + 1]) - heightFor(item));
    return gap >= cameraConfig.largeHeightGap
      ? cameraConfig.largeGapMoveDuration
      : cameraConfig.moveDuration;
  });
  const segmentLengths = durations;
  const totalMoveDuration = segmentLengths.reduce((sum, value) => sum + value, 0);
  const approachFrame = frame - cameraConfig.introDuration;
  const motionFrame = approachFrame - cameraConfig.introApproachDuration;
  const endingProgress = Easing.inOut(Easing.cubic)(
    Math.min(1, Math.max(0, motionFrame - totalMoveDuration) / cameraConfig.endingOverviewDuration),
  );
  if (frame < cameraConfig.introDuration) {
    camera.position.set(
      cameraConfig.overviewX,
      cameraConfig.overviewY,
      cameraConfig.overviewZ,
    );
    camera.lookAt(new THREE.Vector3(0, cameraConfig.overviewLookAtY, 0));
    return null;
  }
  const first = ordered[0];
  const firstX = xFor(first);
  const firstY = heightFor(first) + cameraConfig.lookAtHeightOffset;
  if (approachFrame < cameraConfig.introApproachDuration) {
    const p = Easing.inOut(Easing.cubic)(Math.max(0, approachFrame) / cameraConfig.introApproachDuration);
    const overview = new THREE.Vector3(cameraConfig.overviewX, cameraConfig.overviewY, cameraConfig.overviewZ);
    const focused = new THREE.Vector3(firstX + cameraConfig.cameraSideOffsetX, firstY + cameraConfig.cameraHeightOffset, cameraConfig.cameraDistanceZ);
    camera.position.copy(overview.lerp(focused, p));
    camera.lookAt(new THREE.Vector3().lerpVectors(new THREE.Vector3(0, cameraConfig.overviewLookAtY, 0), new THREE.Vector3(firstX, firstY + cameraConfig.lookAtPitch, 0), p));
    return null;
  }
  if (motionFrame >= totalMoveDuration) {
    const last = ordered[ordered.length - 1];
    const lastX = xFor(last);
    const lastY = heightFor(last) + cameraConfig.lookAtHeightOffset;
    const focusedPosition = new THREE.Vector3(
      lastX + cameraConfig.cameraSideOffsetX,
      lastY + cameraConfig.cameraHeightOffset,
      cameraConfig.cameraDistanceZ,
    );
    const overviewPosition = new THREE.Vector3(
      cameraConfig.overviewX,
      cameraConfig.overviewY,
      cameraConfig.overviewZ,
    );
    camera.position.copy(focusedPosition.lerp(overviewPosition, endingProgress));
    camera.lookAt(new THREE.Vector3().lerpVectors(
      new THREE.Vector3(lastX, lastY, 0),
      new THREE.Vector3(0, cameraConfig.overviewLookAtY, 0),
      endingProgress,
    ));
    return null;
  }
  let elapsed = 0;
  let segment = 0;
  for (let i = 0; i < segmentLengths.length; i++) {
    if (motionFrame < elapsed + segmentLengths[i]) {
      segment = i;
      break;
    }
    elapsed += segmentLengths[i];
    segment = Math.min(i + 1, ordered.length - 1);
  }
  const from = ordered[segment];
  const to = ordered[Math.min(segment + 1, ordered.length - 1)];
  const moveDuration = durations[Math.min(segment, durations.length - 1)] ?? cameraConfig.moveDuration;
  const local = Math.max(0, motionFrame - elapsed);
  const t = Easing.inOut(Easing.cubic)(Math.min(1, local / moveDuration));
  const targetX = THREE.MathUtils.lerp(xFor(from), xFor(to), t);
  // Frame the column tops as the visual focus; the base can remain outside the
  // composition when the camera is close.
  const targetY = THREE.MathUtils.lerp(heightFor(from), heightFor(to), t) + cameraConfig.lookAtHeightOffset;
  // Keep the camera square to the active column while lowering the camera a
  // little toward taller columns, creating a subtle upward-looking angle.
  const cameraY = targetY + cameraConfig.cameraHeightOffset;
  camera.position.set(targetX + cameraConfig.cameraSideOffsetX, cameraY, cameraConfig.cameraDistanceZ);
  const lookTarget = new THREE.Vector3(
    targetX,
    targetY + cameraConfig.lookAtPitch,
    0,
  );
  camera.lookAt(lookTarget);
  return null;
}

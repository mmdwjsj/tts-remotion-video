import React from "react";
import { Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { Scene } from "./Scene";
import { RankingVideoProps } from "./data";
import { cameraConfig } from "./config/cameraConfig";
import { sceneConfig } from "./config/sceneConfig";
import { columnHeight, numericValue } from "./value";
import { BRAND_INTRO_FRAMES, TITLE_VISIBLE_FRAMES } from "./timing";

export const Ranking3D: React.FC<RankingVideoProps> = ({
  title,
  items,
  audioFile,
  timeline,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const ordered = [...items].sort((a, b) => b.rank - a.rank);
  const maxValue = Math.max(...ordered.map((item) => numericValue(item.value)));
  const heightFor = (item: (typeof ordered)[number]) =>
    item.height ??
    columnHeight(item.value, maxValue);
  const motionDuration = ordered.slice(0, -1).reduce((total, item, index) => {
    const gap = Math.abs(heightFor(ordered[index + 1]) - heightFor(item));
    return (
      total +
      (gap >= cameraConfig.largeHeightGap
        ? cameraConfig.largeGapMoveDuration
        : cameraConfig.moveDuration)
    );
  }, 0);
  const contentFrame = frame - BRAND_INTRO_FRAMES;
  const contentDurationFrames =
    durationInFrames ??
    (timeline?.length
      ? Math.ceil(
          (timeline[timeline.length - 1].start +
            timeline[timeline.length - 1].duration) *
            30,
        )
      : cameraConfig.introDuration +
        cameraConfig.introApproachDuration +
        motionDuration);
  // The very first frame is the intentional black lead-in; keep it clean and
  // reveal the title from frame 1 onward.
  // 只有当frame大于0 并且 小于 BRAND_INTRO_FRAMES 的时候标题才会显示
  // const titleVisible = frame < TITLE_VISIBLE_FRAMES;
  const fps = 30;
  const intro = timeline?.find((segment) => segment.id === "intro");

  let titleVisibleUntilFrame = TITLE_VISIBLE_FRAMES;
  if (intro) {
    const configuredDelay = intro.cameraMoveDelay ?? 0.5;
    const actualDelay = Math.min(
      configuredDelay,
      Math.max(0, intro.speechDuration - 1 / fps),
    );
    titleVisibleUntilFrame = BRAND_INTRO_FRAMES + Math.round((intro.start + actualDelay) * fps);
  }

  const titleVisible = frame < titleVisibleUntilFrame;
  return (
    <div style={{ width: "100%", height: "100%", background: "transparent" }}>
      {audioFile ? (
        <Sequence from={BRAND_INTRO_FRAMES}>
          <Audio src={staticFile(audioFile)} />
        </Sequence>
      ) : null}
      <Scene
        items={items}
        timeline={timeline}
        startOffsetFrames={BRAND_INTRO_FRAMES}
        contentDurationFrames={contentDurationFrames}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 450,
          opacity: titleVisible ? 1 : 0,
        }}
      >
        <div
          style={{
            color: "#2C2C2C",
            // 字体大小
            fontSize: 52,
            // 字体粗细
            fontWeight: 700,
            // 字间距
            letterSpacing: 4,
          
            textAlign: "center",
            // 左右留白
            padding: "0 24px",
            maxWidth: "none",
            whiteSpace: "nowrap",
            textShadow: "0 2px 10px rgba(255,255,255,.3)",
          }}
        >
          {title}
        </div>
      </div>
    </div>
  );
};

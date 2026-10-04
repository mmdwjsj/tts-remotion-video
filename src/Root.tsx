import React from "react";
import {CalculateMetadataFunction, Composition} from "remotion";
import * as THREE from "three";
import {Ranking3D} from "./Ranking3D";
import {defaultVideoProps, RankingVideoProps} from "./data";
import {cameraConfig} from "./config/cameraConfig";
import {sceneConfig} from "./config/sceneConfig";
import {columnHeight, numericValue} from "./value";
import {BRAND_INTRO_FRAMES, BRAND_OUTRO_FRAMES} from "./timing";

const durationFor = (props: RankingVideoProps) => {
  if (props.durationInFrames && props.durationInFrames > 0) return props.durationInFrames + BRAND_INTRO_FRAMES + BRAND_OUTRO_FRAMES;
  const ordered = [...props.items].sort((a, b) => numericValue(a.value) - numericValue(b.value));
  const maxValue = Math.max(...ordered.map((item) => numericValue(item.value)));
  const heightFor = (item: (typeof ordered)[number]) => item.height ?? columnHeight(item.value, maxValue);
  const moveDuration = ordered.slice(0, -1).reduce((total, item, index) => {
    const gap = Math.abs(heightFor(ordered[index + 1]) - heightFor(item));
    return total + (gap >= cameraConfig.largeHeightGap ? cameraConfig.largeGapMoveDuration : cameraConfig.moveDuration);
  }, 0);
  return BRAND_INTRO_FRAMES + cameraConfig.introDuration + cameraConfig.introApproachDuration + moveDuration + cameraConfig.endingOverviewDuration + BRAND_OUTRO_FRAMES;
};

const calculateMetadata: CalculateMetadataFunction<RankingVideoProps> = ({props}) => ({durationInFrames: durationFor(props)});

export const RemotionRoot: React.FC = () => <Composition
  id="Ranking3D"
  component={Ranking3D}
  durationInFrames={durationFor(defaultVideoProps)}
  fps={30}
  width={1080}
  height={1920}
  defaultProps={defaultVideoProps}
  calculateMetadata={calculateMetadata}
/>;

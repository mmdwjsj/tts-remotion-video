export const numericValue = (value: number | string): number => {
  if (typeof value === "number") return value;

  const match = value.replace(/,/g, "").match(/[-+]?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
};

export const displayValue = (value: number | string): string => {
  const numeric = numericValue(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("en-US") : String(value).trim();
};

import * as THREE from "three";
import {sceneConfig} from "./config/sceneConfig";

export const columnHeight = (value: number | string, maxValue: number): number => {
  const numeric = numericValue(value);
  if (!Number.isFinite(numeric) || !Number.isFinite(maxValue) || maxValue <= 0) {
    return sceneConfig.baseHeight;
  }
  const compressedHeight = THREE.MathUtils.clamp(
    sceneConfig.baseHeight + Math.pow(numeric / maxValue, sceneConfig.heightCompression) * 7,
    sceneConfig.minHeight,
    sceneConfig.maxHeight,
  );
  const scale = 10 ** sceneConfig.heightPrecision;
  return Math.round(compressedHeight * scale) / scale;
};

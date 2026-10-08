export const numericValue = (value: number | string): number => {
  if (typeof value === "number") return value;

  const match = value.replace(/,/g, "").match(/[-+]?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
};

export const displayValue = (value: number | string): string => {
  if (typeof value === "string") {
    const text = value.trim();
    // Preserve presentation-only prefixes/suffixes (such as $, %, or words),
    // while adding thousands separators only to the numeric integer part.
    return text.replace(/[-+]?\d[\d,]*(?:\.\d+)?/, (numberText) => {
      const normalized = numberText.replace(/,/g, "");
      const match = normalized.match(/^([-+]?)(\d+)(\.\d+)?$/);
      if (!match) return numberText;
      const [, sign, integer, fraction = ""] = match;
      return `${sign}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction}`;
    });
  }
  return value.toLocaleString("en-US");
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

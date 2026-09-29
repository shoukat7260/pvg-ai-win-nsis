/**
 * Adapted from OpenCut Classic (MIT)
 * vendor/opencut-classic/apps/web/src/timeline/zoom-utils.ts
 */
import {
  BASE_TIMELINE_PIXELS_PER_SECOND,
  TIMELINE_ZOOM_MIN,
  TIMELINE_ZOOM_MAX,
} from "./scale.js";

/** PVG sequences use milliseconds; OpenCut uses media ticks per second from WASM. */
export const PVG_MS_PER_SECOND = 1000;

const PADDING_MAX_RATIO = 0.75;
const PADDING_MIN_RATIO = 0.15;
const PADDING_MIN_AT_ZOOM_PERCENT = 0.2;

export function getTimelineZoomMin({
  durationMs,
  containerWidth,
}: {
  durationMs: number;
  containerWidth: number | null | undefined;
}): number {
  const safeDurationSeconds = Math.max(durationMs / PVG_MS_PER_SECOND, 1);
  const safeContainerWidth = containerWidth ?? 1000;
  const contentRatioAtMinZoom = 1 - PADDING_MAX_RATIO;
  const availableWidth = safeContainerWidth * contentRatioAtMinZoom;
  const zoomToFit =
    availableWidth / (safeDurationSeconds * BASE_TIMELINE_PIXELS_PER_SECOND);

  return Math.min(TIMELINE_ZOOM_MAX, Math.max(0.05, zoomToFit));
}

export function getTimelinePaddingPx({
  containerWidth,
  zoomLevel,
  minZoom,
}: {
  containerWidth: number;
  zoomLevel: number;
  minZoom: number;
}): number {
  const zoomPercent = getZoomPercent({ zoomLevel, minZoom });
  const paddingTransitionPercent = Math.min(
    zoomPercent / PADDING_MIN_AT_ZOOM_PERCENT,
    1,
  );
  const paddingRatio =
    PADDING_MAX_RATIO -
    (PADDING_MAX_RATIO - PADDING_MIN_RATIO) * paddingTransitionPercent;

  return containerWidth * paddingRatio;
}

export function getZoomPercent({
  zoomLevel,
  minZoom,
}: {
  zoomLevel: number;
  minZoom: number;
}): number {
  if (TIMELINE_ZOOM_MAX <= minZoom) return 1;
  return (zoomLevel - minZoom) / (TIMELINE_ZOOM_MAX - minZoom);
}

export function sliderToZoom({
  sliderPosition,
  minZoom,
  maxZoom = TIMELINE_ZOOM_MAX,
}: {
  sliderPosition: number;
  minZoom: number;
  maxZoom?: number;
}): number {
  const clampedPosition = Math.max(0, Math.min(1, sliderPosition));
  return minZoom * (maxZoom / minZoom) ** clampedPosition;
}

export function zoomToSlider({
  zoomLevel,
  minZoom,
  maxZoom = TIMELINE_ZOOM_MAX,
}: {
  zoomLevel: number;
  minZoom: number;
  maxZoom?: number;
}): number {
  const clampedZoom = Math.max(minZoom, Math.min(maxZoom, zoomLevel));
  if (maxZoom <= minZoom) return 0;
  return Math.log(clampedZoom / minZoom) / Math.log(maxZoom / minZoom);
}

/** Convert legacy PVG timelineUi.zoom (0.25–4 multiplier) to OpenCut-style zoom level. */
export function pvgZoomToOpenCutLevel(pvgZoom: number): number {
  return Math.max(TIMELINE_ZOOM_MIN, pvgZoom * BASE_TIMELINE_PIXELS_PER_SECOND);
}

export function openCutLevelToPvgZoom(level: number): number {
  return level / BASE_TIMELINE_PIXELS_PER_SECOND;
}

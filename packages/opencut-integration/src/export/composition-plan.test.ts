import { describe, expect, it } from "vitest";
import { buildExportCompositionPlan } from "./composition-plan.js";
import type { ProjectDocument } from "@pvg/project-format";

const TS = "2026-09-30T00:00:00.000Z";

function uuid(n: number) {
  return `550e8400-e29b-41d4-a716-${String(n).padStart(12, "0")}`;
}

describe("export composition plan", () => {
  it("includes video, text, audio, and effects", () => {
    const project = {
      id: uuid(1),
      name: "T",
      schemaVersion: 3,
      workspaceId: "ws",
      createdAt: TS,
      updatedAt: TS,
      lastSavedAt: null,
      appVersion: null,
      lastRecoveredAt: null,
      assets: [],
      bins: [],
      settings: {
        frameRate: 30,
        width: 1920,
        height: 1080,
        sampleRate: 48000,
        locale: "en-US",
        previewQuality: "balanced",
        proxyMode: "auto",
        defaultBackground: "#000000",
      },
      sequences: [
        {
          id: uuid(2),
          name: "S1",
          durationMs: 5000,
          frameRate: 30,
          width: 1920,
          height: 1080,
          sampleRate: 48000,
          backgroundColor: "#000",
          markers: [],
          tracks: [
            {
              id: uuid(3),
              type: "video",
              name: "V1",
              enabled: true,
              locked: false,
              muted: false,
              solo: false,
              visible: true,
              height: 48,
              colorLabel: null,
              clips: [
                {
                  id: uuid(10),
                  assetId: uuid(20),
                  kind: "video",
                  sourceInMs: 0,
                  sourceOutMs: 5000,
                  timelineStartMs: 0,
                  timelineEndMs: 5000,
                  enabled: true,
                  speed: 1,
                  reverse: false,
                  volume: 1,
                  transform: {
                    x: 0,
                    y: 0,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                    anchorX: 0.5,
                    anchorY: 0.5,
                    opacity: 1,
                    flipX: false,
                    flipY: false,
                  },
                  linkedClipId: null,
                  groupId: null,
                  effects: [
                    {
                      id: uuid(30),
                      type: "grayscale",
                      enabled: true,
                      params: {},
                    },
                  ],
                  transitionIn: null,
                  transitionOut: null,
                  text: null,
                  shape: null,
                  mask: {
                    type: "none",
                    x: 0,
                    y: 0,
                    width: 1,
                    height: 1,
                    feather: 0,
                    opacity: 1,
                    invert: false,
                  },
                  blendMode: "normal",
                  keyframes: {},
                  label: "A",
                },
              ],
            },
            {
              id: uuid(4),
              type: "text",
              name: "Text",
              enabled: true,
              locked: false,
              muted: false,
              solo: false,
              visible: true,
              height: 48,
              colorLabel: null,
              clips: [
                {
                  id: uuid(11),
                  assetId: null,
                  kind: "text",
                  sourceInMs: 0,
                  sourceOutMs: 3000,
                  timelineStartMs: 0,
                  timelineEndMs: 3000,
                  enabled: true,
                  speed: 1,
                  reverse: false,
                  volume: 1,
                  transform: {
                    x: 0,
                    y: 0,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                    anchorX: 0.5,
                    anchorY: 0.5,
                    opacity: 1,
                    flipX: false,
                    flipY: false,
                  },
                  linkedClipId: null,
                  groupId: null,
                  effects: [],
                  transitionIn: null,
                  transitionOut: null,
                  text: {
                    content: "Hello",
                    fontFamily: "IBM Plex Sans",
                    fontSize: 48,
                    fontWeight: 600,
                    fontStyle: "normal",
                    align: "center",
                    lineHeight: 1.2,
                    letterSpacing: 0,
                    color: "#fff",
                    strokeColor: null,
                    strokeWidth: 0,
                    shadowColor: null,
                    shadowBlur: 0,
                    backgroundColor: null,
                    padding: 0,
                  },
                  shape: null,
                  mask: {
                    type: "none",
                    x: 0,
                    y: 0,
                    width: 1,
                    height: 1,
                    feather: 0,
                    opacity: 1,
                    invert: false,
                  },
                  blendMode: "normal",
                  keyframes: {},
                  label: "Hello",
                },
              ],
            },
          ],
        },
      ],
    } as ProjectDocument;

    const plan = buildExportCompositionPlan(project, uuid(2));
    expect(plan.videoLayers).toHaveLength(1);
    expect(plan.videoLayers[0]!.effects).toContain("grayscale");
    expect(plan.textLayers).toHaveLength(1);
    expect(plan.textLayers[0]!.content).toBe("Hello");
    expect(plan.audioLayers.length).toBeGreaterThanOrEqual(1);
  });
});

import { describe, expect, it } from "vitest";
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  type ProjectDocument,
  type Sequence,
} from "@pvg/project-format";
import {
  AddKeyframeCommand,
  DeleteClipsCommand,
  HistoryStack,
  MoveClipsCommand,
  MoveClipsToTrackCommand,
  RippleDeleteCommand,
  RollEditCommand,
  SetSpeedCommand,
  SetTrackPropertyCommand,
  SplitClipCommand,
  TrimLeftCommand,
  TrimRightCommand,
  composeAtTime,
  createDefaultTracks,
  createMediaClip,
  evaluateKeyframes,
  interpolateNumber,
  motionPreset,
  parseAiToolCall,
  planToCommands,
  rippleDeleteClips,
  tryLocalEditPlan,
  buildAiContext,
  EditorError,
  FORBIDDEN_AI_TOOLS,
} from "./index.js";

const TS = "2026-09-29T06:00:00.000Z";

function uuid(n: number): string {
  return `550e8400-e29b-41d4-a716-${String(n).padStart(12, "0")}`;
}

function fixtureProject(): ProjectDocument {
  const assetId = uuid(10);
  const tracks = createDefaultTracks();
  const v1 = tracks.find((t) => t.name === "V1")!;
  const a1 = tracks.find((t) => t.name === "A1")!;
  const clipA = createMediaClip({
    assetId,
    kind: "video",
    durationMs: 3000,
    startMs: 0,
    label: "A",
  });
  clipA.id = uuid(20);
  const clipB = createMediaClip({
    assetId,
    kind: "video",
    durationMs: 2000,
    startMs: 3000,
    label: "B",
  });
  clipB.id = uuid(21);
  const clipC = createMediaClip({
    assetId,
    kind: "video",
    durationMs: 2000,
    startMs: 5000,
    label: "C",
  });
  clipC.id = uuid(22);
  v1.clips = [clipA, clipB, clipC];

  const audioA = createMediaClip({
    assetId,
    kind: "audio",
    durationMs: 3000,
    startMs: 0,
    label: "A-audio",
  });
  audioA.id = uuid(30);
  audioA.linkedClipId = clipA.id;
  clipA.linkedClipId = audioA.id;
  a1.clips = [audioA];

  const sequence: Sequence = {
    id: uuid(1),
    name: "Main",
    durationMs: 7000,
    frameRate: 30,
    width: 1920,
    height: 1080,
    sampleRate: 48000,
    backgroundColor: "#000000",
    tracks,
    markers: [],
  };

  return {
    id: uuid(2),
    name: "Phase4 Fixture",
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    workspaceId: "ws-test",
    createdAt: TS,
    updatedAt: TS,
    lastSavedAt: null,
    appVersion: null,
    lastRecoveredAt: null,
    assets: [
      {
        id: assetId,
        kind: "video",
        name: "clip.mp4",
        relativePath: "media/imported/clip.mp4",
        mimeType: "video/mp4",
        byteSize: 1000,
        sourceAssetId: null,
        availability: "available",
        fingerprint: null,
        video: {
          width: 1920,
          height: 1080,
          durationMs: 10000,
          frameRate: 30,
          codec: null,
          container: null,
          pixelFormat: null,
          bitrate: null,
          rotation: null,
          hasAudio: true,
        },
        audio: null,
        image: null,
        thumbnail: null,
        waveform: null,
        proxy: null,
        binId: null,
        favorite: false,
        createdAt: TS,
        updatedAt: TS,
      },
    ],
    bins: [],
    sequences: [sequence],
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
  };
}

describe("timeline clip operations", () => {
  it("moves clips and supports undo/redo", () => {
    let project = fixtureProject();
    const seqId = project.sequences[0]!.id;
    const history = new HistoryStack();
    project = history.push(
      new MoveClipsCommand(seqId, [uuid(20)], 500, false),
      project,
    );
    const clip = project.sequences[0]!.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === uuid(20))!;
    expect(clip.timelineStartMs).toBe(500);
    project = history.undo(project);
    const undone = project.sequences[0]!.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === uuid(20))!;
    expect(undone.timelineStartMs).toBe(0);
    project = history.redo(project);
    const redone = project.sequences[0]!.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === uuid(20))!;
    expect(redone.timelineStartMs).toBe(500);
  });

  it("splits clip at playhead without duplicating media", () => {
    let project = fixtureProject();
    const seqId = project.sequences[0]!.id;
    const history = new HistoryStack();
    project = history.push(
      new SplitClipCommand(seqId, uuid(20), 1500),
      project,
    );
    const v1 = project.sequences[0]!.tracks.find((t) => t.name === "V1")!;
    expect(v1.clips.length).toBe(4);
    const left = v1.clips.find((c) => c.id === uuid(20))!;
    expect(left.timelineEndMs).toBe(1500);
    const right = v1.clips.find((c) => c.timelineStartMs === 1500)!;
    expect(right.assetId).toBe(left.assetId);
    expect(right.id).not.toBe(left.id);
  });

  it("trims left and right with source bounds", () => {
    let project = fixtureProject();
    const seqId = project.sequences[0]!.id;
    const history = new HistoryStack();
    project = history.push(new TrimLeftCommand(seqId, uuid(20), 500), project);
    project = history.push(new TrimRightCommand(seqId, uuid(20), 2500), project);
    const clip = project.sequences[0]!.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === uuid(20))!;
    expect(clip.timelineStartMs).toBe(500);
    expect(clip.timelineEndMs).toBe(2500);
  });

  it("ripple deletes middle clip and closes gap", () => {
    const project = fixtureProject();
    const seq = project.sequences[0]!;
    const next = rippleDeleteClips(seq, [uuid(21)]);
    const v1 = next.tracks.find((t) => t.name === "V1")!;
    expect(v1.clips.map((c) => c.label)).toEqual(["A", "C"]);
    const c = v1.clips.find((c) => c.label === "C")!;
    expect(c.timelineStartMs).toBe(3000);
  });

  it("roll preserves A+B total duration", () => {
    let project = fixtureProject();
    const seqId = project.sequences[0]!.id;
    const history = new HistoryStack();
    const before = project.sequences[0]!;
    const a = before.tracks.find((t) => t.name === "V1")!.clips[0]!;
    const b = before.tracks.find((t) => t.name === "V1")!.clips[1]!;
    const totalBefore =
      (b.timelineEndMs ?? 0) - a.timelineStartMs;
    project = history.push(
      new RollEditCommand(seqId, uuid(20), uuid(21), 2500),
      project,
    );
    const after = project.sequences[0]!.tracks.find((t) => t.name === "V1")!;
    const a2 = after.clips.find((c) => c.id === uuid(20))!;
    const b2 = after.clips.find((c) => c.id === uuid(21))!;
    expect(a2.timelineEndMs).toBe(2500);
    expect(b2.timelineStartMs).toBe(2500);
    const totalAfter = (b2.timelineEndMs ?? 0) - a2.timelineStartMs;
    expect(totalAfter).toBe(totalBefore);
  });

  it("set speed adjusts timeline duration and undoes", () => {
    let project = fixtureProject();
    const seqId = project.sequences[0]!.id;
    const history = new HistoryStack();
    project = history.push(new SetSpeedCommand(seqId, uuid(20), 2), project);
    const clip = project.sequences[0]!.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === uuid(20))!;
    expect(clip.speed).toBe(2);
    expect(clip.timelineEndMs! - clip.timelineStartMs).toBe(1500);
    project = history.undo(project);
    const undone = project.sequences[0]!.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === uuid(20))!;
    expect(undone.speed).toBe(1);
  });
});

describe("keyframes", () => {
  it("interpolates linear and easing", () => {
    const a = {
      id: uuid(40),
      timeMs: 0,
      value: 0,
      interpolation: "linear" as const,
      inHandle: null,
      outHandle: null,
    };
    const b = {
      id: uuid(41),
      timeMs: 1000,
      value: 100,
      interpolation: "linear" as const,
      inHandle: null,
      outHandle: null,
    };
    expect(interpolateNumber(a, b, 500)).toBe(50);
    const ease = { ...a, interpolation: "easeIn" as const };
    expect(interpolateNumber(ease, b, 500)).toBe(25);
  });

  it("evaluates keyframe list and motion presets", () => {
    const kfs = [
      {
        id: uuid(42),
        timeMs: 0,
        value: 0,
        interpolation: "linear" as const,
        inHandle: null,
        outHandle: null,
      },
      {
        id: uuid(43),
        timeMs: 5000,
        value: 200,
        interpolation: "linear" as const,
        inHandle: null,
        outHandle: null,
      },
    ];
    expect(evaluateKeyframes(kfs, 2500)).toBe(100);
    const preset = motionPreset("fadeIn", 1000);
    expect(preset[0]!.propertyPath).toBe("transform.opacity");
  });

  it("composeAtTime applies animated opacity", () => {
    let project = fixtureProject();
    const seqId = project.sequences[0]!.id;
    const history = new HistoryStack();
    project = history.push(
      new AddKeyframeCommand(seqId, uuid(20), "transform.opacity", {
        timeMs: 0,
        value: 0,
        interpolation: "linear",
      }),
      project,
    );
    project = history.push(
      new AddKeyframeCommand(seqId, uuid(20), "transform.opacity", {
        timeMs: 3000,
        value: 1,
        interpolation: "linear",
      }),
      project,
    );
    const layers = composeAtTime(project.sequences[0]!, 1500);
    const layer = layers.find((l) => l.clipId === uuid(20));
    expect(layer).toBeTruthy();
    expect(layer!.opacity).toBeCloseTo(0.5, 5);
  });
});

describe("AI tool security", () => {
  it("accepts valid set_speed tool call", () => {
    const call = parseAiToolCall({
      tool: "set_speed",
      args: { clipId: uuid(20), speed: 2 },
    });
    expect(call.tool).toBe("set_speed");
  });

  it("rejects forbidden tools", () => {
    for (const tool of FORBIDDEN_AI_TOOLS) {
      expect(() => parseAiToolCall({ tool, args: {} })).toThrow(EditorError);
    }
  });

  it("rejects invalid schema without mutating project", () => {
    const project = fixtureProject();
    const before = JSON.stringify(project);
    expect(() =>
      parseAiToolCall({
        tool: "set_speed",
        args: { clipId: "not-a-uuid", speed: -1 },
      }),
    ).toThrow(EditorError);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("local plan for 2x speed applies via commands and undoes", () => {
    let project = fixtureProject();
    const seqId = project.sequences[0]!.id;
    const ctx = buildAiContext(project, seqId, [uuid(20)], 0);
    const plan = tryLocalEditPlan("Make the selected clip 2x faster.", ctx);
    expect(plan).toBeTruthy();
    const cmds = planToCommands(seqId, plan!);
    const history = new HistoryStack();
    for (const cmd of cmds) {
      project = history.push(cmd, project);
    }
    const clip = project.sequences[0]!.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === uuid(20))!;
    expect(clip.speed).toBe(2);
    project = history.undo(project);
    const undone = project.sequences[0]!.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === uuid(20))!;
    expect(undone.speed).toBe(1);
  });

  it("ripple delete command works through history", () => {
    let project = fixtureProject();
    const seqId = project.sequences[0]!.id;
    const history = new HistoryStack();
    project = history.push(
      new RippleDeleteCommand(seqId, [uuid(21)]),
      project,
    );
    const labels = project.sequences[0]!
      .tracks.find((t) => t.name === "V1")!
      .clips.map((c) => c.label);
    expect(labels).toEqual(["A", "C"]);
    project = history.undo(project);
    expect(
      project.sequences[0]!.tracks.find((t) => t.name === "V1")!.clips.length,
    ).toBe(3);
  });

  it("delete command removes linked audio when deleting video", () => {
    let project = fixtureProject();
    const seqId = project.sequences[0]!.id;
    const history = new HistoryStack();
    project = history.push(new DeleteClipsCommand(seqId, [uuid(20)]), project);
    const all = project.sequences[0]!.tracks.flatMap((t) => t.clips);
    expect(all.find((c) => c.id === uuid(20))).toBeUndefined();
    expect(all.find((c) => c.id === uuid(30))).toBeUndefined();
  });

  it("track mute/lock mutate via SetTrackPropertyCommand and undo", () => {
    let project = fixtureProject();
    const seqId = project.sequences[0]!.id;
    const a1 = project.sequences[0]!.tracks.find((t) => t.name === "A1")!;
    const history = new HistoryStack();
    project = history.push(
      new SetTrackPropertyCommand(seqId, a1.id, { muted: true }, "Mute"),
      project,
    );
    expect(project.sequences[0]!.tracks.find((t) => t.id === a1.id)!.muted).toBe(
      true,
    );
    project = history.undo(project);
    expect(project.sequences[0]!.tracks.find((t) => t.id === a1.id)!.muted).toBe(
      false,
    );
  });

  it("MoveClipsToTrackCommand relocates clip", () => {
    let project = fixtureProject();
    const seq = project.sequences[0]!;
    const v2 = seq.tracks.find((t) => t.name === "V2")!;
    const history = new HistoryStack();
    project = history.push(
      new MoveClipsToTrackCommand(seq.id, [uuid(22)], v2.id, 1000, false),
      project,
    );
    const onV2 = project.sequences[0]!
      .tracks.find((t) => t.name === "V2")!
      .clips.find((c) => c.id === uuid(22));
    expect(onV2).toBeTruthy();
    expect(onV2!.timelineStartMs).toBe(1000);
  });
});

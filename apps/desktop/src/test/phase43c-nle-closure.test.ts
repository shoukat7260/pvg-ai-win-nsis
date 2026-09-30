import { describe, expect, it } from "vitest";
import {
  AddKeyframeCommand,
  DuplicateClipsCommand,
  RemoveMarkerCommand,
  AddMarkerCommand,
  MoveClipsToTrackCommand,
  RollEditCommand,
  composeAtTime,
  evaluateTransformProperty,
  activeSequence,
  ensureEditorTracks,
  createMediaClip,
  AppendClipCommand,
  HistoryStack,
} from "@pvg/editor-core";
import { loadProject, type ProjectAsset, type ProjectDocument } from "@pvg/project-format";
import { TRANSITION_LIBRARY } from "@/features/editor/panels/libraryCatalog";

function asset(partial: Partial<ProjectAsset> & Pick<ProjectAsset, "id" | "name">): ProjectAsset {
  return {
    kind: "video",
    relativePath: `media/${partial.name}`,
    mimeType: null,
    byteSize: null,
    sourceAssetId: null,
    availability: "available",
    fingerprint: null,
    video: null,
    audio: null,
    image: null,
    thumbnail: null,
    waveform: null,
    proxy: null,
    binId: null,
    favorite: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...partial,
  };
}

function doc(): ProjectDocument {
  return loadProject({
    id: "550e8400-e29b-41d4-a716-446655440099",
    name: "43C",
    schemaVersion: 3,
    workspaceId: "ws-local",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    lastSavedAt: null,
    appVersion: null,
    lastRecoveredAt: null,
    assets: [
      asset({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "a.mp4" }),
    ],
    bins: [],
    sequences: [
      {
        id: "550e8400-e29b-41d4-a716-446655440091",
        name: "Seq",
        width: 1920,
        height: 1080,
        frameRate: 30,
        sampleRate: 48000,
        durationMs: 5000,
        tracks: [
          {
            id: "550e8400-e29b-41d4-a716-446655440092",
            type: "video",
            name: "V1",
            enabled: true,
            locked: false,
            muted: false,
            solo: false,
            visible: true,
            height: 48,
            clips: [],
          },
          {
            id: "550e8400-e29b-41d4-a716-446655440093",
            type: "video",
            name: "V2",
            enabled: true,
            locked: false,
            muted: false,
            solo: false,
            visible: true,
            height: 48,
            clips: [],
          },
        ],
        markers: [],
      },
    ],
    settings: {},
  });
}

describe("Phase 4.3C NLE closure", () => {
  it("wipe/slide transitions are unavailable until export supports them", () => {
    expect(TRANSITION_LIBRARY.find((t) => t.id === "wipe")?.status).toBe(
      "unavailable",
    );
    expect(TRANSITION_LIBRARY.find((t) => t.id === "slide")?.status).toBe(
      "unavailable",
    );
    expect(TRANSITION_LIBRARY.find((t) => t.id === "fade")?.status).toBe("ready");
  });

  it("composeAtTime evaluates multi-property keyframes", () => {
    let project = doc();
    let seq = ensureEditorTracks(activeSequence(project)!);
    const vTrack = seq.tracks.find((t) => t.type === "video")!;
    const clip = createMediaClip({
      assetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      kind: "video",
      durationMs: 2000,
    });
    clip.keyframes["transform.opacity"] = [
      {
        id: "k1",
        timeMs: 0,
        value: 0,
        interpolation: "linear",
        inHandle: null,
        outHandle: null,
      },
      {
        id: "k2",
        timeMs: 2000,
        value: 1,
        interpolation: "linear",
        inHandle: null,
        outHandle: null,
      },
    ];
    clip.keyframes["transform.x"] = [
      {
        id: "kx1",
        timeMs: 0,
        value: -100,
        interpolation: "easeIn",
        inHandle: null,
        outHandle: null,
      },
      {
        id: "kx2",
        timeMs: 2000,
        value: 100,
        interpolation: "linear",
        inHandle: null,
        outHandle: null,
      },
    ];
    const history = new HistoryStack();
    project = history.push(
      new AppendClipCommand(seq.id, vTrack.id, clip),
      project,
    );
    seq = activeSequence(project)!;
    const mid = composeAtTime(seq, 1000);
    const layer = mid.find((l) => l.clipId === clip.id);
    expect(layer).toBeTruthy();
    expect(layer!.opacity).toBeCloseTo(0.5, 1);
    expect(layer!.x).toBeGreaterThan(-100);
    expect(layer!.x).toBeLessThan(100);
  });

  it("DuplicateClipsCommand and MoveClipsToTrackCommand mutate state", () => {
    let project = doc();
    let seq = ensureEditorTracks(activeSequence(project)!);
    const videos = seq.tracks.filter((t) => t.type === "video");
    const v1 = videos[0]!;
    const v2 = videos[1] ?? v1;
    const clip = createMediaClip({
      assetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      kind: "video",
      durationMs: 1000,
    });
    const history = new HistoryStack();
    project = history.push(new AppendClipCommand(seq.id, v1.id, clip), project);
    seq = activeSequence(project)!;
    project = history.push(
      new DuplicateClipsCommand(seq.id, [clip.id], 1000),
      project,
    );
    seq = activeSequence(project)!;
    expect(seq.tracks.flatMap((t) => t.clips).length).toBeGreaterThanOrEqual(2);

    const ids = seq.tracks.flatMap((t) => t.clips.map((c) => c.id));
    if (v2.id !== v1.id) {
      project = history.push(
        new MoveClipsToTrackCommand(seq.id, [ids[0]!], v2.id, 0, false),
        project,
      );
      seq = activeSequence(project)!;
      expect(seq.tracks.find((t) => t.id === v2.id)!.clips.length).toBeGreaterThan(0);
    }
  });

  it("RemoveMarkerCommand removes marker", () => {
    let project = doc();
    let seq = ensureEditorTracks(activeSequence(project)!);
    const history = new HistoryStack();
    project = history.push(
      new AddMarkerCommand(seq.id, { timeMs: 500, name: "M1" }),
      project,
    );
    seq = activeSequence(project)!;
    expect(seq.markers.length).toBe(1);
    const id = seq.markers[0]!.id;
    project = history.push(new RemoveMarkerCommand(seq.id, id), project);
    seq = activeSequence(project)!;
    expect(seq.markers.length).toBe(0);
  });

  it("RollEditCommand adjusts adjacent boundary", () => {
    let project = doc();
    let seq = ensureEditorTracks(activeSequence(project)!);
    const vTrack = seq.tracks.find((t) => t.type === "video")!;
    const a = createMediaClip({
      assetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      kind: "video",
      durationMs: 2000,
    });
    a.timelineStartMs = 0;
    a.timelineEndMs = 2000;
    const b = createMediaClip({
      assetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      kind: "video",
      durationMs: 2000,
    });
    b.timelineStartMs = 2000;
    b.timelineEndMs = 4000;
    const history = new HistoryStack();
    project = history.push(new AppendClipCommand(seq.id, vTrack.id, a), project);
    project = history.push(new AppendClipCommand(seq.id, vTrack.id, b), project);
    seq = activeSequence(project)!;
    project = history.push(
      new RollEditCommand(seq.id, a.id, b.id, 2500),
      project,
    );
    seq = activeSequence(project)!;
    const left = seq.tracks.flatMap((t) => t.clips).find((c) => c.id === a.id)!;
    const right = seq.tracks.flatMap((t) => t.clips).find((c) => c.id === b.id)!;
    expect(left.timelineEndMs).toBe(2500);
    expect(right.timelineStartMs).toBe(2500);
  });

  it("evaluateTransformProperty interpolates easing", () => {
    const v = evaluateTransformProperty(
      0,
      [
        {
          id: "a",
          timeMs: 0,
          value: 0,
          interpolation: "easeOut",
          inHandle: null,
          outHandle: null,
        },
        {
          id: "b",
          timeMs: 1000,
          value: 100,
          interpolation: "linear",
          inHandle: null,
          outHandle: null,
        },
      ],
      500,
    );
    expect(v).toBeGreaterThan(50);
  });
});

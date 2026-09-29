import { describe, expect, it } from "vitest";
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  DuplicateId,
  formatTimecode,
  framesToMs,
  loadProject,
  migrateProject,
  MigrationRegistry,
  MissingReference,
  msToFrames,
  parseTimecode,
  ProjectCorrupt,
  ProjectInvalid,
  saveProject,
  UnsupportedSchemaVersion,
  validateProject,
} from "./index.js";

const TS = "2026-09-29T06:00:00.000Z";
const TS2 = "2026-09-29T07:00:00.000Z";

function minimalProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Demo",
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    workspaceId: "550e8400-e29b-41d4-a716-446655440001",
    createdAt: TS,
    updatedAt: TS2,
    assets: [],
    bins: [],
    sequences: [
      {
        id: "550e8400-e29b-41d4-a716-4466554400aa",
        name: "Sequence 1",
        durationMs: 0,
        frameRate: 30,
        width: 1920,
        height: 1080,
        tracks: [],
      },
    ],
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
    ...overrides,
  };
}

describe("CURRENT_PROJECT_SCHEMA_VERSION", () => {
  it("is 3", () => {
    expect(CURRENT_PROJECT_SCHEMA_VERSION).toBe(3);
  });
});

describe("validateProject", () => {
  it("accepts a minimal valid project", () => {
    const doc = validateProject(minimalProject());
    expect(doc.name).toBe("Demo");
    expect(doc.schemaVersion).toBe(3);
    expect(doc.sequences.length).toBe(1);
  });

  it("rejects invalid shape as ProjectInvalid", () => {
    expect(() => validateProject(minimalProject({ name: "" }))).toThrow(
      ProjectInvalid,
    );
  });

  it("rejects unsupported schemaVersion without migrating", () => {
    expect(() =>
      validateProject(minimalProject({ schemaVersion: 99 })),
    ).toThrow(UnsupportedSchemaVersion);
  });

  it("rejects absolute / traversal asset paths", () => {
    expect(() =>
      validateProject(
        minimalProject({
          assets: [
            {
              id: "550e8400-e29b-41d4-a716-446655440010",
              kind: "image",
              name: "x",
              relativePath: "../etc/passwd",
              mimeType: null,
              byteSize: null,
              sourceAssetId: null,
              createdAt: TS,
              updatedAt: TS2,
            },
          ],
        }),
      ),
    ).toThrow(ProjectInvalid);
  });
});

describe("integrity", () => {
  it("detects duplicate asset ids", () => {
    const asset = {
      id: "550e8400-e29b-41d4-a716-446655440010",
      kind: "image" as const,
      name: "a",
      relativePath: "assets/a.png",
      mimeType: "image/png",
      byteSize: 10,
      sourceAssetId: null,
      createdAt: TS,
      updatedAt: TS2,
    };
    expect(() =>
      validateProject(minimalProject({ assets: [asset, { ...asset }] })),
    ).toThrow(DuplicateId);
  });

  it("detects missing sourceAssetId references", () => {
    expect(() =>
      validateProject(
        minimalProject({
          assets: [
            {
              id: "550e8400-e29b-41d4-a716-446655440010",
              kind: "image",
              name: "proxy",
              relativePath: "proxies/a.png",
              mimeType: null,
              byteSize: null,
              sourceAssetId: "550e8400-e29b-41d4-a716-446655440099",
              createdAt: TS,
              updatedAt: TS2,
            },
          ],
        }),
      ),
    ).toThrow(MissingReference);
  });

  it("detects invalid timestamp ordering", () => {
    expect(() =>
      validateProject(minimalProject({ createdAt: TS2, updatedAt: TS })),
    ).toThrow(ProjectInvalid);
  });
});

describe("loadProject / saveProject", () => {
  it("loads from object and JSON string", () => {
    const raw = minimalProject();
    expect(loadProject(raw).id).toBe(raw.id);
    expect(loadProject(JSON.stringify(raw)).name).toBe("Demo");
  });

  it("throws ProjectCorrupt on bad JSON", () => {
    expect(() => loadProject("{not-json")).toThrow(ProjectCorrupt);
    expect(() => loadProject(null)).toThrow(ProjectCorrupt);
    expect(() => loadProject([])).toThrow(ProjectCorrupt);
  });

  it("round-trips via saveProject", () => {
    const doc = loadProject(minimalProject());
    const json = saveProject(doc);
    const again = loadProject(json);
    expect(again.id).toBe(doc.id);
    expect(again.schemaVersion).toBe(3);
  });

  it("migrates v1 → v3", () => {
    const v1 = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Legacy",
      schemaVersion: 1,
      workspaceId: "550e8400-e29b-41d4-a716-446655440001",
      createdAt: TS,
      updatedAt: TS2,
      assets: [],
      timeline: { version: 1, tracks: [], durationMs: 0 },
      settings: {
        frameRate: 30,
        width: 1920,
        height: 1080,
        sampleRate: 48000,
        locale: "en-US",
      },
    };
    const doc = loadProject(v1);
    expect(doc.schemaVersion).toBe(3);
    expect(doc.sequences.length).toBeGreaterThanOrEqual(1);
    expect(doc.sequences[0].markers).toEqual([]);
  });

  it("migrates v2 → v3 preserving clips", () => {
    const assetId = "550e8400-e29b-41d4-a716-446655440010";
    const v2 = minimalProject({
      schemaVersion: 2,
      assets: [
        {
          id: assetId,
          kind: "video",
          name: "clip.mp4",
          relativePath: "media/imported/clip.mp4",
          mimeType: "video/mp4",
          byteSize: 100,
          sourceAssetId: null,
          createdAt: TS,
          updatedAt: TS2,
        },
      ],
      sequences: [
        {
          id: "550e8400-e29b-41d4-a716-4466554400aa",
          name: "Sequence 1",
          durationMs: 5000,
          frameRate: 30,
          width: 1920,
          height: 1080,
          tracks: [
            {
              id: "550e8400-e29b-41d4-a716-4466554400bb",
              type: "video",
              name: "V1",
              enabled: true,
              locked: false,
              muted: false,
              clips: [
                {
                  id: "550e8400-e29b-41d4-a716-4466554400cc",
                  assetId,
                  sourceInMs: 0,
                  sourceOutMs: 5000,
                  timelineStartMs: 0,
                  timelineEndMs: 5000,
                  linkedClipId: null,
                },
              ],
            },
          ],
        },
      ],
    });
    const doc = loadProject(v2);
    expect(doc.schemaVersion).toBe(3);
    const clip = doc.sequences[0].tracks[0].clips[0];
    expect(clip.speed).toBe(1);
    expect(clip.transform.opacity).toBe(1);
    expect(clip.keyframes).toEqual({});
  });

  it("rejects future schema versions without silent reinterpretation", () => {
    expect(() =>
      loadProject(minimalProject({ schemaVersion: 99 })),
    ).toThrow(UnsupportedSchemaVersion);
  });
});

describe("timecode", () => {
  it("converts frames and ms at common fps", () => {
    for (const fps of [24, 25, 30, 50, 60]) {
      expect(msToFrames(framesToMs(30, fps), fps)).toBe(30);
    }
  });

  it("formats and parses HH:MM:SS:FF", () => {
    const tc = formatTimecode(0, 30);
    expect(tc).toBe("00:00:00:00");
    expect(parseTimecode("00:00:01:00", 30)).toBe(1000);
  });
});

describe("migrateProject / MigrationRegistry", () => {
  it("no-ops when already at target", () => {
    const doc = migrateProject(minimalProject(), CURRENT_PROJECT_SCHEMA_VERSION);
    expect(doc.schemaVersion).toBe(3);
  });

  it("runs custom registry migrations", () => {
    const registry = new MigrationRegistry();
    registry.register({
      fromVersion: 0,
      toVersion: 1,
      migrate: (data) => {
        const next = { ...data };
        if (!next.timeline) {
          next.timeline = { version: 1, tracks: [], durationMs: 0 };
        }
        if (!next.settings) {
          next.settings = {
            frameRate: 30,
            width: 1920,
            height: 1080,
            sampleRate: 48000,
            locale: "en-US",
          };
        }
        return next;
      },
    });
    registry.register({
      fromVersion: 1,
      toVersion: 2,
      migrate: (data) => ({
        ...data,
        bins: [],
        sequences: [
          {
            id: "550e8400-e29b-41d4-a716-4466554400aa",
            name: "Sequence 1",
            durationMs: 0,
            frameRate: 30,
            width: 1920,
            height: 1080,
            tracks: [],
          },
        ],
        settings: {
          ...(data.settings as object),
          previewQuality: "balanced",
          proxyMode: "auto",
          defaultBackground: "#000000",
        },
      }),
    });
    registry.register({
      fromVersion: 2,
      toVersion: 3,
      migrate: (data) => ({
        ...data,
        sequences: ((data.sequences as unknown[]) ?? []).map((raw) => {
          const seq = (raw ?? {}) as Record<string, unknown>;
          return { sampleRate: 48000, backgroundColor: "#000000", markers: [], ...seq };
        }),
      }),
    });

    const v0 = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Legacy",
      schemaVersion: 0,
      workspaceId: "550e8400-e29b-41d4-a716-446655440001",
      createdAt: TS,
      updatedAt: TS2,
      assets: [],
    };

    const migrated = migrateProject(v0, 3, registry);
    expect(migrated.schemaVersion).toBe(3);
  });

  it("throws when migration path is missing", () => {
    const empty = new MigrationRegistry();
    expect(() =>
      migrateProject(minimalProject({ schemaVersion: 0 }), 1, empty),
    ).toThrow(UnsupportedSchemaVersion);
  });

  it("refuses downgrades", () => {
    const registry = new MigrationRegistry();
    expect(() => registry.migrate({ schemaVersion: 1 }, 1, 0)).toThrow(
      UnsupportedSchemaVersion,
    );
  });
});

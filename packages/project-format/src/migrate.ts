import { CURRENT_PROJECT_SCHEMA_VERSION } from "./version.js";
import { UnsupportedSchemaVersion } from "./errors.js";

export type MigrationFn = (
  data: Record<string, unknown>,
) => Record<string, unknown>;

export interface MigrationStep {
  fromVersion: number;
  toVersion: number;
  migrate: MigrationFn;
}

/**
 * Registry of sequential migrations.
 * Each step must bump schemaVersion by exactly +1.
 * No silent reinterpretation — unknown versions throw.
 */
export class MigrationRegistry {
  private readonly steps = new Map<number, MigrationStep>();

  register(step: MigrationStep): void {
    if (step.toVersion !== step.fromVersion + 1) {
      throw new Error(
        `Migration must advance by 1 (got ${step.fromVersion} → ${step.toVersion})`,
      );
    }
    if (this.steps.has(step.fromVersion)) {
      throw new Error(
        `Migration from version ${step.fromVersion} already registered`,
      );
    }
    this.steps.set(step.fromVersion, step);
  }

  hasPath(fromVersion: number, toVersion: number): boolean {
    if (fromVersion === toVersion) return true;
    if (fromVersion > toVersion) return false;
    let v = fromVersion;
    while (v < toVersion) {
      if (!this.steps.has(v)) return false;
      v += 1;
    }
    return true;
  }

  migrate(
    data: Record<string, unknown>,
    fromVersion: number,
    toVersion: number = CURRENT_PROJECT_SCHEMA_VERSION,
  ): Record<string, unknown> {
    if (fromVersion === toVersion) {
      return data;
    }
    if (fromVersion > toVersion) {
      throw new UnsupportedSchemaVersion(
        `Cannot downgrade project schema from v${fromVersion} to v${toVersion}`,
        { fromVersion, toVersion },
      );
    }
    if (!this.hasPath(fromVersion, toVersion)) {
      throw new UnsupportedSchemaVersion(
        `No migration path from v${fromVersion} to v${toVersion}`,
        { fromVersion, toVersion },
      );
    }

    let current = { ...data };
    let version = fromVersion;
    while (version < toVersion) {
      const step = this.steps.get(version);
      if (!step) {
        throw new UnsupportedSchemaVersion(
          `Missing migration step from v${version}`,
          { fromVersion: version, toVersion },
        );
      }
      current = step.migrate(current);
      current.schemaVersion = step.toVersion;
      version = step.toVersion;
    }
    return current;
  }
}

/** Shared registry — v1→v2 registered for Phase 3. */
export const defaultMigrationRegistry = new MigrationRegistry();

defaultMigrationRegistry.register({
  fromVersion: 1,
  toVersion: 2,
  migrate: (data) => {
    const next: Record<string, unknown> = { ...data };
    const settings = {
      frameRate: 30,
      width: 1920,
      height: 1080,
      sampleRate: 48000,
      locale: "en-US",
      previewQuality: "balanced",
      proxyMode: "auto",
      defaultBackground: "#000000",
      ...((data.settings as Record<string, unknown> | undefined) ?? {}),
    };
    next.settings = settings;

    const assetsIn = Array.isArray(data.assets) ? data.assets : [];
    next.assets = assetsIn.map((raw) => {
      const a = (raw ?? {}) as Record<string, unknown>;
      return {
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
        ...a,
      };
    });

    next.bins = Array.isArray(data.bins) ? data.bins : [];

    if (!Array.isArray(data.sequences) || data.sequences.length === 0) {
      const timeline = (data.timeline ?? {}) as Record<string, unknown>;
      next.sequences = [
        {
          id: cryptoRandomUuid(),
          name: "Sequence 1",
          durationMs: typeof timeline.durationMs === "number" ? timeline.durationMs : 0,
          frameRate: settings.frameRate,
          width: settings.width,
          height: settings.height,
          tracks: [],
        },
      ];
    } else {
      next.sequences = data.sequences;
    }

    next.lastSavedAt = data.lastSavedAt ?? null;
    next.appVersion = data.appVersion ?? null;
    next.lastRecoveredAt = data.lastRecoveredAt ?? null;
    return next;
  },
});

defaultMigrationRegistry.register({
  fromVersion: 2,
  toVersion: 3,
  migrate: (data) => {
    const next: Record<string, unknown> = { ...data };
    const sequencesIn = Array.isArray(data.sequences) ? data.sequences : [];
    next.sequences = sequencesIn.map((raw) => {
      const seq = (raw ?? {}) as Record<string, unknown>;
      const tracksIn = Array.isArray(seq.tracks) ? seq.tracks : [];
      return {
        sampleRate: 48000,
        backgroundColor: "#000000",
        markers: [],
        ...seq,
        tracks: tracksIn.map((tRaw) => {
          const track = (tRaw ?? {}) as Record<string, unknown>;
          const clipsIn = Array.isArray(track.clips) ? track.clips : [];
          return {
            solo: false,
            visible: true,
            height: 48,
            colorLabel: null,
            ...track,
            clips: clipsIn.map((cRaw) => {
              const clip = (cRaw ?? {}) as Record<string, unknown>;
              return {
                kind: "video",
                enabled: true,
                speed: 1,
                reverse: false,
                volume: 1,
                transform: {},
                linkedClipId: null,
                groupId: null,
                effects: [],
                transitionIn: null,
                transitionOut: null,
                text: null,
                shape: null,
                mask: {},
                blendMode: "normal",
                keyframes: {},
                label: null,
                ...clip,
                assetId: clip.assetId ?? null,
              };
            }),
          };
        }),
      };
    });
    return next;
  },
});

function cryptoRandomUuid(): string {
  // Prefer Web Crypto; Node 20+ has globalThis.crypto
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // Deterministic-enough fallback for constrained test envs
  return "00000000-0000-4000-8000-000000000099";
}

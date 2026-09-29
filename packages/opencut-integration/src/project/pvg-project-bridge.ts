import type { ProjectDocument, Sequence, Clip } from "@pvg/project-format";

/**
 * Phase 4.2 bridge: PVG ProjectDocument remains canonical on disk.
 * OpenCut editor state (when fully wired) maps through this layer.
 */
export interface EditorPersistenceSnapshot {
  schemaVersion: number;
  projectId: string;
  activeSequenceId: string | null;
  /** Reserved for OpenCut-compatible timeline blob when migration completes. */
  openCutTimelineState?: unknown;
}

export function snapshotFromPvgProject(
  project: ProjectDocument,
  activeSequenceId: string | null,
): EditorPersistenceSnapshot {
  return {
    schemaVersion: project.schemaVersion,
    projectId: project.id,
    activeSequenceId,
  };
}

export function findClipById(
  sequence: Sequence,
  clipId: string,
): { clip: Clip; trackId: string } | null {
  for (const track of sequence.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { clip, trackId: track.id };
  }
  return null;
}

/**
 * Phase 4 → 4.2: PVG project container stays canonical (sequences/clips/assets).
 * OpenCut-native timeline blob is optional metadata stored outside core schema until vNext.
 */
export function migrateProjectForOpenCutEditor(
  project: ProjectDocument,
): ProjectDocument {
  return project;
}

import type { ProjectDocument } from "./schema.js";
import { DuplicateId, MissingReference, ProjectInvalid } from "./errors.js";

function isValidTimestampOrder(createdAt: string, updatedAt: string): boolean {
  const c = Date.parse(createdAt);
  const u = Date.parse(updatedAt);
  if (Number.isNaN(c) || Number.isNaN(u)) return false;
  return u >= c;
}

/**
 * Integrity checks beyond Zod shape validation.
 * Throws typed errors — never silently reinterprets bad data.
 */
export function assertProjectIntegrity(doc: ProjectDocument): void {
  if (!isValidTimestampOrder(doc.createdAt, doc.updatedAt)) {
    throw new ProjectInvalid("Invalid project timestamps", {
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  const seen = new Set<string>();
  for (const asset of doc.assets) {
    if (seen.has(asset.id)) {
      throw new DuplicateId(`Duplicate asset id: ${asset.id}`, {
        id: asset.id,
        entity: "asset",
      });
    }
    seen.add(asset.id);

    if (!isValidTimestampOrder(asset.createdAt, asset.updatedAt)) {
      throw new ProjectInvalid(`Invalid asset timestamps for ${asset.id}`, {
        id: asset.id,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      });
    }
  }

  for (const asset of doc.assets) {
    if (asset.sourceAssetId !== null && !seen.has(asset.sourceAssetId)) {
      throw new MissingReference(
        `Asset ${asset.id} references missing sourceAssetId ${asset.sourceAssetId}`,
        {
          assetId: asset.id,
          sourceAssetId: asset.sourceAssetId,
        },
      );
    }
  }

  const binIds = new Set((doc.bins ?? []).map((b) => b.id));
  for (const bin of doc.bins ?? []) {
    if (bin.parentId !== null && !binIds.has(bin.parentId)) {
      throw new MissingReference(
        `Bin ${bin.id} references missing parentId ${bin.parentId}`,
        { binId: bin.id, parentId: bin.parentId },
      );
    }
  }

  const seqIds = new Set<string>();
  for (const seq of doc.sequences ?? []) {
    if (seqIds.has(seq.id)) {
      throw new DuplicateId(`Duplicate sequence id: ${seq.id}`, {
        id: seq.id,
        entity: "sequence",
      });
    }
    seqIds.add(seq.id);
    for (const track of seq.tracks) {
      for (const clip of track.clips) {
        if (clip.assetId !== null && !seen.has(clip.assetId)) {
          throw new MissingReference(
            `Clip ${clip.id} references missing assetId ${clip.assetId}`,
            { clipId: clip.id, assetId: clip.assetId },
          );
        }
        if (
          clip.sourceOutMs !== null &&
          clip.sourceOutMs < clip.sourceInMs
        ) {
          throw new ProjectInvalid(
            `Clip ${clip.id} has invalid source range`,
            { clipId: clip.id },
          );
        }
      }
    }
  }
}

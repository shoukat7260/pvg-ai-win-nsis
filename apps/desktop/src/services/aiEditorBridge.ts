import {
  buildAiContext,
  planToCommands,
  type AiPlan,
} from "@pvg/editor-core";
import type { ProjectDocument } from "@pvg/project-format";
import type { EditorCommand } from "@pvg/editor-core";

/**
 * Safe AI → editor command boundary (allowlisted tools only; no shell/eval).
 */
export function buildSafeAiEditorContext(args: {
  project: ProjectDocument;
  sequenceId: string;
  selectedClipIds: string[];
  playheadMs: number;
}) {
  return buildAiContext(
    args.project,
    args.sequenceId,
    args.selectedClipIds,
    args.playheadMs,
  );
}

export function aiPlanToEditorCommands(
  plan: AiPlan,
  sequenceId: string,
): EditorCommand[] {
  return planToCommands(sequenceId, plan);
}

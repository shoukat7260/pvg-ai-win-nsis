import type { Clip, ProjectDocument, TextStyle } from "@pvg/project-format";
import { EditorError } from "../errors.js";
import { newId } from "../ids.js";
import type { EditorCommand } from "../history.js";
import {
  AddKeyframeCommand,
  AddMarkerCommand,
  AppendClipCommand,
  DeleteClipsCommand,
  DuplicateClipsCommand,
  MoveClipsCommand,
  RippleDeleteCommand,
  SetSpeedCommand,
  SetTransformCommand,
  SetTransitionCommand,
  SplitClipCommand,
  TrimLeftCommand,
  TrimRightCommand,
} from "../commands/clipCommands.js";
import { defaultTransform } from "../types.js";
import {
  AiPlanSchema,
  AiToolCallSchema,
  DESTRUCTIVE_TOOLS,
  FORBIDDEN_AI_TOOLS,
  type AiPlan,
  type AiToolCall,
  type AiToolName,
} from "./schemas.js";

export interface AiEditorContext {
  projectName: string;
  sequenceId: string;
  sequenceName: string;
  selectedClipIds: string[];
  selectedClipSummaries: Array<{
    id: string;
    kind: string;
    durationMs: number;
    speed: number;
  }>;
  timelineDurationMs: number;
  trackSummary: Array<{ id: string; type: string; name: string; clipCount: number }>;
  playheadMs: number;
  availableOperations: AiToolName[];
}

/** Build safe context — never include paths, secrets, or credentials. */
export function buildAiContext(
  project: ProjectDocument,
  sequenceId: string,
  selectedClipIds: string[],
  playheadMs: number,
): AiEditorContext {
  const seq = project.sequences.find((s) => s.id === sequenceId);
  if (!seq) {
    throw new EditorError("SEQUENCE_NOT_FOUND", "No active sequence for AI context");
  }
  const summaries: AiEditorContext["selectedClipSummaries"] = [];
  for (const id of selectedClipIds) {
    for (const track of seq.tracks) {
      const clip = track.clips.find((c) => c.id === id);
      if (clip) {
        summaries.push({
          id: clip.id,
          kind: clip.kind,
          durationMs:
            (clip.timelineEndMs ?? clip.timelineStartMs) - clip.timelineStartMs,
          speed: clip.speed,
        });
      }
    }
  }
  return {
    projectName: project.name,
    sequenceId: seq.id,
    sequenceName: seq.name,
    selectedClipIds,
    selectedClipSummaries: summaries,
    timelineDurationMs: seq.durationMs,
    trackSummary: seq.tracks.map((t) => ({
      id: t.id,
      type: t.type,
      name: t.name,
      clipCount: t.clips.length,
    })),
    playheadMs,
    availableOperations: [
      "select_clip",
      "split_clip",
      "delete_clip",
      "ripple_delete_clip",
      "move_clip",
      "trim_clip",
      "set_speed",
      "set_opacity",
      "set_transform",
      "add_text",
      "add_transition",
      "add_marker",
      "duplicate_clip",
      "add_fade",
    ],
  };
}

export function parseAiToolCall(raw: unknown): AiToolCall {
  if (
    raw &&
    typeof raw === "object" &&
    "tool" in raw &&
    typeof (raw as { tool: unknown }).tool === "string" &&
    FORBIDDEN_AI_TOOLS.includes(
      (raw as { tool: string }).tool as (typeof FORBIDDEN_AI_TOOLS)[number],
    )
  ) {
    throw new EditorError("AI_TOOL_DENIED", "Tool is not permitted", {
      tool: (raw as { tool: string }).tool,
    });
  }
  const parsed = AiToolCallSchema.safeParse(raw);
  if (!parsed.success) {
    throw new EditorError("AI_SCHEMA_INVALID", "Invalid AI tool call", {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

export function parseAiPlan(raw: unknown): AiPlan {
  const parsed = AiPlanSchema.safeParse(raw);
  if (!parsed.success) {
    throw new EditorError("AI_SCHEMA_INVALID", "Invalid AI plan", {
      issues: parsed.error.issues,
    });
  }
  for (const step of parsed.data.steps) {
    parseAiToolCall(step);
  }
  return parsed.data;
}

export function isDestructivePlan(plan: AiPlan): boolean {
  return (
    plan.destructive ||
    plan.steps.some((s) => DESTRUCTIVE_TOOLS.has(s.tool as AiToolName))
  );
}

export function toolCallToCommands(
  sequenceId: string,
  call: AiToolCall,
): EditorCommand[] {
  switch (call.tool) {
    case "select_clip":
      return []; // selection is UI-only
    case "split_clip":
      return [new SplitClipCommand(sequenceId, call.args.clipId, call.args.atMs)];
    case "delete_clip":
      return [new DeleteClipsCommand(sequenceId, call.args.clipIds)];
    case "ripple_delete_clip":
      return [new RippleDeleteCommand(sequenceId, call.args.clipIds)];
    case "move_clip":
      return [
        new MoveClipsCommand(
          sequenceId,
          call.args.clipIds,
          call.args.deltaMs,
          true,
        ),
      ];
    case "trim_clip":
      return [
        call.args.side === "left"
          ? new TrimLeftCommand(sequenceId, call.args.clipId, call.args.timeMs)
          : new TrimRightCommand(sequenceId, call.args.clipId, call.args.timeMs),
      ];
    case "set_speed":
      return [
        new SetSpeedCommand(sequenceId, call.args.clipId, call.args.speed),
      ];
    case "set_opacity":
      return [
        new SetTransformCommand(sequenceId, call.args.clipId, {
          opacity: call.args.opacity,
        }),
      ];
    case "set_transform":
      return [
        new SetTransformCommand(sequenceId, call.args.clipId, {
          x: call.args.x,
          y: call.args.y,
          scaleX: call.args.scaleX,
          scaleY: call.args.scaleY,
          rotation: call.args.rotation,
        }),
      ];
    case "add_text": {
      const text: TextStyle = {
        content: call.args.content,
        fontFamily: "IBM Plex Sans",
        fontSize: 48,
        fontWeight: 600,
        fontStyle: "normal",
        align: "center",
        lineHeight: 1.2,
        letterSpacing: 0,
        color: "#FFFFFF",
        strokeColor: null,
        strokeWidth: 0,
        shadowColor: null,
        shadowBlur: 0,
        backgroundColor: null,
        padding: 0,
      };
      const clip: Clip = {
        id: newId(),
        assetId: null,
        kind: "text",
        sourceInMs: 0,
        sourceOutMs: call.args.durationMs,
        timelineStartMs: call.args.startMs,
        timelineEndMs: call.args.startMs + call.args.durationMs,
        enabled: true,
        speed: 1,
        reverse: false,
        volume: 1,
        transform: defaultTransform(),
        linkedClipId: null,
        groupId: null,
        effects: [],
        transitionIn: null,
        transitionOut: null,
        text,
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
        label: call.args.content.slice(0, 40),
      };
      return [new AppendClipCommand(sequenceId, call.args.trackId, clip)];
    }
    case "add_transition":
      return [
        new SetTransitionCommand(sequenceId, call.args.clipId, call.args.side, {
          id: newId(),
          type: call.args.type,
          durationMs: call.args.durationMs,
          params: {},
        }),
      ];
    case "add_marker":
      return [
        new AddMarkerCommand(sequenceId, {
          timeMs: call.args.timeMs,
          name: call.args.name,
          note: call.args.note ?? null,
        }),
      ];
    case "duplicate_clip":
      return [
        new DuplicateClipsCommand(
          sequenceId,
          call.args.clipIds,
          call.args.offsetMs,
        ),
      ];
    case "add_fade": {
      const path = "transform.opacity";
      const from = call.args.side === "in" ? 0 : 1;
      const to = call.args.side === "in" ? 1 : 0;
      return [
        new AddKeyframeCommand(sequenceId, call.args.clipId, path, {
          timeMs: call.args.side === "in" ? 0 : 0,
          value: from,
          interpolation: "easeOut",
        }),
        new AddKeyframeCommand(sequenceId, call.args.clipId, path, {
          timeMs: call.args.durationMs,
          value: to,
          interpolation: "linear",
        }),
        new SetTransitionCommand(sequenceId, call.args.clipId, call.args.side, {
          id: newId(),
          type: "fade",
          durationMs: call.args.durationMs,
          params: {},
        }),
      ];
    }
    default: {
      const _exhaustive: never = call;
      throw new EditorError("AI_TOOL_DENIED", `Unknown tool`, {
        tool: (_exhaustive as AiToolCall).tool,
      });
    }
  }
}

export function planToCommands(
  sequenceId: string,
  plan: AiPlan,
): EditorCommand[] {
  return plan.steps.flatMap((step) => toolCallToCommands(sequenceId, step));
}

/**
 * Heuristic local planner when no LLM provider is connected.
 * Only handles a few explicit natural-language patterns — never fakes LLM replies.
 */
export function tryLocalEditPlan(
  message: string,
  ctx: AiEditorContext,
): AiPlan | null {
  const text = message.trim().toLowerCase();
  const selected = ctx.selectedClipIds[0];

  const speedMatch = text.match(
    /(?:make|set).*(?:clip|selected)?\s*(?:to\s*)?([\d.]+)\s*x|([\d.]+)\s*x\s*(?:faster|speed)/i,
  );
  if ((text.includes("2x") || text.includes("2 x") || speedMatch) && selected) {
    let speed = 2;
    if (speedMatch) {
      speed = Number(speedMatch[1] || speedMatch[2] || 2);
    }
    if (text.includes("2x") || text.includes("twice") || text.includes("2 x")) {
      speed = 2;
    }
    if (!Number.isFinite(speed) || speed <= 0) return null;
    return {
      explanation: `Change the selected clip speed to ${speed}x.`,
      destructive: false,
      steps: [
        {
          tool: "set_speed",
          args: { clipId: selected, speed },
        },
      ],
    };
  }

  if (
    (text.includes("delete") || text.includes("remove")) &&
    text.includes("selected") &&
    selected
  ) {
    const ripple = text.includes("ripple");
    return {
      explanation: ripple
        ? "Ripple-delete the selected clip(s)."
        : "Delete the selected clip(s).",
      destructive: true,
      steps: [
        {
          tool: ripple ? "ripple_delete_clip" : "delete_clip",
          args: { clipIds: ctx.selectedClipIds },
        },
      ],
    };
  }

  if (text.includes("split") && selected) {
    return {
      explanation: `Split the selected clip at the playhead (${ctx.playheadMs} ms).`,
      destructive: false,
      steps: [
        {
          tool: "split_clip",
          args: { clipId: selected, atMs: ctx.playheadMs },
        },
      ],
    };
  }

  if (text.includes("fade") && selected) {
    const side = text.includes("out") ? "out" : "in";
    return {
      explanation: `Add a fade ${side} to the selected clip.`,
      destructive: false,
      steps: [
        {
          tool: "add_fade",
          args: { clipId: selected, side, durationMs: 500 },
        },
      ],
    };
  }

  if (text.includes("duplicate") && selected) {
    return {
      explanation: "Duplicate the selected clip(s).",
      destructive: false,
      steps: [
        {
          tool: "duplicate_clip",
          args: { clipIds: ctx.selectedClipIds, offsetMs: 0 },
        },
      ],
    };
  }

  if (text.includes("marker")) {
    return {
      explanation: "Add a marker at the playhead.",
      destructive: false,
      steps: [
        {
          tool: "add_marker",
          args: {
            timeMs: ctx.playheadMs,
            name: "Marker",
            note: undefined,
          },
        },
      ],
    };
  }

  return null;
}

import { z } from "zod";

/**
 * Allowlisted AI editor tools — never eval / shell / filesystem / secrets.
 * Future Phase 5/6 tools stay unavailable here.
 */
export const AI_TOOL_NAMES = [
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
] as const;

export type AiToolName = (typeof AI_TOOL_NAMES)[number];

export const AiToolCallSchema = z.discriminatedUnion("tool", [
  z.object({
    tool: z.literal("select_clip"),
    args: z.object({ clipIds: z.array(z.string().uuid()).min(1) }),
  }),
  z.object({
    tool: z.literal("split_clip"),
    args: z.object({
      clipId: z.string().uuid(),
      atMs: z.number().nonnegative(),
    }),
  }),
  z.object({
    tool: z.literal("delete_clip"),
    args: z.object({ clipIds: z.array(z.string().uuid()).min(1) }),
  }),
  z.object({
    tool: z.literal("ripple_delete_clip"),
    args: z.object({ clipIds: z.array(z.string().uuid()).min(1) }),
  }),
  z.object({
    tool: z.literal("move_clip"),
    args: z.object({
      clipIds: z.array(z.string().uuid()).min(1),
      deltaMs: z.number(),
    }),
  }),
  z.object({
    tool: z.literal("trim_clip"),
    args: z.object({
      clipId: z.string().uuid(),
      side: z.enum(["left", "right"]),
      timeMs: z.number().nonnegative(),
    }),
  }),
  z.object({
    tool: z.literal("set_speed"),
    args: z.object({
      clipId: z.string().uuid(),
      speed: z.number().positive().max(16),
    }),
  }),
  z.object({
    tool: z.literal("set_opacity"),
    args: z.object({
      clipId: z.string().uuid(),
      opacity: z.number().min(0).max(1),
    }),
  }),
  z.object({
    tool: z.literal("set_transform"),
    args: z.object({
      clipId: z.string().uuid(),
      x: z.number().optional(),
      y: z.number().optional(),
      scaleX: z.number().positive().optional(),
      scaleY: z.number().positive().optional(),
      rotation: z.number().optional(),
    }),
  }),
  z.object({
    tool: z.literal("add_text"),
    args: z.object({
      trackId: z.string().uuid(),
      content: z.string().min(1).max(5000),
      startMs: z.number().nonnegative(),
      durationMs: z.number().positive().default(3000),
    }),
  }),
  z.object({
    tool: z.literal("add_transition"),
    args: z.object({
      clipId: z.string().uuid(),
      side: z.enum(["in", "out"]),
      type: z.enum(["dissolve", "fade", "dip_to_color", "wipe"]),
      durationMs: z.number().positive().max(10000).default(500),
    }),
  }),
  z.object({
    tool: z.literal("add_marker"),
    args: z.object({
      timeMs: z.number().nonnegative(),
      name: z.string().min(1).max(200),
      note: z.string().max(2000).optional(),
    }),
  }),
  z.object({
    tool: z.literal("duplicate_clip"),
    args: z.object({
      clipIds: z.array(z.string().uuid()).min(1),
      offsetMs: z.number().default(0),
    }),
  }),
  z.object({
    tool: z.literal("add_fade"),
    args: z.object({
      clipId: z.string().uuid(),
      side: z.enum(["in", "out"]),
      durationMs: z.number().positive().max(10000).default(500),
    }),
  }),
]);

export type AiToolCall = z.infer<typeof AiToolCallSchema>;

export const AiPlanSchema = z.object({
  explanation: z.string().max(2000),
  steps: z.array(AiToolCallSchema).min(1).max(20),
  destructive: z.boolean().default(false),
});

export type AiPlan = z.infer<typeof AiPlanSchema>;

export const DESTRUCTIVE_TOOLS = new Set<AiToolName>([
  "delete_clip",
  "ripple_delete_clip",
]);

/** Forbidden tool names that must never be accepted. */
export const FORBIDDEN_AI_TOOLS = [
  "shell",
  "eval",
  "read_file",
  "write_file",
  "get_secret",
  "get_api_key",
  "execute_powershell",
  "generate_scene",
  "generate_voice",
] as const;

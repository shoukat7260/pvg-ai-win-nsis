import { z } from "zod";

export const createProjectInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(120, "Name is too long")
    .refine((v) => !v.includes("..") && !v.includes("/") && !v.includes("\\"), {
      message: "Name must not contain path characters",
    }),
  workspaceId: z.string().trim().min(1, "Workspace is required"),
  description: z.string().max(500).default(""),
});

export type CreateProjectFormValues = z.infer<typeof createProjectInputSchema>;

export const projectMetadataSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  path: z.string(),
  workspaceId: z.string(),
  schemaVersion: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  description: z.string(),
});

export type ProjectLoadStage =
  | "resolve_path"
  | "read_project"
  | "validate_format"
  | "migrate"
  | "resolve_media"
  | "create_editor_state"
  | "mount_editor";

export type ProjectLoadCode =
  | "missing"
  | "inaccessible"
  | "corrupted"
  | "incompatible"
  | "migration_failed"
  | "media_missing"
  | "unexpected";

export interface ProjectLoadFailure {
  code: ProjectLoadCode;
  stage: ProjectLoadStage;
  userMessage: string;
  technicalMessage: string;
}

/** Map thrown errors from openDocument / IPC into safe user + diagnostic codes. */
export function classifyProjectLoadError(err: unknown): ProjectLoadFailure {
  const technicalMessage =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Unknown project load failure";
  const m = technicalMessage.toLowerCase();

  if (/not found|no such file|missing path|does not exist/i.test(m)) {
    return {
      code: "missing",
      stage: "resolve_path",
      userMessage: "This project could not be found on disk.",
      technicalMessage,
    };
  }
  if (/permission|access denied|inaccessible|denied/i.test(m)) {
    return {
      code: "inaccessible",
      stage: "resolve_path",
      userMessage: "This project is inaccessible. Check folder permissions.",
      technicalMessage,
    };
  }
  if (/corrupt|json|parse|unexpected token|invalid project/i.test(m)) {
    return {
      code: "corrupted",
      stage: "validate_format",
      userMessage: "This project file appears corrupted and cannot be opened.",
      technicalMessage,
    };
  }
  if (/schema|incompatible|unsupported version/i.test(m)) {
    return {
      code: "incompatible",
      stage: "validate_format",
      userMessage: "This project version is not compatible with this build.",
      technicalMessage,
    };
  }
  if (/migrat/i.test(m)) {
    return {
      code: "migration_failed",
      stage: "migrate",
      userMessage: "Project migration failed. The file was not modified.",
      technicalMessage,
    };
  }
  if (/media|asset.*missing|relink/i.test(m)) {
    return {
      code: "media_missing",
      stage: "resolve_media",
      userMessage:
        "Some media is missing. The project can still open after you relink files.",
      technicalMessage,
    };
  }
  if (/no sequences|sequence/i.test(m)) {
    return {
      code: "corrupted",
      stage: "create_editor_state",
      userMessage: "This project has no editable sequence.",
      technicalMessage,
    };
  }

  return {
    code: "unexpected",
    stage: "mount_editor",
    userMessage: "The project could not be opened due to an unexpected error.",
    technicalMessage,
  };
}

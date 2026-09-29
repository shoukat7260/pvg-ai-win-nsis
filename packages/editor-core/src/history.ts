import type { ProjectDocument } from "@pvg/project-format";
import { EditorError } from "./errors.js";

export interface EditorCommand {
  readonly id: string;
  readonly label: string;
  readonly timestamp: number;
  execute(project: ProjectDocument): ProjectDocument;
  undo(project: ProjectDocument): ProjectDocument;
}

/**
 * Command history — stores inverse-capable commands.
 * Drag coalescing: use beginTransaction/commitTransaction for multi-step gestures.
 */
export class HistoryStack {
  private undoStack: EditorCommand[] = [];
  private redoStack: EditorCommand[] = [];
  private openTxn: EditorCommand[] | null = null;
  private readonly maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoLabels(): string[] {
    return this.undoStack.map((c) => c.label).reverse();
  }

  beginTransaction(): void {
    if (this.openTxn) {
      throw new EditorError("EDIT_OPERATION_FAILED", "Transaction already open");
    }
    this.openTxn = [];
  }

  push(command: EditorCommand, project: ProjectDocument): ProjectDocument {
    const next = command.execute(project);
    if (this.openTxn) {
      this.openTxn.push(command);
      return next;
    }
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    return next;
  }

  commitTransaction(label: string): void {
    if (!this.openTxn) {
      throw new EditorError("EDIT_OPERATION_FAILED", "No open transaction");
    }
    const cmds = this.openTxn;
    this.openTxn = null;
    if (cmds.length === 0) return;
    if (cmds.length === 1) {
      this.undoStack.push(cmds[0]!);
    } else {
      this.undoStack.push(new CompositeCommand(label, cmds));
    }
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  cancelTransaction(project: ProjectDocument): ProjectDocument {
    if (!this.openTxn) return project;
    let current = project;
    for (let i = this.openTxn.length - 1; i >= 0; i--) {
      current = this.openTxn[i]!.undo(current);
    }
    this.openTxn = null;
    return current;
  }

  undo(project: ProjectDocument): ProjectDocument {
    if (this.openTxn) {
      throw new EditorError("UNDO_FAILED", "Finish transaction before undo");
    }
    const cmd = this.undoStack.pop();
    if (!cmd) {
      throw new EditorError("UNDO_FAILED", "Nothing to undo");
    }
    try {
      const next = cmd.undo(project);
      this.redoStack.push(cmd);
      return next;
    } catch (e) {
      this.undoStack.push(cmd);
      throw new EditorError("UNDO_FAILED", "Undo failed; state preserved", {
        cause: String(e),
      });
    }
  }

  redo(project: ProjectDocument): ProjectDocument {
    if (this.openTxn) {
      throw new EditorError("REDO_FAILED", "Finish transaction before redo");
    }
    const cmd = this.redoStack.pop();
    if (!cmd) {
      throw new EditorError("REDO_FAILED", "Nothing to redo");
    }
    try {
      const next = cmd.execute(project);
      this.undoStack.push(cmd);
      return next;
    } catch (e) {
      this.redoStack.push(cmd);
      throw new EditorError("REDO_FAILED", "Redo failed; state preserved", {
        cause: String(e),
      });
    }
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.openTxn = null;
  }
}

class CompositeCommand implements EditorCommand {
  readonly id: string;
  readonly label: string;
  readonly timestamp: number;
  private readonly cmds: EditorCommand[];

  constructor(label: string, cmds: EditorCommand[]) {
    this.id = `composite-${Date.now()}`;
    this.label = label;
    this.timestamp = Date.now();
    this.cmds = cmds;
  }

  execute(project: ProjectDocument): ProjectDocument {
    let current = project;
    for (const c of this.cmds) {
      current = c.execute(current);
    }
    return current;
  }

  undo(project: ProjectDocument): ProjectDocument {
    let current = project;
    for (let i = this.cmds.length - 1; i >= 0; i--) {
      current = this.cmds[i]!.undo(current);
    }
    return current;
  }
}

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExportModal } from "@/features/editor/ExportModal";
import { useEditorStore } from "@/state/editorStore";

describe("Phase 4.2B export UI", () => {
  it("shows export modal with run control", () => {
    // Ensure store has no project — modal still renders controls
    useEditorStore.getState().closeDocument();
    render(<ExportModal onClose={() => undefined} />);
    expect(screen.getByTestId("export-modal")).toBeInTheDocument();
    expect(screen.getByTestId("export-run")).toBeInTheDocument();
  });
});

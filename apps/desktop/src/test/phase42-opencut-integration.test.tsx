import { describe, expect, it } from "vitest";
import { OPENCUT_PINNED_COMMIT } from "@pvg/opencut-integration";
import { render, screen } from "@testing-library/react";
import { OpenCutEditorShell } from "@/features/editor/opencut/OpenCutEditorShell";

describe("Phase 4.2 OpenCut integration", () => {
  it("records pinned OpenCut commit", () => {
    expect(OPENCUT_PINNED_COMMIT).toHaveLength(40);
  });

  it("initializes editor shell", async () => {
    render(
      <OpenCutEditorShell>
        <div data-testid="child">ok</div>
      </OpenCutEditorShell>,
    );
    expect(await screen.findByTestId("opencut-editor-shell")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});

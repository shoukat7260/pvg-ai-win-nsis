import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PvgInput } from "@/components/ui/PvgInput";
import "@/styles/editor-tokens.css";
import "@/styles/pvg-inputs.css";

describe("Phase 4.2 input contrast contract", () => {
  it("dark input keeps explicit readable text color", async () => {
    const user = userEvent.setup();
    render(
      <PvgInput
        data-testid="dark-input"
        surface="dark"
        placeholder="Search…"
        defaultValue=""
      />,
    );
    const input = screen.getByTestId("dark-input") as HTMLInputElement;
    await user.type(input, "PVG TEST");
    expect(input.value).toBe("PVG TEST");
    const styles = getComputedStyle(input);
    // Must not inherit black/near-black from light AppShell
    expect(styles.color).not.toMatch(/^(rgb\(10,\s*10,\s*10\)|#0a0a0a)$/i);
    expect(input.className).toContain("pvg-input");
  });

  it("light surface input uses dark text for Settings", async () => {
    const user = userEvent.setup();
    render(
      <div style={{ color: "#0a0a0a", background: "#f7f7f5" }}>
        <PvgInput
          data-testid="light-input"
          surface="light"
          defaultValue=""
        />
      </div>,
    );
    const input = screen.getByTestId("light-input") as HTMLInputElement;
    await user.type(input, "PVG TEST");
    expect(input.value).toBe("PVG TEST");
    expect(input.className).toContain("pvg-input--light");
  });
});

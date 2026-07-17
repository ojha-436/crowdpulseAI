import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AlertBanner from "../components/AlertBanner.jsx";

describe("AlertBanner", () => {
  it("renders a critical alert inside an assertive live region", () => {
    render(
      <AlertBanner alerts={[{ id: 1, severity: "critical", message: "North Stand overcrowded" }]} />
    );
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("North Stand overcrowded");
    // Critical alerts must be announced immediately to assistive tech.
    expect(banner).toHaveAttribute("aria-live", "assertive");
  });

  it("renders nothing when no alert is critical", () => {
    const { container } = render(
      <AlertBanner alerts={[{ id: 2, severity: "low", message: "routine" }]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when alerts is missing", () => {
    const { container } = render(<AlertBanner alerts={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

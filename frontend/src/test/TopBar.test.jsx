import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TopBar from "../components/TopBar.jsx";

const baseState = {
  name: "MetLife Stadium — New York/New Jersey",
  matchStatus: "break",
  weatherCondition: "clear",
  temperature: 24.5,
  humidity: 55,
};

describe("TopBar", () => {
  it("shows the football-facing label for a match-status value", () => {
    render(<TopBar state={baseState} onOpenAI={() => {}} />);
    // The 'break' status must surface as the football term 'Half-Time'.
    expect(screen.getByRole("button", { name: /Half-Time/i })).toBeInTheDocument();
  });

  it("exposes the AI Command panel trigger", () => {
    render(<TopBar state={baseState} onOpenAI={() => {}} />);
    expect(screen.getByRole("button", { name: /Open AI Command panel/i })).toBeInTheDocument();
  });

  it("renders nothing without state", () => {
    const { container } = render(<TopBar state={null} onOpenAI={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

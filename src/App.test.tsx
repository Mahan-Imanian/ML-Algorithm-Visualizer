import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import App from "./App";

afterEach(cleanup);

describe("App", () => {
  it("renders the shell and the default algorithm", () => {
    render(<App />);
    expect(screen.getByText("Algoscope")).toBeInTheDocument();
    expect(screen.getAllByText("Breadth-first search").length).toBeGreaterThan(0);
    expect(screen.getByText(/No trace/)).toBeInTheDocument();
  });

  it("builds a trace when Run is pressed", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByText(/\d+ events/)).toBeInTheDocument();
  });

  it("switches algorithm family", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Sorting" }));
    expect(screen.getAllByText("Insertion sort").length).toBeGreaterThan(0);
  });
});

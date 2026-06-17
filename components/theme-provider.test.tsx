import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ThemeProvider from "./theme-provider";

describe("ThemeProvider", () => {
  it("does not render script tags inside the React tree", () => {
    const html = renderToString(
      <ThemeProvider>
        <main>content</main>
      </ThemeProvider>,
    );

    expect(html).not.toContain("<script");
  });
});

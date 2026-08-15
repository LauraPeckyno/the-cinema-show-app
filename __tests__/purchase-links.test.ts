import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tracksSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/tracks.tsx"),
  "utf8",
);

describe("Track Selection purchase links", () => {
  it("places a separated Buy the Album section after the film strips", () => {
    expect(tracksSource).toContain("Buy the Album");
    expect(tracksSource).toContain("styles.buySeparator");
    expect(tracksSource.indexOf("styles.buyAlbumSection")).toBeGreaterThan(
      tracksSource.indexOf("styles.stripsContainer"),
    );
  });

  it("opens each requested outlet through branded visual links", () => {
    expect(tracksSource).toContain("https://www.amazon.com/music/player/artists/B001VIHWT2/robert-peckyno");
    expect(tracksSource).toContain("https://music.apple.com/us/artist/robert-peckyno/418366396");
    expect(tracksSource).toContain("https://streamingkeys.bandcamp.com/");
    expect(tracksSource).toContain("https://open.spotify.com/artist/2EdIHh3lgB1v2DI6h48P5g");
    expect(tracksSource).toContain('icon: "spotify" as const');
    expect(tracksSource).toContain("FontAwesome");
    expect(tracksSource).toContain("Linking.openURL(outlet.url)");
  });

  it("groups the links into the requested two-row ordering", () => {
    expect(tracksSource).toContain("const PURCHASE_OUTLET_ROWS");
    const firstRow = tracksSource.slice(
      tracksSource.indexOf("const PURCHASE_OUTLET_ROWS"),
      tracksSource.indexOf("  ],\n  [", tracksSource.indexOf("const PURCHASE_OUTLET_ROWS")),
    );
    const secondRow = tracksSource.slice(
      tracksSource.indexOf("  ],\n  [", tracksSource.indexOf("const PURCHASE_OUTLET_ROWS")),
      tracksSource.indexOf("] as const;", tracksSource.indexOf("const PURCHASE_OUTLET_ROWS")),
    );
    expect(firstRow.indexOf('label: "Bandcamp"')).toBeLessThan(firstRow.indexOf('label: "Spotify"'));
    expect(secondRow.indexOf('label: "Amazon"')).toBeLessThan(secondRow.indexOf('label: "Apple Music"'));
    expect(tracksSource).toContain("styles.outletRows");
  });
});

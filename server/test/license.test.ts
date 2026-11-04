import { describe, expect, it } from "vitest";
import { licenseFamily } from "../src/lib/license.js";

describe("licenseFamily", () => {
  it("classifies GPL licenses", () => {
    expect(licenseFamily("GPL-2.0")).toBe("GPL family");
    expect(licenseFamily("GPL-3.0")).toBe("GPL family");
    expect(licenseFamily("AGPL-3.0")).toBe("GPL family");
  });

  it("classifies MIT licenses", () => {
    expect(licenseFamily("MIT")).toBe("MIT");
    expect(licenseFamily("MIT / Apache-2.0")).toBe("MIT");
  });

  it("classifies Apache licenses", () => {
    expect(licenseFamily("Apache-2.0")).toBe("Apache-2.0");
    expect(licenseFamily("Apache-2.0 + LLVM exception")).toBe("Apache-2.0");
  });

  it("classifies BSD licenses", () => {
    expect(licenseFamily("BSD-2-Clause")).toBe("BSD family");
    expect(licenseFamily("BSD-3-Clause")).toBe("BSD family");
    expect(licenseFamily("Ruby / BSD-2-Clause")).toBe("BSD family");
  });

  it("classifies MPL licenses", () => {
    expect(licenseFamily("MPL-2.0")).toBe("MPL-2.0");
  });

  it("falls back to Other", () => {
    expect(licenseFamily("PostgreSQL")).toBe("Other");
    expect(licenseFamily("Public domain")).toBe("Other");
    expect(licenseFamily("DFSG mix")).toBe("Other");
  });

  it("applies rules in priority order: GPL before MIT/Apache/BSD/MPL", () => {
    expect(licenseFamily("GPL-2.0 with MIT parts")).toBe("GPL family");
    expect(licenseFamily("Apache-2.0 GPL-compatible")).toBe("GPL family");
  });

  it("MIT only matches when license starts with MIT", () => {
    expect(licenseFamily("curl (MIT-style)")).toBe("Other");
  });
});

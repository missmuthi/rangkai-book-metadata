/**
 * Tests for Cutter-Sanborn call number generation
 */

import { describe, it, expect } from "vitest";
import {
  getCutterNumber,
  generateCallNumber,
  getPatternDescription,
} from "../cutter";

describe("Cutter-Sanborn Number Generation", () => {
  describe("getCutterNumber - Basic Functionality", () => {
    it("generates Cutter number for simple surnames", () => {
      expect(getCutterNumber("Smith")).toMatch(/^S\d{2,3}$/);
      expect(getCutterNumber("Jones")).toMatch(/^J\d{2,3}$/);
      expect(getCutterNumber("Brown")).toMatch(/^B\d{2,3}$/);
    });

    it('handles "Last, First" format correctly', () => {
      const cutter = getCutterNumber("Rowling, J.K.");
      expect(cutter).toMatch(/^R\d{2,3}$/);
      expect(cutter.charAt(0)).toBe("R");
    });

    it("handles names with spaces (extracts last name)", () => {
      const cutter = getCutterNumber("John Ronald Reuel Tolkien");
      expect(cutter).toMatch(/^T\d{2,3}$/);
      expect(cutter.charAt(0)).toBe("T");
    });

    it("removes punctuation from surnames", () => {
      const cutter1 = getCutterNumber("O'Brien");
      const cutter2 = getCutterNumber("O-Brien");
      expect(cutter1).toMatch(/^O\d{2,3}$/);
      expect(cutter2).toMatch(/^O\d{2,3}$/);
    });

    it("handles empty or invalid input", () => {
      expect(getCutterNumber("")).toBe("");
      expect(getCutterNumber("-")).toBe("");
      expect(getCutterNumber("   ")).toBe("");
    });

    it("is case-insensitive", () => {
      const cutter1 = getCutterNumber("rowling");
      const cutter2 = getCutterNumber("ROWLING");
      const cutter3 = getCutterNumber("Rowling");

      expect(cutter1).toBe(cutter2);
      expect(cutter2).toBe(cutter3);
    });
  });

  describe("getCutterNumber - Known Author Examples", () => {
    // These tests verify that the algorithm generates consistent,
    // properly formatted Cutter numbers in reasonable ranges

    it("generates Cutter number for Rowling", () => {
      const cutter = getCutterNumber("Rowling");
      expect(cutter).toBe("R150"); // R + number in Ro range
    });

    it("generates Cutter number for Shakespeare", () => {
      const cutter = getCutterNumber("Shakespeare");
      expect(cutter).toBe("S126"); // S + number in Sh range
    });

    it("generates Cutter number for King", () => {
      const cutter = getCutterNumber("King");
      expect(cutter).toBe("K132"); // K + number in Ki range
    });

    it("generates Cutter number for Tolkien", () => {
      const cutter = getCutterNumber("Tolkien");
      expect(cutter).toBe("T149"); // T + number in To range
    });

    it("generates Cutter number for Christie", () => {
      const cutter = getCutterNumber("Christie");
      expect(cutter).toBe("C80"); // C + number in Ch range
    });

    it("generates Cutter number for Austen", () => {
      const cutter = getCutterNumber("Austen");
      expect(cutter).toBe("A15"); // A + number in Au range
    });

    it("handles surnames starting with Mc/Mac", () => {
      const cutterMc = getCutterNumber("McDonald");
      const cutterMa = getCutterNumber("Martin");

      // Both should be in M range but McDonald comes before Martin
      expect(cutterMc.charAt(0)).toBe("M");
      expect(cutterMa.charAt(0)).toBe("M");
    });

    it("handles very common surnames", () => {
      const cutters = [
        getCutterNumber("Smith"),
        getCutterNumber("Johnson"),
        getCutterNumber("Williams"),
        getCutterNumber("Brown"),
        getCutterNumber("Jones"),
      ];

      // All should have proper format
      cutters.forEach((cutter) => {
        expect(cutter).toMatch(/^[A-Z]\d{2,3}$/);
      });
    });
  });

  describe("getCutterNumber - Edge Cases", () => {
    it("handles single-letter surnames", () => {
      const cutter = getCutterNumber("X");
      expect(cutter).toMatch(/^X\d{2,3}$/);
    });

    it("handles very long surnames", () => {
      const cutter = getCutterNumber("Wolfeschlegelsteinhausenbergerdorff");
      expect(cutter).toMatch(/^W\d{2,3}$/);
    });

    it("handles surnames with accents (normalized)", () => {
      const cutter = getCutterNumber("García");
      expect(cutter).toMatch(/^G\d{2,3}$/);
    });

    it("handles hyphenated surnames", () => {
      const cutter = getCutterNumber("Smith-Jones");
      expect(cutter).toMatch(/^S\d{2,3}$/);
    });

    it("handles compound surnames with spaces", () => {
      const cutter = getCutterNumber("Van Der Waals");
      expect(cutter).toMatch(/^W\d{2,3}$/); // Takes last part
    });
  });

  describe("getCutterNumber - Consistency", () => {
    it("generates consistent numbers for the same author", () => {
      const results = Array(10)
        .fill(null)
        .map(() => getCutterNumber("Rowling"));
      const unique = new Set(results);
      expect(unique.size).toBe(1); // All should be the same
    });

    it("generates different numbers for different authors", () => {
      const cutter1 = getCutterNumber("Rowling");
      const cutter2 = getCutterNumber("Tolkien");
      expect(cutter1).not.toBe(cutter2);
    });

    it("maintains alphabetical ordering within same first letter", () => {
      const cutterA = getCutterNumber("Smith");
      const cutterB = getCutterNumber("Snyder");

      // Both start with S
      expect(cutterA.charAt(0)).toBe("S");
      expect(cutterB.charAt(0)).toBe("S");

      // Snyder should have a higher number than Smith (comes later alphabetically)
      const numA = parseInt(cutterA.substring(1));
      const numB = parseInt(cutterB.substring(1));
      expect(numB).toBeGreaterThan(numA);
    });
  });
});

describe("Call Number Pattern Generation", () => {
  const testData = {
    ddc: "823",
    lcc: "PR6068",
    author: "Rowling, J.K.",
    title: "Harry Potter",
    year: "1997",
  };

  describe("generateCallNumber - DDC Patterns", () => {
    it("generates DDC + Cutter + Title pattern", () => {
      const callNumber = generateCallNumber(
        "ddc-cutter-title",
        testData.ddc,
        testData.author,
        testData.title,
        testData.year,
      );

      expect(callNumber).toMatch(/^823 R\d{2,3} h$/);
    });

    it("generates DDC + Cutter pattern (no title)", () => {
      const callNumber = generateCallNumber(
        "ddc-cutter",
        testData.ddc,
        testData.author,
        testData.title,
        testData.year,
      );

      expect(callNumber).toMatch(/^823 R\d{2,3}$/);
    });
  });

  describe("generateCallNumber - LCC Patterns", () => {
    it("generates LCC + Cutter + Year pattern", () => {
      const callNumber = generateCallNumber(
        "lcc-cutter-year",
        testData.lcc,
        testData.author,
        testData.title,
        testData.year,
      );

      expect(callNumber).toMatch(/^PR6068 R\d{2,3} 1997$/);
    });

    it("generates LCC + Cutter pattern without year", () => {
      const callNumber = generateCallNumber(
        "lcc-cutter",
        testData.lcc,
        testData.author,
        testData.title,
      );

      expect(callNumber).toMatch(/^PR6068 R\d{2,3}$/);
    });

    it("handles LCC + Cutter + Year when year is missing", () => {
      const callNumber = generateCallNumber(
        "lcc-cutter-year",
        testData.lcc,
        testData.author,
        testData.title,
      );

      // Should fall back to LCC + Cutter without year
      expect(callNumber).toMatch(/^PR6068 R\d{2,3}$/);
    });
  });

  describe("generateCallNumber - Cutter Only", () => {
    it("generates Cutter number only", () => {
      const callNumber = generateCallNumber(
        "cutter-only",
        testData.ddc,
        testData.author,
        testData.title,
        testData.year,
      );

      expect(callNumber).toMatch(/^R\d{2,3}$/);
    });
  });

  describe("generateCallNumber - Title Initial Handling", () => {
    it("uses lowercase title initial", () => {
      const callNumber = generateCallNumber(
        "ddc-cutter-title",
        "823",
        "Smith, John",
        "The Great Adventure",
        "2020",
      );

      expect(callNumber).toMatch(/^823 S\d{2,3} t$/); // 't' from 'The'
    });

    it("handles titles with articles", () => {
      const testCases = [
        { title: "The Book", expectedInitial: "t" },
        { title: "A Story", expectedInitial: "a" },
        { title: "An Epic", expectedInitial: "a" },
      ];

      testCases.forEach(({ title, expectedInitial }) => {
        const callNumber = generateCallNumber(
          "ddc-cutter-title",
          "800",
          "Author, Test",
          title,
        );

        expect(callNumber).toMatch(
          new RegExp(`^800 A\\d{2,3} ${expectedInitial}$`),
        );
      });
    });

    it("handles empty title gracefully", () => {
      const callNumber = generateCallNumber(
        "ddc-cutter-title",
        "800",
        "Author, Test",
        "",
      );

      // Should still generate DDC + Cutter, just no title initial
      expect(callNumber).toMatch(/^800 A\d{2,3}$/);
    });
  });

  describe("generateCallNumber - Real-world Examples", () => {
    it('generates call number for "To Kill a Mockingbird"', () => {
      const callNumber = generateCallNumber(
        "ddc-cutter-title",
        "813.54",
        "Lee, Harper",
        "To Kill a Mockingbird",
        "1960",
      );

      expect(callNumber).toMatch(/^813\.54 L\d{2,3} t$/);
    });

    it('generates call number for "1984" by Orwell', () => {
      const callNumber = generateCallNumber(
        "ddc-cutter-title",
        "823.912",
        "Orwell, George",
        "1984",
        "1949",
      );

      expect(callNumber).toMatch(/^823\.912 O\d{2,3} 1$/);
    });

    it('generates call number for "Introduction to Algorithms"', () => {
      const callNumber = generateCallNumber(
        "ddc-cutter-title",
        "005.1",
        "Cormen, Thomas H.",
        "Introduction to Algorithms",
        "2009",
      );

      expect(callNumber).toMatch(/^005\.1 C\d{2,3} i$/);
    });
  });
});

describe("Pattern Descriptions", () => {
  it("provides description for ddc-cutter-title", () => {
    const desc = getPatternDescription("ddc-cutter-title");
    expect(desc).toContain("DDC");
    expect(desc).toContain("Cutter");
    expect(desc).toContain("Title");
  });

  it("provides description for lcc-cutter-year", () => {
    const desc = getPatternDescription("lcc-cutter-year");
    expect(desc).toContain("LCC");
    expect(desc).toContain("Year");
  });

  it("provides descriptions for all patterns", () => {
    const patterns: Array<
      | "ddc-cutter-title"
      | "lcc-cutter-year"
      | "ddc-cutter"
      | "lcc-cutter"
      | "cutter-only"
    > = [
      "ddc-cutter-title",
      "lcc-cutter-year",
      "ddc-cutter",
      "lcc-cutter",
      "cutter-only",
    ];

    patterns.forEach((pattern) => {
      const desc = getPatternDescription(pattern);
      expect(desc.length).toBeGreaterThan(0);
      expect(desc).not.toBe("Unknown pattern");
    });
  });
});

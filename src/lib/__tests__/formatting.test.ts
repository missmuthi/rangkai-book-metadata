import { describe, it, expect } from "vitest";
import { mapLangCode, formatAuthorName, formatEdition } from "../merge";

describe("Language Code Mapping", () => {
  it("maps ISO 639-1 codes correctly", () => {
    expect(mapLangCode("en")).toBe("English");
    expect(mapLangCode("id")).toBe("Bahasa Indonesia");
    expect(mapLangCode("es")).toBe("Spanish");
    expect(mapLangCode("fr")).toBe("French");
  });

  it("maps ISO 639-2 codes correctly", () => {
    expect(mapLangCode("eng")).toBe("English");
    expect(mapLangCode("ind")).toBe("Bahasa Indonesia");
    expect(mapLangCode("spa")).toBe("Spanish");
    expect(mapLangCode("fra")).toBe("French");
  });

  it("handles case insensitivity", () => {
    expect(mapLangCode("EN")).toBe("English");
    expect(mapLangCode("En")).toBe("English");
    expect(mapLangCode("ID")).toBe("Bahasa Indonesia");
  });

  it("handles locale variants", () => {
    expect(mapLangCode("en-US")).toBe("English");
    expect(mapLangCode("en-GB")).toBe("English");
  });

  it("returns uppercase code for unknown languages", () => {
    expect(mapLangCode("xyz")).toBe("XYZ");
    expect(mapLangCode("unknown")).toBe("UNKNOWN");
  });

  it("handles empty or invalid input", () => {
    expect(mapLangCode("")).toBe("-");
    expect(mapLangCode("-")).toBe("-");
  });
});

describe("Author Name Formatting", () => {
  it('converts "First Last" to "Last, First"', () => {
    expect(formatAuthorName("J.K. Rowling")).toBe("Rowling, J.K.");
    expect(formatAuthorName("Stephen King")).toBe("King, Stephen");
    expect(formatAuthorName("Gabriel García Márquez")).toBe(
      "Márquez, Gabriel García",
    );
  });

  it('removes "By" prefix', () => {
    expect(formatAuthorName("By Stephen King")).toBe("King, Stephen");
    expect(formatAuthorName("by J.K. Rowling")).toBe("Rowling, J.K.");
    expect(formatAuthorName("BY STEPHEN KING")).toBe("KING, STEPHEN");
  });

  it('removes "Oleh" prefix (Indonesian)', () => {
    expect(formatAuthorName("Oleh Pramoedya Ananta Toer")).toBe(
      "Toer, Pramoedya Ananta",
    );
    expect(formatAuthorName("oleh Andrea Hirata")).toBe("Hirata, Andrea");
  });

  it('handles names already in "Last, First" format', () => {
    expect(formatAuthorName("Rowling, J.K.")).toBe("Rowling, J.K.");
    expect(formatAuthorName("King, Stephen")).toBe("King, Stephen");
  });

  it("handles single names", () => {
    expect(formatAuthorName("Madonna")).toBe("Madonna");
    expect(formatAuthorName("Plato")).toBe("Plato");
  });

  it("handles suffixes (Jr., Sr., III)", () => {
    expect(formatAuthorName("Martin Luther King Jr.")).toBe(
      "King, Martin Luther, Jr.",
    );
    expect(formatAuthorName("John Smith Sr.")).toBe("Smith, John, Sr.");
    expect(formatAuthorName("William Gates III")).toBe("Gates, William, III");
  });

  it("removes trailing punctuation", () => {
    expect(formatAuthorName("Stephen King.")).toBe("King, Stephen");
    expect(formatAuthorName("J.K. Rowling,")).toBe("Rowling, J.K.");
  });

  it("handles empty or invalid input", () => {
    expect(formatAuthorName("")).toBe("-");
    expect(formatAuthorName("-")).toBe("-");
  });
});

describe("Edition Formatting", () => {
  it("formats numeric editions", () => {
    expect(formatEdition("1")).toBe("1st ed.");
    expect(formatEdition("2")).toBe("2nd ed.");
    expect(formatEdition("3")).toBe("3rd ed.");
    expect(formatEdition("4")).toBe("4th ed.");
    expect(formatEdition("21")).toBe("21st ed.");
  });

  it("preserves well-formatted editions", () => {
    expect(formatEdition("2nd ed.")).toBe("2nd ed.");
    expect(formatEdition("3rd edition")).toBe("3rd edition");
  });

  it("preserves Indonesian format (Cet.)", () => {
    expect(formatEdition("Cet. 1")).toBe("Cet. 1");
    expect(formatEdition("Cet. 5")).toBe("Cet. 5");
  });

  it("extracts edition number from text", () => {
    // Note: Current implementation only extracts numbers, not text
    expect(formatEdition("Edition 5")).toBe("5th ed.");
  });

  it("returns empty string for null/undefined", () => {
    expect(formatEdition(null)).toBe("");
    expect(formatEdition(undefined)).toBe("");
    expect(formatEdition("")).toBe("");
  });

  it("handles unparseable edition strings gracefully", () => {
    // Strings without numbers return empty
    expect(formatEdition("Revised")).toBe("");
    expect(formatEdition("Updated version")).toBe("");
  });
});

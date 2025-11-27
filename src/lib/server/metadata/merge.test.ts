import { describe, it, expect } from "vitest";
import {
  processAndRenderMergedData,
  mapLangCode,
  formatAuthorName,
} from "./merge";
import type {
  GoogleBookItem,
  OpenLibraryBookData,
  LoCBookData,
} from "$lib/types";

describe("Metadata Merge Engine - 3-Source Waterfall", () => {
  describe("processAndRenderMergedData - Provider Combinations", () => {
    it("should merge data from all 3 sources (Google + OpenLibrary + LoC)", () => {
      const google = {
        title: "Clean Code",
        authors: ["Robert C. Martin"],
        publisher: "Prentice Hall",
        publishedDate: "2008-08-01",
        pageCount: 464,
        industryIdentifiers: [{ type: "ISBN_13", identifier: "9780132350884" }],
        categories: ["Computers"],
        printType: "BOOK",
        language: "en",
        description: "A handbook of agile software craftsmanship",
        infoLink: "http://books.google.com/books?id=123",
        imageLinks: { thumbnail: "http://books.google.com/cover.jpg" },
      } as GoogleBookItem["volumeInfo"];

      const openlib = {
        title: "Clean Code: A Handbook",
        authors: [{ name: "Robert C. Martin" }],
        publish_date: "2008",
        number_of_pages: 464,
        identifiers: { isbn_13: ["9780132350884"], isbn_10: ["0132350882"] },
        classifications: { dewey_decimal_class: ["005.1"] },
        subjects: ["Software engineering"],
        cover: { large: "http://covers.openlibrary.org/b/id/123-L.jpg" },
      } as OpenLibraryBookData;

      const loc = {
        results: [
          {
            title: "Clean code",
            contributor: ["Martin, Robert C."],
            date: "2008",
            item: {
              call_number: ["QA76.76.D47"],
              control_number: ["123456"],
            },
            subject: ["Software engineering", "Computer programming"],
          },
        ],
      } as LoCBookData;

      const merged = processAndRenderMergedData(google, openlib, loc);

      // Title: Google preferred
      expect(merged.title).toBe("Clean Code");

      // Author: Google, formatted to "Last, First"
      expect(merged.author).toContain("Martin");

      // Publisher: Google
      expect(merged.publisher).toBe("Prentice Hall");

      // LCC: LoC is authoritative
      expect(merged.lcc).toBe("QA76.76.D47");

      // DDC: OpenLibrary primary source
      expect(merged.ddc).toBe("005.1");

      // ISBN-13: Google preferred
      expect(merged.isbn13).toBe("9780132350884");

      // Data source tracking
      expect(merged.dataSource).toBe("all-three");
      expect(merged.isPartialData).toBe(false);
    });

    it("should handle Google + OpenLibrary only (LoC null)", () => {
      const google = {
        title: "Effective Java",
        authors: ["Joshua Bloch"],
        publisher: "Addison-Wesley",
        publishedDate: "2018",
        industryIdentifiers: [{ type: "ISBN_13", identifier: "9780134685991" }],
      } as GoogleBookItem["volumeInfo"];

      const openlib = {
        title: "Effective Java",
        classifications: {
          dewey_decimal_class: ["005.133"],
          lc_classifications: ["QA76.73.J38"],
        },
        identifiers: { isbn_13: ["9780134685991"] },
      } as OpenLibraryBookData;

      const merged = processAndRenderMergedData(google, openlib, null);

      expect(merged.title).toBe("Effective Java");
      expect(merged.ddc).toBe("005.133");
      // LCC falls back to OpenLibrary when LoC unavailable
      expect(merged.lcc).toBe("QA76.73.J38");
      expect(merged.dataSource).not.toBe("all-three");
    });

    it("should handle Google only (OpenLibrary + LoC null)", () => {
      const google = {
        title: "The Pragmatic Programmer",
        authors: ["Andrew Hunt", "David Thomas"],
        publisher: "Addison-Wesley",
        publishedDate: "2019",
        pageCount: 352,
        categories: ["Computers"],
        industryIdentifiers: [{ type: "ISBN_13", identifier: "9780135957059" }],
      } as GoogleBookItem["volumeInfo"];

      const merged = processAndRenderMergedData(google, null, null);

      expect(merged.title).toBe("The Pragmatic Programmer");
      expect(merged.publisher).toBe("Addison-Wesley");
      expect(merged.isbn13).toBe("9780135957059");
      // DDC/LCC should fall back to subject mapping or '-'
      expect(merged.ddc).not.toBe("");
    });

    it("should handle OpenLibrary only (Google + LoC null)", () => {
      const openlib = {
        title: "Introduction to Algorithms",
        authors: [{ name: "Thomas H. Cormen" }],
        publish_date: "2009",
        number_of_pages: 1312,
        classifications: {
          dewey_decimal_class: ["005.1"],
          lc_classifications: ["QA76.6"],
        },
        identifiers: { isbn_13: ["9780262033848"] },
      } as OpenLibraryBookData;

      const merged = processAndRenderMergedData(null, openlib, null);

      expect(merged.title).toBe("Introduction to Algorithms");
      expect(merged.ddc).toBe("005.1");
      expect(merged.lcc).toBe("QA76.6"); // From lc_classifications
      expect(merged.pages).toBe("1312");
    });

    it("should handle all sources null (fallback to defaults)", () => {
      const merged = processAndRenderMergedData(null, null, null);

      expect(merged.title).toBe("-");
      expect(merged.author).toBe("-");
      expect(merged.publisher).toBe("-");
      expect(merged.ddc).toBe("-");
      expect(merged.lcc).toBe("-");
      expect(merged.isbn13).toBe("-");
    });
  });

  describe("processAndRenderMergedData - Data Prioritization", () => {
    it("should prefer Google title over OpenLibrary", () => {
      const google = {
        title: "Google Title",
        industryIdentifiers: [],
      } as GoogleBookItem["volumeInfo"];

      const openlib = {
        title: "OpenLibrary Title",
        identifiers: {},
      } as OpenLibraryBookData;

      const merged = processAndRenderMergedData(google, openlib, null);
      expect(merged.title).toBe("Google Title");
    });

    it("should prefer LoC LCC over OpenLibrary LCC", () => {
      const google = {} as GoogleBookItem["volumeInfo"];

      const openlib = {
        classifications: { lc_classifications: ["QA76.73.OL"] },
      } as OpenLibraryBookData;

      const loc = {
        results: [
          {
            item: {
              call_number: ["QA76.76.LOC"],
            },
          },
        ],
      } as LoCBookData;

      const merged = processAndRenderMergedData(google, openlib, loc);
      // LoC LCC is authoritative (comes from item.call_number)
      expect(merged.lcc).toBe("QA76.76.LOC");
    });

    it("should use OpenLibrary DDC as primary DDC source", () => {
      const google = {
        categories: ["Computers"],
      } as GoogleBookItem["volumeInfo"];

      const openlib = {
        classifications: { dewey_decimal_class: ["005.133"] },
      } as OpenLibraryBookData;

      const merged = processAndRenderMergedData(google, openlib, null);
      expect(merged.ddc).toBe("005.133");
    });

    it("should prefer Google cover image over OpenLibrary", () => {
      const google = {
        imageLinks: { thumbnail: "http://google.com/cover.jpg" },
      } as GoogleBookItem["volumeInfo"];

      const openlib = {
        cover: { large: "http://openlibrary.org/cover.jpg" },
      } as OpenLibraryBookData;

      const merged = processAndRenderMergedData(google, openlib, null);
      expect(merged.cover).toContain("google.com");
    });
  });

  describe("processAndRenderMergedData - Edge Cases", () => {
    it("should handle missing ISBN from all sources", () => {
      const google = {
        title: "No ISBN Book",
        industryIdentifiers: [],
      } as GoogleBookItem["volumeInfo"];

      const merged = processAndRenderMergedData(google, null, null);
      expect(merged.isbn13).toBe("-");
      expect(merged.isbn10).toBe("-");
    });

    it("should handle missing authors gracefully", () => {
      const google = {
        title: "Anonymous Book",
        authors: [],
      } as GoogleBookItem["volumeInfo"];

      const merged = processAndRenderMergedData(google, null, null);
      expect(merged.author).toBe("-");
    });

    it("should handle incomplete LoC data (empty results array)", () => {
      const loc = {
        results: [],
      } as LoCBookData;

      const google = {
        title: "Some Book",
      } as GoogleBookItem["volumeInfo"];

      const merged = processAndRenderMergedData(google, null, loc);
      expect(merged.lcc).toBe("-"); // No LoC data available
    });

    it("should combine subjects from all sources", () => {
      const google = {
        categories: ["Computers", "Programming"],
      } as GoogleBookItem["volumeInfo"];

      const openlib = {
        subjects: ["Software engineering", "Agile development"],
      } as OpenLibraryBookData;

      const loc = {
        results: [
          {
            subject: ["Computer science", "Software design"],
          },
        ],
      } as LoCBookData;

      const merged = processAndRenderMergedData(google, openlib, loc);
      // Should contain subjects from all sources (deduplication may apply)
      expect(merged.subjects).toContain("Computer");
    });
  });

  describe("formatAuthorName", () => {
    it('should format "First Last" to "Last, First"', () => {
      expect(formatAuthorName("Robert Martin")).toBe("Martin, Robert");
      expect(formatAuthorName("Joshua Bloch")).toBe("Bloch, Joshua");
    });

    it('should format "First Middle Last" to "Last, First Middle"', () => {
      expect(formatAuthorName("Robert C. Martin")).toBe("Martin, Robert C.");
      expect(formatAuthorName("Andrew David Hunt")).toBe("Hunt, Andrew David");
    });

    it('should preserve existing "Last, First" format', () => {
      expect(formatAuthorName("Martin, Robert C.")).toBe("Martin, Robert C.");
    });

    it("should handle single names", () => {
      expect(formatAuthorName("Madonna")).toBe("Madonna");
      expect(formatAuthorName("Plato")).toBe("Plato");
    });

    it("should handle suffixes (Jr., Sr., III)", () => {
      expect(formatAuthorName("Martin Luther King Jr.")).toBe(
        "King, Martin Luther, Jr.",
      );
      expect(formatAuthorName("John Smith Sr.")).toBe("Smith, John, Sr.");
    });

    it('should remove prefixes like "By" and "Oleh"', () => {
      expect(formatAuthorName("By Robert Martin")).toBe("Martin, Robert");
      expect(formatAuthorName("Oleh Ahmad Dhani")).toBe("Dhani, Ahmad");
    });

    it("should handle empty or invalid names", () => {
      expect(formatAuthorName("")).toBe("-");
      expect(formatAuthorName("-")).toBe("-");
    });

    it("should remove trailing punctuation except periods in abbreviations", () => {
      expect(formatAuthorName("Robert Martin.")).toBe("Martin, Robert");
      expect(formatAuthorName("Robert C. Martin")).toBe("Martin, Robert C.");
    });
  });

  describe("mapLangCode", () => {
    it("should map common ISO 639-1 codes", () => {
      expect(mapLangCode("en")).toBe("English");
      expect(mapLangCode("id")).toBe("Bahasa Indonesia");
      expect(mapLangCode("es")).toBe("Spanish");
      expect(mapLangCode("fr")).toBe("French");
    });

    it("should map ISO 639-2 codes", () => {
      expect(mapLangCode("eng")).toBe("English");
      expect(mapLangCode("ind")).toBe("Bahasa Indonesia");
      expect(mapLangCode("spa")).toBe("Spanish");
    });

    it("should handle locale variants (en-US, en-GB)", () => {
      expect(mapLangCode("en-US")).toBe("English");
      expect(mapLangCode("en-GB")).toBe("English");
      expect(mapLangCode("id-ID")).toBe("Bahasa Indonesia");
    });

    it("should return uppercase code for unknown languages", () => {
      expect(mapLangCode("xyz")).toBe("XYZ");
      expect(mapLangCode("unknown")).toBe("UNKNOWN");
    });

    it("should handle empty or invalid codes", () => {
      expect(mapLangCode("")).toBe("-");
      expect(mapLangCode("-")).toBe("-");
    });

    it("should map Indonesian variants", () => {
      expect(mapLangCode("id")).toBe("Bahasa Indonesia");
      expect(mapLangCode("ind")).toBe("Bahasa Indonesia");
      expect(mapLangCode("in")).toBe("Bahasa Indonesia");
    });
  });
});

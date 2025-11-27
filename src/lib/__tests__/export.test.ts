/**
 * Tests for export utilities (SLiMS CSV and MARCXML generation)
 */

import { describe, it, expect } from "vitest";
import { generateSLiMSCSV, generateMARCXML } from "../export";
import type { MergedBookData } from "../types";

describe("SLiMS CSV Export", () => {
  const sampleBook: MergedBookData = {
    title: "The Art of Computer Programming",
    author: "Knuth, Donald E.",
    publisher: "Addison-Wesley",
    date: "1997-07-01",
    pages: "650",
    isbn13: "978-0-201-89683-1",
    isbn10: "0-201-89683-4",
    ddc: "005.1",
    lcc: "QA76.6",
    callNumber: "005.1 KNU a",
    description: "Fundamental algorithms for computer science.",
    language: "English",
    subjects: "Computer programming; Algorithms",
    series: "Art of Computer Programming Series",
    publisherString: "Boston : Addison-Wesley, 1997",
    collation: "650 p. ; 24 cm",
    classification: "DDC: 005.1 / LCC: QA76.6",
    edition: "3rd ed.",
    specificDetail: "Vol. 1",
    gmd: "Text",
    infoLink: "https://books.google.com/books?id=example",
    cover: "https://example.com/cover.jpg",
  };

  it("generates CSV with correct headers", () => {
    const csv = generateSLiMSCSV(sampleBook);
    const lines = csv.split("\n");

    // SLiMS uses lowercase field names
    expect(lines[0]).toContain("title");
    expect(lines[0]).toContain("authors");
    expect(lines[0]).toContain("isbn_issn");
    expect(lines[0]).toContain("publisher_name");
    expect(lines[0]).toContain("call_number");
  });

  it("includes all essential book data in CSV", () => {
    const csv = generateSLiMSCSV(sampleBook);
    const lines = csv.split("\n");
    const dataRow = lines[1];

    expect(dataRow).toContain("The Art of Computer Programming");
    expect(dataRow).toContain("Knuth, Donald E.");
    expect(dataRow).toContain("9780201896831"); // ISBN without dashes (cleaned)
    expect(dataRow).toContain("Addison-Wesley");
    expect(dataRow).toContain("005.1 KNU a");
  });

  it("extracts year from date field", () => {
    const csv = generateSLiMSCSV(sampleBook);
    expect(csv).toContain("1997");
  });

  it("escapes commas in CSV values", () => {
    const bookWithCommas: MergedBookData = {
      ...sampleBook,
      subjects: "Programming, Algorithms, Data Structures",
    };

    const csv = generateSLiMSCSV(bookWithCommas);
    const lines = csv.split("\n");
    const dataRow = lines[1];

    // Should be wrapped in quotes due to commas
    expect(dataRow).toContain('"Programming, Algorithms, Data Structures"');
  });

  it("handles missing optional fields gracefully", () => {
    const minimalBook: MergedBookData = {
      title: "Test Book",
      author: "Test Author",
      publisher: "-",
      date: "-",
      pages: "-",
      isbn13: "-",
      isbn10: "-",
      ddc: "-",
      lcc: "-",
      callNumber: "-",
      description: "-",
      language: "-",
      subjects: "-",
      series: "-",
      publisherString: "-",
      collation: "-",
      classification: "-",
      edition: "",
      specificDetail: "-",
      gmd: "-",
      infoLink: "-",
      cover: "/placeholder-book.png",
    };

    const csv = generateSLiMSCSV(minimalBook);
    const lines = csv.split("\n");

    expect(lines.length).toBe(2); // Header + data row
    expect(lines[1]).toContain("Test Book");
  });

  it("excludes placeholder cover image from CSV", () => {
    const bookWithPlaceholder: MergedBookData = {
      ...sampleBook,
      cover: "/placeholder-book.png",
    };

    const csv = generateSLiMSCSV(bookWithPlaceholder);
    const lines = csv.split("\n");
    
    // The cover column (index 13) should be empty for placeholder
    const columns = lines[1].split('","');
    const coverColumn = columns[13].replace(/"/g, ''); // Remove quotes
    
    expect(coverColumn).toBe(""); // Cover URL should be empty for placeholder
    
    // Item code (last column) should still be generated
    const lastColumn = lines[1].split(",").pop();
    expect(lastColumn).toMatch(/^"RNG-\d{4}-\d{5}-\d+"/); // Should have item code
  });
});

describe("MARCXML Export", () => {
  const sampleBook: MergedBookData = {
    title: "Introduction to Algorithms",
    author: "Cormen, Thomas H.",
    publisher: "Cambridge : MIT Press, 2009",
    date: "2009-07-31",
    pages: "1292",
    isbn13: "978-0-262-03384-8",
    isbn10: "0-262-03384-4",
    ddc: "005.1",
    lcc: "QA76.6",
    callNumber: "005.1 COR i",
    description:
      "Comprehensive introduction to algorithms and data structures.",
    language: "English",
    subjects: "Algorithms; Computer science",
    series: "-",
    publisherString: "Cambridge : MIT Press, 2009",
    collation: "1292 p. ; 24 cm",
    classification: "DDC: 005.1 / LCC: QA76.6",
    edition: "3rd ed.",
    specificDetail: "-",
    gmd: "Text",
    infoLink: "https://books.google.com/books?id=example",
    cover: "https://example.com/cover.jpg",
  };

  it("generates valid XML structure", () => {
    const xml = generateMARCXML(sampleBook);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<collection");
    expect(xml).toContain("<record>");
    expect(xml).toContain("</record>");
    expect(xml).toContain("</collection>");
  });

  it("includes MARC leader field", () => {
    const xml = generateMARCXML(sampleBook);
    expect(xml).toContain("<leader>");
  });

  it("includes control fields (001, 008)", () => {
    const xml = generateMARCXML(sampleBook);
    expect(xml).toContain('<controlfield tag="001">');
    expect(xml).toContain('<controlfield tag="008">');
  });

  it("includes ISBN in field 020", () => {
    const xml = generateMARCXML(sampleBook);
    expect(xml).toContain('<datafield tag="020"');
    expect(xml).toContain("978-0-262-03384-8");
  });

  it("includes author in field 100", () => {
    const xml = generateMARCXML(sampleBook);
    expect(xml).toContain('<datafield tag="100"');
    expect(xml).toContain("Cormen, Thomas H.");
  });

  it("includes title in field 245", () => {
    const xml = generateMARCXML(sampleBook);
    expect(xml).toContain('<datafield tag="245"');
    expect(xml).toContain("Introduction to Algorithms");
  });

  it("includes edition in field 250", () => {
    const xml = generateMARCXML(sampleBook);
    expect(xml).toContain('<datafield tag="250"');
    expect(xml).toContain("3rd ed.");
  });

  it("includes publisher info in field 260", () => {
    const xml = generateMARCXML(sampleBook);
    expect(xml).toContain('<datafield tag="260"');
    expect(xml).toContain("MIT Press");
    expect(xml).toContain("2009");
  });

  it("includes physical description in field 300", () => {
    const xml = generateMARCXML(sampleBook);
    expect(xml).toContain('<datafield tag="300"');
    expect(xml).toContain("1292 p. ; 24 cm");
  });

  it("includes description in field 520", () => {
    const xml = generateMARCXML(sampleBook);
    expect(xml).toContain('<datafield tag="520"');
    expect(xml).toContain("Comprehensive introduction to algorithms");
  });

  it("includes DDC classification in field 082", () => {
    const xml = generateMARCXML(sampleBook);
    expect(xml).toContain('<datafield tag="082"');
    expect(xml).toContain("005.1");
  });

  it("includes LCC classification in field 050", () => {
    const xml = generateMARCXML(sampleBook);
    expect(xml).toContain('<datafield tag="050"');
    expect(xml).toContain("QA76.6");
  });

  it("includes subjects in field 650", () => {
    const xml = generateMARCXML(sampleBook);
    expect(xml).toContain('<datafield tag="650"');
    expect(xml).toContain("Algorithms");
  });

  it("splits multiple subjects into separate 650 fields", () => {
    const xml = generateMARCXML(sampleBook);
    const subject650Count = (xml.match(/<datafield tag="650"/g) || []).length;
    expect(subject650Count).toBeGreaterThanOrEqual(2); // Should have at least 2 subjects
  });

  it("includes cover image URL in field 856", () => {
    const xml = generateMARCXML(sampleBook);
    expect(xml).toContain('<datafield tag="856"');
    expect(xml).toContain("https://example.com/cover.jpg");
  });

  it("escapes XML special characters", () => {
    const bookWithSpecialChars: MergedBookData = {
      ...sampleBook,
      title: 'A & B: The "Complete" Guide <Advanced>',
      description: "Contains special chars: & < > \" '",
    };

    const xml = generateMARCXML(bookWithSpecialChars);

    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;");
    expect(xml).toContain("&gt;");
    expect(xml).toContain("&quot;");
    expect(xml).not.toContain("A & B"); // Should be escaped
  });

  it("handles books without optional fields", () => {
    const minimalBook: MergedBookData = {
      title: "Minimal Book",
      author: "Author, Test",
      publisher: "-",
      date: "-",
      pages: "-",
      isbn13: "978-1234567890",
      isbn10: "-",
      ddc: "-",
      lcc: "-",
      callNumber: "-",
      description: "-",
      language: "-",
      subjects: "-",
      series: "-",
      publisherString: "-",
      collation: "-",
      classification: "-",
      edition: "",
      specificDetail: "-",
      gmd: "-",
      infoLink: "-",
      cover: "/placeholder-book.png",
    };

    const xml = generateMARCXML(minimalBook);

    expect(xml).toContain("<record>");
    expect(xml).toContain("Minimal Book");
    expect(xml).not.toContain('field tag="050"'); // No LCC
    expect(xml).not.toContain('field tag="082"'); // No DDC
  });

  it("handles call number in field 090", () => {
    const xml = generateMARCXML(sampleBook);
    expect(xml).toContain('<datafield tag="090"');
    expect(xml).toContain("005.1 COR i");
  });
});

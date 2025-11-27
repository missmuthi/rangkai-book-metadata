import { describe, it, expect } from "vitest";
import {
  convertISBN13to10,
  convertISBN10to13,
  isISBN,
  getISBNSibling,
} from "../utils";

describe("ISBN Conversion Utilities", () => {
  describe("convertISBN13to10", () => {
    it("should convert valid ISBN-13 to ISBN-10", () => {
      // Clean Code by Robert C. Martin
      expect(convertISBN13to10("9780132350884")).toBe("0132350882");

      // Effective Java by Joshua Bloch
      expect(convertISBN13to10("9780134685991")).toBe("0134685997");

      // The Pragmatic Programmer
      expect(convertISBN13to10("9780135957059")).toBe("0135957052");
    });

    it("should handle ISBN-13 with hyphens", () => {
      expect(convertISBN13to10("978-0-13-235088-4")).toBe("0132350882");
    });

    it("should handle ISBN-13 with spaces", () => {
      expect(convertISBN13to10("978 0 13 235088 4")).toBe("0132350882");
    });

    it("should return null for ISBN-13 starting with 979 (not convertible)", () => {
      expect(convertISBN13to10("9791234567890")).toBeNull();
    });

    it("should return null for invalid ISBN-13 checksum", () => {
      expect(convertISBN13to10("9780132350889")).toBeNull(); // Wrong check digit
    });

    it("should return null for invalid length", () => {
      expect(convertISBN13to10("978013235088")).toBeNull(); // Too short
      expect(convertISBN13to10("97801323508844")).toBeNull(); // Too long
    });

    it("should return null for non-ISBN strings", () => {
      expect(convertISBN13to10("not-an-isbn")).toBeNull();
      expect(convertISBN13to10("")).toBeNull();
    });
  });

  describe("convertISBN10to13", () => {
    it("should convert valid ISBN-10 to ISBN-13", () => {
      // Clean Code
      expect(convertISBN10to13("0132350882")).toBe("9780132350884");

      // Effective Java
      expect(convertISBN10to13("0134685997")).toBe("9780134685991");

      // The Pragmatic Programmer
      expect(convertISBN10to13("0135957052")).toBe("9780135957059");
    });

    it("should handle ISBN-10 with X check digit", () => {
      // Design Patterns (has X as check digit)
      expect(convertISBN10to13("020161622X")).toBe("9780201616224");
    });

    it("should handle ISBN-10 with hyphens", () => {
      expect(convertISBN10to13("0-13-235088-2")).toBe("9780132350884");
    });

    it("should handle ISBN-10 with spaces", () => {
      expect(convertISBN10to13("0 13 235088 2")).toBe("9780132350884");
    });

    it("should return null for invalid ISBN-10 checksum", () => {
      expect(convertISBN10to13("0132350888")).toBeNull(); // Wrong check digit
    });

    it("should return null for invalid length", () => {
      expect(convertISBN10to13("013235088")).toBeNull(); // Too short
      expect(convertISBN10to13("01323508822")).toBeNull(); // Too long
    });

    it("should return null for non-ISBN strings", () => {
      expect(convertISBN10to13("not-an-isbn")).toBeNull();
      expect(convertISBN10to13("")).toBeNull();
    });
  });

  describe("isISBN", () => {
    it("should detect valid ISBN-13", () => {
      expect(isISBN("9780132350884")).toBe(true);
      expect(isISBN("978-0-13-235088-4")).toBe(true);
      expect(isISBN("978 0 13 235088 4")).toBe(true);
    });

    it("should detect valid ISBN-10", () => {
      expect(isISBN("0132350882")).toBe(true);
      expect(isISBN("0-13-235088-2")).toBe(true);
      expect(isISBN("020161622X")).toBe(true); // With X
    });

    it("should return false for non-ISBN strings", () => {
      expect(isISBN("not-an-isbn")).toBe(false);
      expect(isISBN("12345")).toBe(false);
      expect(isISBN("")).toBe(false);
      expect(isISBN("978013235088")).toBe(false); // Too short
      expect(isISBN("97801323508844")).toBe(false); // Too long
    });
  });

  describe("getISBNSibling", () => {
    it("should return ISBN-10 for ISBN-13 input", () => {
      expect(getISBNSibling("9780132350884")).toBe("0132350882");
    });

    it("should return ISBN-13 for ISBN-10 input", () => {
      expect(getISBNSibling("0132350882")).toBe("9780132350884");
    });

    it("should handle ISBN-10 with X check digit", () => {
      expect(getISBNSibling("020161622X")).toBe("9780201616224");
    });

    it("should handle formatted ISBNs", () => {
      expect(getISBNSibling("978-0-13-235088-4")).toBe("0132350882");
      expect(getISBNSibling("0-13-235088-2")).toBe("9780132350884");
    });

    it("should return null for ISBN-13 starting with 979", () => {
      expect(getISBNSibling("9791234567890")).toBeNull();
    });

    it("should return null for invalid ISBNs", () => {
      expect(getISBNSibling("not-an-isbn")).toBeNull();
      expect(getISBNSibling("")).toBeNull();
      expect(getISBNSibling("12345")).toBeNull();
    });
  });

  describe("Round-trip conversions", () => {
    it("should maintain data integrity in round-trip conversions", () => {
      const isbn13 = "9780132350884";
      const isbn10 = convertISBN13to10(isbn13);
      const backToISBN13 = isbn10 ? convertISBN10to13(isbn10) : null;

      expect(backToISBN13).toBe(isbn13);
    });

    it("should work with multiple test cases", () => {
      const testCases = [
        "9780134685991", // Effective Java
        "9780135957059", // The Pragmatic Programmer
        "9780132350884", // Clean Code
      ];

      testCases.forEach((isbn13) => {
        const isbn10 = convertISBN13to10(isbn13);
        expect(isbn10).not.toBeNull();

        const backToISBN13 = isbn10 ? convertISBN10to13(isbn10) : null;
        expect(backToISBN13).toBe(isbn13);
      });
    });
  });

  describe("Real-world ISBN examples", () => {
    it("should handle popular programming books", () => {
      const books = [
        { isbn13: "9780132350884", isbn10: "0132350882", title: "Clean Code" },
        {
          isbn13: "9780134685991",
          isbn10: "0134685997",
          title: "Effective Java",
        },
        {
          isbn13: "9780135957059",
          isbn10: "0135957052",
          title: "The Pragmatic Programmer",
        },
        {
          isbn13: "9780201616224",
          isbn10: "020161622X",
          title: "Design Patterns",
        },
      ];

      books.forEach(({ isbn13, isbn10 }) => {
        expect(convertISBN13to10(isbn13)).toBe(isbn10);
        expect(convertISBN10to13(isbn10)).toBe(isbn13);
      });
    });
  });
});

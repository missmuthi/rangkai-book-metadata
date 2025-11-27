import { describe, it, expect } from "vitest";
import { cleanISBN } from "../isbn-helpers";

describe("cleanISBN", () => {
  it('should not remove "X" from ISBN-10', () => {
    const input = "0-306-40615-X";
    const expected = "030640615X";
    const result = cleanISBN(input);
    expect(result).toBe(expected);
  });
});

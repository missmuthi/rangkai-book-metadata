import { z } from "zod";

/**
 * Zod Schemas for Data Validation
 */

/**
 * ISBN Validation Schema
 * Matches ISBN-10 or ISBN-13 (strips hyphens/spaces before validation)
 */
export const isbnSchema = z
  .string()
  .transform((val) => val.replace(/[-\s]/g, ""))
  .pipe(z.string().regex(/^(97(8|9))?\d{9}(\d|X)$/, "Invalid ISBN format"));

/**
 * Book Validation Schema
 * Validates partial or complete book data (MergedBookData)
 */
export const bookSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  publisher: z.string().optional(),
  date: z.string().optional(),
  isbn13: isbnSchema.optional(),
  isbn10: isbnSchema.optional(),
  description: z.string().optional(),
  language: z.string().optional(),
  pageCount: z.union([z.number(), z.string()]).optional(),
  cover: z.string().url().optional().or(z.literal("")),
  // Add more fields as needed based on MergedBookData
});

/**
 * Scan Update Schema
 */
export const scanUpdateSchema = z.object({
  title: z.string().optional(),
  json_data: z.string().optional(), // For raw JSON updates if needed
  // ... other updatable fields
});

import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { scans } from "$lib/server/db/schema";

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

// Derived schema for scans table using drizzle-zod
export const scanInsertSchema = createInsertSchema(scans);

// Refined scan schema for form UX
export const scanFormSchema = scanInsertSchema.extend({
  isbn: z
    .string()
    .transform((val) => val.replace(/[-\s]/g, ""))
    .pipe(z.string().regex(/^(97(8|9))?\d{9}(\d|X)$/, "Invalid ISBN format")),
  title: z.string().min(1, { message: "Title is required" }),
});

// Manual scan form schema (simplified) for use with Superforms to avoid adapter mismatches
export const manualScanSchema = z.object({
  isbn: isbnSchema,
  title: z.string().min(1, { message: "Title is required" }),
  json_data: z.any().optional(),
  status: z.string().optional(),
});

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import type { MergedBookData } from "$lib/types";
import { env } from "$env/dynamic/private";
import { logger } from "$lib/server/logger";

// Define the schema for the cleaned data - COMPREHENSIVE METADATA COMPLETION
const cleanedBookSchema = z.object({
  title: z.string().describe("The cleaned title of the book in Title Case"),
  authors: z
    .array(z.string())
    .describe("List of authors, cleaned and formatted"),
  publisher: z
    .string()
    .describe("The publisher name in ISBD format (Place : Publisher, Year)"),
  description: z
    .string()
    .describe("A standardized summary limited to 2 sentences"),
  subtitle: z.string().optional().describe("The cleaned subtitle if present"),
  publishedDate: z
    .string()
    .optional()
    .describe("Standardized publication date YYYY or YYYY-MM-DD"),
  ddc: z
    .string()
    .optional()
    .describe("Dewey Decimal Classification code (MUST be filled if missing)"),
  lcc: z
    .string()
    .optional()
    .describe(
      "Library of Congress Classification code (MUST be filled if missing)",
    ),
  classification: z
    .string()
    .optional()
    .describe("General classification string"),
  language: z
    .string()
    .optional()
    .describe("Language code (e.g., eng, ind, fra) - predict if missing"),
  series: z
    .string()
    .optional()
    .describe("Series title if the book is part of a series"),
  edition: z
    .string()
    .optional()
    .describe('Edition information (e.g., "2nd ed.", "Rev. ed.")'),
  subjects: z
    .string()
    .optional()
    .describe("Semicolon-separated subject headings"),
  changes: z
    .array(z.string())
    .describe("List of ALL changes made including newly generated fields"),
});

// Extend MergedBookData to include the changes array internally for passing to the handler
interface AIMergedBookData extends Partial<MergedBookData> {
  _changes?: string[];
}

export const aiService = {
  async cleanMetadata(book: MergedBookData): Promise<AIMergedBookData> {
    try {
      if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
        logger.warn("ai_api_key_missing", { service: "google_generative" });
        return {};
      }

      // Construct the prompt context with ALL available fields
      const bookContext = JSON.stringify({
        title: book.title,
        author: book.author,
        publisher: book.publisherString || book.publisher,
        description: book.description,
        date: book.date,
        subjects: book.subjects,
        ddc: book.ddc,
        lcc: book.lcc,
        language: book.language,
        series: book.series,
        edition: book.edition,
        classification: book.classification,
      });

      const { object } = await generateObject({
        model: google("gemini-2.0-flash"),
        schema: cleanedBookSchema,
        prompt: `You are an expert Librarian and Cataloger. Your goal is to create a COMPLETE Bibliographic Record.

Input JSON: ${bookContext}

CRITICAL RULES:

**Rule 1 (Fill ALL Gaps - MANDATORY):**
If ANY field (DDC, LCC, Series, Subjects, Language, Edition) is missing, empty, or just a dash "-", you MUST predict/extract it from the Title and Description using your library science expertise.
- DDC: Predict the most accurate Dewey Decimal Classification (e.g., Computer Science → 005.1, Fiction → 813)
- LCC: Predict Library of Congress Classification (e.g., Computer Science → QA76, Fiction → PS)
- Language: Predict language code (eng, ind, fra, etc.) from title/content clues
- Subjects: Generate relevant subject headings (Library of Congress style, semicolon-separated)
- Series: Extract series name if the title indicates it (e.g., "Book 1 of XYZ Series")
- Edition: Extract edition info if present in title or description (e.g., "2nd ed.", "Revised")

**Rule 2 (Standardize Format - MANDATORY):**
- Title: Use proper Title Case
- Authors: Remove roles like '(Ed.)', 'Ph.D.' from names
- Publisher: Format as "Place : Publisher, Year" following ISBD standard (e.g., "New York : Random House, 2020")
- Description: Rewrite to exactly 2 concise, professional sentences

**Rule 3 (Classify Intelligently):**
If Classification/DDC is missing, predict it based on Subjects and Title context.
Examples:
  - "Python Programming" → DDC: 005.133, LCC: QA76.73.P98
  - "World War II History" → DDC: 940.53, LCC: D743
  - "Biology Textbook" → DDC: 570, LCC: QH308.2

**Rule 4 (Track Every Change):**
In the 'changes' array, document EVERY action you take:
- For NEW data: "Generated [field]: [value]" (e.g., "Generated DDC: 005.1")
- For UPDATED data: "Updated [field]" (e.g., "Updated Title Case")
- For STANDARDIZED data: "Standardized [field]" (e.g., "Standardized Publisher to ISBD")

Return the cleaned AND completed fields with a comprehensive changes log.`,
      });

      // Map back to MergedBookData structure
      // Note: MergedBookData uses 'author' string (often semicolon separated or just first author),
      // while our AI returns an array. We'll join them.

      const updates: AIMergedBookData = {};

      if (object.title) updates.title = object.title;
      if (object.authors && object.authors.length > 0) {
        updates.author = object.authors.join("; ");
      }
      if (object.publisher) {
        updates.publisher = object.publisher;
        updates.publisherString = object.publisher; // Updating both to be safe
      }
      if (object.description) updates.description = object.description;
      if (object.publishedDate) updates.date = object.publishedDate;

      // NEW: Handle all additional metadata fields
      if (object.language) updates.language = object.language;
      if (object.series) updates.series = object.series;
      if (object.edition) updates.edition = object.edition;
      if (object.subjects) updates.subjects = object.subjects;

      // Handle DDC and LCC - check both direct fields and changes array
      let ddc = object.ddc;
      let lcc = object.lcc;

      if (!ddc || !lcc) {
        const changes = object.changes || [];
        changes.forEach((change) => {
          const ddcMatch = change.match(/Generated DDC:\s*([0-9.]+)/);
          const lccMatch = change.match(/Generated LCC:\s*([A-Z0-9.]+)/);
          if (ddcMatch && !ddc) ddc = ddcMatch[1];
          if (lccMatch && !lcc) lcc = lccMatch[1];
        });
      }

      if (ddc) updates.ddc = ddc;
      if (lcc) updates.lcc = lcc;
      if (object.classification) updates.classification = object.classification;
      if (object.changes) updates._changes = object.changes;

      return updates;
    } catch (error) {
      logger.error("ai_clean_failed", { error });
      // Return empty object so we fail gracefully (original data remains)
      return { aiWarning: "AI cleaning service unavailable" };
    }
  },
};

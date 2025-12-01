import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import type { MergedBookData } from "$lib/types";
import { env } from "$env/dynamic/private";
import { logger } from "$lib/server/logger";
import { Analytics } from "$lib/services/analytics";

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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const aiService = {
  async cleanMetadata(book: MergedBookData): Promise<AIMergedBookData> {
    try {
      const groq = createOpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: env.GROQ_API_KEY,
      });

      if (!env.GROQ_API_KEY) {
        logger.warn("ai_api_key_missing", { service: "groq" });
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

      let attempt = 0;
      let object: z.infer<typeof cleanedBookSchema> | null = null;
      let lastError: unknown = null;

      while (attempt < 3) {
        try {
          const result = await generateObject({
            model: groq("llama-3.3-70b-versatile"),
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
          object = result.object;
          break; // Success
        } catch (error) {
          lastError = error;
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const isRateLimit =
            errorMessage.includes("429") || errorMessage.includes("quota");

          attempt++;
          if (isRateLimit && attempt < 3) {
            // Exponential backoff: 2s, 4s
            const waitTime = 2000 * Math.pow(2, attempt - 1);
            logger.warn("ai_rate_limit_retry", { attempt, waitTime });
            await delay(waitTime);
            continue;
          }
          // If the error indicates the model doesn't support json_schema (Groq limitation),
          // stop retrying and fall through to fallback logic outside the loop.
          if (String(errorMessage).includes('json_schema')) {
            break;
          }
          throw error; // Throw non-retriable or other errors
        }
      }


      // Fallback: Some Groq models do not support structured `json_schema` output.
      // If we failed due to unsupported response format try generateText and parse JSON.
      if (!object && lastError) {
        logger.debug('ai_lastError_message', { lastError: String(lastError) });
      }
      if (!object && lastError && String(lastError).includes("json_schema")) {
        try {
          const prompt = `Return ONLY a valid JSON object matching this schema: ${cleanedBookSchema.toString()}\n\nINPUT:\n${JSON.stringify(bookContext, null, 2)}`;
          const textResult = await generateText({
            model: groq("llama-3.3-70b-versatile"),
            prompt,
            system: `You are a helpful assistant. Output a single JSON object with the required fields only.`,
          });
          logger.debug('ai_generateText_result', { result: textResult });

          // Try to pull the textual output in a few known shapes
          const text = (textResult as any).output_text || (textResult as any).output?.[0]?.content?.find((c: any) => c.type === 'output_text')?.text || (textResult as any).output?.[0]?.content?.[0]?.text;
          if (typeof text === 'string') {
            try {
              const parsed = JSON.parse(text);
              logger.debug('ai_generateText_parsed', { parsedType: typeof parsed, keys: Object.keys(parsed ?? {}) });
              // Validate parsed object against zod schema
              const parsedValidated = cleanedBookSchema.safeParse(parsed);
              if (parsedValidated.success) {
                object = parsedValidated.data as unknown as z.infer<typeof cleanedBookSchema>;
                logger.debug('ai_generateText_validated', { fields: Object.keys(object) });
                try {
                  Analytics.track('ai_fallback_used', { model: 'llama-3.3-70b-versatile', provider: 'groq', isbn: book.isbn || undefined, reason: 'json_schema_unsupported' });
                } catch (analyticsErr) {
                  logger.debug('analytics_track_failed', { analyticsErr });
                }
              } else {
                logger.warn('ai_generateText_parsed_but_invalid', { issues: parsedValidated.error.issues });
                // Accept parsed result as a best-effort fallback -- we'll still map fields conservatively
                object = parsed as unknown as z.infer<typeof cleanedBookSchema>;
                logger.debug('ai_generateText_fallback_object_assigned', { fields: Object.keys(object) });
              }
            } catch (parseErr) {
              logger.warn('ai_generateText_parse_failed', { parseErr, textSnippet: text?.slice(0, 200) });
            }
          }
        } catch (fallbackErr) {
          logger.error('ai_generateText_fallback_failed', { fallbackErr });
        }
      }
      if (!object) {
        throw lastError || new Error("AI generation failed");
      }

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
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("429") || errorMessage.includes("quota")) {
        logger.error("ai_clean_rate_limited", { error });
        return { aiWarning: "AI Service Busy (Rate Limit). Try again later." };
      }

      logger.error("ai_clean_failed", { error });
      // Return empty object so we fail gracefully (original data remains)
      return { aiWarning: "AI cleaning service unavailable" };
    }
  },
};

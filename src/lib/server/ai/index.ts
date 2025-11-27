import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { MergedBookData } from '$lib/types';
import { env } from '$env/dynamic/private';

// Define the schema for the cleaned data
const cleanedBookSchema = z.object({
  title: z.string().describe('The cleaned title of the book in Title Case'),
  authors: z.array(z.string()).describe('List of authors, cleaned and formatted'),
  publisher: z.string().describe('The publisher name, cleaned'),
  description: z.string().describe('A standardized summary limited to 2 sentences'),
  subtitle: z.string().optional().describe('The cleaned subtitle if present'),
  publishedDate: z.string().optional().describe('Standardized publication date YYYY or YYYY-MM-DD'),
  ddc: z.string().optional().describe('Dewey Decimal Classification code'),
  lcc: z.string().optional().describe('Library of Congress Classification code'),
  classification: z.string().optional().describe('General classification string'),
  changes: z.array(z.string()).describe('List of changes made to the metadata')
});

// Extend MergedBookData to include the changes array internally for passing to the handler
interface AIMergedBookData extends Partial<MergedBookData> {
  _changes?: string[];
}

export const aiService = {
  async cleanMetadata(book: MergedBookData): Promise<AIMergedBookData> {
    try {
      if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
        console.warn('GOOGLE_GENERATIVE_AI_API_KEY is not set. Skipping AI cleaning.');
        return {};
      }

      // Construct the prompt context
      const bookContext = JSON.stringify({
        title: book.title,
        author: book.author,
        publisher: book.publisherString || book.publisher,
        description: book.description,
        date: book.date,
        subjects: book.subjects,
        ddc: book.ddc,
        lcc: book.lcc
      });

      const { object } = await generateObject({
        model: google('gemini-2.0-flash'),
        schema: cleanedBookSchema,
        prompt: `You are a strict library cataloger.
        Input JSON: ${bookContext}

        Tasks:
        1. Fix capitalization (Title Case) for the title.
        2. Remove roles like '(Ed.)', 'Ph.D.' from names.
        3. Standardize the publisher name (remove Inc., Ltd. if redundant).
        4. Rewrite/Standardize the summary/description to exactly 2 concise sentences.
        5. Analyze the Title and Subject. If DDC or LCC are missing, PREDICT the most accurate classification codes based on standard library rules. Example: Computer Science -> 004.
        6. Return the cleaned fields.
        7. Return a 'changes' array summarizing what you did (e.g., ["Fixed Title Case", "Generated DDC: 005.1"]).
        `
      });

      // Map back to MergedBookData structure
      // Note: MergedBookData uses 'author' string (often semicolon separated or just first author),
      // while our AI returns an array. We'll join them.

      const updates: AIMergedBookData = {};

      if (object.title) updates.title = object.title;
      if (object.authors && object.authors.length > 0) {
        updates.author = object.authors.join('; ');
      }
      if (object.publisher) {
        updates.publisher = object.publisher;
        updates.publisherString = object.publisher; // Updating both to be safe
      }
      if (object.description) updates.description = object.description;
      if (object.publishedDate) updates.date = object.publishedDate;
      if (object.ddc) updates.ddc = object.ddc;
      if (object.lcc) updates.lcc = object.lcc;
      if (object.classification) updates.classification = object.classification;
      if (object.changes) updates._changes = object.changes;

      return updates;
    } catch (error) {
      console.error('AI Cleaning Failed:', error);
      // Return empty object so we fail gracefully (original data remains)
      return { aiWarning: 'AI cleaning service unavailable' };
    }
  }
};

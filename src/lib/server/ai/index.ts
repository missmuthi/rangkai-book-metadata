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
  publishedDate: z.string().optional().describe('Standardized publication date YYYY or YYYY-MM-DD')
});

export const aiService = {
  async cleanMetadata(book: MergedBookData): Promise<Partial<MergedBookData>> {
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
        date: book.date
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
        5. Return the cleaned fields.
        `
      });

      // Map back to MergedBookData structure
      // Note: MergedBookData uses 'author' string (often semicolon separated or just first author),
      // while our AI returns an array. We'll join them.

      const updates: Partial<MergedBookData> = {};

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

      return updates;
    } catch (error) {
      console.error('AI Cleaning Failed:', error);
      // Return empty object so we fail gracefully (original data remains)
      return { aiWarning: 'AI cleaning service unavailable' };
    }
  }
};

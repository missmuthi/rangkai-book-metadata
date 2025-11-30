#!/usr/bin/env node

/**
 * Integration test - simulates the full aiService.cleanMetadata() flow
 */

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import "dotenv/config";

const cleanedBookSchema = z.object({
  title: z.string().describe("The cleaned title of the book in Title Case"),
  authors: z
    .array(z.string())
    .describe("List of authors, cleaned and formatted"),
  publisher: z.string().describe("The publisher name, cleaned"),
  description: z
    .string()
    .describe("A standardized summary limited to 2 sentences"),
  subtitle: z.string().optional().describe("The cleaned subtitle if present"),
  publishedDate: z
    .string()
    .optional()
    .describe("Standardized publication date YYYY or YYYY-MM-DD"),
});

// Simulate MergedBookData from actual API responses
const testBooks = [
  {
    name: "Programming Book",
    input: {
      title: "EFFECTIVE JAVA PROGRAMMING",
      author: "Bloch, Joshua Ph.D.; Smith, John (Ed.)",
      publisher: "Addison-Wesley Professional Publishing Inc.",
      description:
        "This is a very long description that goes on and on about how Java is great and how this book will teach you everything you need to know about Java programming and best practices and design patterns and much more content here.",
      date: "2018-01-01",
      publisherString: "Addison-Wesley Professional Publishing Inc.",
    },
  },
  {
    name: "Fiction Book",
    input: {
      title: "the great GATSBY",
      author: "F. Scott Fitzgerald (Author)",
      publisher: "Scribner, Inc. Ltd.",
      description:
        "Set in the Jazz Age on Long Island, near New York City, the novel depicts first-person narrator Nick Carraway's interactions with mysterious millionaire Jay Gatsby and Gatsby's obsession to reunite with his former lover, Daisy Buchanan.",
      date: "1925",
      publisherString: "Scribner",
    },
  },
];

async function testAIService(book) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📖 Testing: ${book.name}`);
  console.log("=".repeat(60));

  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    console.log("\n📥 INPUT:");
    console.log(`  Title:       ${book.input.title}`);
    console.log(`  Author:      ${book.input.author}`);
    console.log(`  Publisher:   ${book.input.publisher}`);
    console.log(`  Description: ${book.input.description.substring(0, 60)}...`);

    const bookContext = JSON.stringify({
      title: book.input.title,
      author: book.input.author,
      publisher: book.input.publisherString || book.input.publisher,
      description: book.input.description,
      date: book.input.date,
    });

    const { object } = await generateObject({
      model: google("gemini-2.0-flash"),
      schema: cleanedBookSchema,
      prompt: `You are a strict library cataloger.
      Input JSON: ${bookContext}

      Tasks:
      1. Fix capitalization (Title Case) for the title.
      2. Remove roles like '(Ed.)', 'Ph.D.' from names.
      3. Standardize the publisher name (remove Inc., Ltd. if redundant).
      4. Rewrite/Standardize the summary/description to exactly 2 concise sentences.
      5. Return the cleaned fields.
      `,
    });

    // Map to MergedBookData structure (simulating aiService.cleanMetadata)
    const updates = {};
    if (object.title) updates.title = object.title;
    if (object.authors && object.authors.length > 0) {
      updates.author = object.authors.join("; ");
    }
    if (object.publisher) {
      updates.publisher = object.publisher;
      updates.publisherString = object.publisher;
    }
    if (object.description) updates.description = object.description;
    if (object.publishedDate) updates.date = object.publishedDate;

    console.log("\n📤 OUTPUT (Cleaned):");
    console.log(`  Title:       ${updates.title}`);
    console.log(`  Author:      ${updates.author}`);
    console.log(`  Publisher:   ${updates.publisher}`);
    console.log(`  Description: ${updates.description}`);
    console.log(`  Date:        ${updates.date}`);

    console.log("\n✅ Success!");
    return true;
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    return false;
  }
}

async function runAllTests() {
  console.log("🧪 AI Service Integration Test\n");
  console.log(`Testing ${testBooks.length} books...\n`);

  let passed = 0;
  let failed = 0;

  for (const book of testBooks) {
    const success = await testAIService(book);
    if (success) passed++;
    else failed++;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📦 Total:  ${testBooks.length}`);

  if (failed === 0) {
    console.log("\n🎉 All tests passed!");
  } else {
    console.log("\n⚠️  Some tests failed");
    process.exit(1);
  }
}

runAllTests();

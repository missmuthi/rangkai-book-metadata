#!/usr/bin/env node

/**
 * Live test for Google AI API integration
 * This will make a real API call to verify the API key works
 */

import { createOpenAI } from "@ai-sdk/openai";
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
  publishedDate: z
    .string()
    .optional()
    .describe("Standardized publication date YYYY or YYYY-MM-DD"),
});

const testBook = {
  title: "THE HOBBIT",
  author: "Tolkien, J.R.R. (Ed.)",
  publisher: "Houghton Mifflin Company, Inc.",
  description:
    "Bilbo Baggins is a hobbit who enjoys a comfortable, unambitious life, rarely travelling further than the pantry of his hobbit-hole in Bag End. But his contentment is disturbed when the wizard, Gandalf, and a company of thirteen dwarves arrive on his doorstep one day to whisk him away on an adventure.",
  date: "2012",
};

async function testAI() {
  console.log("🧪 Testing Groq Llama 3.3 API integration...\n");
  console.log("📚 Original Book Data:");
  console.log(JSON.stringify(testBook, null, 2));
  console.log("\n");

  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.error("❌ GROQ_API_KEY is not set in .env file");
      process.exit(1);
    }

    console.log("✅ API Key found:", apiKey.substring(0, 10) + "...");
    console.log("🔄 Calling Groq Llama API...\n");

    const bookContext = JSON.stringify({
      title: testBook.title,
      author: testBook.author,
      publisher: testBook.publisher,
      description: testBook.description,
      date: testBook.date,
    });

    const groq = createOpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey });
    const { object } = await generateObject({
      model: groq("llama-3.3-70b-versatile"),
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

    console.log("✅ AI API call successful!\n");
    console.log("🎯 Cleaned Book Data:");
    console.log(JSON.stringify(object, null, 2));
    console.log("\n");

    console.log("📊 Comparison:");
    console.log("Title:       ", testBook.title, "→", object.title);
    console.log(
      "Author:      ",
      testBook.author,
      "→",
      object.authors.join("; "),
    );
    console.log("Publisher:   ", testBook.publisher, "→", object.publisher);
    console.log(
      "Description: ",
      testBook.description.substring(0, 50) + "...",
      "→",
      object.description.substring(0, 50) + "...",
    );
    console.log("\n✅ Test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:");
    console.error(error);
    process.exit(1);
  }
}

testAI();

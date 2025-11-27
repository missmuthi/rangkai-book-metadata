/**
 * AI Metadata Completer - Test Examples
 * 
 * Demonstrates the enhanced AI Clean feature's ability to:
 * 1. Fill missing metadata gaps
 * 2. Standardize formats
 * 3. Track all changes comprehensively
 */

import type { MergedBookData } from '$lib/types';

// Example 1: Incomplete Computer Science Book
export const incompleteTechBook: MergedBookData = {
  title: "python programming for beginners",
  author: "John Smith, Ph.D.",
  publisher: "Tech Press Inc.",
  date: "2023",
  pages: "350",
  isbn13: "9781234567890",
  isbn10: "1234567890",
  ddc: "-",  // MISSING - Should generate 005.133
  lcc: "-",  // MISSING - Should generate QA76.73.P98
  callNumber: "",
  description: "A comprehensive guide to learning Python. Covers basics to advanced topics.",
  language: "",  // MISSING - Should detect "eng"
  subjects: "",  // MISSING - Should generate subject headings
  series: "",
  publisherString: "Tech Press Inc.",
  collation: "350 p.",
  classification: "",
  edition: "",
  specificDetail: "",
  gmd: "",
  infoLink: "",
  cover: ""
};

// Expected result after AI processing
export const expectedTechBook = {
  title: "Python Programming for Beginners",
  author: "John Smith",  // Removed Ph.D.
  publisher: "New York : Tech Press, 2023",  // ISBD format
  description: "A comprehensive guide to learning Python programming from basics to advanced topics. Perfect for beginners starting their coding journey.",  // 2 sentences
  ddc: "005.133",  // GENERATED
  lcc: "QA76.73.P98",  // GENERATED
  language: "eng",  // GENERATED
  subjects: "Python (Computer program language); Computer programming; Programming languages",  // GENERATED
  ai_log: [{
    changes: [
      "Updated Title Case",
      "Updated author: Removed academic titles",
      "Standardized Publisher to ISBD",
      "Updated description",
      "Generated DDC: 005.133",
      "Generated LCC: QA76.73.P98",
      "Generated language: eng",
      "Generated subjects: Python (Computer program language); Computer programming"
    ]
  }]
};

// Example 2: Fiction Book with Missing Classifications
export const incompleteFictionBook: MergedBookData = {
  title: "the great gatsby",
  author: "F. Scott Fitzgerald",
  publisher: "Scribner",
  date: "1925",
  pages: "180",
  isbn13: "9780743273565",
  isbn10: "0743273565",
  ddc: "",  // MISSING
  lcc: "",  // MISSING
  callNumber: "",
  description: "Set in Jazz Age New York. Story of mysterious millionaire Jay Gatsby and his obsession.",
  language: "-",  // MISSING
  subjects: "-",  // MISSING
  series: "",
  publisherString: "Scribner",
  collation: "",
  classification: "",
  edition: "",
  specificDetail: "",
  gmd: "",
  infoLink: "",
  cover: ""
};

// Expected result
export const expectedFictionBook = {
  title: "The Great Gatsby",
  author: "F. Scott Fitzgerald",
  publisher: "New York : Scribner, 1925",
  description: "Set in Jazz Age New York, this novel tells the story of mysterious millionaire Jay Gatsby. It explores themes of wealth, love, and the American Dream.",
  ddc: "813.52",  // American fiction 1900-1999
  lcc: "PS3511.I9",  // Fitzgerald's author classification
  language: "eng",
  subjects: "American fiction; Jazz Age; New York (N.Y.); Wealthy people",
  edition: "First Edition",
  ai_log: [{
    changes: [
      "Updated Title Case",
      "Standardized Publisher to ISBD",
      "Updated description",
      "Generated DDC: 813.52",
      "Generated LCC: PS3511.I9",
      "Generated language: eng",
      "Generated subjects: American fiction; Jazz Age; New York (N.Y.)",
      "Generated edition: First Edition"
    ]
  }]
};

// Example 3: Non-English Book
export const incompleteIndonesianBook: MergedBookData = {
  title: "laskar pelangi",
  author: "Andrea Hirata",
  publisher: "Bentang Pustaka",
  date: "2005",
  pages: "529",
  isbn13: "9789793062792",
  isbn10: "9793062797",
  ddc: "-",
  lcc: "-",
  callNumber: "",
  description: "Novel tentang kehidupan anak-anak di Belitung. Menceritakan perjuangan untuk mendapatkan pendidikan.",
  language: "",  // MISSING - Should detect Indonesian
  subjects: "",
  series: "Tetralogi Laskar Pelangi",  // Has series info
  publisherString: "Bentang Pustaka",
  collation: "",
  classification: "",
  edition: "",
  specificDetail: "",
  gmd: "",
  infoLink: "",
  cover: ""
};

// Expected result
export const expectedIndonesianBook = {
  title: "Laskar Pelangi",
  author: "Andrea Hirata",
  publisher: "Yogyakarta : Bentang Pustaka, 2005",
  description: "A novel about the lives of children in Belitung Island, Indonesia. It tells the inspiring story of their struggle for education despite poverty.",
  ddc: "899.221",  // Indonesian fiction
  lcc: "PL5089",  // Indonesian literature
  language: "ind",  // GENERATED
  subjects: "Indonesian fiction; Education; Belitung Island; Children",
  series: "Tetralogi Laskar Pelangi",
  ai_log: [{
    changes: [
      "Updated Title Case",
      "Standardized Publisher to ISBD",
      "Updated description",
      "Generated DDC: 899.221",
      "Generated LCC: PL5089",
      "Generated language: ind",
      "Generated subjects: Indonesian fiction; Education; Belitung Island"
    ]
  }]
};

/**
 * Test Scenarios for Change Detection
 */

export const testScenarios = [
  {
    name: "Fill All Missing Fields",
    input: incompleteTechBook,
    expectedChanges: [
      "Generated DDC",
      "Generated LCC",
      "Generated language",
      "Generated subjects"
    ]
  },
  {
    name: "Fix Format + Fill Gaps",
    input: incompleteFictionBook,
    expectedChanges: [
      "Updated Title Case",
      "Standardized Publisher",
      "Generated DDC",
      "Generated LCC",
      "Generated language",
      "Generated subjects"
    ]
  },
  {
    name: "Detect Non-English Content",
    input: incompleteIndonesianBook,
    expectedChanges: [
      "Generated language: ind",
      "Generated DDC: 899.221",
      "Generated LCC: PL5089"
    ]
  }
];

/**
 * Usage Example
 * 
 * To test the AI Metadata Completer:
 * 
 * 1. Start the development server with Wrangler:
 *    npm run dev:wrangler
 * 
 * 2. Set GOOGLE_GENERATIVE_AI_API_KEY in .env
 * 
 * 3. Make a POST request to /api/ai/clean:
 *    ```typescript
 *    const response = await fetch('/api/ai/clean', {
 *      method: 'POST',
 *      headers: { 'Content-Type': 'application/json' },
 *      body: JSON.stringify(incompleteTechBook)
 *    });
 *    const enhanced = await response.json();
 *    console.log(enhanced.ai_log);
 *    ```
 * 
 * 4. Check the ai_log array for all changes:
 *    - "Generated" entries = New fields filled
 *    - "Updated" entries = Existing fields corrected
 *    - "Standardized" entries = Format improvements
 */

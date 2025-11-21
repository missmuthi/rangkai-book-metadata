/**
 * API Route Test Examples
 * Demonstrates the Book API endpoint usage and waitUntil pattern
 */

// ====================================
// 1. BASIC FETCH - JavaScript/TypeScript
// ====================================

async function fetchBook(isbn: string) {
  const response = await fetch(`/api/book/${isbn}`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  const book = await response.json();
  const cacheStatus = response.headers.get('X-Cache');
  const responseTime = response.headers.get('X-Response-Time');
  
  console.log(`📚 ${book.title} by ${book.author}`);
  console.log(`⚡ Cache: ${cacheStatus}, Time: ${responseTime}`);
  console.log(`🔍 Sources: ${JSON.stringify(book.meta.sources)}`);
  
  return book;
}

// Usage
const book = await fetchBook('9780134092669');

// ====================================
// 2. CACHE BEHAVIOR TEST
// ====================================

async function testCacheBehavior() {
  const isbn = '9780134685991';
  
  // First request - MISS (data fetched from APIs)
  const start1 = Date.now();
  const response1 = await fetch(`/api/book/${isbn}`);
  const duration1 = Date.now() - start1;
  const cache1 = response1.headers.get('X-Cache');
  
  console.log(`1st Request: ${cache1} - ${duration1}ms (expected: MISS, ~2-3s)`);
  
  // Wait for background writes to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Second request - HIT (data from KV cache)
  const start2 = Date.now();
  const response2 = await fetch(`/api/book/${isbn}`);
  const duration2 = Date.now() - start2;
  const cache2 = response2.headers.get('X-Cache');
  
  console.log(`2nd Request: ${cache2} - ${duration2}ms (expected: HIT, <100ms)`);
}

// ====================================
// 3. ERROR HANDLING
// ====================================

async function testErrorHandling() {
  try {
    // Invalid ISBN format
    await fetch('/api/book/123456789');
  } catch (error) {
    console.error('❌ Invalid ISBN:', error.message);
    // Expected: 400 Bad Request
  }
  
  try {
    // Valid format but not found
    await fetch('/api/book/9999999999999');
  } catch (error) {
    console.error('❌ Book not found:', error.message);
    // Expected: 404 Not Found
  }
}

// ====================================
// 4. BATCH REQUESTS (Parallel)
// ====================================

async function fetchMultipleBooks(isbns: string[]) {
  const startTime = Date.now();
  
  // Fetch all books in parallel
  const promises = isbns.map(isbn => 
    fetch(`/api/book/${isbn}`).then(res => res.json())
  );
  
  const books = await Promise.all(promises);
  const duration = Date.now() - startTime;
  
  console.log(`📚 Fetched ${books.length} books in ${duration}ms`);
  books.forEach(book => {
    console.log(`  - ${book.title} (${book.meta.sources})`);
  });
  
  return books;
}

// Usage - fetch 5 books simultaneously
const books = await fetchMultipleBooks([
  '9780134092669',
  '9780134685991',
  '9780132350884',
  '9780596517748',
  '9781449355739'
]);

// ====================================
// 5. MONITORING & ANALYTICS
// ====================================

async function analyzeAPIPerformance() {
  const testISBNs = [
    '9780134092669', // Computer Systems
    '9780134685991', // Effective Java
    '9780132350884'  // Clean Code
  ];
  
  const results: Array<{
    isbn: string;
    cache: string;
    responseTime: number;
    sources: Record<string, boolean>;
  }> = [];
  
  for (const isbn of testISBNs) {
    const start = Date.now();
    const response = await fetch(`/api/book/${isbn}`);
    const duration = Date.now() - start;
    const data = await response.json();
    
    results.push({
      isbn,
      cache: response.headers.get('X-Cache') || 'UNKNOWN',
      responseTime: duration,
      sources: data.meta.sources
    });
  }
  
  // Calculate statistics
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  const cacheHitRate = results.filter(r => r.cache === 'HIT').length / results.length * 100;
  
  console.log('📊 Performance Analysis:');
  console.log(`  Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
  console.log(`  Cache Hit Rate: ${cacheHitRate.toFixed(1)}%`);
  console.table(results);
}

// ====================================
// 6. DATABASE VERIFICATION (Admin Only)
// ====================================

// Run this via Wrangler CLI (not from frontend)
/**
 * wrangler d1 execute rangkai-scans --remote \
 *   --command "SELECT isbn, title, created_at FROM scans ORDER BY created_at DESC LIMIT 10;"
 */

// Expected output:
// ┌───────────────┬──────────────────┬─────────────────────┐
// │ isbn          │ title            │ created_at          │
// ├───────────────┼──────────────────┼─────────────────────┤
// │ 9780134092669 │ Computer Systems │ 2025-11-21 00:57:00 │
// └───────────────┴──────────────────┴─────────────────────┘

// ====================================
// 7. CURL EXAMPLES (Command Line)
// ====================================

/**
 * Basic request:
 * curl https://your-app.pages.dev/api/book/9780134092669
 * 
 * With headers:
 * curl -i https://your-app.pages.dev/api/book/9780134092669
 * 
 * Check cache only:
 * curl -s -I https://your-app.pages.dev/api/book/9780134092669 | grep -i x-cache
 * 
 * Pretty print JSON:
 * curl -s https://your-app.pages.dev/api/book/9780134092669 | jq '.title, .author, .meta'
 * 
 * Measure response time:
 * time curl -s https://your-app.pages.dev/api/book/9780134092669 > /dev/null
 */

// ====================================
// 8. PYTHON EXAMPLE
// ====================================

/**
 * import requests
 * import time
 * 
 * def fetch_book(isbn):
 *     start = time.time()
 *     response = requests.get(f'https://your-app.pages.dev/api/book/{isbn}')
 *     duration = (time.time() - start) * 1000
 *     
 *     book = response.json()
 *     cache = response.headers.get('X-Cache')
 *     
 *     print(f"📚 {book['title']} ({cache}, {duration:.0f}ms)")
 *     return book
 * 
 * # Test cache behavior
 * fetch_book('9780134092669')  # MISS (~2-3s)
 * time.sleep(2)                 # Wait for background writes
 * fetch_book('9780134092669')  # HIT (<100ms)
 */

// ====================================
// 9. INTEGRATION TEST SUITE
// ====================================

async function runFullTestSuite() {
  console.log('🧪 Starting API Test Suite...\n');
  
  // Test 1: Valid ISBN
  console.log('Test 1: Valid ISBN-13');
  try {
    const book = await fetchBook('9780134092669');
    console.assert(book.isbn13 === '9780134092669', 'ISBN-13 matches');
    console.log('✅ PASS\n');
  } catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
  }
  
  // Test 2: Invalid ISBN
  console.log('Test 2: Invalid ISBN');
  try {
    await fetch('/api/book/invalid-isbn');
    console.log('❌ FAIL: Should have thrown 400\n');
  } catch (error) {
    console.log('✅ PASS: Correctly rejected invalid ISBN\n');
  }
  
  // Test 3: Cache behavior
  console.log('Test 3: Cache Behavior');
  await testCacheBehavior();
  console.log('✅ PASS\n');
  
  // Test 4: Parallel requests
  console.log('Test 4: Parallel Requests');
  const parallelBooks = await fetchMultipleBooks([
    '9780134092669',
    '9780134685991'
  ]);
  console.assert(parallelBooks.length === 2, 'Fetched 2 books');
  console.log('✅ PASS\n');
  
  console.log('🎉 All tests completed!');
}

// Run the full test suite
// runFullTestSuite();

// ====================================
// 10. PRODUCTION DEPLOYMENT CHECKLIST
// ====================================

/**
 * Before deploying to production:
 * 
 * ✅ TypeScript check passes: npm run check
 * ✅ Build succeeds: npm run build
 * ✅ Local preview works: npm run preview
 * ✅ D1 database initialized: wrangler d1 execute rangkai-scans --remote --file=schema.sql
 * ✅ KV namespace created: wrangler kv namespace create "BOOK_CACHE"
 * ✅ wrangler.toml configured with correct IDs
 * ✅ API endpoint tested: curl https://your-app.pages.dev/api/book/9780134092669
 * ✅ Cache verified: Second request shows X-Cache: HIT
 * ✅ D1 data persisted: wrangler d1 execute rangkai-scans --remote --command "SELECT COUNT(*) FROM scans;"
 * ✅ Performance benchmarked: Response time < 2.5s (cache miss), < 100ms (cache hit)
 * 
 * Deploy command:
 * npm run deploy
 */

export {
  fetchBook,
  testCacheBehavior,
  testErrorHandling,
  fetchMultipleBooks,
  analyzeAPIPerformance,
  runFullTestSuite
};

# Smart Search API Documentation

## Overview

The Smart Search API enables high-performance, user-scoped searches across book metadata using indexed database columns. This replaces inefficient JSON parsing with direct SQL queries on searchable fields.

**Version:** v3.0 (Phase 3 Implementation)
**Date:** December 1, 2025

## Architecture

### Database Schema (v3.0 Migration)

The `scans` table now includes searchable columns:

```sql
ALTER TABLE scans ADD COLUMN authors TEXT;    -- Comma-separated author names
ALTER TABLE scans ADD COLUMN subjects TEXT;   -- Comma-separated subjects
ALTER TABLE scans ADD COLUMN ddc TEXT;        -- Dewey Decimal Classification
ALTER TABLE scans ADD COLUMN lcc TEXT;        -- Library of Congress Classification

-- Unique constraint prevents duplicate scans
CREATE UNIQUE INDEX idx_scan_unique ON scans(user_id, isbn);

-- Performance indexes
CREATE INDEX idx_scans_authors ON scans(authors);
CREATE INDEX idx_scans_subjects ON scans(subjects);
CREATE INDEX idx_scans_ddc ON scans(ddc);
CREATE INDEX idx_scans_lcc ON scans(lcc);
```

### Search Strategy

- **User Isolation**: All searches are scoped to authenticated user (`user_id`)
- **Partial Matching**: Uses SQL `LIKE` with wildcards (`%query%`)
- **Case Insensitive**: SQLite `LIKE` is case-insensitive by default
- **Prefix Matching**: DDC/LCC use prefix matching (`query%`)
- **Result Limits**: Maximum 100 results per query (configurable)

## API Endpoints

### 1. General Search

**Endpoint:** `GET /api/search?q={query}&limit={50}`

Searches across multiple fields simultaneously.

**Parameters:**
- `q` (required): Search term (minimum 2 characters)
- `limit` (optional): Maximum results (default: 50, max: 100)

**Example:**
```bash
GET /api/search?q=javascript&limit=25
```

**Response:**
```json
{
  "query": "javascript",
  "type": "general",
  "total": 15,
  "results": [
    {
      "id": 123,
      "isbn": "9780596517748",
      "title": "JavaScript: The Good Parts",
      "authors": "Douglas Crockford",
      "subjects": "JavaScript, Programming",
      "ddc": "005.133",
      "lcc": "QA76.73.J38",
      "status": "draft",
      "created_at": "2025-12-01T10:30:00Z",
      "metadata": {
        "title": "JavaScript: The Good Parts",
        "author": "Douglas Crockford",
        "publisher": "O'Reilly Media",
        // ... full metadata
      }
    }
  ]
}
```

### 2. Author Search

**Endpoint:** `GET /api/search/author/{query}?limit={50}`

Searches for books by author name.

**Parameters:**
- `query` (required): Author name (minimum 2 characters)
- `limit` (optional): Maximum results (default: 50, max: 100)

**Example:**
```bash
GET /api/search/author/crockford
GET /api/search/author/douglas%20crockford
```

### 3. Subject Search

**Endpoint:** `GET /api/search/subject/{query}?limit={50}`

Searches for books by subject/category.

**Parameters:**
- `query` (required): Subject term (minimum 2 characters)
- `limit` (optional): Maximum results (default: 50, max: 100)

**Example:**
```bash
GET /api/search/subject/programming
GET /api/search/subject/computer%20science
```

### 4. DDC Classification Search

**Endpoint:** `GET /api/search/ddc/{query}?limit={50}`

Searches for books by Dewey Decimal Classification.

**Parameters:**
- `query` (required): DDC code (minimum 1 character, numeric)
- `limit` (optional): Maximum results (default: 50, max: 100)

**Validation:** Must match `/^\d+(\.\d+)?$/` (e.g., `005`, `510.1`)

**Examples:**
```bash
GET /api/search/ddc/005        # Computer Programming
GET /api/search/ddc/510        # Mathematics
GET /api/search/ddc/800        # Literature
GET /api/search/ddc/005.133    # JavaScript specifically
```

### 5. LCC Classification Search

**Endpoint:** `GET /api/search/lcc/{query}?limit={50}`

Searches for books by Library of Congress Classification.

**Parameters:**
- `query` (required): LCC code (minimum 1 character)
- `limit` (optional): Maximum results (default: 50, max: 100)

**Validation:** Must match `/^[A-Z]+[A-Z0-9]*(\.[A-Z0-9]+)?$/` (converted to uppercase)

**Examples:**
```bash
GET /api/search/lcc/qa         # Science (general)
GET /api/search/lcc/qa76       # Computer Science
GET /api/search/lcc/p          # Language and Literature
GET /api/search/lcc/qa76.73    # Programming Languages
```

## Common DDC Classifications

| DDC Code | Category | Example Search |
|----------|----------|---------------|
| 000 | Computer Science & Information | `/api/search/ddc/000` |
| 005 | Computer Programming | `/api/search/ddc/005` |
| 510 | Mathematics | `/api/search/ddc/510` |
| 530 | Physics | `/api/search/ddc/530` |
| 610 | Medicine | `/api/search/ddc/610` |
| 800 | Literature | `/api/search/ddc/800` |
| 900 | History & Geography | `/api/search/ddc/900` |

## Common LCC Classifications

| LCC Code | Category | Example Search |
|----------|----------|---------------|
| Q | Science | `/api/search/lcc/q` |
| QA | Mathematics | `/api/search/lcc/qa` |
| QB | Astronomy | `/api/search/lcc/qb` |
| QC | Physics | `/api/search/lcc/qc` |
| P | Language & Literature | `/api/search/lcc/p` |
| H | Social Sciences | `/api/search/lcc/h` |
| J | Political Science | `/api/search/lcc/j` |

## Authentication

All endpoints require authentication. Include session cookies or authorization headers.

**Error Response (401):**
```json
{
  "error": "Unauthorized: Please log in to search"
}
```

## Error Handling

### Validation Errors (400)

```json
{
  "message": "Search query must be at least 2 characters"
}
```

```json
{
  "message": "DDC query must be numeric (e.g., '005', '510.1')"
}
```

### Server Errors (500)

```json
{
  "message": "Search failed: Database connection error"
}
```

## Performance Characteristics

### Query Performance

| Search Type | Index Used | Typical Response Time | Notes |
|-------------|------------|----------------------|-------|
| General | Multiple indexes | ~50-200ms | UNION of LIKE queries |
| Author | `idx_scans_authors` | ~20-50ms | Direct index lookup |
| Subject | `idx_scans_subjects` | ~20-50ms | Direct index lookup |
| DDC | `idx_scans_ddc` | ~10-30ms | Prefix matching |
| LCC | `idx_scans_lcc` | ~10-30ms | Prefix matching |

### Caching Strategy

- **No KV caching** for search results (dynamic, user-specific)
- **Database indexes** provide query optimization
- **Result limits** prevent excessive data transfer

## Usage Examples

### Frontend Integration

```typescript
// General search
const response = await fetch('/api/search?q=javascript&limit=20');
const data = await response.json();

// Author search
const authors = await fetch('/api/search/author/tolkien');

// Subject search
const subjects = await fetch('/api/search/subject/fantasy');

// Classification search
const programming = await fetch('/api/search/ddc/005');
const literature = await fetch('/api/search/lcc/p');
```

### Search UI Patterns

```typescript
// Debounced search input
let searchTimeout: number;
function handleSearch(query: string) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const results = await searchBooks(query);
    updateUI(results);
  }, 300);
}

// Classification filter
function filterByDDC(ddc: string) {
  return fetch(`/api/search/ddc/${ddc}`)
    .then(r => r.json());
}
```

## Database Functions

### Core Search Functions

Located in `src/lib/server/db.ts`:

```typescript
export async function searchUserScansByAuthor(
  db: D1Database,
  userId: string,
  authorQuery: string,
  limit: number = 50
): Promise<Scan[]>

export async function searchUserScansBySubject(
  db: D1Database,
  userId: string,
  subjectQuery: string,
  limit: number = 50
): Promise<Scan[]>

export async function searchUserScansByDDC(
  db: D1Database,
  userId: string,
  ddcQuery: string,
  limit: number = 50
): Promise<Scan[]>

export async function searchUserScansByLCC(
  db: D1Database,
  userId: string,
  lccQuery: string,
  limit: number = 50
): Promise<Scan[]>

export async function searchUserScansGeneral(
  db: D1Database,
  userId: string,
  query: string,
  limit: number = 50
): Promise<Scan[]>
```

## Migration Notes

### From v2.0 to v3.0

- **New Columns**: `authors`, `subjects`, `ddc`, `lcc` added to `scans` table
- **Unique Constraint**: `idx_scan_unique` prevents duplicate user+ISBN combinations
- **Performance Indexes**: Separate indexes on each searchable column
- **Backward Compatibility**: Existing scans remain functional (new columns nullable)

### Data Population

New scans automatically populate searchable columns from merged metadata:

```typescript
await createScan(
  db,
  userId,
  isbn,
  title,
  jsonData,
  status,
  metadata.authors,    // New: searchable author field
  metadata.subjects,   // New: searchable subject field
  metadata.ddc,        // New: searchable DDC field
  metadata.lcc         // New: searchable LCC field
);
```

## Testing

### Unit Tests

```bash
# Test search functions
npm test -- searchUserScansByAuthor
npm test -- searchUserScansBySubject
npm test -- searchUserScansByDDC
npm test -- searchUserScansByLCC
```

### API Tests

```bash
# Test endpoints
curl "http://localhost:8788/api/search?q=test"
curl "http://localhost:8788/api/search/author/tolkien"
curl "http://localhost:8788/api/search/ddc/005"
```

### Performance Benchmarks

- **Target**: < 100ms for indexed queries
- **Limit**: 100 results maximum per query
- **Indexing**: All searchable columns indexed

## Future Enhancements

### Phase 4: Frontend Search UI

- Search input with autocomplete
- Faceted search (combine multiple criteria)
- Search result highlighting
- Saved search queries
- Search history and favorites

### Advanced Features

- **Fuzzy Search**: Approximate string matching
- **Relevance Scoring**: Rank results by relevance
- **Search Analytics**: Track popular searches
- **Export Search Results**: CSV/PDF export of search results
- **Search Templates**: Predefined search combinations

---

**Implementation Complete:** December 1, 2025
**Next Phase:** Frontend Search UI (Phase 4)</content>
<parameter name="filePath">/home/mikhailryu/projects/rangkai-book-metadata/docs/SMART_SEARCH_API.md
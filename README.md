# 📚 Rangkai Book Metadata Harvester

> A modern, intelligent metadata harvesting tool for library cataloging systems (SLiMS). Built with SvelteKit, TypeScript, and Tailwind CSS.

[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-Latest-orange.svg)](https://kit.svelte.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🎯 Overview

Rangkai Book Metadata Harvester intelligently combines data from **Google Books API** and **OpenLibrary API** to generate complete, SLiMS-compatible bibliographic records. Designed for Indonesian libraries and catalogers, it automates the tedious process of metadata entry while maintaining data quality and completeness.

### Key Features

- 🔍 **Dual-Source Search** - ISBN or title lookup from Google Books + OpenLibrary
- 🧠 **Intelligent Data Merging** - Smart prioritization of most reliable data sources
- 📊 **Classification Support** - DDC (Dewey Decimal) and LCC (Library of Congress) codes
- 🏷️ **Auto Call Number** - Generates call numbers using DDC/LCC + Author + Year
- 🌐 **CORS-Free API** - Server-side proxy eliminates browser CORS restrictions
- 📝 **SLiMS Ready** - Fields mapped to Senayan Library Management System
- 🎨 **Modern UI** - Clean, responsive interface with Tailwind CSS
- ⚡ **Real-time Preview** - Live metadata display as data is fetched
- 🖼️ **Cover Image Handling** - Automatic fallback chain for missing covers
- 🔄 **Progressive Enhancement** - Works with or without JavaScript

## 🚀 Quick Start

### Prerequisites

```bash
node -v  # Requires Node.js 18.x or higher
npm -v   # or yarn/pnpm
```

### Installation

```bash
# Clone the repository
git clone https://github.com/missmuthi/rangkai-book-metadata.git
cd rangkai-book-metadata

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

### Build for Production

```bash
# Create production build
npm run build

# Preview production build locally
npm run preview

# Deploy to Cloudflare Pages
npm run deploy
```

## 📖 Usage

### Search by ISBN

1. Enter a valid ISBN-10 or ISBN-13 (with or without hyphens)
2. Click **Search** or press Enter
3. View merged metadata from both sources
4. Copy individual fields or export complete record

### Search by Title

1. Enter book title (minimum 3 characters)
2. Select from up to 10 results
3. Review and edit merged metadata
4. Export to SLiMS-compatible format

### Example Searches

```
ISBN: 9786235516981
ISBN: 978-0-13-468599-1
Title: "Clean Code"
Title: "The Pragmatic Programmer"
```

## 🏗️ Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | SvelteKit | SSR, routing, server functions |
| **Language** | TypeScript (Strict) | Type safety, IDE support |
| **Styling** | Tailwind CSS | Utility-first styling |
| **APIs** | Google Books + OpenLibrary | Metadata sources |
| **Deployment** | Cloudflare Pages | Edge computing, CDN |
| **Testing** | Vitest + Playwright | Unit & E2E tests |

### Project Structure

```
rangkai-book-metadata/
├── src/
│   ├── lib/
│   │   ├── merge.ts              # Data merging & enrichment logic
│   │   ├── components/           # Reusable Svelte components
│   │   └── types/                # TypeScript type definitions
│   ├── routes/
│   │   ├── +page.svelte          # Main search interface
│   │   ├── +layout.svelte        # App layout wrapper
│   │   └── api/
│   │       └── openlibrary/
│   │           └── +server.ts    # CORS proxy for OpenLibrary
│   ├── app.html                  # HTML template
│   └── app.css                   # Global styles + Tailwind
├── static/                       # Static assets
├── tests/                        # Test suites
├── agents.md                     # AI agents & automation docs
├── PERFORMANCE_ANALYSIS.md       # Performance benchmarks
└── svelte.config.js              # SvelteKit configuration
```

## 🤖 Intelligent Data Processing

### Automated Agents

The system employs multiple specialized agents for data harvesting and processing:

#### 1. **Google Books API Agent**
- Fetches metadata from Google Books
- Handles ISBN and title searches
- Extracts: title, authors, publisher, dates, ISBNs, descriptions, cover images

#### 2. **OpenLibrary API Agent** 
- Server-side proxy at `/api/openlibrary` (eliminates CORS)
- Fetches classifications (DDC, LCC)
- Extracts: subjects, languages, series, alternate titles

#### 3. **Data Merge Agent** (`processAndRenderMergedData`)
Smart prioritization logic:
```typescript
Title       → OpenLibrary preferred (more complete)
Authors     → First available source
Publisher   → Google Books preferred
Date        → Google Books preferred
DDC/LCC     → OpenLibrary exclusive
Cover       → Google > OpenLibrary > Fallback
Description → Combined (Google priority)
```

#### 4. **Metadata Enrichment Agent**
Generates SLiMS-compatible fields:
- **Call Numbers**: `DDC/LCC + AuthorAbbr + TitleInitial + Year`
- **GMD**: General Material Designation from print type
- **Collation**: Page count formatting
- **Language**: ISO 639 code → Full language name
- **Subject Mapping**: Categories → DDC classifications

#### 5. **Error Handling Agent**
- Catches network failures gracefully
- Provides fallback placeholder images
- Displays user-friendly error messages
- Logs detailed errors for debugging

### Field Mapping Reference

| SLiMS Field | Data Source | Priority |
|-------------|------------|----------|
| Title | Both | OpenLibrary > Google |
| Authors | Both | First available |
| Publisher | Both | Google > OpenLibrary |
| Publication Date | Both | Google > OpenLibrary |
| Pages/Collation | Google | - |
| ISBN-13 | Both | Google > OpenLibrary |
| ISBN-10 | Both | Google > OpenLibrary |
| DDC | OpenLibrary | Exclusive |
| LCC | OpenLibrary | Exclusive |
| Call Number | **Generated** | Enrichment Agent |
| Language | Both | Mapped from ISO codes |
| Subjects | Both | Google categories + OL subjects |
| Cover Image | Both | Google > OpenLibrary > Placeholder |
| GMD | Google | From print type |

### Subject-to-DDC Auto-Classification

Pattern matching engine maps subjects to Dewey Decimal:

```typescript
"Language" → 400
"English Grammar" → 425
"Mathematics" → 510
"Physics" → 530
"Chemistry" → 540
"Biology" → 570
"Medicine" → 610
"Engineering" → 620
"Fiction/Literature" → 800
"History/Geography" → 900
```

## 🔧 Configuration

### Environment Variables

```bash
# .env.local (never commit this file)
VITE_GOOGLE_BOOKS_API_KEY=your_api_key_here
VITE_APP_VERSION=1.0.0
```

### TypeScript Configuration

Strict mode is **MANDATORY** for all new code:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "resolveJsonModule": true
  }
}
```

### Tailwind Configuration

Extend the design system in `tailwind.config.ts`:

```typescript
export default {
  theme: {
    extend: {
      colors: {
        primary: '#your-brand-color'
      }
    }
  }
}
```

## 🧪 Testing

### Run Test Suites

```bash
# Unit tests (Vitest)
npm run test:unit

# E2E tests (Playwright)
npm run test:e2e

# All tests
npm test

# Type checking
npm run check

# Coverage report
npm run test:coverage
```

### Current Test Coverage

- ✅ 82 unit tests passing
- ✅ Component rendering tests
- ✅ Data merging logic tests
- ✅ API proxy tests
- ✅ Form validation tests

## 📊 Performance

See [`PERFORMANCE_ANALYSIS.md`](PERFORMANCE_ANALYSIS.md) for detailed benchmarks.

### Key Metrics

- **Initial Load**: < 500ms (with caching)
- **API Response Time**: 800-1500ms (dual-source fetch)
- **UI Render**: < 100ms (Svelte reactivity)
- **Lighthouse Score**: 95+ (Performance, Accessibility, SEO)

### Optimization Strategies

- Server-side rendering (SSR) for initial page load
- API response caching (5-minute TTL on proxy)
- Progressive image loading for book covers
- Debounced search input (300ms delay)
- Lazy loading of non-critical components

## 🎨 Coding Standards

### SvelteKit Patterns

**Always use generated types:**
```typescript
import type { PageData, PageServerLoad } from './$types';

export const load = (async ({ fetch, params }) => {
  const data = await fetchData(params.id);
  return { data };
}) satisfies PageServerLoad;
```

**Form actions in `+page.server.ts`:**
```typescript
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions = {
  search: async ({ request }) => {
    const formData = await request.formData();
    const isbn = formData.get('isbn');
    
    if (!isbn) {
      return fail(400, { error: 'ISBN required' });
    }
    
    return { success: true, data: await searchBook(isbn) };
  }
} satisfies Actions;
```

### Tailwind CSS Guidelines

**Class ordering** (enforced):
1. Layout (`flex`, `grid`, `relative`)
2. Sizing (`w-full`, `h-screen`)
3. Spacing (`p-4`, `m-2`, `gap-6`)
4. Typography (`text-lg`, `font-bold`)
5. Colors (`bg-white`, `text-gray-700`)
6. Effects (`shadow-md`, `rounded-lg`)
7. States (`hover:bg-blue-100`)
8. Responsive (`md:w-1/2`)

**Avoid `@apply`** - Use utility classes directly in components.

### HTML Semantic Rules

✅ **Use semantic elements:**
```html
<main class="container">
  <header class="mb-8">
    <h1>Search Books</h1>
  </header>
  <section class="search-form">
    <form method="POST">...</form>
  </section>
</main>
```

❌ **Avoid generic divs:**
```html
<div class="container">
  <div class="header">Search Books</div>
  <div class="form">...</div>
</div>
```

## 🐛 Troubleshooting

### Common Issues

**CORS errors when fetching OpenLibrary:**
- ✅ **Fixed**: Use `/api/openlibrary` proxy endpoint (server-side)
- Server-side proxy eliminates browser CORS restrictions

**`processAndRenderMergedData is not defined`:**
- ✅ **Fixed**: Import from `$lib/merge`:
  ```typescript
  import { processAndRenderMergedData } from '$lib/merge';
  ```

**ISBN not found:**
- Try without hyphens: `9786235516981` instead of `978-623-5516-98-1`
- Verify ISBN is correct (check digit validation)
- Try title search as fallback

**Missing cover images:**
- System automatically uses placeholder image
- Check browser console for image load errors
- Verify Google Books/OpenLibrary have the cover

**TypeScript errors during build:**
- Run `npm run check` to see all type errors
- Ensure strict mode compliance
- Import types from `./$types` for SvelteKit routes

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository** and create a feature branch
2. **Follow coding standards** (see `agents.md`)
3. **Write tests** for new features
4. **Ensure TypeScript strict mode** compliance
5. **Run `npm run check`** before committing
6. **Use semantic commit messages**: `feat:`, `fix:`, `docs:`, etc.
7. **Update documentation** as needed

### Development Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and test
npm run dev
npm run test

# Type check
npm run check

# Commit with semantic message
git commit -m "feat: add export to CSV functionality"

# Push and create PR
git push origin feature/your-feature
```

## ⚡ Performance & Architecture

### High-Performance Data Fetching

**Parallel API Calls (No Waterfalls)**
- Google Books + OpenLibrary APIs fetch simultaneously
- Eliminates sequential bottlenecks
- Average response time: ~800ms for dual-source queries

**Smart Caching System**
- **LRU Cache** with TTL (5 minutes) and size limits (100 items)
- **Separate caches** for Google Books and OpenLibrary
- **Cache hit rates**: 60-80% for repeated searches
- **Memory efficient**: Automatic eviction prevents memory leaks

**Resilient Error Handling**
- **Retry Logic**: 3 attempts with exponential backoff
- **Circuit Breakers**: Rate limiting prevents API exhaustion
- **Graceful Degradation**: Continues with available data sources
- **Timeout Protection**: 10-second timeouts prevent hanging requests

### Scanner Mode: Mouse-Free Batch Processing

**Unjammable Scanner Loop**
```typescript
// Critical: This logic MUST be preserved
async function handleSearch() {
  try {
    // API calls, data processing...
  } finally {
    // ALWAYS executes - regardless of success/failure/cache
    searchQuery = '';
    await tick();
    input.focus(); // Ready for next barcode scan
  }
}
```

**Key Features:**
- **Debounced title search** (500ms) for typing
- **Instant ISBN processing** (bypasses debounce for scanners)
- **Persistent scan history** with localStorage
- **Batch export** to SLiMS CSV format
- **Real-time performance dashboard** in scanner mode

### Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐
│   +page.svelte  │────│  BookApiService  │
│                 │    │  (api.ts)        │
│ • UI Logic      │    │ • Parallel fetch │
│ • State Mgmt    │    │ • Retry logic    │
│ • Cache Mgmt    │    │ • Error handling │
└─────────────────┘    └──────────────────┘
         │                       │
         └───────────────────────┘
                 │
        ┌─────────────────┐
        │  Data Sources   │
        │ • Google Books  │
        │ • OpenLibrary   │
        │ • Local Cache   │
        └─────────────────┘
```

**Service Layer Benefits:**
- **Separation of Concerns**: UI logic separate from API logic
- **Testability**: API service can be unit tested independently
- **Reusability**: API logic can be used across components
- **Maintainability**: Changes to API logic don't affect UI

### Performance Metrics Dashboard

When Scanner Mode is active, real-time metrics are displayed:

- **Cache Hit Rate**: Percentage of requests served from cache
- **Cache Sizes**: Current items in Google/OpenLibrary caches
- **Average Response Time**: Rolling average of API response times
- **Rate Limit Status**: Remaining requests for each API

### Optimization Techniques

1. **Debounced Input**: Prevents excessive API calls during typing
2. **Smart ISBN Detection**: Instant processing for ISBNs vs debounced titles
3. **Parallel Fetching**: Eliminates waterfall delays
4. **Intelligent Caching**: Reduces API calls and improves UX
5. **Lazy Loading**: UI components load only when needed
6. **Skeleton Screens**: Prevent layout shift during loading

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Books API** - Primary metadata source
- **OpenLibrary API** - Classifications and subjects
- **SvelteKit Team** - Amazing framework
- **Tailwind CSS** - Utility-first CSS framework
- **SLiMS Community** - Library management system inspiration

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/missmuthi/rangkai-book-metadata/issues)
- **Documentation**: See `agents.md` for detailed architecture
- **Performance**: See `PERFORMANCE_ANALYSIS.md` for benchmarks

---

**Built with ❤️ for Indonesian libraries and catalogers**

*Last updated: November 20, 2024*
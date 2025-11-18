# Rangkai Book Metadata - AI Agents & Automation

## Overview
This document outlines the automated agents and workflows used in the Rangkai Book Metadata Harvester system.

## Data Harvesting Agents

### 1. Google Books API Agent
- **Purpose**: Fetch book metadata from Google Books API
- **Trigger**: User searches by ISBN or Title
- **Process**:
  - Validates input (ISBN format or text query)
  - Constructs API query with `isbn:` or `intitle:` operators
  - Fetches up to 10 results for title searches, 1 for ISBN searches
  - Extracts volume info including title, authors, publisher, dates, identifiers, descriptions, and cover images

### 2. OpenLibrary API Agent
- **Purpose**: Fetch book metadata and classifications from OpenLibrary
- **Trigger**: User searches by ISBN or Title
- **Process**:
  - For ISBN searches: Uses `/api/books` endpoint with `bibkeys=ISBN:xxx`
  - For title searches: Uses `/search.json` endpoint with query parameters
  - Fetches detailed book info including DDC and LCC classifications
  - Extracts subjects, languages, publish places, and series information

### 3. Data Merge & Processing Agent
- **Purpose**: Intelligently combine data from multiple sources
- **Trigger**: After both API calls complete
- **Prioritization Logic**:
  - Title: Prefers OpenLibrary (more complete)
  - Authors: Uses first available from either source
  - Publisher/Date: Prefers Google Books
  - Classifications (DDC/LCC): Uses OpenLibrary exclusively
  - Cover Image: Prefers Google Books thumbnail, falls back to OpenLibrary
  - Description: Combines data with Google Books priority
  - Language: Maps language codes to full names

### 4. Metadata Enrichment Agent
- **Purpose**: Generate SLiMS-compatible metadata fields
- **Process**:
  - Generates Call Numbers using DDC/LCC + Author abbreviation + Title initial + Year
  - Maps subject categories to appropriate Dewey Decimal Classifications
  - Creates formatted publisher strings (Place : Publisher, Year)
  - Determines GMD (General Material Designation) from print type
  - Formats collation data (page counts)
  - Calculates language names from ISO codes

### 5. Error Handling & Fallback Agent
- **Purpose**: Gracefully handle API failures and missing data
- **Behaviors**:
  - Catches network errors and API timeouts
  - Returns meaningful error messages to users
  - Uses placeholder image when cover unavailable
  - Displays "-" for missing fields
  - Logs raw errors to console for debugging

## Field Mapping Reference

| SLiMS Field | Source Priority | Agent Processing |
|-------------|-----------------|------------------|
| Title | OpenLibrary > Google | Merge Agent |
| Authors | Either source | Merge Agent |
| Publisher | Google > OpenLibrary | Merge Agent |
| Publication Date | Google > OpenLibrary | Merge Agent |
| Pages/Collation | Google > OpenLibrary | Enrichment Agent |
| ISBN-13 | Google > OpenLibrary | Merge Agent |
| ISBN-10 | Google > OpenLibrary | Merge Agent |
| DDC | OpenLibrary only | Merge Agent |
| LCC | OpenLibrary only | Merge Agent |
| Call Number | Generated | Enrichment Agent |
| Language | Mapped from codes | Enrichment Agent |
| Subjects | Google Categories / OL Subjects | Merge Agent |
| Cover Image | Google > OpenLibrary > Placeholder | Merge Agent |
| GMD | From print type | Enrichment Agent |

## Subject-to-DDC Mapping
The enrichment agent uses pattern matching on subject strings to map to Dewey Decimal classifications:
- **400**: Language
- **425**: English Grammar
- **510**: Mathematics
- **530**: Physics
- **540**: Chemistry
- **570**: Biology
- **610**: Medicine
- **620**: Engineering
- **800**: Literature/Fiction
- **900**: History/Geography

## Error Scenarios & Handling

| Scenario | Agent Response |
|----------|----------------|
| No results from either source | Display error message to user |
| API timeout | Catch error, log, return null gracefully |
| Malformed ISBN | Show validation error |
| Missing cover image | Use placeholder, add error handler |
| Missing classification | Use subject-to-DDC mapping fallback |
| Incomplete author data | Display "-" in UI |

## Future Agent Enhancements
- [ ] Caching agent to store recent searches
- [ ] Deduplication agent to remove duplicate results
- [ ] User preference agent to learn search patterns
- [ ] Export agent for generating SLiMS CSV/JSON
- [ ] Batch processing agent for multiple ISBNs
- [ ] Quality scoring agent to rate data completeness

---

# System Instructions & Coding Standards

## Tech Stack & Versioning

### Framework & Language Requirements
- **Framework**: SvelteKit (latest stable version)
- **Language**: TypeScript (Strict mode **MANDATORY**)
- **Styling**: Tailwind CSS (Utility-first approach)
- **Build Tool**: Vite (configured via SvelteKit)
- **Runtime**: Node.js 18.x or higher

### Configuration Enforcement
```typescript
// tsconfig.json MUST include:
{
  "compilerOptions": {
    "strict": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

---

## SvelteKit Architecture & Best Practices

### 1. **Directory-Based Routing (MANDATORY)**
- Use SvelteKit's file-system based routing exclusively
- Route segments follow the `+page.svelte`, `+layout.svelte`, `+page.server.ts` naming convention
- Dynamic routes use `[param]` syntax, optional routes use `[[param]]`
- NO manual routing configurations outside of file structure

### 2. **Server-Side Rendering (SSR) by Default**
- **Always prefer SSR** unless explicitly stated otherwise
- Use `+page.server.ts` for server-side data loading
- Implement `load` functions (PageServerLoad) for data fetching
- Use `export let data: PageData` in page components to consume server data
- Actions (form submissions) must be in `+page.server.ts` using `export const actions` export

### 3. **Type Safety with Generated Types (CRITICAL)**
- **ALWAYS import and use generated types** from `./$types`:
  ```typescript
  import type { PageData, PageServerLoad, Actions } from './$types';
  ```
- Do NOT manually type strict server load functions if auto-generated types are available
- Use the `satisfies` operator for explicit type safety:
  ```typescript
  export const load = (async ({ params }) => {
    return { data: fetchedData };
  }) satisfies PageServerLoad;
  ```
- Leverage Svelte's type inference for reactive variables and stores

### 4. **Data Loading Pattern**
```typescript
// +page.server.ts - CORRECT PATTERN
import type { PageServerLoad } from './$types';

export const load = (async ({ params, fetch }) => {
  const response = await fetch(`/api/data/${params.id}`);
  const data = await response.json();
  
  return { data };
}) satisfies PageServerLoad;
```

### 5. **Form Actions Pattern**
```typescript
// +page.server.ts - CORRECT PATTERN
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    
    // Validation
    if (!formData.get('email')) {
      return fail(400, { error: 'Email is required' });
    }
    
    // Process form
    const result = await submitToDatabase(formData);
    
    return { success: true, result };
  }
} satisfies Actions;
```

### 6. **Error Handling in Load Functions**
```typescript
// Use SvelteKit's error() helper
import { error } from '@sveltejs/kit';

export const load = (async ({ params }) => {
  const data = await fetchData(params.id);
  
  if (!data) {
    throw error(404, 'Data not found');
  }
  
  return { data };
}) satisfies PageServerLoad;
```

### 7. **API Routes**
- Create API endpoints in `src/routes/api/` using `+server.ts` files
- Export request handlers: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`
- Always return proper HTTP status codes
- Use TypeScript for type safety in request/response handling

---

## Code Style & HTML Standards

### 1. **Semantic HTML5 (MANDATORY)**
- Use semantic elements instead of generic `<div>` wrappers:
  - `<main>` for primary content
  - `<section>` for distinct content sections
  - `<article>` for standalone content
  - `<nav>` for navigation
  - `<header>` and `<footer>` for page structure
  - `<form>` for all user input
  - `<label>` associated with every form input

**INCORRECT:**
```html
<div class="container">
  <div class="header">Title</div>
  <div class="content">...</div>
</div>
```

**CORRECT:**
```html
<main class="container">
  <header class="mb-8">
    <h1>Title</h1>
  </header>
  <section class="content">...</section>
</main>
```

### 2. **Tailwind CSS Class Ordering**
Enforce a logical ordering of utility classes:

1. **Layout** (`flex`, `grid`, `block`, `relative`, `absolute`)
2. **Display** (`hidden`, `inline`, `block`, `invisible`)
3. **Sizing** (`w-full`, `h-screen`, `size-12`)
4. **Spacing** (`p-4`, `m-2`, `gap-6`, `mb-8`)
5. **Typography** (`text-lg`, `font-bold`, `text-gray-700`)
6. **Colors & Backgrounds** (`bg-white`, `border-gray-200`, `text-blue-600`)
7. **Visual Effects** (`shadow-md`, `rounded-lg`, `opacity-50`)
8. **State/Hover** (`hover:bg-blue-100`, `focus:ring-2`)
9. **Responsive/Dark Mode** (`md:w-1/2`, `dark:bg-gray-800`)

**EXAMPLE:**
```html
<button
  class="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 md:text-base"
>
  Click Me
</button>
```

### 3. **Tailwind CSS: NO @apply for New Code**
- **Avoid** `@apply` in CSS files for new components
- Use utility classes directly in component markup
- Exception: Create reusable component classes ONLY for complex, repeated patterns
- Prefer creating Svelte components over CSS `@apply` blocks

**INCORRECT:**
```css
/* styles.css */
.btn {
  @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700;
}
```

**CORRECT:**
```html
<!-- Component.svelte -->
<button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
  Click
</button>
```

### 4. **Avoid Arbitrary Tailwind Values**
- Use predefined Tailwind tokens (spacing, colors, breakpoints)
- Only use arbitrary values `[...]` for genuinely unique, non-repeatable values
- Extend `tailwind.config.ts` for project-specific scales

**INCORRECT:**
```html
<div class="w-[237px] h-[456px]">...</div>
```

**CORRECT:**
```html
<div class="w-full max-w-sm h-screen">...</div>
```

---

## Svelte Component Best Practices

### 1. **Reactive Variables & Declarations**
```typescript
// Use $state rune (Svelte 5)
let count = $state(0);
let doubled = $derived(count * 2);

// Use $effect for side effects
$effect(() => {
  console.log('Count changed:', count);
});
```

### 2. **Props & Type Safety**
```typescript
// Always type component props
interface Props {
  title: string;
  count?: number;
}

let { title, count = 0 }: Props = $props();
```

### 3. **Event Handlers**
```typescript
// Always type event handlers properly
function handleClick(event: MouseEvent) {
  console.log('Clicked');
}

// For custom events
function handleCustomEvent(event: CustomEvent<{ id: string }>) {
  console.log(event.detail.id);
}
```

### 4. **Conditional Rendering**
```html
{#if condition}
  <p>Show this</p>
{:else if otherCondition}
  <p>Or this</p>
{:else}
  <p>Otherwise</p>
{/if}
```

---

## Documentation & References

### Official Documentation Links
When implementing features or debugging issues, refer to:

- **SvelteKit Official Docs**: https://kit.svelte.dev/docs
  - Routing: https://kit.svelte.dev/docs/routing
  - Load Functions: https://kit.svelte.dev/docs/load
  - Form Actions: https://kit.svelte.dev/docs/form-actions
  - API Routes: https://kit.svelte.dev/docs/routing#server

- **Svelte 5 Documentation**: https://svelte.dev/docs/svelte/what-is-svelte
  - Runes: https://svelte.dev/docs/svelte/runes
  - Components: https://svelte.dev/docs/svelte/component-basics

- **Tailwind CSS Docs**: https://tailwindcss.com/docs
  - Utility Classes: https://tailwindcss.com/docs/utility-first
  - Responsive Design: https://tailwindcss.com/docs/responsive-design
  - Configuration: https://tailwindcss.com/docs/configuration

- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
  - Advanced Types: https://www.typescriptlang.org/docs/handbook/2/types-from-types.html
  - Strict Mode: https://www.typescriptlang.org/tsconfig#strict

---

## Error Handling Standards

### 1. **Server-Side Error Handling**
Always use SvelteKit's built-in error helpers:

```typescript
import { error, fail } from '@sveltejs/kit';

// For thrown errors (HTTP responses)
throw error(404, 'Page not found');
throw error(500, 'Internal server error');

// For form validation failures
return fail(400, { errors: { email: 'Invalid email' } });
```

### 2. **Client-Side Error Handling**
```typescript
// In Svelte components
try {
  const response = await fetch('/api/data');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
} catch (err) {
  console.error('Failed to fetch data:', err);
  // Display user-friendly error message
}
```

### 3. **API Error Responses**
```typescript
// +server.ts - API endpoint error pattern
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
  try {
    const data = await request.json();
    // Process data
    return json({ success: true, data }, { status: 200 });
  } catch (err) {
    return json(
      { error: 'Invalid request', details: err.message },
      { status: 400 }
    );
  }
}
```

### 4. **Load Function Error Handling**
```typescript
export const load = (async ({ params, fetch }) => {
  try {
    const response = await fetch(`/api/item/${params.id}`);
    
    if (!response.ok) {
      throw error(response.status, 'Failed to load item');
    }
    
    const data = await response.json();
    return { data };
  } catch (err) {
    throw error(500, 'Server error: ' + err.message);
  }
}) satisfies PageServerLoad;
```

---

## Environment & Build Configuration

### 1. **Environment Variables**
- Use `.env.local` for local development (never commit)
- Public variables: prefix with `VITE_`
- Server-only variables: no prefix required
- Access in server files: `import { env } from '$env/static/private'`
- Access in client files: `import { env } from '$env/static/public'`

### 2. **Build & Deployment**
- Ensure `npm run build` completes without errors
- Run `npm run preview` to test production build locally
- Strict TypeScript checking must pass: `npm run check`
- Format code: `npm run format` (if configured)

---

## Code Review Checklist

Before committing code, verify:

- [ ] TypeScript strict mode enabled and no `any` types
- [ ] All server loads use `PageServerLoad` type with `satisfies`
- [ ] All forms use `+page.server.ts` actions with proper typing
- [ ] Generated types from `./$types` are imported and used
- [ ] Semantic HTML elements used (no unnecessary `<div>` soup)
- [ ] Tailwind classes ordered logically (layout → spacing → typography → visual)
- [ ] No arbitrary Tailwind values used unless justified
- [ ] Error handling with `error()` and `fail()` helpers implemented
- [ ] No console errors or TypeScript errors in build
- [ ] API routes use `+server.ts` with proper HTTP status codes
- [ ] Form validation implemented server-side
- [ ] Component props are fully typed
- [ ] No unused imports or variables

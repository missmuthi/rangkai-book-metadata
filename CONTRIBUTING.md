import type { RequestEvent } from "@sveltejs/kit";
import { requireSession } from "$lib/server/auth";
   import { getRawDb } from "$lib/server/db";

# Contributing to Rangkai Book Metadata

Thank you for considering contributing to Rangkai! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js (see `.nvmrc` for version)
- npm (comes with Node.js)
- Cloudflare account (for deployment)

### Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd rangkai-book-metadata
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file based on `.env.example` (if available) or refer to `AUTHENTICATION_SETUP.md`

4. **Run development server**
   ```bash
   npm run dev
   # App runs at http://localhost:5173
   ```

## Architecture Overview

Rangkai follows a **3-tier modular architecture**:

### Tier 1: Core Infrastructure

- **Auth helpers** (`src/lib/server/auth.ts`) - Session management, ownership checks
- **Database helpers** (`src/lib/server/db.ts`) - D1 queries, scan management
- **Cache helpers** (`src/lib/server/cache.ts`) - KV operations
- **Metadata engine** (`src/lib/server/metadata/`) - Multi-source book metadata fetching

### Tier 2: Business Logic Modules

- **Module structure** (`src/modules/*`) - Domain-specific logic
  - `scan/` - Book scanning operations
  - `dashboard/` - Dashboard analytics
  - `auth/` - Extended auth utilities
- **Thin routes** (`src/routes/*`) - Minimal route handlers calling modules

### Tier 3: UX & Developer Experience

- **UI components** (`src/lib/components/ui/`) - Shared design system
- **Logging** (`src/lib/server/log.ts`) - Structured, production-safe logging
- **Error handling** (`src/routes/+error.svelte`) - Global error UI
- **Validation scripts** - Automated architecture checks

## Running Checks

Before committing, ensure your code passes all validations:

### Quick Check

```bash
npm run check
```

Runs TypeScript type checking.

### Full Validation

```bash
./validate-all.sh
```

Runs TypeScript, Tier 1, Tier 2, and Tier 3 validations.

### With Build

```bash
./validate-all.sh --with-build
```

Includes a production build test (slower but comprehensive).

### Individual Tier Checks

```bash
./validate-tier1.sh  # Core infrastructure
./validate-tier2.sh  # Module structure
```

## Code Style Guide

### TypeScript

- **Strict mode enabled** - All code must pass `strict: true`
- **Explicit return types** - Prefer explicit return types in modules and server code
- **No unused variables** - Clean up unused imports/vars

### Svelte Components

- Use **Svelte 5 runes** (`$props`, `$state`, `$derived`)
- Import UI primitives from `$lib/components/ui`
- Keep components focused and single-purpose

### Server Code

- Use **structured logging** via `logger` from `$lib/server/log`

  ```ts
  import { logger, LogEvents } from "$lib/server/log";

  logger.info(LogEvents.SCAN_CREATED, { userId, isbn });
  logger.error(LogEvents.METADATA_FETCH_FAILED, {
    provider,
    error: err.message,
  });
  ```

- Never log sensitive data (tokens, passwords, etc.)
- Use helpers from `$lib/server/*` instead of raw D1/KV calls

### UI Components

- Use the shared design system (`Button`, `Card`, `Alert`, `EmptyState`, etc.)
- Ensure accessibility (proper ARIA labels, keyboard navigation)
- Follow existing Tailwind patterns for consistency

## Adding a New Module

1. **Create module structure**

   ```bash
   mkdir -p src/modules/my-module
   touch src/modules/my-module/service.ts
   touch src/modules/my-module/types.ts
   touch src/modules/my-module/index.ts
   ```

2. **Implement service functions**

   ```ts
   // src/modules/my-module/service.ts
   import type { RequestEvent } from "@sveltejs/kit";
   import { requireSession } from "$lib/server/auth";
   import { getRawDb } from "$lib/server/db";

   export async function myModuleFunction(
     event: RequestEvent,
   ): Promise<MyResult> {
     const session = await requireSession(event);
    export async function myModuleFunction(
       event: RequestEvent,
    ): Promise<MyResult> {
       const db = getRawDb(event.platform);
     // ... your logic
   }
   ```

3. **Export from module index**

   ```ts
   // src/modules/my-module/index.ts
   export * from "./service";
   export * from "./types";
   ```

4. **Update module barrel export**

   ```ts
   // src/modules/index.ts
   export * as myModule from "./my-module";
   ```

5. **Use in routes**

   ```ts
   // src/routes/my-route/+page.server.ts
   import { myModule } from "$modules";

   export const load = async (event) => {
     return await myModule.myModuleFunction(event);
   };
   ```

## Testing

```bash
npm run test           # Run tests once
npm run test:watch     # Watch mode
```

## Deployment

```bash
npm run deploy
```

Deploys to Cloudflare Pages. Ensure you have:

- Cloudflare credentials configured
- D1 database set up
- KV namespace created

See `DEPLOYMENT_CHECKLIST_v2.0.md` for detailed deployment steps.

## Getting Help

- Check existing documentation in the repository
- Review `MODULE_REFERENCE.md` for module patterns
- Look at `RANGKAI_APP_DIRECTION.md` for product vision

## Code of Conduct

- Be respectful and professional
- Focus on constructive feedback
- Keep discussions technical and on-topic

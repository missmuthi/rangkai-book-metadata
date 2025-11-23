# Documentation Index

Complete guide to all documentation in the Rangkai Book Metadata project.

---

## 📁 Documentation Structure

```
rangkai-book-metadata/
│
├── docs/                          # 📚 Core Documentation (Start Here)
│   ├── SYSTEM_OVERVIEW.md         # High-level system architecture
│   ├── GETTING_STARTED.md         # Quick setup guide (0 to running)
│   ├── ARCHITECTURE.md            # Detailed technical architecture
│   ├── API_INTEGRATION_GUIDE.md   # External API integration
│   └── DEPLOYMENT_GUIDE.md        # Production deployment
│
├── README.md                      # 🏠 Project homepage
├── CONTRIBUTING.md                # Contributing guidelines
├── CHANGELOG.md                   # Version history
│
└── [Legacy Docs]                  # 📄 Specialized topics (being migrated)
    ├── ANALYTICS_TELEMETRY.md
    ├── LOC_INTEGRATION_GUIDE.md
    ├── SERVERLESS_ARCHITECTURE.md
    ├── AUTHENTICATION_SETUP.md
    └── ...
```

---

## 🎯 Documentation Map by Priority

### ⭐ MUST EXIST NOW (Already Created)

| Document | Purpose | Location | Status |
|----------|---------|----------|--------|
| [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) | High-level system architecture, tech stack, core concepts | `/docs` | ✅ Complete |
| [GETTING_STARTED.md](GETTING_STARTED.md) | Quick setup guide for new developers | `/docs` | ✅ Complete |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Detailed architecture: layers, data flow, component structure | `/docs` | ✅ Complete |
| [API_INTEGRATION_GUIDE.md](API_INTEGRATION_GUIDE.md) | How the 3 external APIs work together, fallback strategies | `/docs` | ✅ Complete |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Production deployment to Cloudflare Pages | `/docs` | ✅ Complete |

### 📋 Nice-to-Have (Future Work)

| Document | Purpose | Location | Priority |
|----------|---------|----------|----------|
| RUNBOOK_PRODUCTION.md | Production operations: monitoring, troubleshooting, rollback | `/docs` | Medium |
| DATABASE_GUIDE.md | D1 schema, migrations, Kysely queries | `/docs` | Medium |
| AUTHENTICATION_GUIDE.md | Better Auth setup, OAuth flow, security | `/docs` | Low |
| TESTING_STRATEGY.md | Test philosophy, running tests, coverage goals | `/docs` | Medium |
| MOBILE_SCANNER_GUIDE.md | Scanner mode, barcode scanning, field agent workflows | `/docs` | Low |
| DATA_MERGING_LOGIC.md | Waterfall prioritization, conflict resolution | `/docs` | Low |
| BUSINESS_RULES.md | Library cataloging rules, SLiMS compatibility | `/docs` | Low |
| DECISIONS_LOG.md | Key technical decisions, why we chose X over Y | `/docs` | Low |
| CONTRIBUTING_GUIDE.md | Code style, PR process, commit conventions | `/docs` | Medium |

---

## 🗺️ Documentation Roadmap

**By Reader Persona:**

### 👨‍💻 New Developer (First Week)

**Day 1:**
1. Read [README.md](../README.md) - Project overview
2. Follow [GETTING_STARTED.md](GETTING_STARTED.md) - Get app running locally
3. Make first test change, see HMR in action

**Day 2-3:**
4. Read [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) - Understand architecture
5. Read [ARCHITECTURE.md](ARCHITECTURE.md) - Deep dive into layers
6. Explore codebase with mental model

**Day 4-5:**
7. Read [API_INTEGRATION_GUIDE.md](API_INTEGRATION_GUIDE.md) - API layer
8. Pick a small task from backlog
9. Submit first PR

### 🏗️ Senior Developer (Refactoring)

**Before Major Changes:**
1. [ARCHITECTURE.md](ARCHITECTURE.md) - Component boundaries
2. [API_INTEGRATION_GUIDE.md](API_INTEGRATION_GUIDE.md) - API contracts
3. [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) - Tech debt section
4. Related source code

**During Changes:**
- Update affected documentation in parallel
- Add migration notes to CHANGELOG.md

### 🚀 DevOps Engineer (Deployment)

**First Deployment:**
1. [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Full setup
2. [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) - Environment section
3. Cloudflare dashboard for bindings

**CI/CD Setup:**
- GitHub Actions workflow in DEPLOYMENT_GUIDE.md
- Environment variable management
- Database migration strategy

### 📊 Product Manager (Understanding System)

1. [README.md](../README.md) - Product overview
2. [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) - Core concepts
3. Legacy docs: RANGKAI_APP_DIRECTION.md - Product vision

---

## 📖 How to Use This Documentation

### Finding Information

**"How do I run the app locally?"**
→ [GETTING_STARTED.md](GETTING_STARTED.md)

**"Why do we use 3 APIs instead of 1?"**
→ [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) → Core Concepts → Triple-Source Data Harvesting

**"How does data merging work?"**
→ [API_INTEGRATION_GUIDE.md](API_INTEGRATION_GUIDE.md) → Data Merging Logic

**"How do I deploy to production?"**
→ [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

**"What's the database schema?"**
→ [ARCHITECTURE.md](ARCHITECTURE.md) → Data Layer → D1 Database

**"How do I add a new API source?"**
→ [API_INTEGRATION_GUIDE.md](API_INTEGRATION_GUIDE.md) → Adding a New API Source

### Document Conventions

**Every doc has:**
- ✅ **"When to Read This Doc"** section - Know if it's relevant
- 📌 **"Keep This Updated When..."** section - Maintenance triggers
- 🔄 **"Next Time You Change X, Update:"** - Cross-references
- ❓ **"Questions This Doc Should Answer But Doesn't Yet:"** - Future work

**Writing Style:**
- **Active voice:** "We use X" not "X is used"
- **Concrete examples:** Show code, not just concepts
- **Decision rationale:** Explain WHY, not just WHAT
- **No jargon:** Explain acronyms on first use

---

## 🔄 Maintenance Schedule

### When to Update Docs

| Change Type | Update These Docs | Priority |
|-------------|-------------------|----------|
| **Add external API** | SYSTEM_OVERVIEW, API_INTEGRATION_GUIDE, ARCHITECTURE | High |
| **Change deployment platform** | DEPLOYMENT_GUIDE, SYSTEM_OVERVIEW | High |
| **Add environment variable** | DEPLOYMENT_GUIDE, GETTING_STARTED | High |
| **Change database schema** | ARCHITECTURE, DEPLOYMENT_GUIDE (migrations) | High |
| **Refactor component** | ARCHITECTURE (component boundaries) | Medium |
| **Fix bug** | CHANGELOG (version entry) | Low |
| **Add feature** | README (feature list), CHANGELOG | Medium |

### Quarterly Review

**Every 3 months, check:**
- [ ] Are code examples still accurate?
- [ ] Have any external APIs changed?
- [ ] Are rate limits still correct?
- [ ] Do screenshots need updating?
- [ ] Are there unanswered questions we can now answer?

---

## 📝 Documentation Standards

### Required Sections (All Docs)

1. **Title** - Clear, descriptive
2. **Summary** - 2-3 sentences explaining the doc
3. **When to Read** - Help readers decide relevance
4. **Keep Updated When** - Maintenance triggers
5. **Body** - Structured content (H2, H3 headings)
6. **Next Time You Change X** - Cross-references
7. **Questions** - Gaps to fill in future

### Markdown Style

```markdown
# Title (H1 - One per doc)

Brief summary paragraph.

---

## ✅ When to Read This Doc

- Bullet points for scenarios

## 📌 Keep This Updated When…

- Bullet points for triggers

---

## Main Section (H2)

Content here.

### Subsection (H3)

More details.

**Code Example:**
```typescript
// Annotated code
```

**Diagrams (ASCII):**
```
┌─────────┐
│ Component│
└─────────┘
```

---

## Next Time You Change X, Update:

- List of related docs

## Questions This Doc Should Answer But Doesn't Yet:

- Future improvements
```

### Code Examples

**✅ Good:**
```typescript
// Fetch book data with retry logic
async function fetchBook(isbn: string): Promise<BookData> {
  // Implementation...
}
```

**❌ Bad:**
```typescript
function f(x) { return y; }  // No context, no types
```

### Diagrams

**Prefer ASCII Art:**
- Works in VS Code preview
- No external tools needed
- Easy to update

**Use Mermaid for Complex Flows:**
- GitHub renders Mermaid diagrams
- VS Code has Mermaid preview extensions

---

## 🤝 Contributing to Docs

### How to Add New Documentation

1. **Determine priority** - Must-have or nice-to-have?
2. **Choose location** - `/docs` for core, root for specialized
3. **Follow template** - Use existing docs as examples
4. **Get review** - Same PR process as code
5. **Update this index** - Add to Documentation Map

### Reviewing Documentation PRs

**Check:**
- [ ] Follows markdown style guide
- [ ] Has required sections (When to Read, Keep Updated, etc.)
- [ ] Code examples are tested and accurate
- [ ] Cross-references are correct
- [ ] Added to Documentation Index

---

## 📚 External Resources

**SvelteKit:**
- [Official Docs](https://kit.svelte.dev/docs)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/what-are-runes)

**Cloudflare:**
- [Pages Docs](https://developers.cloudflare.com/pages/)
- [Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [KV Storage](https://developers.cloudflare.com/kv/)

**APIs:**
- [Google Books API](https://developers.google.com/books)
- [OpenLibrary API](https://openlibrary.org/dev/docs/api/books)
- [Library of Congress API](https://www.loc.gov/apis/)

**TypeScript:**
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Strict Mode](https://www.typescriptlang.org/tsconfig#strict)

---

## 🎓 Learning Path

### Week 1: Foundations
- [ ] Clone repo and run locally
- [ ] Read GETTING_STARTED.md
- [ ] Read SYSTEM_OVERVIEW.md
- [ ] Make first code change

### Week 2: Architecture
- [ ] Read ARCHITECTURE.md
- [ ] Trace code flow: search → API → merge → render
- [ ] Read API_INTEGRATION_GUIDE.md
- [ ] Debug an API integration issue

### Week 3: Deployment
- [ ] Read DEPLOYMENT_GUIDE.md
- [ ] Deploy to personal Cloudflare account
- [ ] Run database migration
- [ ] Monitor Workers logs

### Week 4: Advanced
- [ ] Add new API source (practice)
- [ ] Optimize cache hit rate
- [ ] Write integration test
- [ ] Review PR from teammate

---

**Last Updated:** 2025-01-22  
**Maintained By:** Development Team  
**Questions?** Open a GitHub Discussion

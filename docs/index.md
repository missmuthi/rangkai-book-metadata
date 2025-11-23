# Rangkai Book Metadata - Documentation Index

**Version:** 2.0.2  
**Last Updated:** November 23, 2025  
**Project:** Rangkai Book Metadata Harvester

---

## 🎯 Quick Navigation

### For New Developers
**Start here in this order:**
1. [System Overview](SYSTEM_OVERVIEW.md) - Understand what Rangkai does (15 min read)
2. [Getting Started](GETTING_STARTED.md) - Run the app locally (10 min setup)
3. [Architecture](ARCHITECTURE.md) - Deep dive into system design (30 min read)

### For API Integration
4. [API Integration Guide](API_INTEGRATION_GUIDE.md) - External APIs and data merging

### For Deployment
5. [Deployment Guide](DEPLOYMENT_GUIDE.md) - Cloudflare Pages deployment

### For Contributing
6. [Contributing Guide](../CONTRIBUTING.md) - Code standards and workflow
7. [Agents Documentation](../agents.md) - AI-assisted development patterns

---

## 📚 Documentation Map

### Core Documentation (`/docs`)

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md)** | High-level architecture, features, tech stack | First time exploring the project |
| **[GETTING_STARTED.md](GETTING_STARTED.md)** | Local setup, environment configuration | Setting up development environment |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Detailed technical architecture, components, data flow | Planning features or debugging |
| **[API_INTEGRATION_GUIDE.md](API_INTEGRATION_GUIDE.md)** | Google Books, OpenLibrary, LoC API details | Working with metadata sources |
| **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** | Production deployment, secrets, D1/KV setup | Deploying to Cloudflare Pages |
| **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** | Common commands, file locations | Quick lookups during development |

### Root-Level Documentation

| Document | Purpose |
|----------|---------|
| **[README.md](../README.md)** | Project overview, features, quick start |
| **[CHANGELOG.md](../CHANGELOG.md)** | Version history, release notes |
| **[CONTRIBUTING.md](../CONTRIBUTING.md)** | Contribution guidelines, code standards |
| **[agents.md](../agents.md)** | AI agents documentation, automation patterns |
| **[copilot-instructions.md](../copilot-instruction.md)** | GitHub Copilot instructions |

### Legacy/Reference Documentation (Root)

These documents contain historical information or specific implementation details:

- `SERVERLESS_ARCHITECTURE.md` - Serverless migration guide (v1.3.0)
- `LOC_INTEGRATION_GUIDE.md` - Library of Congress API integration
- `ANALYTICS_TELEMETRY.md` - Analytics system documentation
- `IMAGE_SECURITY.md` - Image proxy and SSRF protection
- `PERFORMANCE_ANALYSIS.md` - Performance benchmarks
- `MOBILE_*.md` - Mobile scanner implementation notes (historical)
- `OAUTH_*.md` - OAuth fix documentation (historical)
- Deployment checklists - Version-specific deployment guides

---

## 🗺️ Documentation Maintenance

### When to Update Docs

| Change Type | Update These Docs |
|-------------|-------------------|
| **New feature** | SYSTEM_OVERVIEW.md, ARCHITECTURE.md, CHANGELOG.md, README.md |
| **API change** | API_INTEGRATION_GUIDE.md, ARCHITECTURE.md |
| **Deployment change** | DEPLOYMENT_GUIDE.md, GETTING_STARTED.md |
| **Environment variable** | GETTING_STARTED.md, DEPLOYMENT_GUIDE.md |
| **Database schema** | ARCHITECTURE.md, schema.sql |
| **Authentication change** | ARCHITECTURE.md, DEPLOYMENT_GUIDE.md |
| **UI component** | ARCHITECTURE.md (Component Architecture section) |
| **Code standards** | CONTRIBUTING.md, copilot-instructions.md |
| **Bug fix** | CHANGELOG.md |

### Documentation Quality Checklist

All documentation should:
- ✅ Include "When to Read This" section
- ✅ Include "Keep Updated When..." section
- ✅ Use consistent terminology (refer to ARCHITECTURE.md glossary)
- ✅ Include code examples where relevant
- ✅ Link to related documentation
- ✅ Be tested for broken links
- ✅ Use semantic headers (h1 = title, h2 = major sections, h3 = subsections)

---

## 👥 Reader Personas

### 🆕 New Developer
**Goal:** Understand the project and run it locally  
**Path:** SYSTEM_OVERVIEW.md → GETTING_STARTED.md → ARCHITECTURE.md  
**Time:** 1-2 hours

### 🔧 Feature Developer
**Goal:** Add new functionality or fix bugs  
**Path:** ARCHITECTURE.md → API_INTEGRATION_GUIDE.md → agents.md  
**Time:** 30 min - 1 hour (reference as needed)

### 🚀 DevOps Engineer
**Goal:** Deploy and maintain production  
**Path:** DEPLOYMENT_GUIDE.md → ARCHITECTURE.md (Infrastructure section)  
**Time:** 45 min

### 📊 Technical Writer
**Goal:** Update documentation  
**Path:** This index → All docs → Maintenance schedule below  
**Time:** 2-4 hours (full sync)

---

## 📅 Maintenance Schedule

### Regular Updates (Per Release)
- [ ] CHANGELOG.md - Add new version entry
- [ ] README.md - Update version badge
- [ ] SYSTEM_OVERVIEW.md - Add new features to feature list
- [ ] ARCHITECTURE.md - Document new components/patterns

### Monthly Review
- [ ] Check for broken links
- [ ] Update external API documentation references
- [ ] Verify code examples still work
- [ ] Review and archive outdated legacy docs

### Quarterly Audit
- [ ] Full documentation sync (all files)
- [ ] Update screenshots/diagrams
- [ ] Review reader personas and paths
- [ ] Consolidate or deprecate redundant docs

---

## 🎨 Documentation Conventions

### Terminology Standards

| Term | Use This | Not This |
|------|----------|----------|
| **Authentication** | "Arctic-based OAuth" | "Better Auth" (deprecated) |
| **Database** | "D1 database" or "Cloudflare D1" | "SQLite", "DB" (without context) |
| **Cache** | "KV cache" or "Cloudflare KV" | "Redis", "cache" (generic) |
| **API endpoint** | "`/api/book/[isbn]`" (code formatted) | "/api/book/isbn" |
| **Component** | "CameraScanner component" | "camera scanner", "scanner comp" |
| **Scanner mode** | "Mobile Scanner Mode" | "barcode scanner", "scan feature" |

### Code Examples
- Always use TypeScript
- Include imports when relevant
- Show both happy path and error handling
- Use realistic data (not "foo", "bar")

### Diagrams
- Use ASCII art for simple flows
- Use Mermaid for complex diagrams
- Always include alt text explanation

---

## 🔗 External Resources

### SvelteKit
- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Svelte 5 Runes API](https://svelte.dev/docs/svelte/what-are-runes)

### Cloudflare
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [KV Storage](https://developers.cloudflare.com/kv/)
- [Workers](https://developers.cloudflare.com/workers/)

### APIs
- [Google Books API](https://developers.google.com/books)
- [OpenLibrary API](https://openlibrary.org/developers/api)
- [Library of Congress API](https://www.loc.gov/apis/)

### Authentication
- [Arctic OAuth Library](https://arctic.js.org/)

---

## ❓ Questions This Documentation Should Answer

### System Understanding
- ✅ What does Rangkai do and why?
- ✅ What are the core features?
- ✅ What tech stack is used?
- ✅ How does data merging work?

### Development
- ✅ How do I set up the project locally?
- ✅ What are the coding standards?
- ✅ How do I add a new feature?
- ✅ How do I test my changes?

### Deployment
- ✅ How do I deploy to production?
- ✅ What environment variables are needed?
- ✅ How do I set up OAuth?
- ✅ How do I manage D1/KV resources?

### Troubleshooting
- ✅ Why is my build failing?
- ✅ How do I debug authentication issues?
- ✅ What if an API is down?
- ✅ How do I check logs?

### Future Improvements
- ⚠️ **Needs addition:** How to add new metadata sources
- ⚠️ **Needs addition:** How to customize the mobile scanner UI
- ⚠️ **Needs addition:** How to add new export formats
- ⚠️ **Needs addition:** How to implement rate limiting

---

## 📞 Getting Help

**Found outdated documentation?** Open an issue with the "documentation" label.

**Want to contribute to docs?** See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

**Need clarification?** Check existing issues or start a discussion.

---

**Last Full Sync:** November 23, 2025  
**Next Scheduled Review:** December 2025  
**Documentation Version:** 2.0.2

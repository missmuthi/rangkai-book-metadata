# Rangkai: Book Metadata Harvester

![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=flat&logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-F38020?style=flat&logo=cloudflare&logoColor=white)
![MIT License](https://img.shields.io/badge/License-MIT-green.svg)

**A specialized tool for Indonesian librarians to harvest, format, and export book metadata directly into SLiMS (Senayan Library Management System).**

Built for high-speed cataloging workflows, Rangkai combines metadata from Google Books and OpenLibrary to generate SLiMS-compatible records with classification numbers, call numbers, and properly formatted bibliographic data.

---

## ✨ Key Features

### 🔍 **Dual-Source Harvesting**
- **Google Books**: Rich metadata including titles, authors, publishers, descriptions, and cover images
- **OpenLibrary**: Classification systems (DDC, LCC) and subject headings
- **Smart Merging**: Automatically combines the best data from both sources

### 🚀 **NEW: Scanner Mode — High-Speed Cataloging**
Transform your workflow with **Scanner Mode**, designed specifically for USB barcode scanners:

- ⚡ **Mouse-Free Operation**: Scan → Auto-fetch → Auto-save → Repeat
- 🎯 **Auto-Focus Input**: "Unjammable" input loop keeps scanner ready
- 🔊 **Audio Feedback**: Instant confirmation for successful scans
- 📦 **Local Batch History**: Stores up to 50 scanned books in browser storage (localStorage)
- 🚫 **Ghost Scan Protection**: Automatically ignores partial/corrupted barcode reads
- 💾 **Batch Export**: Download 50+ books at once as SLiMS CSV

### 📂 **SLiMS Compatible Exports**
- **SLiMS CSV**: UTF-8 with BOM encoding for direct import into SLiMS Bibliography module
- **Auto-Generated Call Numbers**: DDC + Cutter-Sanborn format (e.g., `823.92 LAN a`)
- **MARCXML**: Standard library catalog format
- **Smart Formatting**:
  - Publisher strings: `Jakarta : Gramedia, 2023`
  - Author names: `Last, First` format
  - Language mapping: ISO codes → Full names (e.g., `ind` → `Indonesian`)

### 🧠 **Intelligent Data Processing**
- **ISBN Sanitization**: Strips dashes, spaces from scanner input
- **5-Minute Response Cache**: Reduces duplicate API calls
- **Rate Limiting**: Protects against API throttling
- **Subject-to-DDC Mapping**: Automatically assigns Dewey classifications based on content
- **Collation Formatting**: Standardizes page counts and physical descriptions

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | SvelteKit (Svelte 5 with Runes) |
| **Language** | TypeScript (Strict Mode) |
| **Styling** | Tailwind CSS |
| **State Management** | Svelte 5 Runes (`$state`, `$derived`, `$effect`) |
| **Testing** | Vitest + Testing Library |
| **Deployment** | Cloudflare Pages |
| **Runtime** | Node.js 18+ |

---

## 📖 How to Use Scanner Mode

Perfect for cataloging large collections with a USB barcode scanner:

1. **Connect USB Scanner**: Plug in your scanner (configured for ISBN barcode format)
2. **Enable Scanner Mode**: Click the "Enable Scanner Mode" button in the UI
3. **Start Scanning**: 
   - Point scanner at book's ISBN barcode
   - Scan the barcode (data auto-submits on Enter)
   - Wait for green confirmation and audio beep
   - Repeat immediately for next book
4. **Review Scanned Books**: Check the "Recent Scans" sidebar (right panel)
5. **Batch Export**: Click **"Download All (X) as CSV"** when finished
6. **Import to SLiMS**:
   - Go to SLiMS → Bibliography → Import
   - Upload the downloaded CSV file
   - Map fields (auto-detected for SLiMS format)
   - Complete import

### 🎯 Scanner Mode Tips
- **Keep input focused**: The app auto-refocuses after each scan
- **Scan speed**: Process 50+ books in under 10 minutes
- **Network resilience**: Local history preserved even if APIs fail temporarily
- **Remove mistakes**: Click the "X" on any scanned item to remove it

---

## 🚀 Installation & Development

### Prerequisites
- Node.js 18.x or higher
- npm or pnpm

### Setup

1. **Clone the repository:**
```bash
git clone https://github.com/missmuthi/rangkai-book-metadata.git
cd rangkai-book-metadata
```

2. **Install dependencies:**
```bash
npm install
```

3. **Run development server:**
```bash
npm run dev
```

4. **Open in browser:**
```
http://localhost:5173
```

### Build for Production

```bash
npm run build
npm run preview  # Test production build locally
```

### Deploy to Cloudflare Pages

```bash
npm run deploy
```

---

## 📂 Project Structure

```
rangkai-book-metadata/
├── src/
│   ├── lib/
│   │   ├── cutter.ts                   # Cutter-Sanborn call number generator
│   │   ├── merge.ts                    # Dual-source data merging logic
│   │   ├── export.ts                   # CSV & MARCXML exporters
│   │   ├── rateLimiter.ts              # API rate limiting system
│   │   ├── types.ts                    # TypeScript interfaces
│   │   ├── ErrorBoundary.svelte        # Error handling component
│   │   ├── stores/
│   │   │   └── history.svelte.ts       # Scanner Mode history store (Svelte 5 Runes)
│   │   └── __tests__/                  # Unit tests
│   │       ├── cutter.test.ts
│   │       ├── export.test.ts
│   │       ├── formatting.test.ts
│   │       └── merge.test.ts
│   ├── routes/
│   │   ├── +layout.svelte              # Global layout
│   │   └── +page.svelte                # Main application (Search + Scanner UI)
│   ├── app.css                         # Tailwind CSS imports
│   └── app.html                        # HTML shell
├── static/                             # Static assets
├── agents.md                           # AI agent automation docs
├── PERFORMANCE_ANALYSIS.md             # Performance optimization notes
├── package.json
├── svelte.config.js
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

## 🧪 Testing

Run the test suite:

```bash
npm run test
```

Watch mode for development:

```bash
npm run test:watch
```

Type checking:

```bash
npm run check
```

---

## 📊 Data Mapping & Processing

### Call Number Generation
```
Format: [DDC] [Cutter] [Title Initial]

Example: 823.92 LAN a
         ↓      ↓   ↓
       DDC  Cutter Title
```

### Field Priority (Google Books vs OpenLibrary)

| SLiMS Field | Source Priority | Processing |
|-------------|-----------------|------------|
| Title | OpenLibrary → Google | Direct mapping |
| Authors | First available | Formatted as `Last, First` |
| Publisher | Google → OpenLibrary | Formatted as `Place : Publisher, Year` |
| DDC | OpenLibrary only | First available classification |
| LCC | OpenLibrary only | First available classification |
| Call Number | Generated | DDC + Cutter-Sanborn + Title initial |
| Cover Image | Google → OpenLibrary → Placeholder | Thumbnail URL |
| Language | Mapped | ISO code → Full name |
| Collation | Google → OpenLibrary | `X pages ; size` |

### Subject-to-DDC Auto-Mapping

When DDC is unavailable, the system maps subjects to Dewey classes:

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

---

## 🔧 Configuration

### Rate Limiting (Adjustable in `src/lib/rateLimiter.ts`)

```typescript
Google Books: 50 requests / minute
OpenLibrary: 100 requests / minute
```

### Cache Settings (`src/routes/+page.svelte`)

```typescript
TTL: 5 minutes
Storage: In-memory (Map)
```

### Scanner History (`src/lib/stores/history.svelte.ts`)

```typescript
Max Items: 50 books
Storage: localStorage
Key: 'rangkai-scan-history'
```

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines
- Follow the TypeScript strict mode requirements
- Use Svelte 5 Runes for reactive state
- Follow Tailwind CSS utility-first patterns
- Add tests for new features
- Update documentation as needed

---

## 📝 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Google Books API** — Rich bibliographic metadata
- **OpenLibrary** — Classification systems and subject headings
- **SLiMS Community** — Indonesian library automation standards
- **Svelte Team** — Revolutionary reactive framework
- **Cloudflare** — Edge deployment platform

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/missmuthi/rangkai-book-metadata/issues)
- **Discussions**: [GitHub Discussions](https://github.com/missmuthi/rangkai-book-metadata/discussions)

---

<div align="center">

**Built with ❤️ for Indonesian Libraries**

⭐ Star this repo if Rangkai helps your cataloging workflow!

</div>
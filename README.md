<<<<<<< HEAD
# rangkai-book-metadata
Rangkai is a SLiMS 9-ready metadata harvester built with SvelteKit &amp; Tailwind. It intelligently merges Google Books &amp; OpenLibrary APIs, prioritizing accurate classification and rich descriptions. Features a modern, reactive UI powered by Svelte 5 Runes to deliver clean, catalog-ready bibliographic data.
=======
# Rangkai Book Metadata Harvester

A sophisticated metadata harvesting tool that aggregates book information from **Google Books** and **OpenLibrary** to generate **SLiMS-ready** (Senayan Library Management System) bibliographic records.

## Features

✨ **Dual-Source Data Aggregation**
- Fetches comprehensive metadata from Google Books and OpenLibrary APIs
- Intelligently merges conflicting data with prioritization logic
- Provides fallback data when sources have incomplete information

📚 **SLiMS Integration**
- Generates call numbers following Dewey Decimal Classification (DDC)
- Produces SLiMS-compatible metadata fields
- Includes LCC (Library of Congress Classification) support
- Exports standardized bibliographic records

🔍 **Flexible Search**
- Search by ISBN (10 or 13 digit)
- Search by book title
- Returns multiple results from each source
- User-selectable results for detailed harvesting

📊 **Rich Metadata**
- Title, authors, publisher, publication date
- ISBNs (both 10 and 13 digit variants)
- Page counts, language, subjects
- Cover images with fallback placeholders
- Classifications (DDC, LCC)
- Publication location and series information

⚡ **Modern UI/UX**
- Real-time search with enter key support
- Loading states with spinner indicators
- Result pagination and scrolling
- Dual-panel view (search results + merged data)
- Responsive design (mobile-friendly)
- Raw JSON data source viewers for debugging

## Tech Stack

- **Framework**: SvelteKit 5 (with Runes)
- **Language**: TypeScript
# Rangkai Book Metadata Harvester

A sophisticated metadata harvesting tool that aggregates book information from **Google Books** and **OpenLibrary** to generate **SLiMS-ready** (Senayan Library Management System) bibliographic records.

## Features

✨ **Dual-Source Data Aggregation**
- Fetches comprehensive metadata from Google Books and OpenLibrary APIs
- Intelligently merges conflicting data with prioritization logic
- Provides fallback data when sources have incomplete information

📚 **SLiMS Integration**
- Generates call numbers following Dewey Decimal Classification (DDC)
- Produces SLiMS-compatible metadata fields
- Includes LCC (Library of Congress Classification) support
- Exports standardized bibliographic records

🔍 **Flexible Search**
- Search by ISBN (10 or 13 digit)
- Search by book title
- Returns multiple results from each source
- User-selectable results for detailed harvesting

📊 **Rich Metadata**
- Title, authors, publisher, publication date
- ISBNs (both 10 and 13 digit variants)
- Page counts, language, subjects
- Cover images with fallback placeholders
- Classifications (DDC, LCC)
- Publication location and series information

⚡ **Modern UI/UX**
- Real-time search with enter key support
- Loading states with spinner indicators
- Result pagination and scrolling
- Dual-panel view (search results + merged data)
- Responsive design (mobile-friendly)
- Raw JSON data source viewers for debugging

## Tech Stack

- **Framework**: SvelteKit 5 (with Runes)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **APIs**: 
  - [Google Books API](https://developers.google.com/books)
  - [OpenLibrary API](https://openlibrary.org/developers)
- **Runtime**: Node.js 18+

## Installation

### Prerequisites
- Node.js 18.x or higher
- npm or yarn package manager

### Setup

```bash
# Clone repository
git clone https://github.com/missmuthi/rangkai-book-metadata.git
cd rangkai-book-metadata

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser
# Navigate to http://localhost:5173 (or the port shown in terminal)
# Note: If port 5173 is busy, Vite will automatically use the next available port
```

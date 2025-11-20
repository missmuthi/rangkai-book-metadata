import { describe, it, expect } from 'vitest';
import { processAndRenderMergedData } from '$lib/merge';

describe('processAndRenderMergedData', () => {
  it('merges Google and OpenLibrary data with prioritization', () => {
    const google = {
      title: 'Google Title',
      authors: ['G Author'],
      publisher: 'G Publisher',
      publishedDate: '2020-01-01',
      pageCount: 123,
      industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780000000000' }],
      categories: ['Fiction'],
      printType: 'BOOK',
      infoLink: 'http://google.example',
      imageLinks: { thumbnail: 'http://image.example/thumb.jpg' }
    } as any;

    const openlib = {
      title: 'OL Title',
      authors: [{ name: 'OL Author' }],
      publish_date: '2019',
      number_of_pages: 200,
      identifiers: { isbn_13: ['9780000000001'] },
      classifications: { dewey_decimal_class: ['800'] },
      cover: { large: 'http://ol.example/cover.jpg' }
    } as any;

    const merged = processAndRenderMergedData(google, openlib);

    // === WATERFALL PRIORITIZATION ===
    // Base Metadata: Google Books preferred
    expect(merged.title).toBe('Google Title');
    // Author should come from Google and be formatted as "Last, First"
    expect(merged.author).toBe('Author, G');
    // Publisher should come from Google
    expect(merged.publisher).toBe('G Publisher');
    // Classification: DDC comes from OpenLibrary (only source)
    expect(merged.ddc).toBe('800');
    // ISBN13 prefers Google
    expect(merged.isbn13).toBe('9780000000000');
    // Data source tracking
    expect(merged.dataSource).toBe('google-openlibrary');
  });
});

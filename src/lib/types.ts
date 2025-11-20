export interface GoogleBookItem {
  id: string;
  volumeInfo: any;
}

export interface GoogleBooksResponse {
  totalItems: number;
  items?: GoogleBookItem[];
}

export interface OpenLibraryBookData {
  title?: string;
  authors?: Array<{ name?: string }>;
  publishers?: Array<{ name?: string }>;
  publish_date?: string | number;
  number_of_pages?: number;
  description?: any;
  languages?: Array<{ key: string }>;
  subjects?: string[];
  publish_places?: string[];
  edition_name?: string;
  series?: string[];
  identifiers?: {
    isbn_13?: string[];
    isbn_10?: string[];
  };
  classifications?: {
    dewey_decimal_class?: string[];
    lc_classifications?: string[];
  };
  cover?: { large?: string };
}

export interface OpenLibrarySearchResponse {
  docs?: Array<{
    title?: string;
    author_name?: string[];
    cover_i?: number;
    key?: string;
    isbn?: string[];
    first_publish_year?: number;
    number_of_pages_median?: number;
  }>;
}

export interface MergedBookData {
  title: string;
  author: string;
  publisher: string;
  date: string;
  pages: string;
  isbn13: string;
  isbn10: string;
  ddc: string;
  lcc: string;
  callNumber: string;
  description: string;
  language: string;
  subjects: string;
  series: string;
  publisherString: string;
  collation: string;
  classification: string;
  edition: string;
  specificDetail: string;
  gmd: string;
  infoLink: string;
  cover: string;
  isPartialData?: boolean; // True when OpenLibrary failed but Google Books succeeded
  dataSource?: 'both' | 'google-only' | 'openlibrary-only';
}

export interface GoogleBookItem {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/**
 * Library of Congress API Response
 * Endpoint: https://www.loc.gov/books/?q={isbn}&fo=json&at=results
 */
export interface LoCBookData {
  results?: Array<{
    title?: string;
    contributor?: string[];
    date?: string;
    subject?: string[];
    description?: string[];
    language?: string[];
    number_lccn?: string;
    item?: {
      call_number?: string[];
      control_number?: string[];
    };
    url?: string;
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
  publishPlace?: string;
  publishYear?: string;
  physicalDescription?: string;
  authors?: string;
  collation: string;
  classification: string;
  edition: string;
  specificDetail: string;
  gmd: string;
  infoLink: string;
  cover: string;
  isbn?: string;
  is_ai_enhanced?: boolean;
  enhanced_at?: number;
  isPartialData?: boolean; // True when one or more sources failed
  dataSource?:
    | "all-three"
    | "google-loc"
    | "google-openlibrary"
    | "loc-openlibrary"
    | "google-only"
    | "loc-only"
    | "openlibrary-only";
  aiWarning?: string;
  ai_log?: { timestamp: number; model: string; changes: string[] }[];
}

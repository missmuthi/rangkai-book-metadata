/**
 * Scan Module - Public API
 */

export {
  createBookScan,
  getScanHistory,
  validateISBN,
  batchCreateScans,
} from "./service";

export type { ScanResult, ScanHistoryResult } from "./service";

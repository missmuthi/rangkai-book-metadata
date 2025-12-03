# Row-Version History System

## Overview

The row-version history system provides full-snapshot versioning for scan records, enabling audit trails and recovery from AI metadata cleaning errors. Every time a scan is updated (especially via AI cleaning), the previous state is preserved in the `scans_history` table.

## Architecture

### Database Schema

#### `scans` table (Main)

Stores the current state of each scan record.

#### `scans_history` table (Versioning)

Stores full snapshots of scan records:

- `history_id` - Unique identifier for each snapshot
- `scan_id` - Reference to the original scan
- `version` - Version number (increments per scan)
- `snapshot_at` - Unix timestamp when snapshot was created
- All scan fields - Full copy of the scan state at that moment

### Key Features

1. **Full Snapshots** - Complete record state preserved, not just diffs
2. **Automatic Versioning** - AI clean endpoint automatically creates snapshots before updates
3. **Audit Trail** - Track all changes made to scan records
4. **Recovery** - Restore any previous version with a single API call

## Usage

### Automatic Snapshot Creation

Snapshots are automatically created when:

- Updating an existing scan via `/api/ai/clean`
- Any update operation that modifies scan metadata

```typescript
// Happens automatically in the AI clean endpoint
await createScanSnapshot(DB, scanId, requestId);
```

### Manual Snapshot Creation

```typescript
import { createScanSnapshot } from "$lib/server/versioning";

// Create a snapshot before making manual changes
const version = await createScanSnapshot(db, scanId, optionalRequestId);
if (version) {
  console.log(`Created version ${version}`);
}
```

### Retrieve Version History

**API Endpoint:**

```
GET /api/scans/{id}/history
```

**Response:**

```json
{
  "scan_id": 123,
  "total_versions": 5,
  "versions": [
    {
      "history_id": 15,
      "scan_id": 123,
      "version": 5,
      "snapshot_at": 1733200000000,
      "isbn": "9780134685991",
      "title": "Effective Java",
      "json_data": "{...}",
      "ai_log": "[...]",
      ...
    },
    ...
  ]
}
```

**Code Example:**

```typescript
import { getScanHistory } from "$lib/server/versioning";

const history = await getScanHistory(db, scanId);
console.log(`Found ${history.length} versions`);
```

### Restore to Previous Version

**API Endpoint:**

```
POST /api/scans/{id}/history
Content-Type: application/json

{
  "version": 3
}
```

**Response:**

```json
{
  "success": true,
  "scan_id": 123,
  "restored_to_version": 3,
  "message": "Successfully restored scan to version 3"
}
```

**Code Example:**

```typescript
import { restoreScanVersion } from "$lib/server/versioning";

const success = await restoreScanVersion(db, scanId, version, requestId);
if (success) {
  console.log("Scan restored successfully");
}
```

## Use Cases

### 1. AI Cleaning Gone Wrong

If AI cleaning produces bad metadata:

```bash
# Check what changed
curl -X GET https://your-domain.com/api/scans/123/history \
  -H "Cookie: your-session-cookie"

# Restore to last good version
curl -X POST https://your-domain.com/api/scans/123/history \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json" \
  -d '{"version": 2}'
```

### 2. Audit Trail

Track all changes made to a book record:

```sql
SELECT
  version,
  datetime(snapshot_at/1000, 'unixepoch') as changed_at,
  json_extract(json_data, '$.title') as title,
  json_extract(json_data, '$.ddc') as ddc
FROM scans_history
WHERE scan_id = ?
ORDER BY version DESC;
```

### 3. Compare Versions

```typescript
const history = await getScanHistory(db, scanId);
const current = history[0];
const previous = history[1];

// Compare what AI changed
const currentData = JSON.parse(current.json_data);
const previousData = JSON.parse(previous.json_data);

console.log("Title changed from", previousData.title, "to", currentData.title);
```

## Performance Considerations

### Storage Overhead

- **Impact**: History table grows with each update
- **Mitigation**:
  - Archive old versions periodically
  - Implement retention policy (e.g., keep last 10 versions)
  - Compress `json_data` field if needed

### Query Performance

Indexes are optimized for common queries:

- `idx_scans_history_scan_id` - Get all versions for a scan
- `idx_scans_history_scan_version` - Get specific version
- `idx_scans_history_snapshot_at` - Time-based queries
- `idx_scans_history_isbn` - Lookup by ISBN

### Write Performance

Each update operation creates one additional INSERT:

- Main update: `UPDATE scans ...`
- Snapshot: `INSERT INTO scans_history ...`

For most use cases (moderate update frequency), this overhead is negligible.

## Migration

To add versioning to an existing database:

```bash
# Apply migration
wrangler d1 execute DB --file=migrations/20251203_add_scans_history.sql
```

**Local Development:**

```bash
# Apply to local D1
npm run db:migrate
```

## Best Practices

1. **Always snapshot before destructive updates** - The system does this automatically for AI cleaning
2. **Don't snapshot on INSERT** - Only existing records need versioning
3. **Log snapshot creation** - Use requestId for tracing
4. **Verify ownership** - Always check user permissions before restore
5. **Test recovery** - Periodically test restore functionality

## Troubleshooting

### Snapshot not created

Check logs for errors:

```typescript
logger.error("scan_snapshot_failed", { scanId, error });
```

Common causes:

- Scan doesn't exist
- Database connection issues
- Permission errors

### Version count mismatch

If version numbers seem off:

```sql
-- Check for gaps
SELECT scan_id, version
FROM scans_history
WHERE scan_id = ?
ORDER BY version;
```

### Restore failed

Verify:

1. Version exists: `SELECT * FROM scans_history WHERE scan_id = ? AND version = ?`
2. User owns the scan: `SELECT user_id FROM scans WHERE id = ?`
3. Database is accessible

## Future Enhancements

Potential improvements:

- **Diff-based storage** - Store only changed fields to save space
- **Automatic cleanup** - Purge old versions beyond retention policy
- **Branching** - Support multiple version branches
- **Comparison UI** - Visual diff between versions
- **Bulk restore** - Restore multiple scans at once

## Security Notes

- Snapshots inherit the security context of the main scan
- Restore operations verify user ownership
- History is deleted when scan is deleted (CASCADE)
- No separate permissions needed - if you can update a scan, you can restore it

## API Reference

### `createScanSnapshot(db, scanId, requestId?)`

Creates a snapshot of the current scan state.

**Returns:** Version number or null

### `getScanHistory(db, scanId)`

Retrieves all versions of a scan.

**Returns:** Array of ScanSnapshot objects

### `restoreScanVersion(db, scanId, version, requestId?)`

Restores a scan to a specific version.

**Returns:** Boolean success status

## Examples

### Frontend Integration

```typescript
// In your Svelte component
async function restorePreviousVersion(scanId: number) {
  const response = await fetch(`/api/scans/${scanId}/history`);
  const { versions } = await response.json();

  if (versions.length > 1) {
    // Restore to previous version
    await fetch(`/api/scans/${scanId}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: versions[1].version }),
    });

    alert("Restored to previous version");
  }
}
```

### CLI Tool

```bash
# Get history
curl -X GET "https://api.example.com/api/scans/123/history" \
  -H "Authorization: Bearer $TOKEN" | jq '.versions[]'

# Restore
curl -X POST "https://api.example.com/api/scans/123/history" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version": 2}'
```

# Mobile Field Agent QA Checklist

## Test Environment Matrix

| Platform | Browser | Version | Device Type                |
| -------- | ------- | ------- | -------------------------- |
| iOS      | Safari  | 15+     | iPhone/iPad                |
| Android  | Chrome  | 100+    | Phone/Tablet               |
| Desktop  | Chrome  | 100+    | Laptop/Desktop with webcam |
| Desktop  | Firefox | 100+    | Laptop/Desktop with webcam |
| Desktop  | Edge    | 100+    | Laptop/Desktop with webcam |

---

## 1. Browser Compatibility & Device Access

### 1.1 iOS Safari (Mobile)

**Severity: CRITICAL**

- [ ] Page loads without errors on iOS Safari 15+
- [ ] Page loads without errors on iOS Safari 16+
- [ ] Camera permission prompt appears on first scan attempt
- [ ] Rear camera (environment) is selected by default, not front camera
- [ ] Camera stream displays correctly in scanner frame
- [ ] Video feed is not mirrored or distorted
- [ ] Barcode scanning works in portrait mode
- [ ] Barcode scanning works in landscape mode
- [ ] Device rotation maintains scanner state
- [ ] No console errors in Safari Web Inspector
- [ ] Audio beep plays on successful scan (if not muted)
- [ ] Works on iPhone 12 and newer models
- [ ] Works on older iPhone models (iPhone 8, X)

### 1.2 Android Chrome (Mobile)

**Severity: CRITICAL**

- [ ] Page loads without errors on Chrome 100+
- [ ] Camera permission prompt appears correctly
- [ ] Rear camera is selected by default
- [ ] Camera stream displays in correct aspect ratio
- [ ] Barcode scanning works in portrait mode
- [ ] Barcode scanning works in landscape mode
- [ ] No console errors in Chrome DevTools
- [ ] Audio beep plays on successful scan
- [ ] Works on Samsung devices
- [ ] Works on Google Pixel devices
- [ ] Works on other Android manufacturers

### 1.3 Desktop Chrome (Webcam)

**Severity: HIGH**

- [ ] Page loads without errors
- [ ] Camera permission prompt appears
- [ ] Webcam feed displays correctly
- [ ] Barcode scanning works with physical books
- [ ] Scanning works with barcode on screen (testing aid)
- [ ] Audio beep plays on successful scan
- [ ] No console errors

---

## 2. Camera Permission Handling

### 2.1 Initial Permission Request

**Severity: CRITICAL**

- [ ] Permission prompt appears on component mount
- [ ] Status text shows "Camera starting..." before permission granted
- [ ] Status text updates to "Scanning..." after permission granted
- [ ] No errors logged when permission granted
- [ ] Camera stream starts within 3 seconds of permission grant

### 2.2 Permission Denied (First Time)

**Severity: CRITICAL**

- [ ] Error message displays: "Camera permission denied" or similar
- [ ] Error text is red and clearly visible
- [ ] No JavaScript errors in console
- [ ] Scanner gracefully stops attempting to access camera
- [ ] Refresh page allows re-prompting for permission
- [ ] Error event is dispatched to parent component

### 2.3 Permission Permanently Denied/Blocked

**Severity: HIGH**

- [ ] User-friendly error message displays
- [ ] Instructions to enable camera in browser settings (if possible)
- [ ] Page remains functional (no crash)
- [ ] No infinite retry loops
- [ ] Clear messaging about manual permission reset

### 2.4 Permission Revoked During Session

**Severity: MEDIUM**

- [ ] Scanner stops when permission revoked mid-session
- [ ] Error message displays appropriately
- [ ] No unhandled promise rejections
- [ ] Page can recover if permission re-granted

---

## 3. Barcode Scanning Functionality

### 3.1 Successful Scanning - Various Conditions

**Severity: CRITICAL**

**Good Lighting:**

- [ ] ISBN-13 barcode scans successfully
- [ ] ISBN-10 barcode scans successfully
- [ ] EAN-13 barcode scans successfully
- [ ] UPC barcode scans successfully
- [ ] Audio beep plays immediately on scan
- [ ] Scanned text is trimmed (no leading/trailing whitespace)

**Poor Lighting:**

- [ ] Scanner attempts to focus and scan
- [ ] Error handling for repeated failed scans is graceful
- [ ] User can improve lighting and retry
- [ ] No app crash from scan failures

**Tilted Barcode (15-30° angle):**

- [ ] Scanner successfully reads tilted barcodes
- [ ] Scan time may be longer but succeeds
- [ ] No false positives

**Partial Barcode (edges cut off):**

- [ ] Scanner does not return partial/incorrect data
- [ ] No successful scan until full barcode visible
- [ ] User can adjust camera to include full barcode

**Distance Testing:**

- [ ] Barcode scans from 10cm distance
- [ ] Barcode scans from 20cm distance
- [ ] Barcode scans from 30cm distance
- [ ] Clear feedback if barcode too far/close

### 3.2 Duplicate Scan Debouncing

**Severity: HIGH**

- [ ] Scanning same barcode within 3 seconds is ignored
- [ ] Only one API call made for duplicate scans
- [ ] Audio beep does NOT play for debounced scans
- [ ] `lastScan` and `lastScanAt` state updates correctly
- [ ] After 3+ seconds, same barcode triggers new scan
- [ ] Different barcode scans immediately (no debounce)
- [ ] Rapid scanning of different barcodes works correctly

**Test Sequence:**

1. Scan barcode A at T=0s → Should trigger
2. Scan barcode A at T=1s → Should be ignored
3. Scan barcode A at T=2s → Should be ignored
4. Scan barcode B at T=2.5s → Should trigger immediately
5. Scan barcode A at T=4s → Should trigger (>3s from T=0)

### 3.3 QR Box Visibility & UX

**Severity: HIGH**

- [ ] QR scanning box (250x150px) is clearly visible
- [ ] Box has blue border (rgba(59, 130, 246, 0.5))
- [ ] Box overlays video feed correctly
- [ ] Status text "Align the book's barcode within the frame" displays
- [ ] Status text updates based on scanner state
- [ ] Video feed is not obscured by UI elements

### 3.4 Scanner Lifecycle

**Severity: CRITICAL**

- [ ] Scanner initializes on page mount
- [ ] Scanner stops cleanly on page unmount/navigation
- [ ] No memory leaks from scanner instance
- [ ] Cleanup functions execute without errors
- [ ] Multiple mount/unmount cycles work correctly
- [ ] Browser back button properly cleans up scanner

---

## 4. API Integration & Network Behavior

### 4.1 Successful API Response

**Severity: CRITICAL**

- [ ] Scanned ISBN triggers API call to `/api/book/[isbn]`
- [ ] ISBN is normalized (spaces/hyphens removed) before API call
- [ ] Loading state displays: "Fetching book data..."
- [ ] Loading spinner visible during fetch
- [ ] API response maps correctly to `LastBook` type
- [ ] Book card displays with all available fields:
  - Cover image
  - Title (bold)
  - Subtitle (if available)
  - Authors (comma-separated)
  - ISBN
  - Source label
- [ ] Previous scanned book is replaced with new data
- [ ] Loading state clears after successful fetch

### 4.2 API 404 - Book Not Found

**Severity: HIGH**

- [ ] Error message displays: "Book not found" or similar
- [ ] Red error card shows with appropriate icon
- [ ] Previous book data (if any) remains or clears appropriately
- [ ] User can scan another barcode to retry
- [ ] No console errors from 404 response
- [ ] Error state clears on next successful scan

### 4.3 API 500 - Server Error

**Severity: HIGH**

- [ ] Error message displays: "Server error" or similar
- [ ] Error card shows user-friendly message
- [ ] No app crash from server error
- [ ] User can retry with another scan
- [ ] Error state clears on next scan attempt

### 4.4 Offline Mode / No Internet

**Severity: MEDIUM**

- [ ] Network error displays: "No internet connection" or similar
- [ ] Fetch promise rejects gracefully
- [ ] No unhandled promise rejections
- [ ] Scanner continues to work (can queue scans)
- [ ] When online again, scans resume working
- [ ] Clear error messaging about connectivity

### 4.5 Rapid Scanning / Request Queueing

**Severity: HIGH**

- [ ] Scanning barcode B while loading barcode A queues B correctly
- [ ] Only the latest queued scan executes after current fetch
- [ ] No explosion of parallel API requests
- [ ] `pendingIsbn` state manages queue correctly
- [ ] Intermediate scans are discarded (latest wins)
- [ ] UI shows loading state throughout

**Test Sequence:**

1. Scan ISBN A (starts loading)
2. Scan ISBN B while A is loading (should queue B)
3. A finishes → B should immediately start loading
4. Scan ISBN C while B is loading (should replace B with C)
5. B finishes → C should load

### 4.6 Slow Network Conditions

**Severity: MEDIUM**

- [ ] Loading state persists for slow responses (5-10s)
- [ ] No timeout errors before reasonable wait time
- [ ] User can scan different barcode to cancel implicit previous request
- [ ] UI remains responsive during slow fetch

---

## 5. UI/UX Validation

### 5.1 Page Layout & Responsiveness

**Severity: HIGH**

**Mobile Portrait (375px - 428px width):**

- [ ] Header displays correctly: "Mobile Scan Mode"
- [ ] Subtitle visible: "Scan ISBN/EAN barcodes to fetch book metadata"
- [ ] Scanner container fits screen width
- [ ] Scanner container max-width: 500px enforced
- [ ] Book card fits screen width
- [ ] All text is readable (no overflow)
- [ ] Touch targets are adequate (44x44px minimum)

**Mobile Landscape:**

- [ ] Layout adapts appropriately
- [ ] Scanner remains usable
- [ ] Book card displays correctly

**Tablet (768px - 1024px):**

- [ ] Scanner centers on page
- [ ] Book card centers below scanner
- [ ] Adequate spacing between elements

**Desktop (1280px+):**

- [ ] Scanner and card centered with max-width
- [ ] Layout doesn't stretch awkwardly
- [ ] Maintains mobile-friendly feel

### 5.2 Loading States

**Severity: HIGH**

- [ ] "Camera starting..." displays on initial load
- [ ] "Scanning..." displays when camera active
- [ ] "Fetching book data..." displays during API call
- [ ] Blue spinning loader visible during fetch
- [ ] Loading state in book card section only (scanner remains visible)

### 5.3 Error States

**Severity: HIGH**

- [ ] Camera permission error: Red text, clear message
- [ ] API error: Red card with error icon and message
- [ ] Network error: Red card with connectivity message
- [ ] All errors are user-friendly (no technical jargon)
- [ ] Error messages are grammatically correct

### 5.4 Success States - Book Card

**Severity: CRITICAL**

**With All Data Available:**

- [ ] Cover image displays (w-24 h-32)
- [ ] Cover has rounded corners and shadow
- [ ] Title displays in bold, large text
- [ ] Subtitle displays if available
- [ ] Authors display with "By:" label
- [ ] Multiple authors separated by commas
- [ ] ISBN displays with "ISBN:" label
- [ ] Source displays with "Source:" label (e.g., "google-loc")
- [ ] Card has proper spacing and padding

**With Missing Data:**

- [ ] Missing cover: Image section hidden, text fills space
- [ ] Missing subtitle: No extra space, compact layout
- [ ] Missing authors: Authors line not displayed
- [ ] Missing source: Source line not displayed
- [ ] Fallback title: "Unknown Title" if title missing

**Cover Image Error Handling:**

- [ ] Broken cover URL hides image (display: none)
- [ ] No broken image icon visible
- [ ] Layout adjusts gracefully without image

### 5.5 Empty State

**Severity: MEDIUM**

- [ ] "No book scanned yet" displays initially
- [ ] Barcode icon visible in empty state
- [ ] Subtitle: "Point your camera at a barcode to begin"
- [ ] Empty state card is centered and visually clear
- [ ] Gray text for empty state (not too prominent)

### 5.6 Accessibility

**Severity: HIGH**

- [ ] All interactive elements keyboard accessible (if applicable)
- [ ] Color contrast meets WCAG AA standards
- [ ] Error messages are announced (screen reader testing)
- [ ] Status updates are conveyed appropriately
- [ ] Focus management is logical
- [ ] Viewport meta tag prevents unwanted zoom on mobile

---

## 6. SSR Safety & SvelteKit Compatibility

### 6.1 Server-Side Rendering

**Severity: CRITICAL**

- [ ] Page renders HTML on server without errors
- [ ] No `window` or `document` access during SSR
- [ ] No `navigator` access during SSR
- [ ] html5-qrcode imported only in `onMount` (client-side)
- [ ] AudioContext created only client-side
- [ ] Server logs show no SSR-related errors
- [ ] Initial HTML includes proper meta tags and title

### 6.2 Hydration

**Severity: CRITICAL**

- [ ] Page hydrates correctly on client
- [ ] No hydration mismatches in browser console
- [ ] Component state initializes correctly client-side
- [ ] Camera initialization happens after hydration
- [ ] No "Cannot read property of undefined" errors

### 6.3 Client-Side Navigation

**Severity: HIGH**

- [ ] Navigating to `/scan/mobile` from another page works
- [ ] Scanner initializes correctly after client-side navigation
- [ ] Using browser back button cleans up scanner
- [ ] Using browser forward button re-initializes scanner
- [ ] No memory leaks from navigation cycles
- [ ] SvelteKit's preload doesn't break scanner

### 6.4 Build & Bundle

**Severity: CRITICAL**

- [ ] `npm run build` completes without errors
- [ ] html5-qrcode is code-split correctly (not in SSR bundle)
- [ ] Bundle size is reasonable (<500KB for route)
- [ ] No TypeScript errors in build output
- [ ] No Svelte compiler warnings for this component/page

---

## 7. Performance & Resource Management

### 7.1 Camera Resource Management

**Severity: HIGH**

- [ ] Camera turns on only when needed
- [ ] Camera turns off when navigating away
- [ ] Camera turns off on component unmount
- [ ] Multiple visits to page don't leak camera instances
- [ ] Battery drain is reasonable during use
- [ ] Device doesn't overheat during extended scanning

### 7.2 Memory Management

**Severity: MEDIUM**

- [ ] No memory leaks in Chrome DevTools memory profiler
- [ ] Scanner cleanup releases resources
- [ ] Video stream stops on cleanup
- [ ] Multiple scan sessions don't accumulate memory
- [ ] Page can be used for 10+ scans without issues

### 7.3 Network Efficiency

**Severity: MEDIUM**

- [ ] API calls leverage existing KV cache (check via Network tab)
- [ ] Duplicate scans don't make duplicate API calls
- [ ] Failed requests don't retry infinitely
- [ ] Requests have reasonable timeout

---

## 8. Edge Cases & Error Recovery

### 8.1 Edge Cases

**Severity: MEDIUM**

- [ ] Scanning invalid barcode format (non-ISBN): Handled gracefully
- [ ] Scanning non-book barcode (food product): API 404 handled
- [ ] Extremely long ISBN-like string: Normalized and handled
- [ ] Empty barcode scan result: Ignored or error handled
- [ ] Special characters in barcode: Sanitized before API call
- [ ] Camera covered/blocked: No crash, recovers when uncovered
- [ ] Multiple cameras available: Correct camera selected

### 8.2 Component Recovery

**Severity: HIGH**

- [ ] Can recover from camera error and retry
- [ ] Can recover from API error and scan again
- [ ] Page refresh clears all errors
- [ ] No stuck states requiring force-refresh

### 8.3 Concurrent Operations

**Severity: MEDIUM**

- [ ] Scanner works while API call in progress
- [ ] Multiple rapid scans don't break state
- [ ] User can leave and return to page mid-scan

---

## 9. Cross-Browser Consistency

### 9.1 Feature Parity

**Severity: HIGH**

- [ ] All features work identically on iOS Safari
- [ ] All features work identically on Android Chrome
- [ ] Desktop Chrome matches mobile functionality
- [ ] Audio beep works consistently (or fails gracefully)

### 9.2 Known Limitations

**Severity: LOW**

Document any browser-specific limitations:

- [ ] iOS Safari: Audio may not play if device muted
- [ ] Firefox: Camera permission prompt differs
- [ ] Older browsers: Note minimum versions

---

## 10. Security & Privacy

### 10.1 Data Privacy

**Severity: CRITICAL**

- [ ] Camera stream not recorded or stored
- [ ] Scanned ISBNs not logged unnecessarily
- [ ] No third-party scripts access camera
- [ ] Camera stops immediately when not in use

### 10.2 Input Sanitization

**Severity: HIGH**

- [ ] Scanned barcode text is sanitized before API call
- [ ] No XSS vulnerabilities from scanned text
- [ ] ISBN normalization prevents injection attacks
- [ ] URL encoding applied to API calls

---

## Test Execution Summary

### Priority Levels:

- **CRITICAL**: Must pass before production deployment
- **HIGH**: Should pass, can be hotfixed if needed
- **MEDIUM**: Important for UX, can be addressed in next release
- **LOW**: Nice-to-have, document as known issues

### Test Sign-Off:

| Test Category         | iOS Safari | Android Chrome | Desktop Chrome | Status |
| --------------------- | ---------- | -------------- | -------------- | ------ |
| Browser Compatibility | ☐          | ☐              | ☐              |        |
| Permission Handling   | ☐          | ☐              | ☐              |        |
| Barcode Scanning      | ☐          | ☐              | ☐              |        |
| API Integration       | ☐          | ☐              | ☐              |        |
| UI/UX Validation      | ☐          | ☐              | ☐              |        |
| SSR Safety            | ☐          | ☐              | ☐              |        |
| Performance           | ☐          | ☐              | ☐              |        |
| Edge Cases            | ☐          | ☐              | ☐              |        |
| Security              | ☐          | ☐              | ☐              |        |

### Tester Information:

- **Tester Name:** **\*\***\_\_\_**\*\***
- **Test Date:** **\*\***\_\_\_**\*\***
- **Build Version:** **\*\***\_\_\_**\*\***
- **Environment:** ☐ Staging ☐ Production

### Critical Blockers Found:

_List any critical issues that must be resolved before release_

1.
2.
3.

---

**Total Checklist Items:** 250+  
**Estimated Testing Time:** 4-6 hours (per platform)  
**Recommended Retest Cycle:** After any scanner-related code changes

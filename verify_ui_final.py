from playwright.sync_api import sync_playwright

def verify_frontend_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a mobile viewport to verify mobile-first design
        context = browser.new_context(viewport={"width": 375, "height": 812}, user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1")
        page = context.new_page()

        # 1. Verify History Page (Empty State)
        print("Verifying History Page Empty State...")
        page.goto("http://localhost:5173/history")
        page.wait_for_selector("text=No scan history yet")
        page.screenshot(path="verification_history_empty.png")
        print("History empty state screenshot saved.")

        # 2. Verify Mobile Scanner Page
        print("Verifying Mobile Scanner Page...")
        page.goto("http://localhost:5173/scan/mobile")

        # Verify Scan Button
        scan_button = page.get_by_role("button", name="Scan ISBN")
        # Ensure button is visible
        if scan_button.is_visible():
            print("Scan ISBN button is visible.")
        else:
             print("Scan ISBN button is NOT visible.")

        # Verify Camera Area (using text fallback or structure)
        if page.locator("text=Camera is paused").is_visible():
             print("Camera paused state visible.")

        # Click the scan button to toggle state (should change to Stop Scanning)
        scan_button.click()
        # Wait for "Stop Scanning" text
        page.wait_for_selector("text=Stop Scanning", timeout=5000)

        # Verify Scan Line animation exists (by class)
        scan_line = page.locator(".animate-scan-vertical")
        if scan_line.is_visible():
            print("Scan line animation is visible.")

        page.screenshot(path="verification_scanner.png")
        print("Scanner page screenshot saved.")

        browser.close()

if __name__ == "__main__":
    verify_frontend_changes()

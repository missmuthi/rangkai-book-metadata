
from playwright.sync_api import sync_playwright
import time

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Navigate to the app
        print("Navigating to verification page...")
        page.goto("http://localhost:5173/verification-scanner")

        # Wait for hydration
        time.sleep(2)

        # Check Offline Mode Badge
        print("Simulating offline mode...")
        context.set_offline(True)
        time.sleep(2)

        # Check for "🔌 Offline Mode" text
        offline_badge = page.get_by_text("🔌 Offline Mode")
        if offline_badge.is_visible():
            print("SUCCESS: Offline badge visible with correct text.")
            page.screenshot(path="verification/offline_mode_verified.png")
        else:
            print("ERROR: Offline badge not found or text incorrect.")
            page.screenshot(path="verification/offline_check_fail_direct.png")

        # Restore online
        context.set_offline(False)
        time.sleep(1)

        browser.close()

if __name__ == "__main__":
    verify_changes()

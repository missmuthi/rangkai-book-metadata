from playwright.sync_api import sync_playwright

def verify_scanner_debug():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use mobile viewport
        context = browser.new_context(viewport={"width": 375, "height": 812})
        page = context.new_page()

        print("Navigating to Scanner Page...")
        page.goto("http://localhost:5173/scan/mobile")

        # Wait a bit for client-side hydration
        page.wait_for_timeout(3000)

        print("Page Title:", page.title())
        print("URL:", page.url)

        # Check if we got redirected
        if "login" in page.url:
            print("Redirected to login!")

        # Take a screenshot
        page.screenshot(path="debug_scanner.png")
        print("Screenshot saved.")

        # Print body text to see what's on the page
        print("Body text snippet:", page.inner_text("body")[:500])

        browser.close()

if __name__ == "__main__":
    verify_scanner_debug()

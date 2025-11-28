from playwright.sync_api import sync_playwright, expect
import os

def verify_tailwind_login(page):
    print("Navigating to login page...")
    page.goto("http://localhost:5173/login")

    # Wait for heading
    heading = page.get_by_role("heading", name="Welcome to Rangkai")
    expect(heading).to_be_visible()

    print("Taking screenshot...")
    # Use relative path to current working directory
    page.screenshot(path="verification/login_tailwind_v4.png")
    print("Screenshot saved to verification/login_tailwind_v4.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_tailwind_login(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

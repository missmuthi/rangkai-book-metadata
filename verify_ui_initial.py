from playwright.sync_api import sync_playwright

def verify_history_empty_state():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # We can't easily login, but we can verify that the empty state component works if we could bypass auth.
        # Since we can't bypass auth easily without modifying server code, we will rely on static analysis or unit tests for logic.
        # However, for the purpose of the instructions, I will attempt to visit the login page and scan page.

        # Visit Login Page
        page.goto("http://localhost:5173/login")
        page.screenshot(path="login_page.png")
        print("Login page screenshot saved.")

        # Try to visit History (should redirect to login)
        page.goto("http://localhost:5173/history")
        page.wait_for_load_state("networkidle")
        if "login" in page.url:
            print("Redirected to login as expected.")

        # To truly verify the UI, I would need to mock the data or bypass auth.
        # I will temporarily modify +page.server.ts to bypass auth for verification in the next step.

        browser.close()

if __name__ == "__main__":
    verify_history_empty_state()

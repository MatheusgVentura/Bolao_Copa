from playwright.sync_api import sync_playwright
import pathlib

url = pathlib.Path("index.html").resolve().as_uri()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 2000})
    page.goto(url)
    page.wait_for_timeout(1500)

    page.click("#themeToggleButton")
    page.wait_for_timeout(300)

    page.on("dialog", lambda dialog: dialog.accept("7nzuoeeZKVMeY7QE4LiVhgl6"))
    page.click("#adminLoginButton")
    page.wait_for_timeout(800)

    page.screenshot(path="_dm_5_admin_dark.png", full_page=True)
    browser.close()

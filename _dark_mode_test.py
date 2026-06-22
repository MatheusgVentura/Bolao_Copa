from playwright.sync_api import sync_playwright
import pathlib

url = pathlib.Path("index.html").resolve().as_uri()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 1600})
    page.goto(url)
    page.wait_for_timeout(1500)

    page.screenshot(path="_dm_1_light_initial.png", full_page=True)

    page.click("#themeToggleButton")
    page.wait_for_timeout(300)
    theme_after_click = page.evaluate("document.documentElement.getAttribute('data-theme')")
    storage_after_click = page.evaluate("localStorage.getItem('bolao-theme')")
    btn_text_after_click = page.inner_text("#themeToggleButton")
    page.screenshot(path="_dm_2_dark_after_click.png", full_page=True)

    page.reload()
    page.wait_for_timeout(1000)
    theme_after_reload = page.evaluate("document.documentElement.getAttribute('data-theme')")
    btn_text_after_reload = page.inner_text("#themeToggleButton")
    page.screenshot(path="_dm_3_dark_after_reload.png", full_page=True)

    page.click("#themeToggleButton")
    page.wait_for_timeout(300)
    theme_after_toggle_back = page.evaluate("document.documentElement.getAttribute('data-theme')")
    storage_after_toggle_back = page.evaluate("localStorage.getItem('bolao-theme')")
    page.screenshot(path="_dm_4_light_after_toggle_back.png", full_page=True)

    browser.close()

    print("theme_after_click:", theme_after_click)
    print("storage_after_click:", storage_after_click)
    print("btn_text_after_click:", btn_text_after_click)
    print("theme_after_reload:", theme_after_reload)
    print("btn_text_after_reload:", btn_text_after_reload)
    print("theme_after_toggle_back:", theme_after_toggle_back)
    print("storage_after_toggle_back:", storage_after_toggle_back)

from pathlib import Path

from playwright.sync_api import expect, sync_playwright


BASE_URL = "http://127.0.0.1:4173"
REVIEW_DIR = Path(__file__).resolve().parents[1] / "review"
STANDALONE_HTML = Path(__file__).resolve().parents[1] / "dist" / "index.html"


def attach_error_collection(page, errors: list[str]) -> None:
    page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))

    def collect_console(message) -> None:
        if message.type == "error":
            errors.append(f"console: {message.text}")

    page.on("console", collect_console)


def add_observation_without_viewport_jump(page) -> None:
    rows = page.locator(".observation-row")
    previous_count = rows.count()
    add_observation = page.get_by_role("button", name="Добавить запись")
    add_observation.evaluate("element => element.scrollIntoView({ block: 'center' })")
    page.wait_for_timeout(100)
    add_button_before = add_observation.bounding_box()
    assert add_button_before is not None

    add_observation.click()
    expect(rows).to_have_count(previous_count + 1)

    add_button_after = add_observation.bounding_box()
    assert add_button_after is not None
    assert abs(add_button_after["y"] - add_button_before["y"]) <= 1, (
        "Adding an observation moved the journal controls in the viewport: "
        f"before={add_button_before}, after={add_button_after}"
    )


def validate_desktop(browser) -> list[str]:
    errors: list[str] = []
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    attach_error_collection(page, errors)
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")

    expect(page.get_by_role("heading", name="Радар подозрений")).to_be_visible()
    expect(page.locator(".leader-plane__copy h2")).to_have_text("fox_001")
    expect(page.locator(".ranking-row")).to_have_count(4)
    suspicion_stepper = page.locator('[data-observation-id="obs_001"] .suspicion-stepper')
    expect(suspicion_stepper).to_be_visible()
    decrement = page.get_by_role("button", name="Уменьшить подозрительность obs_001")
    increment = page.get_by_role("button", name="Увеличить подозрительность obs_001")
    for button in [decrement, increment]:
        button_box = button.bounding_box()
        assert button_box is not None
        assert 24 <= button_box["width"] <= 30 and button_box["height"] >= 30, (
            "Suspicion stepper buttons do not match the compact reviewed size"
        )
    stepper_box = suspicion_stepper.bounding_box()
    assert stepper_box is not None and stepper_box["width"] <= 108, (
        "Suspicion stepper is still oversized relative to its value"
    )
    assert suspicion_stepper.evaluate(
        "element => element.scrollWidth <= element.clientWidth"
    ), "Suspicion stepper clips its inner grid"
    suspicion_input = page.get_by_role("spinbutton", name="Подозрительность obs_001")
    expect(suspicion_input).to_have_attribute("type", "number")
    decrement.click()
    expect(suspicion_input).to_have_value("7")
    increment.click()
    expect(suspicion_input).to_have_value("8")
    suspicion_input.focus()
    assert suspicion_stepper.evaluate("element => element.matches(':focus-within')")
    input_box = suspicion_input.bounding_box()
    scale_box = suspicion_stepper.locator(".suspicion-stepper__scale").bounding_box()
    assert input_box is not None and scale_box is not None
    assert suspicion_input.evaluate(
        "element => element.scrollWidth <= element.clientWidth"
    ), "Suspicion input clips its numeric value"
    assert input_box["x"] + input_box["width"] <= scale_box["x"], (
        "The focused numeric input overlaps its /10 scale label"
    )
    stepper_box = suspicion_stepper.bounding_box()
    value_box = suspicion_stepper.locator(".suspicion-stepper__value").bounding_box()
    assert stepper_box is not None and value_box is not None
    value_center = value_box["x"] + value_box["width"] / 2
    stepper_center = stepper_box["x"] + stepper_box["width"] / 2
    assert abs(value_center - stepper_center) <= 1, (
        "The score value is not centered inside the compact stepper"
    )
    value_center_y = value_box["y"] + value_box["height"] / 2
    stepper_center_y = stepper_box["y"] + stepper_box["height"] / 2
    assert abs(value_center_y - stepper_center_y) <= 1, (
        "The score value is not vertically centered inside the compact stepper: "
        f"value={value_box}, stepper={stepper_box}"
    )
    assert suspicion_stepper.locator(".suspicion-stepper__value").evaluate(
        "element => getComputedStyle(element).alignItems === 'center'"
    ), "Suspicion value still uses baseline alignment"

    first_row = page.locator(".observation-row").first
    for field in first_row.locator("input:not([type='checkbox']), select").all():
        assert field.evaluate(
            "element => parseFloat(getComputedStyle(element).paddingLeft) === 0"
        ), "Observation values remain shifted right from their column headings"
    page.screenshot(path=REVIEW_DIR / "desktop-overview.png")

    for label in [
        "Уровень подозрительности",
        "Наличие добычи",
        "Повторная встреча",
        "Одна локация",
    ]:
        slider = page.get_by_role("slider", name=label)
        slider.focus()
        slider.press("Home")
    expect(page.get_by_role("heading", name="Ничья в рейтинге")).to_be_visible()
    expect(page.locator(".leader-plane")).to_contain_text("4 лисы")
    zero_score_bars = page.locator(".ranking-row__meter span").evaluate_all(
        "elements => elements.every((element) => element.style.width === '0%')"
    )
    assert zero_score_bars, "Zero-score ranking rows still show a non-zero meter"
    page.evaluate("document.activeElement?.blur()")
    page.wait_for_timeout(500)
    page.screenshot(path=REVIEW_DIR / "desktop-tie.png")
    page.get_by_role("button", name="Сбросить").click()
    expect(page.locator(".leader-plane__copy h2")).to_have_text("fox_001")

    page.get_by_role("spinbutton", name="Подозрительность obs_001").fill("1")
    page.locator('[data-observation-id="obs_001"] .prey-toggle').click()
    page.get_by_role("spinbutton", name="Подозрительность obs_003").fill("1")
    expect(page.locator(".leader-plane__copy h2")).to_have_text("fox_003")

    page.get_by_role("button", name="Как считается балл").click()
    expect(page.get_by_role("dialog")).to_be_visible()
    expect(page.get_by_role("dialog")).to_contain_text("Средняя подозрительность")
    page.screenshot(path=REVIEW_DIR / "desktop-formula.png", full_page=True)
    page.get_by_role("button", name="Закрыть формулу").click()

    page.get_by_role("button", name="AI Worklog 7").click()
    expect(page.get_by_role("heading", name="AI Worklog", exact=True)).to_be_visible()
    expect(page.locator(".worklog-timeline article")).to_have_count(7)
    expect(page.locator(".worklog-timeline blockquote")).to_have_count(5)
    expect(page.locator(".worklog-timeline blockquote strong")).to_have_text(["Промпт"] * 5)
    expect(page.locator(".worklog-timeline blockquote")).to_contain_text([
        "$grill-with-docs",
        "$to-spec",
        "$to-tickets",
        "$implement",
        "Провалидируй вёрстку и функциональность",
    ])
    expect(page.locator(".worklog-timeline article h2")).to_have_text([
        "Согласовал задачу в grill-with-docs",
        "Зафиксировал договорённости через to-spec",
        "Разбил спецификацию через to-tickets",
        "Проверил каждый тикет до начала работы",
        "Субагенты реализовали тикеты через implement",
        "Субагенты выполнили code-review",
        "Исправил UX и сверил результат с требованиями",
    ])
    expect(page.locator(".worklog-timeline")).to_contain_text("Lavish")
    expect(page.locator(".worklog-timeline article").nth(6)).to_contain_text(
        "Сначала я попросил агента проверить вёрстку и функциональность сайта"
    )
    expect(page.locator(".worklog-timeline article").nth(6)).to_contain_text(
        "через Lavish отметил оставшиеся несоответствия"
    )
    expect(page.locator(".worklog-timeline article").nth(2)).to_contain_text(
        "to-tickets я нарезал спецификацию на задачи и выставил блокеры"
    )
    expect(page.locator(".worklog-timeline article").nth(3)).to_contain_text(
        "при необходимости вносил правки"
    )
    expect(page.locator(".worklog-timeline article").nth(4)).to_contain_text(
        "Чтобы не переполнять контекстное окно одного агента"
    )
    expect(page.locator(".worklog-timeline article").nth(4)).to_contain_text(
        "каждому передали по одному тикету"
    )
    expect(page.locator(".worklog-timeline article").nth(5)).to_contain_text(
        "$code-review входил во флоу скилла $implement"
    )
    expect(page.locator(".worklog-timeline article").nth(5)).to_contain_text(
        "субагенты сверили код"
    )
    expect(page.locator(".worklog-timeline article").nth(5)).to_contain_text(
        "Моего участия на этом этапе не было"
    )
    expect(page.locator(".worklog-timeline article").nth(5)).to_contain_text(
        "зафиксировали и исправили найденные замечания"
    )
    expect(page.locator(".worklog-note")).to_contain_text("валидировал изменения")
    expect(page.locator(".worklog-note")).not_to_contain_text("принимал изменения")
    page.wait_for_timeout(900)
    page.evaluate("window.scrollTo(0, 0)")
    page.screenshot(path=REVIEW_DIR / "desktop-worklog.png", full_page=True)

    page.get_by_role("button", name="Лисий диспетчер").click()
    page.get_by_role("button", name="Вернуть исходные").click()
    add_observation_without_viewport_jump(page)
    page.locator(".observations").scroll_into_view_if_needed()
    page.wait_for_timeout(150)
    page.screenshot(path=REVIEW_DIR / "desktop-data.png")

    page.get_by_role("button", name="Вернуть исходные").click()
    page.get_by_role("button", name="Удалить obs_002").click()
    expect(page.locator(".report-meta")).to_contain_text("3 лисы")
    page.get_by_role("button", name="Добавить запись").click()
    added_fox_id = page.locator(".observation-row").last.get_by_role("textbox").first
    expect(added_fox_id).to_have_value("fox_005")
    expect(page.locator(".report-meta")).to_contain_text("4 лисы")
    page.close()
    return errors


def validate_mobile(browser) -> list[str]:
    errors: list[str] = []
    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    attach_error_collection(page, errors)
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")

    expect(page.get_by_role("heading", name="Радар подозрений")).to_be_visible()
    expect(page.locator(".leader-plane__copy h2")).to_have_text("fox_001")
    overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
    assert not overflow, "Mobile layout has horizontal overflow"
    page.locator(".observations").scroll_into_view_if_needed()
    expect(page.get_by_role("spinbutton", name="Подозрительность obs_001")).to_be_visible()
    page.screenshot(path=REVIEW_DIR / "mobile-overview.png", full_page=True)

    for label in [
        "Уровень подозрительности",
        "Наличие добычи",
        "Повторная встреча",
        "Одна локация",
    ]:
        slider = page.get_by_role("slider", name=label)
        slider.focus()
        slider.press("Home")
    expect(page.get_by_role("heading", name="Ничья в рейтинге")).to_be_visible()
    page.evaluate("document.activeElement?.blur()")
    page.wait_for_timeout(500)
    overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
    assert not overflow, "Mobile tie state has horizontal overflow"
    page.screenshot(path=REVIEW_DIR / "mobile-tie.png", full_page=True)
    page.get_by_role("button", name="Сбросить").click()

    page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    page.get_by_role("button", name="Открыть AI Worklog").click()
    worklog_heading = page.get_by_role("heading", name="AI Worklog", exact=True)
    expect(worklog_heading).to_be_in_viewport()
    expect(worklog_heading).to_be_focused()
    scroll_y = page.evaluate("window.scrollY")
    assert scroll_y == 0, f"AI Worklog navigation left scrollY at {scroll_y}"
    expect(page.locator(".worklog-timeline article")).to_have_count(7)
    page.wait_for_timeout(900)
    overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
    assert not overflow, "Mobile worklog has horizontal overflow"
    page.screenshot(path=REVIEW_DIR / "mobile-worklog.png", full_page=True)
    page.close()
    return errors


def validate_intermediate_layout(browser) -> list[str]:
    errors: list[str] = []
    page = browser.new_page(viewport={"width": 1080, "height": 900}, device_scale_factor=1)
    attach_error_collection(page, errors)
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")

    for selector in [
        "#report-title",
        "#ranking-title",
        "#locations-title",
        "#parameters-title",
        "#observations-title",
    ]:
        heading = page.locator(selector)
        expect(heading).to_be_visible()
        metrics = heading.evaluate(
            "element => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight })"
        )
        assert metrics["scrollHeight"] - metrics["clientHeight"] <= 1, (
            f"Heading {selector} clips its text vertically: {metrics}"
        )

    page.close()
    return errors


def validate_breakpoint_layout(browser) -> list[str]:
    errors: list[str] = []
    for width in [621, 640, 662]:
        page = browser.new_page(viewport={"width": width, "height": 900}, device_scale_factor=1)
        attach_error_collection(page, errors)
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        overflow = page.evaluate(
            "document.documentElement.scrollWidth > document.documentElement.clientWidth"
        )
        assert not overflow, (
            f"Responsive layout overflows horizontally at {width}px: "
            f"scrollWidth={page.evaluate('document.documentElement.scrollWidth')}"
        )
        if width == 640:
            page.screenshot(path=REVIEW_DIR / "breakpoint-640.png", full_page=True)
        page.close()
    return errors


def validate_standalone(browser) -> list[str]:
    errors: list[str] = []
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    attach_error_collection(page, errors)
    page.goto(STANDALONE_HTML.as_uri())
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("heading", name="Радар подозрений")).to_be_visible()
    expect(page.locator(".leader-plane__copy h2")).to_have_text("fox_001")
    page.get_by_role("spinbutton", name="Подозрительность obs_001").fill("1")
    page.locator('[data-observation-id="obs_001"] .prey-toggle').click()
    page.get_by_role("spinbutton", name="Подозрительность obs_003").fill("1")
    expect(page.locator(".leader-plane__copy h2")).to_have_text("fox_003")
    add_observation_without_viewport_jump(page)
    page.close()
    return errors


def main() -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        errors = (
            validate_mobile(browser)
            + validate_intermediate_layout(browser)
            + validate_breakpoint_layout(browser)
            + validate_desktop(browser)
            + validate_standalone(browser)
        )
        browser.close()
    if errors:
        raise AssertionError("Browser errors detected:\n" + "\n".join(errors))
    print("E2E validation passed: desktop, mobile, and standalone HTML flows are healthy.")


if __name__ == "__main__":
    main()

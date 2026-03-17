#!/usr/bin/env python3
"""Scrape MuckRack profile to extract authored articles.

Uses Playwright (headed Chromium) to bypass Cloudflare protection.
Outputs a JSON file with article metadata for use by build_luiz_clipping_data.py.

Usage:
    python3 scripts/scrape_muckrack.py
    python3 scripts/scrape_muckrack.py --headless   # try headless (may hit Cloudflare)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_PROFILE = "https://muckrack.com/luiz-fernando-toledo-2"
ROOT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT_DIR / "clipping-dashboard" / "data" / "muckrack_articles.json"


def parse_relative_date(text: str) -> Optional[str]:
    """Convert MuckRack relative dates like '3 days ago' to ISO date strings."""
    text = text.strip().lower()
    now = datetime.now(timezone.utc)

    match = re.match(r"(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago", text)
    if match:
        amount = int(match.group(1))
        unit = match.group(2)
        deltas = {
            "second": timedelta(seconds=amount),
            "minute": timedelta(minutes=amount),
            "hour": timedelta(hours=amount),
            "day": timedelta(days=amount),
            "week": timedelta(weeks=amount),
            "month": timedelta(days=amount * 30),
            "year": timedelta(days=amount * 365),
        }
        target = now - deltas.get(unit, timedelta())
        return target.strftime("%Y-%m-%d")

    for fmt in ("%B %d, %Y", "%b %d, %Y", "%d %B %Y", "%d %b %Y"):
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def scrape_muckrack(profile_url: str, headless: bool = False) -> List[Dict[str, Any]]:
    """Scrape all articles from a MuckRack profile page."""
    from playwright.sync_api import sync_playwright

    articles: List[Dict[str, Any]] = []
    seen_urls: set = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
        )

        # Remove webdriver detection
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        """)

        page = context.new_page()

        # First load the main profile page (more likely to pass Cloudflare)
        print(f"Loading profile: {profile_url}", file=sys.stderr)
        page.goto(profile_url, wait_until="domcontentloaded", timeout=60000)

        # Wait for content to load and handle Cloudflare
        for attempt in range(6):
            time.sleep(3)
            content = page.content()
            if "challenge-platform" in content or "Just a moment" in content:
                print(f"  Cloudflare challenge detected (attempt {attempt+1}/6). Waiting...", file=sys.stderr)
                time.sleep(5)
            else:
                break

        # Accept cookies if present
        try:
            cookie_btn = page.locator("text=Accept all cookies")
            if cookie_btn.is_visible(timeout=3000):
                cookie_btn.click()
                time.sleep(1)
        except Exception:
            pass

        # Navigate to articles page
        articles_url = profile_url.rstrip("/") + "/articles"
        print(f"Navigating to articles: {articles_url}", file=sys.stderr)
        page.goto(articles_url, wait_until="domcontentloaded", timeout=60000)
        time.sleep(5)

        # Re-check Cloudflare
        for attempt in range(4):
            content = page.content()
            if "challenge-platform" in content or "Just a moment" in content:
                print(f"  Cloudflare challenge on articles page (attempt {attempt+1}/4). Waiting...", file=sys.stderr)
                time.sleep(8)
            else:
                break

        # Scroll to load all articles
        print("Scrolling to load all articles...", file=sys.stderr)
        max_scrolls = 60
        last_height = 0
        no_change_count = 0

        for scroll_idx in range(max_scrolls):
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(1.5)

            current_height = page.evaluate("document.body.scrollHeight")
            if current_height == last_height:
                no_change_count += 1
                if no_change_count >= 4:
                    break
            else:
                no_change_count = 0
                last_height = current_height

            # Try clicking load more
            try:
                load_more = page.locator(
                    "button:has-text('Load More'), "
                    "button:has-text('Show More'), "
                    "a:has-text('Load More'), "
                    "a:has-text('Show More'), "
                    "a:has-text('See all'), "
                    "[class*='load-more'], [class*='show-more']"
                )
                if load_more.first.is_visible(timeout=500):
                    load_more.first.click()
                    time.sleep(2)
                    no_change_count = 0
            except Exception:
                pass

            if scroll_idx % 10 == 0:
                print(f"  Scroll {scroll_idx}/{max_scrolls}", file=sys.stderr)

        # Extract articles using JS
        print("Extracting article data from page...", file=sys.stderr)

        raw_articles = page.evaluate("""
            () => {
                const results = [];
                const seen = new Set();

                // Strategy: find all external links that look like articles
                const allLinks = document.querySelectorAll('a[href]');
                for (const link of allLinks) {
                    const href = link.href || '';
                    if (!href.startsWith('http')) continue;
                    if (href.includes('muckrack.com')) continue;
                    if (href.includes('javascript:')) continue;
                    if (href.includes('facebook.com') || href.includes('twitter.com') ||
                        href.includes('linkedin.com') || href.includes('instagram.com') ||
                        href.includes('x.com') || href.includes('youtube.com')) continue;

                    const title = (link.textContent || '').trim();
                    if (title.length < 10) continue;
                    if (seen.has(href)) continue;
                    seen.add(href);

                    // Get container for context (publication, date)
                    let container = link.closest(
                        'article, .card, [class*="article"], [class*="story"], ' +
                        '[class*="clip"], tr, li, [class*="portfolio"]'
                    );
                    if (!container) {
                        container = link.parentElement?.parentElement?.parentElement;
                    }
                    const containerText = container ? container.textContent.trim() : '';

                    results.push({
                        url: href,
                        title: title,
                        context: containerText.substring(0, 600),
                    });
                }
                return results;
            }
        """)

        for item in raw_articles:
            url = item.get("url", "").strip()
            title = clean_text(item.get("title", ""))
            context = item.get("context", "")

            if not url or not title or url in seen_urls:
                continue
            seen_urls.add(url)

            # Extract publication from context
            publication = ""
            published_date = None

            # Date detection
            date_match = re.search(
                r"(\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago)",
                context,
                re.IGNORECASE,
            )
            if date_match:
                published_date = parse_relative_date(date_match.group(1))

            # Absolute date detection
            if not published_date:
                abs_date = re.search(
                    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},\s+\d{4}",
                    context,
                )
                if abs_date:
                    published_date = parse_relative_date(abs_date.group(0))

            # Publication detection: look for known patterns
            pub_match = re.search(
                r"(?:in|from|via|for)\s+([A-Z][A-Za-zÀ-ú0-9 ]+?)(?:\s*[·|•\-]|\s+\d|\s*$)",
                context,
            )
            if pub_match:
                publication = clean_text(pub_match.group(1))

            articles.append({
                "url": url,
                "title": title,
                "publication": publication,
                "published_date": published_date,
                "source": "muckrack",
                "author": "Luiz Fernando Toledo",
            })

        browser.close()

    print(f"Extracted {len(articles)} articles from MuckRack.", file=sys.stderr)
    return articles


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape MuckRack profile for articles")
    parser.add_argument("--profile-url", default=DEFAULT_PROFILE, help="MuckRack profile URL")
    parser.add_argument("--headless", action="store_true", help="Run headless (may hit Cloudflare)")
    parser.add_argument("--output", default=str(OUTPUT_PATH), help="Output JSON file path")
    args = parser.parse_args()

    articles = scrape_muckrack(args.profile_url, headless=args.headless)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "profile_url": args.profile_url,
        "article_count": len(articles),
        "articles": articles,
    }

    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Saved {len(articles)} articles to {output_path}", file=sys.stderr)
    print(json.dumps({"articles": len(articles), "output": str(output_path)}))


if __name__ == "__main__":
    main()

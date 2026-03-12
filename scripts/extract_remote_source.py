#!/usr/bin/env python3

import argparse
import json
import re
import sys
from io import BytesIO

import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
}
TIMEOUT_SECONDS = 18
MAX_DOWNLOAD_BYTES = 2_500_000
MAX_TEXT_CHARS = 60_000


def normalize_whitespace(value):
    return re.sub(r"\s+", " ", value or "").strip()


def normalize_multiline(value):
    text = (value or "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def clean_lines(lines):
    cleaned = []
    seen = set()
    for raw_line in lines:
        line = normalize_whitespace(raw_line)
        if len(line) < 35:
            continue
        if line in seen:
            continue
        seen.add(line)
        cleaned.append(line)
    return cleaned


def extract_title(soup):
    for selector, attr in (
        (("meta", {"property": "og:title"}), "content"),
        (("meta", {"name": "twitter:title"}), "content"),
        (("meta", {"name": "title"}), "content"),
    ):
        node = soup.find(*selector)
        if node and node.get(attr):
            return normalize_whitespace(node.get(attr))

    if soup.title and soup.title.string:
        return normalize_whitespace(soup.title.string)

    h1 = soup.find("h1")
    if h1:
        return normalize_whitespace(h1.get_text(" ", strip=True))

    return ""


def extract_description(soup):
    for selector, attr in (
        (("meta", {"property": "og:description"}), "content"),
        (("meta", {"name": "description"}), "content"),
        (("meta", {"name": "twitter:description"}), "content"),
    ):
        node = soup.find(*selector)
        if node and node.get(attr):
            return normalize_whitespace(node.get(attr))
    return ""


def candidate_nodes(soup):
    selectors = [
        ("article", {}),
        ("main", {}),
        ("section", {"itemprop": "articleBody"}),
        ("div", {"itemprop": "articleBody"}),
        ("div", {"class": re.compile(r"(content|article|story|post|entry|body)", re.I)}),
        ("section", {"class": re.compile(r"(content|article|story|post|entry|body)", re.I)}),
    ]

    candidates = []
    for tag_name, attrs in selectors:
        for node in soup.find_all(tag_name, attrs=attrs):
            text = normalize_whitespace(node.get_text(" ", strip=True))
            if len(text) < 400:
                continue
            candidates.append((len(text), node))

    body = soup.body
    if body:
        text = normalize_whitespace(body.get_text(" ", strip=True))
        if len(text) >= 400:
            candidates.append((len(text), body))

    candidates.sort(key=lambda item: item[0], reverse=True)
    return [node for _, node in candidates]


def extract_html_text(html):
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup.find_all(
        [
            "script",
            "style",
            "noscript",
            "svg",
            "form",
            "button",
            "aside",
            "nav",
            "footer",
            "header",
            "picture",
            "source",
        ]
    ):
        tag.decompose()

    title = extract_title(soup)
    description = extract_description(soup)

    chosen = None
    for node in candidate_nodes(soup):
        paragraphs = clean_lines(
            part.get_text(" ", strip=True)
            for part in node.find_all(
                ["h1", "h2", "h3", "p", "li", "blockquote"], recursive=True
            )
        )
        if len("\n".join(paragraphs)) >= 600:
            chosen = paragraphs
            break

    if not chosen:
        root = soup.body or soup
        chosen = clean_lines(
            part.get_text(" ", strip=True)
            for part in root.find_all(
                ["h1", "h2", "h3", "p", "li", "blockquote"], recursive=True
            )
        )

    if not chosen:
        chosen = clean_lines([soup.get_text(" ", strip=True)])

    text = "\n\n".join(chosen)
    if description and description not in text[:800]:
        text = f"{description}\n\n{text}" if text else description

    return {
        "kind": "html",
        "title": title,
        "description": description,
        "text": normalize_multiline(text)[:MAX_TEXT_CHARS],
    }


def extract_pdf_text(content):
    reader = PdfReader(BytesIO(content))
    pages = []
    for page in reader.pages[:40]:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            continue

    text = normalize_multiline("\n\n".join(pages))[:MAX_TEXT_CHARS]
    return {
        "kind": "pdf",
        "title": "",
        "description": "",
        "text": text,
    }


def extract_text_payload(response):
    content_type = (response.headers.get("content-type") or "").lower()

    if "application/pdf" in content_type:
        return extract_pdf_text(response.content)

    if (
        "text/plain" in content_type
        or "text/markdown" in content_type
        or "application/json" in content_type
    ):
        text = normalize_multiline(response.text)[:MAX_TEXT_CHARS]
        return {
            "kind": "text",
            "title": "",
            "description": "",
            "text": text,
        }

    return extract_html_text(response.text)


def fetch_source(url):
    response = requests.get(
        url,
        headers=REQUEST_HEADERS,
        timeout=TIMEOUT_SECONDS,
        allow_redirects=True,
        stream=True,
    )
    response.raise_for_status()

    content = bytearray()
    for chunk in response.iter_content(chunk_size=65536):
        if not chunk:
            continue
        content.extend(chunk)
        if len(content) > MAX_DOWNLOAD_BYTES:
            raise RuntimeError(
                f"Response too large ({len(content)} bytes). Limit is {MAX_DOWNLOAD_BYTES}."
            )

    final = requests.models.Response()
    final.status_code = response.status_code
    final.url = response.url
    final.headers = response.headers
    final._content = bytes(content)
    final.encoding = response.encoding or response.apparent_encoding or "utf-8"
    return final


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    args = parser.parse_args()

    try:
        response = fetch_source(args.url)
        payload = extract_text_payload(response)
        payload.update(
            {
                "url": args.url,
                "final_url": response.url,
                "content_type": response.headers.get("content-type", ""),
                "status": response.status_code,
            }
        )
        print(json.dumps(payload, ensure_ascii=False))
    except Exception as exc:
        print(
            json.dumps(
                {
                    "url": args.url,
                    "error": str(exc),
                },
                ensure_ascii=False,
            )
        )
        sys.exit(1)


if __name__ == "__main__":
    main()

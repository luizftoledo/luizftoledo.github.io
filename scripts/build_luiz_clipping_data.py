#!/usr/bin/env python3
"""Build a personal clipping dataset for Luiz Fernando Toledo."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
import time
import urllib.parse
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

ROOT_DIR = Path(__file__).resolve().parents[1]
DASH_DIR = ROOT_DIR / "clipping-dashboard"
DATA_DIR = DASH_DIR / "data"
ITEMS_JSON = DATA_DIR / "items.json"
META_JSON = DATA_DIR / "metadata.json"
SOURCES_JSON = DATA_DIR / "sources.json"
PORTFOLIO_HTML = ROOT_DIR / "index.html"
RESUME_HTML = ROOT_DIR / "resume.html"

NAME_VARIANTS = [
    "Luiz Fernando Toledo",
    "Luiz Fernando Toledo Antunes",
]
IDENTITY_TOKENS = {
    "abraji",
    "bbc",
    "cambridge",
    "cnn",
    "columbia",
    "dados",
    "data journalism",
    "datafixers",
    "estadao",
    "estadão",
    "fiquem sabendo",
    "foia",
    "insper",
    "investigative",
    "investigativo",
    "journalist",
    "jornalismo",
    "jornalista",
    "londres",
    "london",
    "occrp",
    "oxford",
    "pesquisador",
    "polis",
    "professor",
    "public records",
    "reporter",
    "reuters institute",
    "transparencia",
    "transparência",
    "uol",
}
PROFILE_DOMAINS = {
    "brown.columbia.edu",
    "cam.ac.uk",
    "congresso.abraji.org.br",
    "gijc2025.org",
    "github.io",
    "linkedin.com",
    "orcid.org",
    "reutersinstitute.politics.ox.ac.uk",
    "talks.ox.ac.uk",
    "udemy.com",
    "www.escavador.com",
}
SOCIAL_DOMAINS = {
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "open.spotify.com",
    "spotify.com",
    "x.com",
    "youtube.com",
    "youtu.be",
}
CATEGORY_LABELS = {
    "reportagem_autoral": "Reportagens publicadas por mim",
    "eco_republicacao": "Republicacoes / ecos da minha apuracao",
    "mencao": "Mencoes ao meu nome",
    "entrevista": "Entrevistas / podcasts",
    "palestra_curso": "Palestras / cursos / workshops",
    "perfil_bio": "Perfis / bios / paginas institucionais",
}
CATEGORY_ORDER = [
    "reportagem_autoral",
    "eco_republicacao",
    "mencao",
    "entrevista",
    "palestra_curso",
    "perfil_bio",
]
DUCKDUCKGO_QUERIES = [
    '"Luiz Fernando Toledo"',
    '"Luiz Fernando Toledo Antunes"',
    '"Luiz Fernando Toledo" jornalista',
    '"Luiz Fernando Toledo" entrevista',
    '"Luiz Fernando Toledo" palestra',
    'site:youtube.com "Luiz Fernando Toledo"',
    'site:spotify.com "Luiz Fernando Toledo"',
]
GOOGLE_NEWS_QUERIES = [
    '"Luiz Fernando Toledo"',
    '"Luiz Fernando Toledo Antunes"',
]
JINA_PREFIX = "https://r.jina.ai/http://"
SPECIAL_SEEDS = [
    {
        "url": "https://www.bbc.com/portuguese/topics/c5ydzy3vg0xt",
        "title": "Luiz Fernando Toledo - BBC News Brasil",
        "category_hint": "perfil_bio",
        "relation_hint": "pagina de autor",
        "source_label": "bbc-author-page",
        "notes": "Pagina de autor da BBC usada para ampliar a cobertura de reportagens autorais.",
    },
]
SKIP_QUERY_TOKENS = {
    "facebook",
    "instagram",
    "linkedin",
}
DEFAULT_TIMEOUT = 30


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def fold_text(value: str) -> str:
    import unicodedata

    return (
        unicodedata.normalize("NFD", (value or ""))
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", fold_text(value)).strip()


def make_id(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:16]


def unwrap_url(raw_url: str) -> str:
    if not raw_url:
        return ""
    url = raw_url.strip()
    if url.startswith("//"):
        url = "https:" + url
    parsed = urllib.parse.urlparse(url)
    if "duckduckgo.com" in parsed.netloc and parsed.path.startswith("/l/"):
        target = dict(urllib.parse.parse_qsl(parsed.query)).get("uddg")
        return urllib.parse.unquote(target) if target else url
    if "/embed/" in parsed.path and "youtube.com" in parsed.netloc:
        video_id = parsed.path.rstrip("/").split("/")[-1]
        return f"https://www.youtube.com/watch?v={video_id}"
    if parsed.netloc == "youtu.be":
        video_id = parsed.path.strip("/")
        return f"https://www.youtube.com/watch?v={video_id}" if video_id else url
    if "/embed/episode/" in parsed.path and "spotify.com" in parsed.netloc:
        return url.replace("/embed/episode/", "/episode/")
    return url


def canonicalize_url(raw_url: str) -> str:
    url = unwrap_url(raw_url)
    if not url:
        return ""
    parsed = urllib.parse.urlparse(url)
    scheme = parsed.scheme or "https"
    netloc = parsed.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    query_pairs = []
    for key, value in urllib.parse.parse_qsl(parsed.query, keep_blank_values=True):
        if key.lower().startswith("utm_"):
            continue
        if key.lower() in {"oc", "gaa_at", "ga_src", "ga_hp"}:
            continue
        if "youtube.com" in netloc and key.lower() not in {"v", "t", "start"}:
            continue
        query_pairs.append((key, value))
    query = urllib.parse.urlencode(query_pairs, doseq=True)
    path = parsed.path or "/"
    if path != "/":
        path = path.rstrip("/")
    return urllib.parse.urlunparse((scheme, netloc, path, "", query, ""))


def domain_of(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    netloc = parsed.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    return netloc


def parse_datetime(value: Any) -> Optional[str]:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    raw = raw.replace("Z", "+00:00")
    try:
        parsed = dt.datetime.fromisoformat(raw)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc).isoformat()
    except Exception:
        pass

    date_match = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", raw)
    if date_match:
        try:
            parsed = dt.datetime(
                int(date_match.group(1)),
                int(date_match.group(2)),
                int(date_match.group(3)),
                tzinfo=dt.timezone.utc,
            )
            return parsed.isoformat()
        except Exception:
            return None
    return None


def parse_rfc822_datetime(value: Any) -> Optional[str]:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        parsed = dt.datetime.strptime(raw, "%a, %d %b %Y %H:%M:%S %Z")
        return parsed.replace(tzinfo=dt.timezone.utc).isoformat()
    except Exception:
        return parse_datetime(raw)


def iso_to_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    parsed = parse_datetime(value)
    if not parsed:
        return None
    return parsed[:10]


def recent_days_from(date_str: Optional[str], now: dt.datetime) -> Optional[int]:
    if not date_str:
        return None
    try:
        target = dt.datetime.fromisoformat(parse_datetime(date_str) or "")
    except Exception:
        return None
    return (now - target).days


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def text_has_name(value: str) -> List[str]:
    hay = normalize_text(value)
    matched = []
    for name in NAME_VARIANTS:
        if normalize_text(name) in hay:
            matched.append(name)
    return matched


def text_has_identity_token(value: str) -> List[str]:
    hay = normalize_text(value)
    matched = []
    for token in IDENTITY_TOKENS:
        if normalize_text(token) in hay:
            matched.append(token)
    return matched


def dedupe_keep_order(values: Iterable[str]) -> List[str]:
    seen = set()
    out = []
    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def is_placeholder_title(value: str) -> bool:
    title = normalize_text(value)
    if not title:
        return True
    if title in {
        "read full story",
        "view workshop on udemy",
        "brazil",
        "uk",
        "usa",
        "sweden",
        "malaysia",
        "portugal",
        "ned",
        "oxford",
    }:
        return True
    return title.startswith("read full story") or title.startswith("view workshop")


class Fetcher:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": USER_AGENT,
                "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            }
        )

    def get(self, url: str, **kwargs: Any) -> requests.Response:
        response = self.session.get(url, timeout=kwargs.pop("timeout", DEFAULT_TIMEOUT), **kwargs)
        response.raise_for_status()
        return response

    def close(self) -> None:
        self.session.close()


FETCHER = Fetcher()


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_json_ld_node(node: Any, out: Dict[str, Any]) -> None:
    if isinstance(node, list):
        for item in node:
            parse_json_ld_node(item, out)
        return
    if not isinstance(node, dict):
        return

    for key in ("datePublished", "dateCreated", "dateModified", "uploadDate"):
        if key in node and not out.get("published_at"):
            out["published_at"] = parse_datetime(node.get(key))

    if "author" in node:
        authors = out.setdefault("author_names", [])
        author_value = node.get("author")
        author_candidates = author_value if isinstance(author_value, list) else [author_value]
        for author in author_candidates:
            if isinstance(author, dict):
                name = clean_text(author.get("name") or author.get("alternateName") or "")
                if name:
                    authors.append(name)
            elif isinstance(author, str):
                name = clean_text(author)
                if name:
                    authors.append(name)

    if "publisher" in node and isinstance(node.get("publisher"), dict) and not out.get("site_name"):
        site_name = clean_text(node["publisher"].get("name") or "")
        if site_name:
            out["site_name"] = site_name

    if not out.get("title") and clean_text(node.get("headline") or ""):
        out["title"] = clean_text(node.get("headline") or "")
    if not out.get("description") and clean_text(node.get("description") or ""):
        out["description"] = clean_text(node.get("description") or "")

    for value in node.values():
        parse_json_ld_node(value, out)


def build_excerpt(text: str, fallback_title: str = "") -> str:
    if not text:
        return ""
    plain = clean_text(text)
    if not plain:
        return ""
    lower = normalize_text(plain)
    indices = []
    for name in NAME_VARIANTS:
        hit = lower.find(normalize_text(name))
        if hit >= 0:
            indices.append(hit)
    if indices:
        start = max(0, min(indices) - 180)
        end = min(len(plain), min(indices) + 240)
        excerpt = plain[start:end]
        if start > 0:
            excerpt = "... " + excerpt
        if end < len(plain):
            excerpt += " ..."
        return excerpt
    if fallback_title and normalize_text(fallback_title) in lower:
        return plain[:420]
    return plain[:420]


def extract_html_metadata(url: str, html_text: str) -> Dict[str, Any]:
    soup = BeautifulSoup(html_text, "html.parser")
    for element in soup(["script", "style", "noscript", "svg"]):
        element.extract()

    metadata: Dict[str, Any] = {
        "title": "",
        "description": "",
        "site_name": "",
        "canonical_url": "",
        "author_names": [],
        "published_at": None,
        "text_excerpt": "",
    }

    if soup.title:
        metadata["title"] = clean_text(soup.title.get_text(" ", strip=True))

    meta_candidates = {
        "description": [
            ('meta', {'name': 'description'}, 'content'),
            ('meta', {'property': 'og:description'}, 'content'),
            ('meta', {'name': 'twitter:description'}, 'content'),
        ],
        "site_name": [
            ('meta', {'property': 'og:site_name'}, 'content'),
            ('meta', {'name': 'application-name'}, 'content'),
        ],
        "canonical_url": [
            ('link', {'rel': 'canonical'}, 'href'),
            ('meta', {'property': 'og:url'}, 'content'),
        ],
        "published_at": [
            ('meta', {'property': 'article:published_time'}, 'content'),
            ('meta', {'name': 'parsely-pub-date'}, 'content'),
            ('meta', {'itemprop': 'datePublished'}, 'content'),
            ('time', {'datetime': True}, 'datetime'),
        ],
    }
    for key, selectors in meta_candidates.items():
        for tag_name, attrs, attr_name in selectors:
            tag = soup.find(tag_name, attrs=attrs)
            if not tag:
                continue
            value = tag.get(attr_name)
            if not value:
                continue
            if key == "published_at":
                parsed = parse_datetime(value)
                if parsed:
                    metadata[key] = parsed
                    break
            else:
                metadata[key] = clean_text(value)
                break

    author_values = []
    for attrs in (
        {"name": "author"},
        {"property": "article:author"},
        {"itemprop": "author"},
    ):
        for tag in soup.find_all("meta", attrs=attrs):
            content = clean_text(tag.get("content") or "")
            if content:
                author_values.append(content)
    metadata["author_names"] = dedupe_keep_order(author_values)

    for script in soup.select('script[type="application/ld+json"]'):
        raw = script.string or script.get_text(" ", strip=True)
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except Exception:
            continue
        parse_json_ld_node(payload, metadata)

    page_text = clean_text(soup.get_text(" ", strip=True))
    if "bbc.com" in domain_of(url) and not metadata["author_names"]:
        bbc_match = re.search(r"Author,\s*([^,]+?)\s+Role,", page_text)
        if bbc_match:
            metadata["author_names"] = [clean_text(bbc_match.group(1))]
    if not metadata.get("published_at") and "bbc.com" in domain_of(url):
        bbc_date = re.search(r"(\d{1,2})\s+([a-zA-ZçÇ]+)\s+(\d{4})", page_text)
        if bbc_date:
            months = {
                "janeiro": 1,
                "fevereiro": 2,
                "marco": 3,
                "março": 3,
                "abril": 4,
                "maio": 5,
                "junho": 6,
                "julho": 7,
                "agosto": 8,
                "setembro": 9,
                "outubro": 10,
                "novembro": 11,
                "dezembro": 12,
            }
            month = months.get(fold_text(bbc_date.group(2)))
            if month:
                metadata["published_at"] = dt.datetime(
                    int(bbc_date.group(3)), month, int(bbc_date.group(1)), tzinfo=dt.timezone.utc
                ).isoformat()

    metadata["text_excerpt"] = build_excerpt(page_text, metadata.get("title") or "")
    return metadata


def extract_jina_metadata(url: str, markdown_text: str) -> Dict[str, Any]:
    metadata: Dict[str, Any] = {
        "title": "",
        "description": "",
        "site_name": "",
        "canonical_url": canonicalize_url(url),
        "author_names": [],
        "published_at": None,
        "text_excerpt": "",
    }
    lines = markdown_text.splitlines()
    content_start = 0
    for idx, line in enumerate(lines[:40]):
        if line.startswith("Title: "):
            metadata["title"] = clean_text(line.replace("Title: ", "", 1))
        elif line.startswith("URL Source: "):
            source_url = clean_text(line.replace("URL Source: ", "", 1))
            if source_url:
                metadata["canonical_url"] = canonicalize_url(source_url)
        elif line.startswith("Published Time: "):
            metadata["published_at"] = parse_datetime(line.replace("Published Time: ", "", 1))
        elif line.startswith("Markdown Content:"):
            content_start = idx + 1
            break
    body = clean_text("\n".join(lines[content_start:])) if content_start else clean_text(markdown_text)
    metadata["text_excerpt"] = build_excerpt(body, metadata.get("title") or "")
    metadata["description"] = metadata["text_excerpt"][:220]
    metadata["site_name"] = domain_of(url)
    return metadata


def fetch_via_jina(url: str) -> Dict[str, Any]:
    response = FETCHER.get(f"{JINA_PREFIX}{url}", allow_redirects=True, timeout=DEFAULT_TIMEOUT)
    metadata = extract_jina_metadata(url, response.text)
    return {
        "url": url,
        "canonical_url": metadata.get("canonical_url") or canonicalize_url(url),
        "status_code": response.status_code,
        "fetch_ok": True,
        "content_type": response.headers.get("Content-Type", "text/plain"),
        "title": metadata.get("title") or "",
        "description": metadata.get("description") or "",
        "site_name": metadata.get("site_name") or "",
        "author_names": metadata.get("author_names") or [],
        "published_at": metadata.get("published_at"),
        "text_excerpt": metadata.get("text_excerpt") or "",
        "resolved_url": url,
        "error": "",
        "fetched_via": "jina",
    }


def fetch_page(url: str) -> Dict[str, Any]:
    item: Dict[str, Any] = {
        "url": url,
        "canonical_url": canonicalize_url(url),
        "status_code": None,
        "fetch_ok": False,
        "content_type": "",
        "title": "",
        "description": "",
        "site_name": "",
        "author_names": [],
        "published_at": None,
        "text_excerpt": "",
        "resolved_url": url,
        "error": "",
    }
    try:
        response = FETCHER.get(url, allow_redirects=True)
        item["status_code"] = response.status_code
        item["content_type"] = response.headers.get("Content-Type", "")
        item["resolved_url"] = response.url
        item["canonical_url"] = canonicalize_url(response.url)
        item["fetch_ok"] = True
        if "text/html" in item["content_type"] or not item["content_type"]:
            metadata = extract_html_metadata(response.url, response.text)
            item.update(metadata)
        else:
            item["title"] = url
        item["fetched_via"] = "direct"
    except Exception as exc:
        item["error"] = str(exc)
        try:
            fallback = fetch_via_jina(url)
            item.update(fallback)
            item["error"] = ""
        except Exception as fallback_exc:
            item["error"] = f"{exc} | jina: {fallback_exc}"
    return item


def parse_portfolio_seeds() -> List[Dict[str, Any]]:
    html = PORTFOLIO_HTML.read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")
    seeds: List[Dict[str, Any]] = []

    def add_seed(url: str, title: str, category_hint: str, relation_hint: str, source_label: str, notes: str = "") -> None:
        clean_url = canonicalize_url(url)
        if not clean_url:
            return
        seeds.append(
            {
                "url": clean_url,
                "title": clean_text(title),
                "category_hint": category_hint,
                "relation_hint": relation_hint,
                "source_label": source_label,
                "notes": notes,
            }
        )

    investigative = soup.find("section", id="investigative")
    if investigative:
        for link in investigative.select('a[href]'):
            href = link.get('href')
            if not href or href.startswith('#'):
                continue
            text = clean_text(link.get_text(" ", strip=True)) or "Reportagem autoral"
            add_seed(href, text, "reportagem_autoral", "autor", "portfolio-investigative")

    for card in soup.select('.interview-card'):
        title = clean_text(card.find('h3').get_text(" ", strip=True) if card.find('h3') else 'Entrevista')
        description = clean_text(card.find('p').get_text(" ", strip=True) if card.find('p') else '')
        iframe = card.find('iframe')
        if iframe and iframe.get('src'):
            add_seed(iframe['src'], title, "entrevista", "entrevistado", "portfolio-interviews", description)

    for link in soup.select('#course a[href]'):
        add_seed(link['href'], link.get_text(" ", strip=True), "palestra_curso", "curso", "portfolio-course")

    for card in soup.select('.impact-card'):
        title = clean_text(card.find('h3').get_text(" ", strip=True) if card.find('h3') else '')
        if not title:
            continue
        title_norm = normalize_text(title)
        if 'training' in title_norm or 'research' in title_norm:
            category = 'palestra_curso' if 'training' in title_norm else 'perfil_bio'
            relation = 'palestrante' if category == 'palestra_curso' else 'perfil'
            for link in card.select('a[href]'):
                add_seed(link['href'], link.get_text(" ", strip=True), category, relation, f'portfolio-{category}')

    for seed in SPECIAL_SEEDS:
        seeds.append({**seed, "url": canonicalize_url(seed["url"])})
    return seeds


def parse_bbc_author_page() -> List[Dict[str, Any]]:
    seeds: List[Dict[str, Any]] = []
    url = "https://www.bbc.com/portuguese/topics/c5ydzy3vg0xt"
    try:
        response = FETCHER.get(url)
    except Exception:
        return seeds
    soup = BeautifulSoup(response.text, "html.parser")
    for link in soup.select('a[href]'):
        href = link.get('href')
        if not href or '/articles/' not in href:
            continue
        full_url = href if href.startswith('http') else urllib.parse.urljoin(response.url, href)
        title = clean_text(link.get_text(" ", strip=True))
        if not title:
            continue
        seeds.append(
            {
                "url": canonicalize_url(full_url),
                "title": title,
                "category_hint": "reportagem_autoral",
                "relation_hint": "autor",
                "source_label": "bbc-author-page",
                "notes": "Descoberto na pagina de autor da BBC News Brasil.",
            }
        )
    seeds.append(
        {
            "url": canonicalize_url(url),
            "title": "Luiz Fernando Toledo - BBC News Brasil",
            "category_hint": "perfil_bio",
            "relation_hint": "pagina de autor",
            "source_label": "bbc-author-page",
            "notes": "Pagina institucional da BBC com listagem de reportagens autorais.",
        }
    )
    return dedupe_seed_candidates(seeds)


def dedupe_seed_candidates(rows: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        key = canonicalize_url(row.get("url") or "")
        if not key:
            continue
        if key not in merged:
            merged[key] = dict(row)
            merged[key]["url"] = key
            continue
        current = merged[key]
        for field in ("title", "notes", "category_hint", "relation_hint"):
            if not current.get(field) and row.get(field):
                current[field] = row.get(field)
        current["source_label"] = ", ".join(dedupe_keep_order([current.get("source_label", ""), row.get("source_label", "")]))
    return list(merged.values())


def ddg_search(query: str, max_pages: int = 2) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for page in range(max_pages):
        params = {"q": query}
        if page:
            params["s"] = str(page * 30)
        try:
            response = requests.get(
                "https://html.duckduckgo.com/html/",
                params=params,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
                },
                timeout=DEFAULT_TIMEOUT,
            )
            response.raise_for_status()
        except Exception:
            continue
        soup = BeautifulSoup(response.text, "html.parser")
        results = soup.select('.result')
        if not results:
            break
        for result in results:
            link = result.select_one('.result__title a')
            if not link or not link.get('href'):
                continue
            url = canonicalize_url(link.get('href'))
            title = clean_text(link.get_text(" ", strip=True))
            snippet = clean_text(result.select_one('.result__snippet').get_text(" ", strip=True) if result.select_one('.result__snippet') else '')
            if not url or not title:
                continue
            items.append(
                {
                    "url": url,
                    "title": title,
                    "description": snippet,
                    "source_label": f'duckduckgo:{query}',
                    "query": query,
                }
            )
        time.sleep(0.4)
    return items


def get_google_news_base64(source_url: str) -> Optional[str]:
    parsed = urllib.parse.urlparse(source_url)
    parts = [part for part in parsed.path.split("/") if part]
    if parsed.netloc != "news.google.com":
        return None
    if len(parts) < 2:
        return None
    if parts[0] == "rss" and len(parts) >= 3 and parts[1] == "articles":
        return parts[2]
    if parts[-2] in {"articles", "read"}:
        return parts[-1]
    return None


def decode_google_news_url(source_url: str) -> str:
    base64_str = get_google_news_base64(source_url)
    if not base64_str:
        return canonicalize_url(source_url)

    article_url = f"https://news.google.com/rss/articles/{base64_str}"
    response = FETCHER.get(article_url, allow_redirects=True, timeout=DEFAULT_TIMEOUT)
    soup = BeautifulSoup(response.text, "html.parser")
    data_element = soup.select_one("c-wiz > div[jscontroller]") or soup.select_one("[data-n-a-sg][data-n-a-ts]")
    if not data_element:
        return canonicalize_url(source_url)

    signature = data_element.get("data-n-a-sg")
    timestamp = data_element.get("data-n-a-ts")
    if not signature or not timestamp:
        return canonicalize_url(source_url)

    payload = [
        "Fbv4je",
        (
            f'["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],'
            f'"X","X",1,[1,1,1],1,1,null,0,0,null,0],"{base64_str}",{timestamp},"{signature}"]'
        ),
    ]
    response = requests.post(
        "https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je",
        headers={
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": USER_AGENT,
        },
        data=f"f.req={urllib.parse.quote(json.dumps([[payload]]))}",
        timeout=DEFAULT_TIMEOUT,
    )
    response.raise_for_status()
    chunks = response.text.split("\n\n")
    if len(chunks) < 2:
        return canonicalize_url(source_url)
    parsed = json.loads(chunks[1])[:-2]
    if not parsed or len(parsed[0]) < 3:
        return canonicalize_url(source_url)
    decoded = json.loads(parsed[0][2])[1]
    return canonicalize_url(decoded) or canonicalize_url(source_url)


def google_news_search(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    rss_url = (
        "https://news.google.com/rss/search?q="
        + urllib.parse.quote(query)
        + "&hl=pt-BR&gl=BR&ceid=BR:pt-419"
    )
    try:
        response = FETCHER.get(rss_url)
        root = ET.fromstring(response.text)
    except Exception:
        return items

    for node in root.findall('./channel/item')[:limit]:
        title = clean_text(node.findtext('title') or '')
        link = clean_text(node.findtext('link') or '')
        description = clean_text(node.findtext('description') or '')
        pub_date = clean_text(node.findtext('pubDate') or '')
        if not link:
            continue
        resolved = canonicalize_url(link)
        try:
            resolved = decode_google_news_url(link)
        except Exception:
            try:
                head = FETCHER.get(link, allow_redirects=True, timeout=20)
                resolved = canonicalize_url(head.url)
            except Exception:
                pass
        items.append(
            {
                "url": resolved,
                "title": title,
                "description": description,
                "published_at": parse_datetime(pub_date),
                "source_label": f'google-news-rss:{query}',
                "query": query,
            }
        )
        time.sleep(0.2)
    return items


def merge_candidate(base: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(base)
    if incoming.get("title") and (not merged.get("title") or is_placeholder_title(merged.get("title") or "")):
        merged["title"] = incoming["title"]
    if incoming.get("description") and (not merged.get("description") or len(merged.get("description") or "") < 40):
        merged["description"] = incoming["description"]
    for key in ("category_hint", "relation_hint", "notes", "published_at"):
        if incoming.get(key) and not merged.get(key):
            merged[key] = incoming[key]
    merged["source_labels"] = dedupe_keep_order((merged.get("source_labels") or []) + [incoming.get("source_label", "")])
    if incoming.get("query"):
        merged["queries"] = dedupe_keep_order((merged.get("queries") or []) + [incoming.get("query")])
    return merged


def build_candidates(max_ddg_pages: int, max_google_items: int) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    diagnostics: Dict[str, Any] = {
        "seeds": {},
        "searches": {},
    }
    merged: Dict[str, Dict[str, Any]] = {}

    def add(row: Dict[str, Any]) -> None:
        key = canonicalize_url(row.get("url") or "")
        if not key:
            return
        row = dict(row)
        row["url"] = key
        if key not in merged:
            merged[key] = {
                "url": key,
                "title": row.get("title", ""),
                "description": row.get("description", ""),
                "category_hint": row.get("category_hint", ""),
                "relation_hint": row.get("relation_hint", ""),
                "notes": row.get("notes", ""),
                "published_at": row.get("published_at"),
                "source_labels": [],
                "queries": [],
            }
        merged[key] = merge_candidate(merged[key], row)

    portfolio = dedupe_seed_candidates(parse_portfolio_seeds())
    diagnostics["seeds"]["portfolio"] = len(portfolio)
    for row in portfolio:
        add(row)

    bbc = parse_bbc_author_page()
    diagnostics["seeds"]["bbc_author_page"] = len(bbc)
    for row in bbc:
        add(row)

    if max_ddg_pages > 0:
        for query in DUCKDUCKGO_QUERIES:
            results = ddg_search(query, max_pages=max_ddg_pages)
            diagnostics["searches"][f"duckduckgo:{query}"] = len(results)
            for row in results:
                add(row)

    if max_google_items > 0:
        for query in GOOGLE_NEWS_QUERIES:
            results = google_news_search(query, limit=max_google_items)
            diagnostics["searches"][f"google-news-rss:{query}"] = len(results)
            for row in results:
                add(row)

    for query in GOOGLE_NEWS_QUERIES:
        results = google_news_html_search(query, max_pages=4)
        diagnostics["searches"][f"google-news-html:{query}"] = len(results)
        for row in results:
            add(row)

    return list(merged.values()), diagnostics


def match_identity_score(item: Dict[str, Any]) -> Tuple[int, List[str], List[str]]:
    reasons: List[str] = []
    matched_names = dedupe_keep_order(
        text_has_name(
            " ".join(
                [
                    item.get("title", ""),
                    item.get("description", ""),
                    item.get("text_excerpt", ""),
                    " ".join(item.get("author_names") or []),
                    item.get("notes", ""),
                ]
            )
        )
    )
    matched_tokens = dedupe_keep_order(
        text_has_identity_token(
            " ".join(
                [
                    item.get("title", ""),
                    item.get("description", ""),
                    item.get("text_excerpt", ""),
                    item.get("site_name", ""),
                    " ".join(item.get("author_names") or []),
                    " ".join(item.get("queries") or []),
                    item.get("notes", ""),
                    item.get("relation_hint", ""),
                ]
            )
        )
    )

    score = 0
    if item.get("category_hint"):
        score += 2
        reasons.append("seed")
    if matched_names:
        score += 3
        reasons.append("nome_exato")
    if matched_tokens:
        score += 2
        reasons.append("contexto_identidade")
    if any(normalize_text(name) in normalize_text(" ".join(item.get("author_names") or [])) for name in NAME_VARIANTS):
        score += 4
        reasons.append("byline")
    if domain_of(item.get("url", "")) in PROFILE_DOMAINS:
        score += 1
        reasons.append("dominio_perfil")
    return score, matched_names, matched_tokens


def classify_item(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    score, matched_names, matched_tokens = match_identity_score(item)
    title_desc = normalize_text(" ".join([item.get("title", ""), item.get("description", ""), item.get("notes", "")]))
    body = normalize_text(item.get("text_excerpt", ""))
    domain = domain_of(item.get("url", ""))
    category_hint = item.get("category_hint") or ""

    if domain == "news.google.com":
        return None
    if domain in {"linkedin.com", "facebook.com", "instagram.com"} and score < 4:
        return None
    if score < 2:
        return None

    category = category_hint or ""
    relation = item.get("relation_hint") or ""

    event_keywords = (
        "palestra",
        "palestrante",
        "speaker",
        "workshop",
        "curso",
        "conference",
        "congresso",
        "seminar",
        "seminario",
        "webinar",
        "training",
        "udemy",
    )
    interview_keywords = (
        "entrevista",
        "interview",
        "podcast",
        "episode",
        "stage talks",
        "youtube",
        "spotify",
    )
    profile_keywords = (
        "speaker profile",
        "resume",
        "curriculo",
        "portfolio",
        "people",
        "research",
        "researcher",
        "professor",
        "orcid",
        "sobre",
    )
    echo_keywords = (
        "apos reportagem",
        "após reportagem",
        "investigacao da bbc",
        "investigação da bbc",
        "reportagem da bbc",
        "segundo reportagem",
        "levantamento da datafixers",
        "reportagem de luiz fernando toledo",
    )

    if not category:
        if any(normalize_text(name) in normalize_text(" ".join(item.get("author_names") or [])) for name in NAME_VARIANTS):
            category = "reportagem_autoral"
            relation = relation or "autor"
        elif any(keyword in title_desc for keyword in event_keywords):
            category = "palestra_curso"
            relation = relation or "palestrante"
        elif any(keyword in title_desc for keyword in interview_keywords):
            category = "entrevista"
            relation = relation or "entrevistado"
        elif domain in PROFILE_DOMAINS or any(keyword in title_desc for keyword in profile_keywords):
            category = "perfil_bio"
            relation = relation or "perfil"
        elif any(keyword in (title_desc + " " + body) for keyword in echo_keywords):
            category = "eco_republicacao"
            relation = relation or "eco de apuracao"
        elif matched_names and matched_tokens:
            category = "mencao"
            relation = relation or "mencionado"
        else:
            return None

    if category == "reportagem_autoral" and not relation:
        relation = "autor"
    if category == "entrevista" and not relation:
        relation = "entrevistado"
    if category == "palestra_curso" and not relation:
        relation = "palestrante"
    if category == "perfil_bio" and not relation:
        relation = "perfil"
    if category == "eco_republicacao" and not relation:
        relation = "eco de apuracao"
    if category == "mencao" and not relation:
        relation = "mencionado"

    item["category"] = category
    item["category_label"] = CATEGORY_LABELS.get(category, category)
    item["relation"] = relation
    item["match_score"] = score
    item["matched_name_variants"] = matched_names
    item["matched_identity_tokens"] = matched_tokens
    return item


def enrich_candidates(candidates: List[Dict[str, Any]], existing_items: Dict[str, Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    now_iso = utcnow().isoformat()
    diagnostics: Dict[str, Any] = {
        "fetched": 0,
        "reused": 0,
        "kept": 0,
        "dropped": 0,
        "categories": Counter(),
        "domains": Counter(),
        "errors": [],
    }
    items: List[Dict[str, Any]] = []

    for idx, candidate in enumerate(candidates, start=1):
        key = canonicalize_url(candidate.get("url") or "")
        if not key:
            continue
        existing = existing_items.get(key)
        should_refetch = bool(
            not existing
            or not existing.get("fetch_ok")
            or not existing.get("title")
            or is_placeholder_title(existing.get("title") or "")
            or (existing.get("domain") in {"tab.uol.com.br", "udemy.com"} and not existing.get("published_at"))
        )
        if existing and not should_refetch and existing.get("last_seen_at"):
            merged = merge_candidate(existing, candidate)
            merged["last_seen_at"] = now_iso
            diagnostics["reused"] += 1
        else:
            fetched = fetch_page(key)
            merged = merge_candidate(candidate, fetched)
            merged["url"] = fetched.get("canonical_url") or key
            merged["canonical_url"] = fetched.get("canonical_url") or key
            merged["resolved_url"] = fetched.get("resolved_url") or key
            merged["status_code"] = fetched.get("status_code")
            merged["fetch_ok"] = fetched.get("fetch_ok", False)
            merged["content_type"] = fetched.get("content_type", "")
            merged["error"] = fetched.get("error", "")
            diagnostics["fetched"] += 1
            if merged.get("error"):
                diagnostics["errors"].append({"url": merged["url"], "error": merged["error"]})
            time.sleep(0.15)

        existing_first_seen = existing.get("first_seen_at") if existing else None
        merged["first_seen_at"] = existing_first_seen or now_iso
        merged["last_seen_at"] = now_iso
        merged["author_names"] = dedupe_keep_order(merged.get("author_names") or [])
        merged["source_labels"] = dedupe_keep_order(merged.get("source_labels") or [])
        merged["queries"] = dedupe_keep_order(merged.get("queries") or [])
        merged["domain"] = domain_of(merged.get("url") or "")
        merged["site_name"] = merged.get("site_name") or merged["domain"]
        merged["published_at"] = parse_datetime(merged.get("published_at")) or None
        merged["published_date"] = iso_to_date(merged.get("published_at"))
        merged["first_seen_date"] = iso_to_date(merged.get("first_seen_at"))
        merged["last_seen_date"] = iso_to_date(merged.get("last_seen_at"))
        merged["id"] = existing.get("id") if existing else make_id(merged["url"])
        merged = classify_item(merged)  # type: ignore[assignment]
        if not merged:
            diagnostics["dropped"] += 1
            continue
        diagnostics["kept"] += 1
        diagnostics["categories"][merged["category"]] += 1
        diagnostics["domains"][merged["domain"]] += 1
        items.append(merged)

        if idx % 25 == 0:
            print(f"Processed {idx}/{len(candidates)} candidates", file=sys.stderr)

    items.sort(
        key=lambda item: (
            item.get("published_at") or item.get("first_seen_at") or "",
            item.get("match_score") or 0,
            item.get("title") or "",
        ),
        reverse=True,
    )
    return items, diagnostics


def build_metadata(items: List[Dict[str, Any]], source_diagnostics: Dict[str, Any]) -> Dict[str, Any]:
    now = utcnow()
    counts_by_category = {key: 0 for key in CATEGORY_ORDER}
    counts_by_domain = Counter(item.get("domain") or "" for item in items)
    recent = {
        "last_1_day": 0,
        "last_7_days": 0,
        "last_30_days": 0,
    }
    for item in items:
        counts_by_category[item["category"]] = counts_by_category.get(item["category"], 0) + 1
        ref = item.get("published_at") or item.get("first_seen_at")
        days = recent_days_from(ref, now)
        if days is None:
            continue
        if days <= 1:
            recent["last_1_day"] += 1
        if days <= 7:
            recent["last_7_days"] += 1
        if days <= 30:
            recent["last_30_days"] += 1

    published_values = [item.get("published_date") for item in items if item.get("published_date")]
    return {
        "generated_at": now.isoformat(),
        "counts": {
            "items": len(items),
            "domains": len([domain for domain in counts_by_domain if domain]),
            "categories": counts_by_category,
            "recent": recent,
        },
        "date_range": {
            "min": min(published_values) if published_values else None,
            "max": max(published_values) if published_values else None,
        },
        "methodology": {
            "names": NAME_VARIANTS,
            "summary": (
                "Clipping incremental com duas camadas: sementes curadas do proprio portfolio/resume e descoberta automatica "
                "por buscas em noticias do Google, pagina de autor da BBC e sementes curadas do proprio portfolio/resume. "
                "Quando um site bloqueia raspagem direta, o script tenta uma leitura alternativa so para metadados e trechos. "
                "A classificacao e por regras (byline, tipo de pagina, "
                "palavras-chave e contexto institucional). O resultado e amplo, mas nao exaustivo: buscadores podem perder paginas, "
                "alguns sites bloqueiam raspagem e homonimos podem exigir revisao manual."
            ),
        },
        "sources": source_diagnostics,
    }


def build_existing_index() -> Dict[str, Dict[str, Any]]:
    existing = load_json(ITEMS_JSON, [])
    index: Dict[str, Dict[str, Any]] = {}
    for item in existing:
        key = canonicalize_url(item.get("url") or item.get("canonical_url") or "")
        if key:
            index[key] = item
    return index


def run(max_ddg_pages: int, max_google_items: int) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    existing_items = build_existing_index()
    candidates, discovery_diagnostics = build_candidates(max_ddg_pages=max_ddg_pages, max_google_items=max_google_items)
    items, enrich_diagnostics = enrich_candidates(candidates, existing_items)
    metadata = build_metadata(items, {"discovery": discovery_diagnostics, "enrich": enrich_diagnostics})
    save_json(ITEMS_JSON, items)
    save_json(META_JSON, metadata)
    save_json(SOURCES_JSON, {"discovery": discovery_diagnostics, "enrich": enrich_diagnostics})

    print(
        json.dumps(
            {
                "items": len(items),
                "categories": metadata["counts"]["categories"],
                "recent": metadata["counts"]["recent"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build personal clipping data for Luiz Fernando Toledo")
    parser.add_argument("--max-ddg-pages", type=int, default=0)
    parser.add_argument("--max-google-items", type=int, default=0)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        run(max_ddg_pages=max(0, args.max_ddg_pages), max_google_items=max(0, args.max_google_items))
    finally:
        FETCHER.close()

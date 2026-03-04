#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import html
import os
import re
import unicodedata
from collections import Counter, defaultdict
from typing import Any, Dict, List

from flask import Flask, jsonify, request
from flask_cors import CORS
from google.cloud import bigquery


PROJECT_ID = (os.getenv("BQ_PROJECT_ID") or "militares-376417").strip()
DATASET_ID = (os.getenv("BQ_DATASET") or "militares").strip()
MAX_FUTURE_SKEW_DAYS = int(os.getenv("WORDCLOUD_MAX_FUTURE_SKEW_DAYS") or "7")
EXAMPLE_MANDATES_LIMIT = 3
EXAMPLES_PER_MANDATE = 2
EXAMPLE_SNIPPET_RADIUS = 150
WORD_MIN_LEN = 3
WORDCLOUD_DOC_SCAN_LIMIT = int(os.getenv("WORDCLOUD_DOC_SCAN_LIMIT") or "5000")
WORDCLOUD_CLOUD_LIMIT = 60
WORDCLOUD_TABLE_LIMIT = 10

TABLE_RECORDS = f"`{PROJECT_ID}.{DATASET_ID}.records`"
TABLE_RUNS = f"`{PROJECT_ID}.{DATASET_ID}.pipeline_runs`"

PT_STOPWORDS = [
    "a", "ao", "aos", "aquela", "aquelas", "aquele", "aqueles", "aquilo", "as", "ate", "com", "como",
    "contra", "da", "das", "de", "dela", "delas", "dele", "deles", "depois", "do", "dos", "e", "ela",
    "elas", "ele", "eles", "em", "entre", "era", "eram", "essa", "essas", "esse", "esses", "esta",
    "estao", "estar", "estas", "estava", "estavam", "este", "estes", "eu", "foi", "foram", "ha", "isso",
    "isto", "ja", "la", "lhe", "lhes", "mais", "mas", "me", "mesmo", "mesmos", "meu", "meus", "minha",
    "minhas", "muito", "na", "nao", "nas", "nem", "no", "nos", "nossa", "nossas", "nosso", "nossos",
    "num", "numa", "o", "os", "ou", "para", "pela", "pelas", "pelo", "pelos", "por", "porque", "quando",
    "que", "quem", "se", "sem", "sera", "serao", "seu", "seus", "sim", "sob", "sobre", "sua", "suas",
    "tambem", "te", "tem", "tendo", "tenho", "ter", "teve", "ti", "tu", "tua", "tuas", "um", "uma",
    "umas", "uns", "vos", "voces", "ainda", "cada", "durante", "entao", "fazer", "fez", "for", "fora",
    "fosse", "fui", "havia", "nesse", "nessa", "neste", "nesta", "nunca", "onde", "outra", "outro",
    "outros", "outras", "pode", "podem", "pois", "qual", "quais", "qualquer", "quase", "seja", "sejam",
    "sendo", "ser", "seria", "seriam", "sido", "somente", "tanto", "toda", "todas", "todo", "todos",
    "trata", "vamos", "vai", "vem", "vindo",
]


app = Flask(__name__)

_origins_raw = (os.getenv("CORS_ALLOW_ORIGINS") or "*").strip()
if _origins_raw == "*":
    CORS(app)
else:
    CORS(app, resources={r"/v1/*": {"origins": [x.strip() for x in _origins_raw.split(",") if x.strip()]}})

client = bigquery.Client(project=PROJECT_ID)


def row_to_dict(row: bigquery.table.Row) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k in row.keys():
        v = row[k]
        if isinstance(v, dt.date):
            out[k] = v.isoformat()
        elif isinstance(v, dt.datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


def run_query(sql: str, params: List[bigquery.ScalarQueryParameter | bigquery.ArrayQueryParameter] | None = None) -> List[Dict[str, Any]]:
    config = bigquery.QueryJobConfig(query_parameters=params or [])
    rows = client.query(sql, job_config=config).result()
    return [row_to_dict(r) for r in rows]


def normalize_query(raw: str) -> Dict[str, Any]:
    text = (raw or "").strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9]+", " ", text).strip()
    words = [w for w in text.split(" ") if w]
    return {
        "normalized": text,
        "words": words,
        "words_count": len(words),
        "is_phrase": len(words) > 1,
    }


def build_term_regex(words: List[str]) -> str:
    if not words:
        return r"^$"
    pattern = r"\s+".join(re.escape(w) for w in words)
    return rf"(?:^|[^a-z0-9])(?:{pattern})(?:$|[^a-z0-9])"


def parse_limit(value: str | None, default: int, min_v: int, max_v: int) -> int:
    try:
        v = int(value or default)
    except (TypeError, ValueError):
        v = default
    return max(min_v, min(max_v, v))


def parse_phrase_mode(value: str | None) -> str:
    mode = (value or "2-3").strip()
    if mode not in {"1", "2", "3", "2-3"}:
        return "2-3"
    return mode


def phrase_sizes_for_mode(mode: str) -> List[int]:
    if mode == "1":
        return [1]
    if mode == "2":
        return [2]
    if mode == "3":
        return [3]
    return [2, 3]


def parse_filters() -> Dict[str, str]:
    type_filter = (request.args.get("type") or "ambos").strip().lower()
    if type_filter not in {"ambos", "entrevista", "discurso"}:
        type_filter = "ambos"
    president_filter = (request.args.get("president") or "todos").strip()
    mandate_filter = (request.args.get("mandate") or "todos").strip()
    return {
        "type_filter": type_filter or "ambos",
        "president_filter": president_filter or "todos",
        "mandate_filter": mandate_filter or "todos",
    }


def extract_mandate_sort_year(mandate: str) -> int:
    years = [int(y) for y in re.findall(r"\d{4}", mandate or "")]
    return max(years) if years else 0


def build_snippet_regex(words: List[str]) -> re.Pattern[str] | None:
    if not words:
        return None
    pattern = r"[^a-z0-9]+".join(re.escape(w) for w in words)
    return re.compile(rf"(^|[^a-z0-9])({pattern})(?=$|[^a-z0-9])")


def fold_text(value: str) -> str:
    text = (value or "").lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return text


def is_relevant_word_token(token: str) -> bool:
    if not token or len(token) < WORD_MIN_LEN:
        return False
    if token.isdigit():
        return False
    if token in PT_STOPWORDS:
        return False
    return True


def count_term_units(tokens: List[str], phrase_sizes: List[int], out_counts: Counter[str]) -> None:
    if not tokens:
        return

    if 1 in phrase_sizes:
        for token in tokens:
            if is_relevant_word_token(token):
                out_counts[token] += 1

    for size in phrase_sizes:
        if size <= 1 or len(tokens) < size:
            continue
        for idx in range(0, len(tokens) - size + 1):
            chunk = tokens[idx : idx + size]
            if any((not tok) or len(tok) < 2 or tok.isdigit() for tok in chunk):
                continue
            if not is_relevant_word_token(chunk[0]) or not is_relevant_word_token(chunk[-1]):
                continue
            relevant_count = sum(1 for tok in chunk if is_relevant_word_token(tok))
            if relevant_count < 2:
                continue
            out_counts[" ".join(chunk)] += 1


def build_highlighted_snippet(text: str, query_words: List[str]) -> str:
    raw_text = (text or "").strip()
    if not raw_text:
        return "Trecho não disponível para este documento."

    snippet_regex = build_snippet_regex(query_words)
    folded = fold_text(raw_text)
    match = snippet_regex.search(folded) if snippet_regex else None

    if not match:
        fallback = re.sub(r"\s+", " ", raw_text[: EXAMPLE_SNIPPET_RADIUS + 120]).strip()
        return f"{html.escape(fallback)}{'...' if len(raw_text) > len(fallback) else ''}"

    term_start = match.start(2)
    term_end = match.end(2)

    start = max(0, term_start - EXAMPLE_SNIPPET_RADIUS)
    end = min(len(raw_text), term_end + EXAMPLE_SNIPPET_RADIUS)

    left_break = raw_text.rfind(" ", 0, start)
    if left_break >= 0 and left_break > start - 40:
        start = left_break + 1

    right_break = raw_text.find(" ", end)
    if right_break >= 0 and right_break < end + 40:
        end = right_break

    snippet = raw_text[start:end].replace("\n", " ")
    rel_start = max(0, term_start - start)
    rel_end = min(len(snippet), term_end - start)

    before = html.escape(re.sub(r"\s+", " ", snippet[:rel_start]))
    hit = html.escape(re.sub(r"\s+", " ", snippet[rel_start:rel_end]))
    after = html.escape(re.sub(r"\s+", " ", snippet[rel_end:]))

    prefix = "... " if start > 0 else ""
    suffix = " ..." if end < len(raw_text) else ""
    return f"{prefix}{before}<mark>{hit}</mark>{after}{suffix}"


def build_examples(filters: Dict[str, str], query_words: List[str], term_pattern: str) -> List[Dict[str, Any]]:
    sql = f"""
    WITH base AS (
      SELECT
        date,
        president,
        mandate,
        type,
        title,
        location,
        url,
        text,
        ARRAY_LENGTH(REGEXP_EXTRACT_ALL(
          REGEXP_REPLACE(NORMALIZE(LOWER(COALESCE(text, '')), NFD), r'[\\pM]', ''),
          @term_pattern
        )) AS mentions
      FROM {TABLE_RECORDS}
      WHERE TRIM(COALESCE(text, '')) != ''
        AND (@type_filter = 'ambos' OR type = @type_filter)
        AND (@president_filter = 'todos' OR president = @president_filter)
        AND (@mandate_filter = 'todos' OR mandate = @mandate_filter)
    )
    SELECT date, president, mandate, type, title, location, url, text, mentions
    FROM base
    WHERE mentions > 0
    ORDER BY date DESC, mentions DESC
    LIMIT 1200
    """
    rows = run_query(
        sql,
        [
            bigquery.ScalarQueryParameter("type_filter", "STRING", filters["type_filter"]),
            bigquery.ScalarQueryParameter("president_filter", "STRING", filters["president_filter"]),
            bigquery.ScalarQueryParameter("mandate_filter", "STRING", filters["mandate_filter"]),
            bigquery.ScalarQueryParameter("term_pattern", "STRING", term_pattern),
        ],
    )

    by_mandate: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        mandate = row.get("mandate") or "Mandato nao identificado"
        if mandate not in by_mandate:
            by_mandate[mandate] = {"mandate": mandate, "latest_date": row.get("date") or "", "rows": []}
        bucket = by_mandate[mandate]
        if (row.get("date") or "") > bucket["latest_date"]:
            bucket["latest_date"] = row.get("date") or ""
        bucket["rows"].append(row)

    recent_mandates = sorted(
        by_mandate.values(),
        key=lambda x: (
            x["latest_date"] or "",
            extract_mandate_sort_year(x["mandate"]),
            x["mandate"],
        ),
        reverse=True,
    )[:EXAMPLE_MANDATES_LIMIT]

    out: List[Dict[str, Any]] = []
    for bucket in recent_mandates:
        picks = sorted(
            bucket["rows"],
            key=lambda x: ((x.get("date") or ""), int(x.get("mentions") or 0)),
            reverse=True,
        )[:EXAMPLES_PER_MANDATE]
        for row in picks:
            out.append(
                {
                    "mandate": row.get("mandate") or "Mandato nao identificado",
                    "title": row.get("title") or "Sem titulo",
                    "president": row.get("president") or "--",
                    "type": row.get("type") or "--",
                    "date": row.get("date") or "",
                    "mentions": int(row.get("mentions") or 0),
                    "location": row.get("location") or "",
                    "url": row.get("url") or "",
                    "snippet_html": build_highlighted_snippet(row.get("text") or "", query_words),
                }
            )
    return out


@app.get("/v1/health")
def health() -> Any:
    return jsonify({"ok": True, "project_id": PROJECT_ID, "dataset_id": DATASET_ID})


@app.get("/v1/bootstrap")
def bootstrap() -> Any:
    overview_sql = f"""
    SELECT
      COUNT(*) AS total_docs,
      COUNTIF(TRIM(COALESCE(text, '')) != '') AS total_filled,
      COUNTIF(date > DATE_ADD(CURRENT_DATE(), INTERVAL @max_future_skew DAY)) AS future_outlier_dates
    FROM {TABLE_RECORDS}
    """
    overview = run_query(
        overview_sql,
        [bigquery.ScalarQueryParameter("max_future_skew", "INT64", MAX_FUTURE_SKEW_DAYS)],
    )[0]

    source_counts = run_query(
        f"""
        SELECT source, COUNT(*) AS total
        FROM {TABLE_RECORDS}
        GROUP BY source
        ORDER BY total DESC, source ASC
        """
    )

    pres_counts = run_query(
        f"""
        SELECT
          president AS name,
          COUNT(*) AS total,
          COUNTIF(type = 'discurso') AS discurso_total,
          COUNTIF(type = 'entrevista') AS entrevista_total,
          COUNTIF(type = 'discurso' AND TRIM(COALESCE(text, '')) != '') AS discurso_filled,
          COUNTIF(type = 'entrevista' AND TRIM(COALESCE(text, '')) != '') AS entrevista_filled,
          COUNTIF(TRIM(COALESCE(text, '')) != '') AS filled
        FROM {TABLE_RECORDS}
        GROUP BY president
        ORDER BY filled DESC, name ASC
        """
    )

    mandate_counts = run_query(
        f"""
        SELECT
          mandate AS name,
          COUNT(*) AS total,
          COUNTIF(type = 'discurso') AS discurso_total,
          COUNTIF(type = 'entrevista') AS entrevista_total,
          COUNTIF(type = 'discurso' AND TRIM(COALESCE(text, '')) != '') AS discurso_filled,
          COUNTIF(type = 'entrevista' AND TRIM(COALESCE(text, '')) != '') AS entrevista_filled,
          COUNTIF(TRIM(COALESCE(text, '')) != '') AS filled
        FROM {TABLE_RECORDS}
        GROUP BY mandate
        ORDER BY filled DESC, name ASC
        """
    )

    latest_run = []
    try:
        latest_run = run_query(
            f"""
            SELECT generated_at, synced_at
            FROM {TABLE_RUNS}
            ORDER BY synced_at DESC
            LIMIT 1
            """
        )
    except Exception:
        latest_run = []

    presidents = [
        {
            "name": r.get("name") or "",
            "total": int(r.get("total") or 0),
            "filled": int(r.get("filled") or 0),
            "discurso_total": int(r.get("discurso_total") or 0),
            "entrevista_total": int(r.get("entrevista_total") or 0),
            "discurso_filled": int(r.get("discurso_filled") or 0),
            "entrevista_filled": int(r.get("entrevista_filled") or 0),
        }
        for r in pres_counts
    ]
    mandates = [
        {
            "name": r.get("name") or "",
            "total": int(r.get("total") or 0),
            "filled": int(r.get("filled") or 0),
            "discurso_total": int(r.get("discurso_total") or 0),
            "entrevista_total": int(r.get("entrevista_total") or 0),
            "discurso_filled": int(r.get("discurso_filled") or 0),
            "entrevista_filled": int(r.get("entrevista_filled") or 0),
        }
        for r in mandate_counts
    ]
    hidden_presidents = sorted((r["name"] for r in presidents if r["filled"] == 0 and r["name"]))
    hidden_mandates = sorted((r["name"] for r in mandates if r["filled"] == 0 and r["name"]))

    return jsonify(
        {
            "project_id": PROJECT_ID,
            "dataset_id": DATASET_ID,
            "generated_at": (latest_run[0].get("generated_at") if latest_run else None),
            "synced_at": (latest_run[0].get("synced_at") if latest_run else None),
            "total_docs": int(overview.get("total_docs") or 0),
            "total_filled": int(overview.get("total_filled") or 0),
            "future_outlier_dates": int(overview.get("future_outlier_dates") or 0),
            "sources": [{"source": r.get("source") or "", "total": int(r.get("total") or 0)} for r in source_counts],
            "presidents": presidents,
            "mandates": mandates,
            "hidden_presidents": hidden_presidents,
            "hidden_mandates": hidden_mandates,
        }
    )


@app.get("/v1/search")
def search() -> Any:
    filters = parse_filters()
    term_raw = (request.args.get("term") or "").strip()
    query = normalize_query(term_raw)
    has_term = query["words_count"] > 0
    term_pattern = build_term_regex(query["words"]) if has_term else r"^$"
    limit = parse_limit(request.args.get("limit"), 600, 20, 1200)

    sql = f"""
    WITH base AS (
      SELECT
        date,
        president,
        mandate,
        type,
        title,
        location,
        url,
        REGEXP_REPLACE(NORMALIZE(LOWER(COALESCE(text, '')), NFD), r'[\\pM]', '') AS search_text
      FROM {TABLE_RECORDS}
      WHERE TRIM(COALESCE(text, '')) != ''
        AND (@type_filter = 'ambos' OR type = @type_filter)
        AND (@president_filter = 'todos' OR president = @president_filter)
        AND (@mandate_filter = 'todos' OR mandate = @mandate_filter)
    )
    SELECT
      date,
      president,
      mandate,
      type,
      title,
      location,
      url,
      CASE WHEN @has_term THEN ARRAY_LENGTH(REGEXP_EXTRACT_ALL(search_text, @term_pattern)) ELSE 0 END AS mentions
    FROM base
    WHERE NOT @has_term OR ARRAY_LENGTH(REGEXP_EXTRACT_ALL(search_text, @term_pattern)) > 0
    """
    rows = run_query(
        sql,
        [
            bigquery.ScalarQueryParameter("type_filter", "STRING", filters["type_filter"]),
            bigquery.ScalarQueryParameter("president_filter", "STRING", filters["president_filter"]),
            bigquery.ScalarQueryParameter("mandate_filter", "STRING", filters["mandate_filter"]),
            bigquery.ScalarQueryParameter("has_term", "BOOL", has_term),
            bigquery.ScalarQueryParameter("term_pattern", "STRING", term_pattern),
        ],
    )

    if has_term:
        rows.sort(key=lambda r: (int(r.get("mentions") or 0), r.get("date") or ""), reverse=True)
    else:
        rows.sort(key=lambda r: (r.get("date") or ""), reverse=True)

    total_mentions = 0
    earliest_date = ""
    latest_date = ""
    docs_by_type = {"entrevista": 0, "discurso": 0}
    mentions_by_type = {"entrevista": 0, "discurso": 0}
    timeline: Dict[str, int] = defaultdict(int)
    by_president: Dict[str, int] = defaultdict(int)
    by_mandate: Dict[str, int] = defaultdict(int)

    for row in rows:
        r_type = row.get("type") or ""
        mentions = int(row.get("mentions") or 0)
        value = mentions if has_term else 1

        if r_type in docs_by_type:
            docs_by_type[r_type] += 1
        if has_term and r_type in mentions_by_type:
            mentions_by_type[r_type] += mentions

        total_mentions += value
        d = row.get("date") or ""
        if d:
            if not earliest_date or d < earliest_date:
                earliest_date = d
            if not latest_date or d > latest_date:
                latest_date = d
            if len(d) >= 7:
                timeline[d[:7]] += value

        by_president[row.get("president") or "Nao identificado"] += value
        by_mandate[row.get("mandate") or "Mandato nao identificado"] += value

    rows_limited = [
        {
            "date": r.get("date") or "",
            "president": r.get("president") or "",
            "mandate": r.get("mandate") or "",
            "type": r.get("type") or "",
            "mentions": int(r.get("mentions") or 0),
            "title": r.get("title") or "",
            "location": r.get("location") or "",
            "url": r.get("url") or "",
        }
        for r in rows[:limit]
    ]

    total_docs_with_text = run_query(
        f"SELECT COUNT(*) AS total FROM {TABLE_RECORDS} WHERE TRIM(COALESCE(text, '')) != ''"
    )[0]["total"]

    examples = build_examples(filters, query["words"], term_pattern) if has_term else []

    return jsonify(
        {
            "has_term": has_term,
            "term_raw": term_raw,
            "query_words_count": query["words_count"],
            "is_phrase": query["is_phrase"],
            "results_count": len(rows),
            "total_docs_with_text": int(total_docs_with_text or 0),
            "total_mentions": int(total_mentions),
            "docs_by_type": docs_by_type,
            "mentions_by_type": mentions_by_type,
            "earliest_date": earliest_date,
            "latest_date": latest_date,
            "timeline": [{"key": k, "value": v} for k, v in sorted(timeline.items())],
            "by_president": [{"name": k, "value": v} for k, v in sorted(by_president.items(), key=lambda x: (-x[1], x[0]))],
            "by_mandate": [{"name": k, "value": v} for k, v in sorted(by_mandate.items(), key=lambda x: (-x[1], x[0]))],
            "rows": rows_limited,
            "examples": examples,
        }
    )


@app.get("/v1/wordcloud")
def wordcloud() -> Any:
    filters = parse_filters()
    range_days = parse_limit(request.args.get("range_days"), 30, 7, 3650)
    phrase_mode = parse_phrase_mode(request.args.get("phrase_mode"))
    phrase_sizes = phrase_sizes_for_mode(phrase_mode)
    doc_scan_limit = parse_limit(request.args.get("doc_limit"), WORDCLOUD_DOC_SCAN_LIMIT, 200, 20000)

    docs_sql = f"""
    WITH base AS (
      SELECT
        date,
        REGEXP_REPLACE(NORMALIZE(LOWER(COALESCE(text, '')), NFD), r'[\\pM]', '') AS search_text
      FROM {TABLE_RECORDS}
      WHERE TRIM(COALESCE(text, '')) != ''
        AND (@type_filter = 'ambos' OR type = @type_filter)
        AND (@president_filter = 'todos' OR president = @president_filter)
        AND (@mandate_filter = 'todos' OR mandate = @mandate_filter)
    ),
    anchor AS (
      SELECT MAX(date) AS anchor_date
      FROM base
      WHERE date <= DATE_ADD(CURRENT_DATE(), INTERVAL @max_future_skew DAY)
    )
    SELECT
      anchor.anchor_date AS anchor_date,
      COUNT(*) AS docs_in_window
    FROM base, anchor
    WHERE anchor.anchor_date IS NOT NULL
      AND base.date BETWEEN DATE_SUB(anchor.anchor_date, INTERVAL @range_days - 1 DAY) AND anchor.anchor_date
    GROUP BY anchor.anchor_date
    """
    docs_row = run_query(
        docs_sql,
        [
            bigquery.ScalarQueryParameter("type_filter", "STRING", filters["type_filter"]),
            bigquery.ScalarQueryParameter("president_filter", "STRING", filters["president_filter"]),
            bigquery.ScalarQueryParameter("mandate_filter", "STRING", filters["mandate_filter"]),
            bigquery.ScalarQueryParameter("max_future_skew", "INT64", MAX_FUTURE_SKEW_DAYS),
            bigquery.ScalarQueryParameter("range_days", "INT64", range_days),
        ],
    )
    anchor_date = docs_row[0].get("anchor_date") if docs_row else None
    docs_in_window = int(docs_row[0].get("docs_in_window") or 0) if docs_row else 0

    if not anchor_date:
        return jsonify(
            {
                "range_days": range_days,
                "phrase_mode": phrase_mode,
                "anchor_date": None,
                "docs_in_window": 0,
                "docs_scanned": 0,
                "docs_truncated": False,
                "top_cloud": [],
                "top_table": [],
            }
        )

    text_sql = f"""
    WITH base AS (
      SELECT
        date,
        REGEXP_REPLACE(NORMALIZE(LOWER(COALESCE(text, '')), NFD), r'[\\pM]', '') AS search_text
      FROM {TABLE_RECORDS}
      WHERE TRIM(COALESCE(text, '')) != ''
        AND (@type_filter = 'ambos' OR type = @type_filter)
        AND (@president_filter = 'todos' OR president = @president_filter)
        AND (@mandate_filter = 'todos' OR mandate = @mandate_filter)
    ),
    window_docs AS (
      SELECT search_text
      FROM base
      WHERE date BETWEEN DATE_SUB(@anchor_date, INTERVAL @range_days - 1 DAY) AND @anchor_date
    )
    SELECT search_text
    FROM window_docs
    LIMIT @doc_scan_limit
    """
    text_rows = run_query(
        text_sql,
        [
            bigquery.ScalarQueryParameter("type_filter", "STRING", filters["type_filter"]),
            bigquery.ScalarQueryParameter("president_filter", "STRING", filters["president_filter"]),
            bigquery.ScalarQueryParameter("mandate_filter", "STRING", filters["mandate_filter"]),
            bigquery.ScalarQueryParameter("anchor_date", "DATE", anchor_date),
            bigquery.ScalarQueryParameter("range_days", "INT64", range_days),
            bigquery.ScalarQueryParameter("doc_scan_limit", "INT64", doc_scan_limit),
        ],
    )

    counts: Counter[str] = Counter()
    for row in text_rows:
        search_text = (row.get("search_text") or "").strip()
        if not search_text:
            continue
        tokens = [tok for tok in re.split(r"\s+", search_text) if tok]
        count_term_units(tokens, phrase_sizes, counts)

    sorted_terms = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    top_cloud = [{"word": word, "count": int(count)} for word, count in sorted_terms[:WORDCLOUD_CLOUD_LIMIT]]
    top_table = [{"word": word, "count": int(count)} for word, count in sorted_terms[:WORDCLOUD_TABLE_LIMIT]]
    docs_scanned = len(text_rows)
    docs_truncated = docs_in_window > docs_scanned

    return jsonify(
        {
            "range_days": range_days,
            "phrase_mode": phrase_mode,
            "anchor_date": anchor_date,
            "docs_in_window": docs_in_window,
            "docs_scanned": docs_scanned,
            "docs_truncated": docs_truncated,
            "top_cloud": top_cloud,
            "top_table": top_table,
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")), debug=False)

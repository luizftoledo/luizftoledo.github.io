#!/usr/bin/env python3
import argparse
import csv
import datetime as dt
import gzip
import io
import json
import re
import shutil
import subprocess
import tempfile
import unicodedata
import urllib.error
import urllib.request
import zipfile
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path


DOWNLOAD_URL = "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO"
FALLBACK_ZIP_URL = (
    "https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/"
    "emendas-parlamentares/EmendasParlamentares.zip"
)
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)

ROOT_DIR = Path(__file__).resolve().parents[1]
DASH_DIR = ROOT_DIR / "emendas-dashboard"
DATA_DIR = DASH_DIR / "data"
STATE_DIR = DATA_DIR / "state"
REPORT_FILE = DATA_DIR / "report_data.json"
META_FILE = DATA_DIR / "metadata.json"
HISTORY_FILE = DATA_DIR / "daily_history.json"
STATE_FILE = STATE_DIR / "latest_aggregates.json.gz"


def ensure_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STATE_DIR.mkdir(parents=True, exist_ok=True)


def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def normalize_text(value):
    if value is None:
        return ""
    text = str(value).replace("\ufeff", "").strip()
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def normalize_column(value):
    text = normalize_text(value)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return text


def parse_currency(value):
    text = normalize_text(value)
    if not text:
        return Decimal("0")
    text = text.replace("R$", "").replace(" ", "")
    text = text.replace(".", "").replace(",", ".")
    text = re.sub(r"[^0-9.\-]", "", text)
    if text in {"", "-", ".", "-."}:
        return Decimal("0")
    try:
        return Decimal(text)
    except (InvalidOperation, ValueError):
        return Decimal("0")


def to_float(value):
    if isinstance(value, Decimal):
        return float(value.quantize(Decimal("0.01")))
    return float(value)


def download_with_urllib(url, target):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=300) as resp:
        with target.open("wb") as out:
            shutil.copyfileobj(resp, out, length=1024 * 1024)


def download_with_curl(url, target):
    cmd = [
        "curl",
        "-L",
        "-A",
        USER_AGENT,
        "--fail",
        "--silent",
        "--show-error",
        "--output",
        str(target),
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "curl falhou")


def download_source(url, target):
    errors = []
    for downloader in (download_with_urllib, download_with_curl):
        try:
            downloader(url, target)
            if target.exists() and target.stat().st_size > 0:
                return
        except Exception as exc:
            errors.append(str(exc))
            target.unlink(missing_ok=True)
    raise RuntimeError("Falha no download: " + " | ".join(errors))


def fetch_headers(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return {
                "etag": normalize_text(resp.headers.get("ETag")),
                "last_modified": normalize_text(resp.headers.get("Last-Modified")),
                "content_length": normalize_text(resp.headers.get("Content-Length")),
                "final_url": normalize_text(resp.geturl()),
            }
    except Exception:
        return {"etag": "", "last_modified": "", "content_length": "", "final_url": ""}


def load_json(path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def load_state():
    if not STATE_FILE.exists():
        return {
            "snapshot_date": "",
            "total_empenhado": 0.0,
            "author_totals": {},
            "destination_totals": {},
            "author_destination_totals": {},
        }
    with gzip.open(STATE_FILE, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def save_state(payload):
    with gzip.open(STATE_FILE, "wt", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False)


def pick_primary_member(names):
    normalized = [name for name in names if name.lower().endswith(".csv")]
    for name in normalized:
        lower = name.lower()
        if "emendasparlamentares" in lower and "porfavorecido" not in lower and "convenios" not in lower:
            return name
    if normalized:
        return normalized[0]
    raise RuntimeError("ZIP sem CSV principal de emendas.")


def safe_share(value, total):
    if not total:
        return 0.0
    return float(value / total)


def sort_top(mapping, limit):
    return sorted(mapping.items(), key=lambda item: item[1], reverse=True)[:limit]


def apply_diff(curr_map, prev_map):
    positive = {}
    negative_total = Decimal("0")
    positive_total = Decimal("0")
    for key, curr in curr_map.items():
        prev = Decimal(str(prev_map.get(key, 0.0)))
        delta = curr - prev
        if delta > Decimal("0.005"):
            positive[key] = delta
            positive_total += delta
        elif delta < Decimal("-0.005"):
            negative_total += delta
    return positive, positive_total, negative_total


def build_report(current, previous, headers, source_zip_size, has_previous):
    total_current = current["total_empenhado"]
    total_previous = Decimal(str(previous.get("total_empenhado", 0.0))) if has_previous else total_current

    if has_previous:
        author_growth, author_positive_total, author_negative_total = apply_diff(
            current["author_totals"], previous.get("author_totals", {})
        )
        destination_growth, destination_positive_total, _ = apply_diff(
            current["destination_totals"], previous.get("destination_totals", {})
        )
        pair_growth, _, _ = apply_diff(
            current["author_destination_totals"],
            previous.get("author_destination_totals", {}),
        )
        delta_liquid = total_current - total_previous
        delta_positive = author_positive_total
    else:
        author_growth = {}
        destination_growth = {}
        pair_growth = {}
        author_positive_total = Decimal("0")
        destination_positive_total = Decimal("0")
        author_negative_total = Decimal("0")
        delta_liquid = Decimal("0")
        delta_positive = Decimal("0")

    top_author_growth = sort_top(author_growth, 20)
    top_destination_growth = sort_top(destination_growth, 20)
    top_pair_growth = sort_top(pair_growth, 50)

    top_authors_total = sort_top(current["author_totals"], 20)
    top_destinations_total = sort_top(current["destination_totals"], 20)

    pair_rows = []
    for key, delta in top_pair_growth:
        author, destination = key.split("|||", 1)
        pair_rows.append(
            {
                "author": author,
                "destination": destination,
                "delta_empenhado": to_float(delta),
                "current_empenhado": to_float(current["author_destination_totals"].get(key, Decimal("0"))),
            }
        )

    report = {
        "generated_at": now_iso(),
        "snapshot_date": dt.date.today().isoformat(),
        "source": {
            "label": "Portal da Transparência (CGU) - Emendas Parlamentares",
            "requested_url": DOWNLOAD_URL,
            "download_url": headers.get("final_url") or FALLBACK_ZIP_URL,
            "senado_reference_url": (
                "https://www9.senado.gov.br/QvAJAXZfc/opendoc.htm?document=senado%2F"
                "sigabrasilpainelcidadao.qvw&host=QVS%40www9&anonymous=true&Sheet=shOrcamentoVisaoGeral"
            ),
            "etag": headers.get("etag", ""),
            "last_modified": headers.get("last_modified", ""),
            "zip_bytes": source_zip_size,
        },
        "metrics": {
            "total_empenhado_atual": to_float(total_current),
            "total_empenhado_snapshot_anterior": to_float(total_previous),
            "delta_liquido_desde_snapshot_anterior": to_float(delta_liquid),
            "delta_positivo_desde_snapshot_anterior": to_float(delta_positive),
            "delta_negativo_desde_snapshot_anterior": to_float(author_negative_total),
            "autores_com_aumento": len(author_growth),
            "destinos_com_aumento": len(destination_growth),
            "pares_autor_destino_com_aumento": len(pair_growth),
            "total_autores_mapeados": len(current["author_totals"]),
            "total_destinos_mapeados": len(current["destination_totals"]),
            "total_linhas_csv": current["rows_processed"],
            "baseline_initialized": not has_previous,
        },
        "top_authors_today": [
            {
                "author": name,
                "delta_empenhado": to_float(delta),
                "share_in_day": safe_share(delta, delta_positive),
                "current_empenhado": to_float(current["author_totals"].get(name, Decimal("0"))),
            }
            for name, delta in top_author_growth
        ],
        "top_destinations_today": [
            {
                "destination": name,
                "delta_empenhado": to_float(delta),
                "share_in_day": safe_share(delta, destination_positive_total),
                "current_empenhado": to_float(current["destination_totals"].get(name, Decimal("0"))),
            }
            for name, delta in top_destination_growth
        ],
        "top_author_destination_today": pair_rows,
        "top_authors_total": [
            {"author": name, "total_empenhado": to_float(value)}
            for name, value in top_authors_total
        ],
        "top_destinations_total": [
            {"destination": name, "total_empenhado": to_float(value)}
            for name, value in top_destinations_total
        ],
    }
    return report


def update_history(report):
    history = load_json(HISTORY_FILE, [])
    snapshot_date = report["snapshot_date"]
    history = [row for row in history if row.get("date") != snapshot_date]
    history.append(
        {
            "date": snapshot_date,
            "delta_positivo": report["metrics"]["delta_positivo_desde_snapshot_anterior"],
            "delta_liquido": report["metrics"]["delta_liquido_desde_snapshot_anterior"],
            "total_empenhado_atual": report["metrics"]["total_empenhado_atual"],
            "autores_com_aumento": report["metrics"]["autores_com_aumento"],
            "destinos_com_aumento": report["metrics"]["destinos_com_aumento"],
        }
    )
    history.sort(key=lambda row: row.get("date", ""))
    if len(history) > 730:
        history = history[-730:]
    HISTORY_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
    report["daily_history"] = history
    return history


def build_current_aggregates(zip_path):
    with zipfile.ZipFile(zip_path) as zf:
        member = pick_primary_member(zf.namelist())
        with zf.open(member) as fh:
            wrapper = io.TextIOWrapper(fh, encoding="latin-1", newline="")
            reader = csv.DictReader(wrapper, delimiter=";")
            if not reader.fieldnames:
                raise RuntimeError("CSV de emendas sem cabeçalho.")

            col_map = {}
            for original in reader.fieldnames:
                col_map[normalize_column(original)] = original

            def get_col(row, norm_name):
                return normalize_text(row.get(col_map.get(norm_name, ""), ""))

            rows_processed = 0
            total_empenhado = Decimal("0")
            author_totals = defaultdict(lambda: Decimal("0"))
            destination_totals = defaultdict(lambda: Decimal("0"))
            author_destination_totals = defaultdict(lambda: Decimal("0"))

            for row in reader:
                rows_processed += 1
                valor_empenhado = parse_currency(get_col(row, "valor_empenhado"))
                if valor_empenhado == 0:
                    continue

                author = (
                    get_col(row, "nome_do_autor_da_emenda")
                    or "Autor não informado"
                )
                destination = (
                    get_col(row, "localidade_de_aplicacao_do_recurso")
                    or (
                        f"{get_col(row, 'municipio')} - {get_col(row, 'uf')}"
                        if get_col(row, "municipio") or get_col(row, "uf")
                        else "Destino não informado"
                    )
                )
                pair_key = f"{author}|||{destination}"

                total_empenhado += valor_empenhado
                author_totals[author] += valor_empenhado
                destination_totals[destination] += valor_empenhado
                author_destination_totals[pair_key] += valor_empenhado

    return {
        "rows_processed": rows_processed,
        "total_empenhado": total_empenhado,
        "author_totals": author_totals,
        "destination_totals": destination_totals,
        "author_destination_totals": author_destination_totals,
    }


def write_metadata(report):
    metrics = report["metrics"]
    source = report["source"]
    metadata = {
        "updated_at": report["generated_at"],
        "snapshot_date": report["snapshot_date"],
        "source_requested_url": source["requested_url"],
        "source_download_url": source["download_url"],
        "source_senado_reference_url": source["senado_reference_url"],
        "source_last_modified": source.get("last_modified", ""),
        "source_etag": source.get("etag", ""),
        "source_zip_bytes": source.get("zip_bytes", 0),
        "rows_processed": metrics["total_linhas_csv"],
        "authors_mapped": metrics["total_autores_mapeados"],
        "destinations_mapped": metrics["total_destinos_mapeados"],
    }
    META_FILE.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return metadata


def save_report(report):
    REPORT_FILE.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def save_state_from_current(current, report):
    payload = {
        "snapshot_date": report["snapshot_date"],
        "total_empenhado": to_float(current["total_empenhado"]),
        "author_totals": {k: to_float(v) for k, v in current["author_totals"].items()},
        "destination_totals": {k: to_float(v) for k, v in current["destination_totals"].items()},
        "author_destination_totals": {
            k: to_float(v) for k, v in current["author_destination_totals"].items()
        },
    }
    save_state(payload)


def should_skip_build(headers, metadata, force):
    if force:
        return False
    if not REPORT_FILE.exists():
        return False
    last_modified = normalize_text(headers.get("last_modified"))
    etag = normalize_text(headers.get("etag"))
    if last_modified and last_modified == normalize_text(metadata.get("source_last_modified")):
        return True
    if etag and etag == normalize_text(metadata.get("source_etag")):
        return True
    return False


def build_dashboard(force=False):
    ensure_dirs()
    headers = fetch_headers(DOWNLOAD_URL)
    metadata = load_json(META_FILE, {})

    if should_skip_build(headers, metadata, force):
        print("[skip] Fonte sem atualização detectada (etag/last-modified).")
        return False

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        zip_path = tmpdir_path / "emendas.zip"

        try:
            download_source(DOWNLOAD_URL, zip_path)
        except Exception:
            download_source(FALLBACK_ZIP_URL, zip_path)
            if not headers.get("final_url"):
                headers["final_url"] = FALLBACK_ZIP_URL

        current = build_current_aggregates(zip_path)
        previous = load_state()
        has_previous = bool(previous.get("snapshot_date")) and bool(previous.get("author_totals"))
        report = build_report(current, previous, headers, zip_path.stat().st_size, has_previous)
        update_history(report)
        save_report(report)
        write_metadata(report)
        save_state_from_current(current, report)

    print(
        "[ok] emendas-dashboard atualizado:",
        f"delta_positivo={report['metrics']['delta_positivo_desde_snapshot_anterior']:.2f}",
        f"autores_com_aumento={report['metrics']['autores_com_aumento']}",
    )
    return True


def parse_args():
    parser = argparse.ArgumentParser(
        description="Atualiza dados da dashboard de emendas (monitor diário por variação de empenho)."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Força rebuild mesmo quando ETag/Last-Modified não mudaram.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    build_dashboard(force=args.force)


if __name__ == "__main__":
    main()

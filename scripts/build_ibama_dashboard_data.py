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
from decimal import Decimal, InvalidOperation
from pathlib import Path

try:
    import openpyxl
except ImportError as exc:  # pragma: no cover
    raise SystemExit("openpyxl nao instalado. Rode: pip install openpyxl") from exc


IBAMA_ZIP_URL = (
    "https://dadosabertos.ibama.gov.br/dados/SIFISC/auto_infracao/"
    "auto_infracao/auto_infracao_csv.zip"
)
ICMBIO_XLSX_URL = (
    "https://www.gov.br/icmbio/pt-br/assuntos/dados_geoespaciais/"
    "mapa-tematico-e-dados-geoestatisticos-das-unidades-de-conservacao-federais/"
    "autos_infracao_icmbio.xlsx"
)

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)
MIN_VALID_YEAR = 1970
DOWNLOAD_TIMEOUT = 300

DATE_PRIORITY_COLUMNS = (
    "dat_hora_auto_infracao",
    "dt_fato_infracional",
    "dat_ciencia_autuacao",
    "dt_lancamento",
    "ultima_atualizacao_relatorio",
    "data",
)

ROOT_DIR = Path(__file__).resolve().parents[1]
DASH_DIR = ROOT_DIR / "ibama-dashboard"
DATA_DIR = DASH_DIR / "data"
META_FILE = DATA_DIR / "metadata.json"

DATA_FILES = {
    "ibama": DATA_DIR / "ibama_records.jsonl.gz",
    "icmbio": DATA_DIR / "icmbio_records.jsonl.gz",
}

SOURCE_URLS = {
    "ibama": IBAMA_ZIP_URL,
    "icmbio": ICMBIO_XLSX_URL,
}


def ensure_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def normalize_text(value):
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_column_name(value):
    text = normalize_text(value)
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def parse_fine_value(raw_value):
    if raw_value is None:
        return Decimal("0")
    text = str(raw_value).strip()
    if not text:
        return Decimal("0")

    text = text.lower().replace("r$", "").replace(" ", "")
    text = text.replace(".", "").replace(",", ".")
    text = re.sub(r"[^0-9.\-]", "", text)
    if text in {"", "-", ".", "-."}:
        return Decimal("0")
    try:
        return Decimal(text)
    except (InvalidOperation, ValueError):
        return Decimal("0")


def parse_coordinate_value(raw_value):
    if raw_value is None:
        return None
    text = str(raw_value).strip()
    if not text:
        return None
    text = text.replace(",", ".").replace(" ", "")
    if text.count(".") > 1:
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    if value < -180 or value > 180:
        return None
    return value


def parse_date_value(raw_value):
    if raw_value is None:
        return None
    text = str(raw_value).strip()
    if not text:
        return None

    text = text.replace("t", " ")
    text = re.sub(r"\s+", " ", text)
    known_formats = (
        "%Y-%m-%d",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%d/%m/%Y",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
    )
    for fmt in known_formats:
        try:
            return dt.datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    iso_match = re.match(r"^(\d{4})-(\d{2})-(\d{2})", text)
    if iso_match:
        try:
            return dt.date(
                int(iso_match.group(1)),
                int(iso_match.group(2)),
                int(iso_match.group(3)),
            )
        except ValueError:
            return None

    br_match = re.match(r"^(\d{2})/(\d{2})/(\d{4})", text)
    if br_match:
        try:
            return dt.date(
                int(br_match.group(3)),
                int(br_match.group(2)),
                int(br_match.group(1)),
            )
        except ValueError:
            return None
    return None


def detect_value_column(headers):
    preferred = (
        "val_auto_infracao",
        "valor_auto_infracao",
        "valor_multa",
        "val_multa",
        "valor_multa",
    )
    for candidate in preferred:
        if candidate in headers:
            return candidate
    for header in headers:
        if "valor" in header and ("multa" in header or "infracao" in header):
            return header
    for header in headers:
        if "valor" in header:
            return header
    return None


def pick_first_value(row, candidates):
    for key in candidates:
        value = row.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def read_metadata():
    if not META_FILE.exists():
        return {}
    try:
        return json.loads(META_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def write_metadata(metadata):
    META_FILE.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def download_with_urllib(url, target):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT) as resp:
        if getattr(resp, "status", 200) >= 400:
            raise urllib.error.HTTPError(url, resp.status, "http error", resp.headers, None)
        with target.open("wb") as f:
            shutil.copyfileobj(resp, f, length=1024 * 1024)


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
        except Exception as exc:  # pragma: no cover
            errors.append(str(exc))
            target.unlink(missing_ok=True)
    raise RuntimeError("Falha no download: " + " | ".join(errors))


def detect_csv_encoding(sample_bytes):
    for encoding in ("utf-8-sig", "utf-8", "latin1", "iso-8859-1", "cp1252"):
        try:
            sample_bytes.decode(encoding)
            return encoding
        except UnicodeDecodeError:
            continue
    return "utf-8"


def write_record(gzip_file, record):
    gzip_file.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
    gzip_file.write("\n")


def build_dataset_from_ibama_zip(source_zip, output_file):
    today = dt.date.today()
    stats = {
        "rows": 0,
        "total_fines": 0.0,
        "date_min": "",
        "date_max": "",
        "future_dates_ignored": 0,
        "ufs": set(),
    }

    date_min = None
    date_max = None
    with zipfile.ZipFile(source_zip, "r") as zf:
        csv_names = sorted([name for name in zf.namelist() if name.lower().endswith(".csv")])
        if not csv_names:
            raise RuntimeError("ZIP do IBAMA sem arquivo CSV.")

        with gzip.open(output_file, "wt", encoding="utf-8", compresslevel=9) as out_fp:
            for csv_name in csv_names:
                with zf.open(csv_name, "r") as raw_fp:
                    sample = raw_fp.read(32768)
                    raw_fp.seek(0)
                    encoding = detect_csv_encoding(sample)
                    text_fp = io.TextIOWrapper(raw_fp, encoding=encoding, errors="replace", newline="")
                    reader = csv.DictReader(text_fp, delimiter=";")

                    headers_raw = reader.fieldnames or []
                    headers = [normalize_column_name(h) for h in headers_raw]
                    value_column = detect_value_column(headers)

                    for src_row in reader:
                        row = {}
                        for i, raw_header in enumerate(headers_raw):
                            if i >= len(headers):
                                continue
                            key = headers[i]
                            row[key] = src_row.get(raw_header, "")

                        date_text = ""
                        for col in DATE_PRIORITY_COLUMNS:
                            parsed = parse_date_value(row.get(col, ""))
                            if not parsed:
                                continue
                            if parsed.year < MIN_VALID_YEAR:
                                continue
                            if parsed > today:
                                stats["future_dates_ignored"] += 1
                                continue
                            date_text = parsed.isoformat()
                            date_min = parsed if date_min is None else min(date_min, parsed)
                            date_max = parsed if date_max is None else max(date_max, parsed)
                            break

                        value_decimal = parse_fine_value(row.get(value_column, "")) if value_column else Decimal("0")
                        uf = normalize_text(pick_first_value(row, ("uf", "sg_uf", "sigla_uf")))
                        if uf:
                            stats["ufs"].add(uf)

                        record = {
                            "i": normalize_text(pick_first_value(row, ("seq_auto_infracao", "numero_auto", "num_auto"))),
                            "n": normalize_text(pick_first_value(row, ("nome_infrator", "nom_autuado", "autuado"))),
                            "d": normalize_text(
                                pick_first_value(row, ("des_auto_infracao", "descricao", "descricao_auto_infracao"))
                            )[:320],
                            "m": normalize_text(pick_first_value(row, ("municipio", "nom_municipio", "cidade"))),
                            "u": uf,
                            "v": float(value_decimal),
                            "dt": date_text,
                            "p": normalize_text(pick_first_value(row, ("num_processo", "processo"))),
                            "cp": re.sub(r"[^0-9a-z]", "", normalize_text(
                                pick_first_value(row, ("cpf_cnpj_infrator", "cpf_cnpj", "cpf", "cnpj"))
                            )),
                            "lat": parse_coordinate_value(
                                pick_first_value(row, ("num_latitude_auto", "latitude", "lat"))
                            ),
                            "lon": parse_coordinate_value(
                                pick_first_value(row, ("num_longitude_auto", "longitude", "lon"))
                            ),
                        }
                        write_record(out_fp, record)
                        stats["rows"] += 1
                        stats["total_fines"] += float(value_decimal)

    stats["date_min"] = date_min.isoformat() if date_min else ""
    stats["date_max"] = date_max.isoformat() if date_max else ""
    stats["ufs"] = sorted(stats["ufs"])
    return stats


def build_dataset_from_icmbio_xlsx(source_xlsx, output_file):
    today = dt.date.today()
    stats = {
        "rows": 0,
        "total_fines": 0.0,
        "date_min": "",
        "date_max": "",
        "future_dates_ignored": 0,
        "ufs": set(),
    }
    date_min = None
    date_max = None

    workbook = openpyxl.load_workbook(source_xlsx, read_only=True, data_only=True)
    sheet = workbook.active
    rows_iter = sheet.iter_rows(values_only=True)
    headers_raw = [str(cell or "").strip() for cell in next(rows_iter)]
    headers = [normalize_column_name(h) for h in headers_raw]
    value_column = detect_value_column(headers)

    with gzip.open(output_file, "wt", encoding="utf-8", compresslevel=9) as out_fp:
        for cells in rows_iter:
            row = {}
            for i, value in enumerate(cells):
                if i >= len(headers):
                    continue
                row[headers[i]] = "" if value is None else str(value)

            date_text = ""
            for col in DATE_PRIORITY_COLUMNS:
                parsed = parse_date_value(row.get(col, ""))
                if not parsed:
                    continue
                if parsed.year < MIN_VALID_YEAR:
                    continue
                if parsed > today:
                    stats["future_dates_ignored"] += 1
                    continue
                date_text = parsed.isoformat()
                date_min = parsed if date_min is None else min(date_min, parsed)
                date_max = parsed if date_max is None else max(date_max, parsed)
                break

            value_decimal = parse_fine_value(row.get(value_column, "")) if value_column else Decimal("0")
            uf = normalize_text(pick_first_value(row, ("uf", "sg_uf", "sigla_uf")))
            if uf:
                stats["ufs"].add(uf)

            record = {
                "i": normalize_text(pick_first_value(row, ("seq_auto_infracao", "numero_auto", "num_auto"))),
                "n": normalize_text(pick_first_value(row, ("nome_infrator", "nom_autuado", "autuado"))),
                "d": normalize_text(
                    pick_first_value(row, ("des_auto_infracao", "descricao", "descricao_auto_infracao"))
                )[:320],
                "m": normalize_text(pick_first_value(row, ("municipio", "nom_municipio", "cidade"))),
                "u": uf,
                "v": float(value_decimal),
                "dt": date_text,
                "p": normalize_text(pick_first_value(row, ("num_processo", "processo"))),
                "cp": re.sub(r"[^0-9a-z]", "", normalize_text(
                    pick_first_value(row, ("cpf_cnpj_infrator", "cpf_cnpj", "cpf", "cnpj"))
                )),
                "lat": parse_coordinate_value(
                    pick_first_value(row, ("num_latitude_auto", "latitude", "lat"))
                ),
                "lon": parse_coordinate_value(
                    pick_first_value(row, ("num_longitude_auto", "longitude", "lon"))
                ),
            }
            write_record(out_fp, record)
            stats["rows"] += 1
            stats["total_fines"] += float(value_decimal)

    workbook.close()
    stats["date_min"] = date_min.isoformat() if date_min else ""
    stats["date_max"] = date_max.isoformat() if date_max else ""
    stats["ufs"] = sorted(stats["ufs"])
    return stats


def should_update_dataset(dataset, source_size_bytes, old_meta, force):
    if force:
        return True
    old_dataset = ((old_meta.get("datasets") or {}).get(dataset) or {})
    old_size = int(old_dataset.get("source_size_bytes") or 0)
    if old_size <= 0:
        return True
    return source_size_bytes > old_size


def main():
    parser = argparse.ArgumentParser(description="Build otimizado da dashboard IBAMA + ICMBio para GitHub Pages.")
    parser.add_argument("--force", action="store_true", help="Ignora regra de tamanho e sempre atualiza.")
    args = parser.parse_args()

    ensure_dirs()
    old_meta = read_metadata()
    datasets_meta = (old_meta.get("datasets") or {}).copy()
    any_updated = False

    with tempfile.TemporaryDirectory(prefix="ibama_dash_") as tmp_dir:
        tmp_dir_path = Path(tmp_dir)

        for dataset in ("ibama", "icmbio"):
            source_url = SOURCE_URLS[dataset]
            source_ext = ".zip" if dataset == "ibama" else ".xlsx"
            source_tmp = tmp_dir_path / f"{dataset}_source{source_ext}"
            print(f"[{dataset}] download: {source_url}")
            download_source(source_url, source_tmp)
            source_size = source_tmp.stat().st_size
            print(f"[{dataset}] source size bytes: {source_size}")

            if not should_update_dataset(dataset, source_size, old_meta, args.force):
                print(f"[{dataset}] skip: fonte nova menor que a anterior.")
                continue

            target_tmp = tmp_dir_path / f"{dataset}_records.jsonl.gz"
            if dataset == "ibama":
                stats = build_dataset_from_ibama_zip(source_tmp, target_tmp)
            else:
                stats = build_dataset_from_icmbio_xlsx(source_tmp, target_tmp)

            shutil.move(target_tmp, DATA_FILES[dataset])
            datasets_meta[dataset] = {
                "rows": int(stats["rows"]),
                "total_fines": float(stats["total_fines"]),
                "date_min": stats["date_min"],
                "date_max": stats["date_max"],
                "future_dates_ignored": int(stats["future_dates_ignored"]),
                "ufs": stats["ufs"],
                "source_size_bytes": int(source_size),
                "source_url": source_url,
                "data_file": DATA_FILES[dataset].name,
                "updated_at": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
            }
            any_updated = True
            print(
                f"[{dataset}] atualizado: rows={stats['rows']} total_fines={stats['total_fines']:.2f} "
                f"file={DATA_FILES[dataset].name} ({DATA_FILES[dataset].stat().st_size} bytes)"
            )

    now_iso = dt.datetime.now().astimezone().isoformat(timespec="seconds")
    metadata = {
        "updated_at": now_iso if any_updated else (old_meta.get("updated_at") or now_iso),
        "datasets": datasets_meta,
    }
    write_metadata(metadata)
    print("[meta] metadata.json atualizado.")

    if not any_updated:
        print("[ok] Nenhum dataset substituido (regra de tamanho mantida).")
    else:
        print("[ok] Build concluido.")


if __name__ == "__main__":
    main()

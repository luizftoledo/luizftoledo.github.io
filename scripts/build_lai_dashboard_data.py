#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import re
import shutil
import subprocess
import tempfile
import unicodedata
import urllib.error
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd


DOWNLOAD_URL_TEMPLATE = (
    "https://dadosabertos-download.cgu.gov.br/FalaBR/Arquivos_FalaBR_Filtrado/"
    "Arquivos_csv_{year}.zip"
)
DOWNLOAD_PORTAL_URL = "https://buscalai.cgu.gov.br/DownloadDados/DownloadDados"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)
DOWNLOAD_TIMEOUT = 300
START_YEAR_DEFAULT = 2015

ROOT_DIR = Path(__file__).resolve().parents[1]
DASH_DIR = ROOT_DIR / "lai-dashboard"
DATA_DIR = DASH_DIR / "data"
CACHE_DIR = DATA_DIR / "cache"
YEARLY_CACHE_DIR = CACHE_DIR / "yearly"
REPORT_FILE = DATA_DIR / "report_data.json"
METADATA_FILE = DATA_DIR / "metadata.json"

CANONICAL_DECISIONS = (
    "Acesso Concedido",
    "Acesso Negado",
    "Acesso Parcialmente Concedido",
    "Não se trata de solicitação de informação",
    "Informação Inexistente",
    "Órgão não tem competência para responder sobre o assunto",
    "Pergunta Duplicada/Repetida",
)

DECISION_DENIED = "Acesso Negado"
DECISION_RESTRICTED = {"Acesso Negado", "Acesso Parcialmente Concedido"}

PERSONAL_REASON_KEYWORDS = (
    "dado pessoal",
    "dados pessoais",
    "informacao pessoal",
    "informações pessoais",
    "privacidade",
    "honra",
    "imagem",
    "lgpd",
    "sigilo bancario",
    "sigilo fiscal",
    "informacao de terceiro",
    "informação de terceiro",
    "terceiro",
)

REASON_NORMALIZATION = {
    "dados pessoais": "Dados pessoais",
    "dado pessoal": "Dados pessoais",
    "dados pessoais.": "Dados pessoais",
    "dados pessoais e sensiveis": "Dados pessoais e sensíveis",
    "dados pessoais e sensíveis": "Dados pessoais e sensíveis",
    "pedido generico": "Pedido genérico",
    "pedido genérico": "Pedido genérico",
    "pedido incompreensivel": "Pedido incompreensível",
    "pedido incompreensível": "Pedido incompreensível",
    "pedido desproporcional ou desarrazoado": "Pedido desproporcional ou desarrazoado",
    "informacao sigilosa de acordo com legislacao especifica": "Informação sigilosa de acordo com legislação específica",
    "informação sigilosa de acordo com legislação específica": "Informação sigilosa de acordo com legislação específica",
    "parte da informacao e sigilosa de acordo com legislacao especifica": "Parte da informação é sigilosa de acordo com legislação específica",
    "parte da informação é sigilosa de acordo com legislação específica": "Parte da informação é sigilosa de acordo com legislação específica",
    "informacao classificada conforme artigos 23 e 24 da lei n 12.527/2011": "Informação classificada conforme artigos 23 e 24 da Lei nº 12.527/2011",
    "informação classificada conforme artigos 23 e 24 da lei nº 12.527/2011": "Informação classificada conforme artigos 23 e 24 da Lei nº 12.527/2011",
    "parte da informacao classificada conforme artigos 23 e 24 da lei n 12.527/2011": "Parte da informação classificada conforme artigos 23 e 24 da Lei nº 12.527/2011",
    "parte da informação classificada conforme artigos 23 e 24 da lei nº 12.527/2011": "Parte da informação classificada conforme artigos 23 e 24 da Lei nº 12.527/2011",
    "informacao inexistente": "Informação inexistente",
    "parte da informacao e inexistente": "Parte da informação é inexistente",
    "parte da informação é inexistente": "Parte da informação é inexistente",
    "processo decisorio em curso": "Processo decisório em curso",
    "processo decisório em curso": "Processo decisório em curso",
    "parte da informacao esta relacionada a processo decisorio em curso": "Parte da informação está relacionada a processo decisório em curso",
    "parte da informação está relacionada a processo decisório em curso": "Parte da informação está relacionada a processo decisório em curso",
    "pedido exige tratamento adicional de dados": "Pedido exige tratamento adicional de dados",
    "parte da informacao demandara mais tempo para producao": "Parte da informação demandará mais tempo para produção",
    "parte da informação demandará mais tempo para produção": "Parte da informação demandará mais tempo para produção",
}


def ensure_dirs():
    YEARLY_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def normalize_text(value):
    if value is None:
        return ""
    text = str(value).replace("\ufeff", "").strip()
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_for_match(value):
    text = normalize_text(value)
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"\s+", " ", text).strip()
    return text


def canonicalize_decision(value):
    text = normalize_text(value)
    if not text:
        return "Sem decisão registrada"

    normalized = normalize_for_match(text)
    for decision in CANONICAL_DECISIONS:
        norm_dec = normalize_for_match(decision)
        if normalized == norm_dec:
            return decision
        if normalized.startswith(norm_dec + " "):
            return decision

    if len(text) > 120:
        return "Outros (texto livre)"
    return text


def canonicalize_reason(value):
    text = normalize_text(value)
    if not text:
        return "Motivo não informado"

    if len(text) > 180:
        return "Outros (texto livre)"

    norm = normalize_for_match(text)
    canonical = REASON_NORMALIZATION.get(norm)
    if canonical:
        return canonical

    if len(text) > 0:
        return text[0].upper() + text[1:]
    return "Motivo não informado"


def is_personal_reason(reason):
    norm = normalize_for_match(reason)
    if not norm:
        return False
    return any(token in norm for token in PERSONAL_REASON_KEYWORDS)


def merge_counter_dict(target, incoming):
    for key, value in incoming.items():
        target[key] += int(value)


def cache_file_for_year(year):
    return YEARLY_CACHE_DIR / f"{year}.json"


def load_year_cache(year):
    path = cache_file_for_year(year)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def save_year_cache(year_payload):
    year = int(year_payload["year"])
    path = cache_file_for_year(year)
    path.write_text(json.dumps(year_payload, ensure_ascii=False, indent=2), encoding="utf-8")


def download_with_urllib(url, target):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT) as resp:
        if getattr(resp, "status", 200) >= 400:
            raise urllib.error.HTTPError(url, resp.status, "http error", resp.headers, None)
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
        except Exception as exc:  # pragma: no cover
            errors.append(str(exc))
            target.unlink(missing_ok=True)
    raise RuntimeError("Falha no download: " + " | ".join(errors))


def find_pedidos_member(zip_path):
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
    candidates = [
        name
        for name in names
        if "Pedidos_csv_" in name and "Solicitantes" not in name and "LinkArquivo" not in name
    ]
    if not candidates:
        raise RuntimeError(f"ZIP sem arquivo Pedidos_csv: {zip_path.name}")
    return sorted(candidates)[0]


def process_year_zip(year, zip_path, source_url):
    pedidos_member = find_pedidos_member(zip_path)

    usecols = [
        "OrgaoDestinatario",
        "AssuntoPedido",
        "Decisao",
        "EspecificacaoDecisao",
        "MotivoNegativaAcesso",
    ]

    total_requests = 0
    denied_total = 0
    restricted_total = 0
    personal_restricted_total = 0

    decision_counts = Counter()
    reason_counts = Counter()

    org_total = Counter()
    org_denied = Counter()
    org_restricted = Counter()
    org_personal = Counter()

    org_assunto_total = Counter()
    org_assunto_decision = Counter()

    with zipfile.ZipFile(zip_path) as zf:
        with zf.open(pedidos_member) as handle:
            iterator = pd.read_csv(
                handle,
                sep=";",
                encoding="utf-16",
                dtype=str,
                usecols=usecols,
                chunksize=120_000,
                on_bad_lines="skip",
            )

            for chunk in iterator:
                if chunk.empty:
                    continue

                total_requests += len(chunk)

                org = chunk["OrgaoDestinatario"].fillna("").astype(str).map(normalize_text)
                assunto = chunk["AssuntoPedido"].fillna("").astype(str).map(normalize_text)
                assunto = assunto.mask(assunto == "", "Assunto não informado")

                decision = chunk["Decisao"].fillna("").astype(str).map(canonicalize_decision)

                reason_source = (
                    chunk["EspecificacaoDecisao"].fillna("").astype(str).map(normalize_text)
                )
                motivo_fallback = chunk["MotivoNegativaAcesso"].fillna("").astype(str).map(normalize_text)
                reason_raw = reason_source.where(reason_source != "", motivo_fallback)
                reason = reason_raw.map(canonicalize_reason)

                denied_mask = decision == DECISION_DENIED
                restricted_mask = decision.isin(DECISION_RESTRICTED)
                personal_mask = restricted_mask & reason.map(is_personal_reason)

                denied_total += int(denied_mask.sum())
                restricted_total += int(restricted_mask.sum())
                personal_restricted_total += int(personal_mask.sum())

                decision_counts.update(decision.value_counts(dropna=False).to_dict())
                reason_counts.update(reason[restricted_mask].value_counts(dropna=False).to_dict())

                valid_org_mask = org != ""
                org_total.update(org[valid_org_mask].value_counts(dropna=False).to_dict())
                org_denied.update(org[denied_mask & valid_org_mask].value_counts(dropna=False).to_dict())
                org_restricted.update(org[restricted_mask & valid_org_mask].value_counts(dropna=False).to_dict())
                org_personal.update(org[personal_mask & valid_org_mask].value_counts(dropna=False).to_dict())

                combos = pd.DataFrame(
                    {
                        "org": org[valid_org_mask],
                        "assunto": assunto[valid_org_mask],
                        "decision": decision[valid_org_mask],
                    }
                )
                if not combos.empty:
                    pair_counts = combos[["org", "assunto"]].value_counts(sort=False)
                    for (org_name, assunto_name), count in pair_counts.items():
                        org_assunto_total[f"{org_name}|||{assunto_name}"] += int(count)

                    triple_counts = combos[["org", "assunto", "decision"]].value_counts(sort=False)
                    for (org_name, assunto_name, decision_name), count in triple_counts.items():
                        org_assunto_decision[
                            f"{org_name}|||{assunto_name}|||{decision_name}"
                        ] += int(count)

    denied_rate = (denied_total / total_requests) if total_requests else 0.0
    restricted_rate = (restricted_total / total_requests) if total_requests else 0.0
    personal_share_in_restricted = (
        (personal_restricted_total / restricted_total) if restricted_total else 0.0
    )

    return {
        "year": int(year),
        "source_url": source_url,
        "zip_member": pedidos_member,
        "processed_at": now_iso(),
        "total_requests": int(total_requests),
        "denied_total": int(denied_total),
        "restricted_total": int(restricted_total),
        "personal_restricted_total": int(personal_restricted_total),
        "denied_rate": denied_rate,
        "restricted_rate": restricted_rate,
        "personal_share_in_restricted": personal_share_in_restricted,
        "decision_counts": dict(decision_counts),
        "reason_counts": dict(reason_counts),
        "org_total": dict(org_total),
        "org_denied": dict(org_denied),
        "org_restricted": dict(org_restricted),
        "org_personal": dict(org_personal),
        "org_assunto_total": dict(org_assunto_total),
        "org_assunto_decision": dict(org_assunto_decision),
    }


def maybe_process_year(year, force=False):
    cache = load_year_cache(year)
    current_year = dt.date.today().year
    should_refresh = force or cache is None or year >= current_year

    if not should_refresh and cache is not None:
        print(f"[cache] {year}: usando cache anual")
        return cache, False

    url = DOWNLOAD_URL_TEMPLATE.format(year=year)

    with tempfile.TemporaryDirectory(prefix=f"lai_{year}_") as tmp:
        zip_path = Path(tmp) / f"Arquivos_csv_{year}.zip"
        print(f"[download] {year}: {url}")
        try:
            download_source(url, zip_path)
        except Exception as exc:
            if cache is not None:
                print(f"[warn] {year}: falha no download ({exc}); mantendo cache")
                return cache, False
            print(f"[skip] {year}: sem arquivo disponível ({exc})")
            return None, False

        print(f"[process] {year}: processando Pedidos_csv")
        payload = process_year_zip(year=year, zip_path=zip_path, source_url=url)
        save_year_cache(payload)
        return payload, True


def identify_pf_org(org_stats):
    best = None
    best_total = -1
    for org, stat in org_stats.items():
        norm = normalize_for_match(org)
        if "policia federal" in norm or "departamento de policia federal" in norm:
            total = int(stat.get("total_requests", 0))
            if total > best_total:
                best_total = total
                best = org
    return best


def build_report(year_payloads):
    year_payloads = sorted(year_payloads, key=lambda x: int(x["year"]))

    global_decisions = Counter()
    global_reasons = Counter()

    global_org_total = Counter()
    global_org_denied = Counter()
    global_org_restricted = Counter()
    global_org_personal = Counter()

    global_org_assunto_total = Counter()
    global_org_assunto_decision = Counter()

    yearly_series = []

    for payload in year_payloads:
        year = int(payload["year"])
        total_requests = int(payload.get("total_requests", 0))
        denied_total = int(payload.get("denied_total", 0))
        restricted_total = int(payload.get("restricted_total", 0))
        personal_total = int(payload.get("personal_restricted_total", 0))

        denied_rate = (denied_total / total_requests) if total_requests else 0.0
        restricted_rate = (restricted_total / total_requests) if total_requests else 0.0
        personal_share = (personal_total / restricted_total) if restricted_total else 0.0

        yearly_series.append(
            {
                "year": year,
                "total_requests": total_requests,
                "denied_total": denied_total,
                "restricted_total": restricted_total,
                "personal_restricted_total": personal_total,
                "denied_rate": denied_rate,
                "restricted_rate": restricted_rate,
                "personal_share_in_restricted": personal_share,
            }
        )

        merge_counter_dict(global_decisions, payload.get("decision_counts", {}))
        merge_counter_dict(global_reasons, payload.get("reason_counts", {}))
        merge_counter_dict(global_org_total, payload.get("org_total", {}))
        merge_counter_dict(global_org_denied, payload.get("org_denied", {}))
        merge_counter_dict(global_org_restricted, payload.get("org_restricted", {}))
        merge_counter_dict(global_org_personal, payload.get("org_personal", {}))
        merge_counter_dict(global_org_assunto_total, payload.get("org_assunto_total", {}))
        merge_counter_dict(global_org_assunto_decision, payload.get("org_assunto_decision", {}))

    overall_total = sum(item["total_requests"] for item in yearly_series)
    overall_denied = sum(item["denied_total"] for item in yearly_series)
    overall_restricted = sum(item["restricted_total"] for item in yearly_series)
    overall_personal = sum(item["personal_restricted_total"] for item in yearly_series)

    org_stats = {}
    for org, total in global_org_total.items():
        denied = int(global_org_denied.get(org, 0))
        restricted = int(global_org_restricted.get(org, 0))
        personal = int(global_org_personal.get(org, 0))
        org_stats[org] = {
            "org": org,
            "total_requests": int(total),
            "denied_total": denied,
            "restricted_total": restricted,
            "personal_restricted_total": personal,
            "denied_rate": (denied / total) if total else 0.0,
            "restricted_rate": (restricted / total) if total else 0.0,
        }

    org_by_denied = sorted(
        org_stats.values(),
        key=lambda row: (row["denied_total"], row["restricted_total"], row["total_requests"]),
        reverse=True,
    )

    org_by_low_rate = sorted(
        [row for row in org_stats.values() if row["total_requests"] >= 1500],
        key=lambda row: (row["denied_rate"], -row["total_requests"]),
    )

    top5 = org_by_denied[:5]
    top5_names = {row["org"] for row in top5}
    pf_org = identify_pf_org(org_stats)
    top5_plus_pf = list(top5)
    if pf_org and pf_org not in top5_names:
        top5_plus_pf.append(org_stats[pf_org])

    reason_top_labels = [label for label, _ in global_reasons.most_common(8)]
    reason_top_set = set(reason_top_labels)

    reason_series = []
    decision_series = []

    for payload in year_payloads:
        year = int(payload["year"])
        restricted_total = int(payload.get("restricted_total", 0))

        year_reason_counter = Counter()
        for reason, count in payload.get("reason_counts", {}).items():
            key = reason if reason in reason_top_set else "Outros motivos"
            year_reason_counter[key] += int(count)

        for reason in reason_top_labels:
            count = int(year_reason_counter.get(reason, 0))
            reason_series.append(
                {
                    "year": year,
                    "reason": reason,
                    "count": count,
                    "share_in_restricted": (count / restricted_total) if restricted_total else 0.0,
                }
            )

        outros_count = int(year_reason_counter.get("Outros motivos", 0))
        reason_series.append(
            {
                "year": year,
                "reason": "Outros motivos",
                "count": outros_count,
                "share_in_restricted": (outros_count / restricted_total) if restricted_total else 0.0,
            }
        )

        for decision, count in payload.get("decision_counts", {}).items():
            decision_series.append(
                {
                    "year": year,
                    "decision": decision,
                    "count": int(count),
                    "share_in_year": (int(count) / int(payload.get("total_requests", 0)))
                    if int(payload.get("total_requests", 0))
                    else 0.0,
                }
            )

    org_assunto_by_org = defaultdict(Counter)
    for key, count in global_org_assunto_total.items():
        try:
            org, assunto = key.split("|||", 1)
        except ValueError:
            continue
        org_assunto_by_org[org][assunto] += int(count)

    org_assunto_decision = defaultdict(Counter)
    org_decisions = defaultdict(Counter)
    for key, count in global_org_assunto_decision.items():
        try:
            org, assunto, decision = key.split("|||", 2)
        except ValueError:
            continue
        org_assunto_decision[(org, assunto)][decision] += int(count)
        org_decisions[org][decision] += int(count)

    org_profiles = {}
    for org_row in top5_plus_pf:
        org_name = org_row["org"]
        assunto_counter = org_assunto_by_org.get(org_name, Counter())
        top_subjects = []

        for assunto, assunto_total in assunto_counter.most_common(5):
            decisions_counter = org_assunto_decision.get((org_name, assunto), Counter())
            denied_subject = sum(
                int(value)
                for key, value in decisions_counter.items()
                if key in DECISION_RESTRICTED
            )
            top_decisions = [
                {
                    "decision": decision,
                    "count": int(count),
                    "share_in_subject": (int(count) / assunto_total) if assunto_total else 0.0,
                }
                for decision, count in decisions_counter.most_common(3)
            ]

            top_subjects.append(
                {
                    "subject": assunto,
                    "total_requests": int(assunto_total),
                    "restricted_total": int(denied_subject),
                    "restricted_rate": (denied_subject / assunto_total) if assunto_total else 0.0,
                    "top_decisions": top_decisions,
                }
            )

        org_profiles[org_name] = {
            "org": org_name,
            "summary": org_row,
            "top_subjects": top_subjects,
            "top_decisions": [
                {
                    "decision": decision,
                    "count": int(count),
                    "share_in_org": (int(count) / org_row["total_requests"])
                    if org_row["total_requests"]
                    else 0.0,
                }
                for decision, count in org_decisions.get(org_name, Counter()).most_common(5)
            ],
        }

    personal_series = [
        {
            "year": item["year"],
            "count": item["personal_restricted_total"],
            "share_in_restricted": item["personal_share_in_restricted"],
        }
        for item in yearly_series
    ]

    personal_top_orgs = sorted(
        [
            {
                **row,
                "share_in_org_restricted": (
                    row["personal_restricted_total"] / row["restricted_total"]
                    if row["restricted_total"]
                    else 0.0
                ),
            }
            for row in org_stats.values()
            if row["personal_restricted_total"] > 0
        ],
        key=lambda row: (row["personal_restricted_total"], row["restricted_total"]),
        reverse=True,
    )[:15]

    report = {
        "generated_at": now_iso(),
        "source": {
            "portal_url": DOWNLOAD_PORTAL_URL,
            "download_url_template": DOWNLOAD_URL_TEMPLATE,
            "years_covered": [item["year"] for item in yearly_series],
        },
        "overall": {
            "total_requests": int(overall_total),
            "denied_total": int(overall_denied),
            "restricted_total": int(overall_restricted),
            "personal_restricted_total": int(overall_personal),
            "denied_rate": (overall_denied / overall_total) if overall_total else 0.0,
            "restricted_rate": (overall_restricted / overall_total) if overall_total else 0.0,
            "personal_share_in_restricted": (
                (overall_personal / overall_restricted) if overall_restricted else 0.0
            ),
        },
        "series": yearly_series,
        "decision_series": decision_series,
        "reason_series": reason_series,
        "top_reasons": [
            {"reason": reason, "count": int(count)}
            for reason, count in global_reasons.most_common(12)
        ],
        "decision_totals": [
            {"decision": decision, "count": int(count)}
            for decision, count in global_decisions.most_common()
        ],
        "org_ranking": org_by_denied[:40],
        "org_lowest_denial_high_volume": org_by_low_rate[:12],
        "org_top5_plus_pf": top5_plus_pf,
        "org_profiles": org_profiles,
        "personal_info": {
            "series": personal_series,
            "top_orgs": personal_top_orgs,
        },
    }

    metadata = {
        "updated_at": report["generated_at"],
        "years_covered": report["source"]["years_covered"],
        "overall": report["overall"],
        "source": report["source"],
    }

    return report, metadata


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def run(force=False, start_year=START_YEAR_DEFAULT, end_year=None):
    ensure_dirs()

    current_year = dt.date.today().year
    final_end_year = end_year if end_year is not None else current_year

    years = list(range(int(start_year), int(final_end_year) + 1))
    print(f"[info] anos avaliados: {years[0]}-{years[-1]}")

    year_payloads = []
    refreshed = 0

    for year in years:
        payload, was_refreshed = maybe_process_year(year, force=force)
        if payload is None:
            continue
        year_payloads.append(payload)
        if was_refreshed:
            refreshed += 1

    if not year_payloads:
        raise RuntimeError("Nenhum ano disponível para gerar o painel LAI.")

    report, metadata = build_report(year_payloads)
    metadata["years_refreshed_in_run"] = refreshed
    metadata["build_notes"] = (
        "Cache anual incremental: anos anteriores ficam congelados; "
        "ano corrente é reprocessado a cada execução."
    )

    write_json(REPORT_FILE, report)
    write_json(METADATA_FILE, metadata)

    print(f"[ok] relatório salvo em: {REPORT_FILE}")
    print(f"[ok] metadata salva em: {METADATA_FILE}")
    print(f"[ok] anos processados/reutilizados: {len(year_payloads)}")
    print(f"[ok] anos atualizados nesta execução: {refreshed}")


def main():
    parser = argparse.ArgumentParser(
        description="Build incremental da dashboard LAI para GitHub Pages."
    )
    parser.add_argument("--force", action="store_true", help="Reprocessa todos os anos.")
    parser.add_argument(
        "--start-year",
        type=int,
        default=START_YEAR_DEFAULT,
        help=f"Ano inicial (padrão: {START_YEAR_DEFAULT}).",
    )
    parser.add_argument(
        "--end-year",
        type=int,
        default=None,
        help="Ano final (padrão: ano atual).",
    )

    args = parser.parse_args()
    run(force=args.force, start_year=args.start_year, end_year=args.end_year)


if __name__ == "__main__":
    main()

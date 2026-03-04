#!/usr/bin/env python3
"""Build data files for the Basometro dashboard.

This script uses annual CSV dumps from the Camara dos Deputados open data portal
(votacoes, votacoesVotos, votacoesOrientacoes), which remain available in 2026.

Outputs (under basometro-dashboard/data):
- report_data.json
- metadata.json
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
import shutil
import tempfile
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)

BASE_DOWNLOAD_URL = "https://dadosabertos.camara.leg.br/arquivos"

ROOT_DIR = Path(__file__).resolve().parents[1]
DASH_DIR = ROOT_DIR / "basometro-dashboard"
DATA_DIR = DASH_DIR / "data"
REPORT_FILE = DATA_DIR / "report_data.json"
META_FILE = DATA_DIR / "metadata.json"

# Government periods used in the dashboard.
# End dates are inclusive.
GOVERNMENT_PERIODS = [
    {"id": "lula1", "label": "Lula 1", "start": "2003-01-01", "end": "2006-12-31"},
    {"id": "lula2", "label": "Lula 2", "start": "2007-01-01", "end": "2010-12-31"},
    {"id": "dilma1", "label": "Dilma 1", "start": "2011-01-01", "end": "2014-12-31"},
    {"id": "dilma2", "label": "Dilma 2", "start": "2015-01-01", "end": "2016-05-12"},
    {"id": "temer", "label": "Temer", "start": "2016-05-13", "end": "2018-12-31"},
    {"id": "bolsonaro", "label": "Bolsonaro", "start": "2019-01-01", "end": "2022-12-31"},
    {"id": "lula3", "label": "Lula 3", "start": "2023-01-01", "end": None},
]

VOTE_NORMALIZATION = {
    "SIM": "Sim",
    "NÃO": "Não",
    "NAO": "Não",
    "ABSTENÇÃO": "Abstenção",
    "ABSTENCAO": "Abstenção",
    "OBSTRUÇÃO": "Obstrução",
    "OBSTRUCAO": "Obstrução",
    "ARTIGO 17": "Artigo 17",
    "ART. 17": "Artigo 17",
    "ART 17": "Artigo 17",
    "ART.17": "Artigo 17",
}


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def text(value: object) -> str:
    if value is None:
        return ""
    return str(value).replace("\ufeff", "").strip()


def normalize_vote(value: object) -> str:
    raw = text(value)
    if not raw:
        return ""
    key = raw.upper()
    key = key.replace("Á", "A").replace("À", "A").replace("Â", "A").replace("Ã", "A")
    key = key.replace("É", "E").replace("Ê", "E")
    key = key.replace("Í", "I")
    key = key.replace("Ó", "O").replace("Ô", "O").replace("Õ", "O")
    key = key.replace("Ú", "U")
    key = re.sub(r"\s+", " ", key).strip()
    return VOTE_NORMALIZATION.get(key, raw)


def parse_date(value: str) -> dt.date | None:
    try:
        return dt.datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def government_for_date(date_iso: str) -> tuple[str, str]:
    date_obj = parse_date(date_iso)
    if date_obj is None:
        return "outro", "Outro"

    for gov in GOVERNMENT_PERIODS:
        start = parse_date(gov["start"])
        end = parse_date(gov["end"]) if gov["end"] else None
        if start and date_obj >= start and (end is None or date_obj <= end):
            return gov["id"], gov["label"]

    return "outro", "Outro"


def pct(part: int, whole: int) -> float:
    if whole <= 0:
        return 0.0
    return round((part / whole) * 100, 2)


def download_file(url: str, target: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=300) as response:
        with target.open("wb") as out:
            shutil.copyfileobj(response, out, length=1024 * 1024)


def csv_reader(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh, delimiter=";")
        for row in reader:
            yield row


def download_year_files(year: int, tmp_dir: Path) -> dict[str, Path]:
    paths = {
        "votacoes": tmp_dir / f"votacoes-{year}.csv",
        "votos": tmp_dir / f"votacoesVotos-{year}.csv",
        "orientacoes": tmp_dir / f"votacoesOrientacoes-{year}.csv",
    }

    urls = {
        "votacoes": f"{BASE_DOWNLOAD_URL}/votacoes/csv/votacoes-{year}.csv",
        "votos": f"{BASE_DOWNLOAD_URL}/votacoesVotos/csv/votacoesVotos-{year}.csv",
        "orientacoes": f"{BASE_DOWNLOAD_URL}/votacoesOrientacoes/csv/votacoesOrientacoes-{year}.csv",
    }

    for key, url in urls.items():
        download_file(url, paths[key])

    return paths


def aggregate_year(year: int, files: dict[str, Path]) -> dict:
    votacoes_info: dict[str, dict] = {}

    for row in csv_reader(files["votacoes"]):
        votacao_id = text(row.get("id"))
        if not votacao_id:
            continue

        # Keep only plenary votes from Chamber.
        if text(row.get("idOrgao")) != "180":
            continue

        data_iso = text(row.get("data"))
        datetime_iso = text(row.get("dataHoraRegistro"))
        descricao = text(row.get("descricao"))
        aprovacao = text(row.get("aprovacao"))

        gov_id, gov_label = government_for_date(data_iso)
        votacoes_info[votacao_id] = {
            "id": votacao_id,
            "date": data_iso,
            "datetime": datetime_iso,
            "description": descricao,
            "approval": aprovacao,
            "government_id": gov_id,
            "government_label": gov_label,
        }

    orientacao_governo: dict[str, str] = {}
    for row in csv_reader(files["orientacoes"]):
        votacao_id = text(row.get("idVotacao"))
        if votacao_id not in votacoes_info:
            continue

        bancada = text(row.get("siglaBancada")).lower()
        if bancada != "governo":
            continue

        orient = normalize_vote(row.get("orientacao"))
        if not orient:
            continue

        orientacao_governo[votacao_id] = orient

    valid_vote_ids = set(votacoes_info.keys()) & set(orientacao_governo.keys())

    vote_level = {}
    seen_deputy_in_vote = defaultdict(set)

    for row in csv_reader(files["votos"]):
        votacao_id = text(row.get("idVotacao"))
        if votacao_id not in valid_vote_ids:
            continue

        vote_type = normalize_vote(row.get("voto"))
        if not vote_type:
            continue

        deputy_id = text(row.get("deputado_id"))
        deputy_name = text(row.get("deputado_nome"))
        deputy_key = deputy_id or f"name::{deputy_name}"
        if not deputy_key:
            continue

        if deputy_key in seen_deputy_in_vote[votacao_id]:
            continue
        seen_deputy_in_vote[votacao_id].add(deputy_key)

        party = text(row.get("deputado_siglaPartido")) or "Sem partido"
        uf = text(row.get("deputado_siglaUf")) or "--"

        orient = orientacao_governo[votacao_id]
        is_pro = vote_type == orient

        entry = vote_level.setdefault(
            votacao_id,
            {
                "pro": 0,
                "anti": 0,
                "total": 0,
                "deputies": {},
                "parties": {},
            },
        )

        entry["total"] += 1
        if is_pro:
            entry["pro"] += 1
        else:
            entry["anti"] += 1

        dep = entry["deputies"].setdefault(
            deputy_key,
            {
                "deputy_id": deputy_id,
                "name": deputy_name,
                "party": party,
                "uf": uf,
                "pro": 0,
                "anti": 0,
                "total": 0,
            },
        )
        dep["total"] += 1
        dep["pro"] += int(is_pro)
        dep["anti"] += int(not is_pro)
        # Keep the newest observed party/UF for display consistency.
        dep["party"] = party
        dep["uf"] = uf

        party_row = entry["parties"].setdefault(party, {"pro": 0, "anti": 0, "total": 0})
        party_row["total"] += 1
        party_row["pro"] += int(is_pro)
        party_row["anti"] += int(not is_pro)

    monthly = defaultdict(lambda: {"pro": 0, "anti": 0, "total": 0, "votacoes": 0, "government_id": "", "government_label": ""})
    yearly = defaultdict(lambda: {"pro": 0, "anti": 0, "total": 0, "votacoes": 0})

    government_totals = defaultdict(lambda: {"pro": 0, "anti": 0, "total": 0, "votacoes": 0})
    party_totals = defaultdict(lambda: {"pro": 0, "anti": 0, "total": 0, "by_government": defaultdict(lambda: {"pro": 0, "anti": 0, "total": 0})})
    deputy_totals = {}

    vote_summaries = []

    for votacao_id, counters in vote_level.items():
        info = votacoes_info[votacao_id]
        data_iso = info["date"]
        if not data_iso:
            continue

        total = counters["total"]
        if total <= 0:
            continue

        pro = counters["pro"]
        anti = counters["anti"]

        month_key = data_iso[:7]
        year_key = data_iso[:4]

        month_row = monthly[month_key]
        month_row["pro"] += pro
        month_row["anti"] += anti
        month_row["total"] += total
        month_row["votacoes"] += 1
        month_row["government_id"] = info["government_id"]
        month_row["government_label"] = info["government_label"]

        yr = yearly[year_key]
        yr["pro"] += pro
        yr["anti"] += anti
        yr["total"] += total
        yr["votacoes"] += 1

        gov = government_totals[info["government_id"]]
        gov["pro"] += pro
        gov["anti"] += anti
        gov["total"] += total
        gov["votacoes"] += 1

        for party, pstats in counters["parties"].items():
            p = party_totals[party]
            p["pro"] += pstats["pro"]
            p["anti"] += pstats["anti"]
            p["total"] += pstats["total"]
            pg = p["by_government"][info["government_id"]]
            pg["pro"] += pstats["pro"]
            pg["anti"] += pstats["anti"]
            pg["total"] += pstats["total"]

        for deputy_key, dstats in counters["deputies"].items():
            dep = deputy_totals.setdefault(
                deputy_key,
                {
                    "deputy_id": dstats["deputy_id"],
                    "name": dstats["name"],
                    "party": dstats["party"],
                    "uf": dstats["uf"],
                    "pro": 0,
                    "anti": 0,
                    "total": 0,
                    "by_government": defaultdict(lambda: {"pro": 0, "anti": 0, "total": 0}),
                },
            )
            dep["pro"] += dstats["pro"]
            dep["anti"] += dstats["anti"]
            dep["total"] += dstats["total"]
            dep["party"] = dstats["party"]
            dep["uf"] = dstats["uf"]
            dg = dep["by_government"][info["government_id"]]
            dg["pro"] += dstats["pro"]
            dg["anti"] += dstats["anti"]
            dg["total"] += dstats["total"]

        vote_summaries.append(
            {
                "id": votacao_id,
                "date": data_iso,
                "datetime": info["datetime"],
                "description": info["description"],
                "government_id": info["government_id"],
                "government_label": info["government_label"],
                "gov_orientation": orientacao_governo[votacao_id],
                "approval": info["approval"],
                "pro_votes": pro,
                "anti_votes": anti,
                "total_votes": total,
                "alignment_pct": pct(pro, total),
            }
        )

    def serialize_party_totals(raw_dict):
        out = {}
        for party, stats in raw_dict.items():
            out[party] = {
                "pro": stats["pro"],
                "anti": stats["anti"],
                "total": stats["total"],
                "alignment_pct": pct(stats["pro"], stats["total"]),
                "by_government": {
                    gov_id: {
                        "pro": gstats["pro"],
                        "anti": gstats["anti"],
                        "total": gstats["total"],
                        "alignment_pct": pct(gstats["pro"], gstats["total"]),
                    }
                    for gov_id, gstats in stats["by_government"].items()
                },
            }
        return out

    def serialize_deputy_totals(raw_dict):
        out = {}
        for key, stats in raw_dict.items():
            out[key] = {
                "deputy_id": stats["deputy_id"],
                "name": stats["name"],
                "party": stats["party"],
                "uf": stats["uf"],
                "pro": stats["pro"],
                "anti": stats["anti"],
                "total": stats["total"],
                "alignment_pct": pct(stats["pro"], stats["total"]),
                "by_government": {
                    gov_id: {
                        "pro": gstats["pro"],
                        "anti": gstats["anti"],
                        "total": gstats["total"],
                        "alignment_pct": pct(gstats["pro"], gstats["total"]),
                    }
                    for gov_id, gstats in stats["by_government"].items()
                },
            }
        return out

    return {
        "year": year,
        "monthly": {
            month: {
                "pro": stats["pro"],
                "anti": stats["anti"],
                "total": stats["total"],
                "votacoes": stats["votacoes"],
                "alignment_pct": pct(stats["pro"], stats["total"]),
                "government_id": stats["government_id"],
                "government_label": stats["government_label"],
            }
            for month, stats in monthly.items()
        },
        "yearly": {
            key: {
                "pro": stats["pro"],
                "anti": stats["anti"],
                "total": stats["total"],
                "votacoes": stats["votacoes"],
                "alignment_pct": pct(stats["pro"], stats["total"]),
            }
            for key, stats in yearly.items()
        },
        "government_totals": {
            gov_id: {
                "pro": stats["pro"],
                "anti": stats["anti"],
                "total": stats["total"],
                "votacoes": stats["votacoes"],
                "alignment_pct": pct(stats["pro"], stats["total"]),
            }
            for gov_id, stats in government_totals.items()
        },
        "party_totals": serialize_party_totals(party_totals),
        "deputy_totals": serialize_deputy_totals(deputy_totals),
        "vote_summaries": vote_summaries,
        "counts": {
            "votacoes_plenario": len(votacoes_info),
            "votacoes_com_orientacao_governo": len(valid_vote_ids),
            "votacoes_nominais_validas": len(vote_summaries),
        },
    }


def merge_years(year_payloads: list[dict], start_year: int, end_year: int) -> dict:
    monthly = defaultdict(lambda: {"pro": 0, "anti": 0, "total": 0, "votacoes": 0, "government_id": "", "government_label": ""})
    yearly = defaultdict(lambda: {"pro": 0, "anti": 0, "total": 0, "votacoes": 0})
    government_totals = defaultdict(lambda: {"pro": 0, "anti": 0, "total": 0, "votacoes": 0})

    party_totals = defaultdict(lambda: {"pro": 0, "anti": 0, "total": 0, "by_government": defaultdict(lambda: {"pro": 0, "anti": 0, "total": 0})})
    deputy_totals = {}

    vote_summaries = []
    raw_counts = defaultdict(int)

    for payload in year_payloads:
        for month, stats in payload["monthly"].items():
            row = monthly[month]
            row["pro"] += stats["pro"]
            row["anti"] += stats["anti"]
            row["total"] += stats["total"]
            row["votacoes"] += stats["votacoes"]
            row["government_id"] = stats["government_id"]
            row["government_label"] = stats["government_label"]

        for year_key, stats in payload["yearly"].items():
            row = yearly[year_key]
            row["pro"] += stats["pro"]
            row["anti"] += stats["anti"]
            row["total"] += stats["total"]
            row["votacoes"] += stats["votacoes"]

        for gov_id, stats in payload["government_totals"].items():
            row = government_totals[gov_id]
            row["pro"] += stats["pro"]
            row["anti"] += stats["anti"]
            row["total"] += stats["total"]
            row["votacoes"] += stats["votacoes"]

        for party, stats in payload["party_totals"].items():
            p = party_totals[party]
            p["pro"] += stats["pro"]
            p["anti"] += stats["anti"]
            p["total"] += stats["total"]
            for gov_id, gstats in stats.get("by_government", {}).items():
                pg = p["by_government"][gov_id]
                pg["pro"] += gstats["pro"]
                pg["anti"] += gstats["anti"]
                pg["total"] += gstats["total"]

        for dep_key, stats in payload["deputy_totals"].items():
            dep = deputy_totals.setdefault(
                dep_key,
                {
                    "deputy_id": stats["deputy_id"],
                    "name": stats["name"],
                    "party": stats["party"],
                    "uf": stats["uf"],
                    "pro": 0,
                    "anti": 0,
                    "total": 0,
                    "by_government": defaultdict(lambda: {"pro": 0, "anti": 0, "total": 0}),
                },
            )
            dep["pro"] += stats["pro"]
            dep["anti"] += stats["anti"]
            dep["total"] += stats["total"]
            dep["party"] = stats["party"]
            dep["uf"] = stats["uf"]
            for gov_id, gstats in stats.get("by_government", {}).items():
                dg = dep["by_government"][gov_id]
                dg["pro"] += gstats["pro"]
                dg["anti"] += gstats["anti"]
                dg["total"] += gstats["total"]

        vote_summaries.extend(payload["vote_summaries"])

        for key, val in payload.get("counts", {}).items():
            raw_counts[key] += int(val)

    monthly_series = []
    for month in sorted(monthly.keys()):
        stats = monthly[month]
        monthly_series.append(
            {
                "month": month,
                "pro_votes": stats["pro"],
                "anti_votes": stats["anti"],
                "total_votes": stats["total"],
                "votacoes": stats["votacoes"],
                "alignment_pct": pct(stats["pro"], stats["total"]),
                "government_id": stats["government_id"],
                "government_label": stats["government_label"],
            }
        )

    yearly_series = []
    for year_key in sorted(yearly.keys()):
        stats = yearly[year_key]
        yearly_series.append(
            {
                "year": year_key,
                "pro_votes": stats["pro"],
                "anti_votes": stats["anti"],
                "total_votes": stats["total"],
                "votacoes": stats["votacoes"],
                "alignment_pct": pct(stats["pro"], stats["total"]),
            }
        )

    government_series = []
    for gov in GOVERNMENT_PERIODS:
        gov_id = gov["id"]
        stats = government_totals.get(gov_id)
        if not stats:
            continue
        government_series.append(
            {
                "id": gov_id,
                "label": gov["label"],
                "start": gov["start"],
                "end": gov["end"],
                "pro_votes": stats["pro"],
                "anti_votes": stats["anti"],
                "total_votes": stats["total"],
                "votacoes": stats["votacoes"],
                "alignment_pct": pct(stats["pro"], stats["total"]),
            }
        )

    party_ranking = []
    for party, stats in party_totals.items():
        party_ranking.append(
            {
                "party": party,
                "pro_votes": stats["pro"],
                "anti_votes": stats["anti"],
                "total_votes": stats["total"],
                "alignment_pct": pct(stats["pro"], stats["total"]),
                "by_government": {
                    gov_id: {
                        "pro_votes": gstats["pro"],
                        "anti_votes": gstats["anti"],
                        "total_votes": gstats["total"],
                        "alignment_pct": pct(gstats["pro"], gstats["total"]),
                    }
                    for gov_id, gstats in stats["by_government"].items()
                },
            }
        )
    party_ranking.sort(key=lambda item: item["total_votes"], reverse=True)

    deputy_ranking = []
    for dep in deputy_totals.values():
        deputy_ranking.append(
            {
                "deputy_id": dep["deputy_id"],
                "name": dep["name"],
                "party": dep["party"],
                "uf": dep["uf"],
                "pro_votes": dep["pro"],
                "anti_votes": dep["anti"],
                "total_votes": dep["total"],
                "alignment_pct": pct(dep["pro"], dep["total"]),
                "by_government": {
                    gov_id: {
                        "pro_votes": gstats["pro"],
                        "anti_votes": gstats["anti"],
                        "total_votes": gstats["total"],
                        "alignment_pct": pct(gstats["pro"], gstats["total"]),
                    }
                    for gov_id, gstats in dep["by_government"].items()
                },
            }
        )
    deputy_ranking.sort(key=lambda item: item["total_votes"], reverse=True)

    vote_summaries.sort(key=lambda item: (item["date"], item["datetime"], item["id"]))
    recent_votes = list(reversed(vote_summaries))[:80]

    total_pro = sum(item["pro_votes"] for item in government_series)
    total_anti = sum(item["anti_votes"] for item in government_series)
    total_votes = total_pro + total_anti

    summary = {
        "pro_votes": total_pro,
        "anti_votes": total_anti,
        "total_votes": total_votes,
        "alignment_pct": pct(total_pro, total_votes),
        "votacoes_validas": sum(item["votacoes"] for item in government_series),
        "partidos_com_voto": sum(1 for item in party_ranking if item["total_votes"] > 0),
        "deputados_com_voto": sum(1 for item in deputy_ranking if item["total_votes"] > 0),
    }

    return {
        "metadata": {
            "generated_at": now_iso(),
            "source": "Camara dos Deputados - dadosabertos (CSV anual)",
            "source_base_url": BASE_DOWNLOAD_URL,
            "start_year": start_year,
            "end_year": end_year,
            "raw_counts": raw_counts,
        },
        "governments": [
            {"id": gov["id"], "label": gov["label"], "start": gov["start"], "end": gov["end"]}
            for gov in GOVERNMENT_PERIODS
            if any(gs["id"] == gov["id"] for gs in government_series)
        ],
        "summary": summary,
        "government_series": government_series,
        "monthly_series": monthly_series,
        "yearly_series": yearly_series,
        "party_ranking": party_ranking,
        "deputy_ranking": deputy_ranking,
        "recent_votes": recent_votes,
        "methodology": {
            "title": "Metodologia",
            "items": [
                "Consideramos apenas votacoes nominais de plenario (idOrgao=180) com orientacao explicita da bancada 'Governo'.",
                "Um voto e contado como pro-governo apenas quando o voto do deputado e igual a orientacao do Governo na votacao.",
                "Todos os demais votos validos (incluindo nao, abstencao, obstrucao e artigo 17) entram como contra-governo, mantendo o criterio historico do Basometro.",
                "Votacoes sem orientacao do Governo ou sem votos nominais registrados sao descartadas.",
            ],
            "notes": [
                "Em 2026, a Camara mantem os arquivos anuais de votacoes, orientacoes e votos em formato CSV.",
                "O endpoint de API v2 para listagem de votacoes tem limite de janela de 3 meses; por estabilidade, esta versao usa os dumps anuais oficiais.",
                "Pode haver revisoes retroativas na base oficial; por isso o painel e reprocessado periodicamente.",
            ],
        },
    }


def write_outputs(payload: dict) -> None:
    REPORT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    meta = {
        "updated_at": payload["metadata"]["generated_at"],
        "source": payload["metadata"]["source"],
        "start_year": payload["metadata"]["start_year"],
        "end_year": payload["metadata"]["end_year"],
        "summary": payload["summary"],
    }
    META_FILE.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def build_dataset(start_year: int, end_year: int) -> dict:
    year_payloads = []

    with tempfile.TemporaryDirectory(prefix="basometro-build-") as tmp:
        tmp_dir = Path(tmp)

        for year in range(start_year, end_year + 1):
            print(f"[basometro] Processando ano {year}...")
            files = download_year_files(year, tmp_dir)
            year_payload = aggregate_year(year, files)
            year_payloads.append(year_payload)

    return merge_years(year_payloads, start_year, end_year)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Basometro dashboard dataset")
    parser.add_argument("--start-year", type=int, default=2019, help="Primeiro ano da serie historica (padrao: 2019)")
    parser.add_argument(
        "--end-year",
        type=int,
        default=dt.date.today().year,
        help="Ultimo ano da serie historica (padrao: ano atual)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.start_year > args.end_year:
        raise SystemExit("--start-year nao pode ser maior que --end-year")

    ensure_dirs()

    payload = build_dataset(start_year=args.start_year, end_year=args.end_year)
    write_outputs(payload)

    summary = payload["summary"]
    print(
        "[basometro] Concluido:",
        f"votacoes={summary['votacoes_validas']}",
        f"votos={summary['total_votes']}",
        f"alinhamento={summary['alignment_pct']}%",
    )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Pipeline de dados: Planos de Governo – Eleições Municipais 2024
===============================================================
Baixa os ZIPs do TSE, extrai texto dos PDFs, gera relatório de integridade,
cruza com dados de candidatos, faz análise textual e exporta JSONs para o
dashboard estático em planos-governo-dashboard/.

Dependências:
    pip install requests pandas pdfplumber tqdm

Uso:
    python scripts/build_planos_governo_data.py
"""

import os
import re
import json
import math
import zipfile
import unicodedata
from pathlib import Path
from datetime import datetime
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import pandas as pd

try:
    import pdfplumber
except ImportError:
    raise SystemExit("Instale pdfplumber: pip install pdfplumber")

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False
    class tqdm:
        def __init__(self, iterable=None, **kw): self._it = iterable or []
        def __iter__(self): return iter(self._it)
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def update(self, n=1): pass

# ── Configuração ──────────────────────────────────────────────────────────────

BASE_CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele"
CAND_URL = f"{BASE_CDN}/consulta_cand/consulta_cand_2024.zip"
PLAN_URL  = f"{BASE_CDN}/proposta_governo/proposta_governo_2024_{{}}.zip"

STATES = [
    "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA",
    "MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN",
    "RO","RR","RS","SC","SE","SP","TO",
]

ROOT     = Path(__file__).resolve().parent.parent
RAW_DIR  = ROOT / "data" / "planos_raw"
TXT_DIR  = ROOT / "data" / "planos_txt"
OUT_DIR  = ROOT / "planos-governo-dashboard" / "data"

for d in [RAW_DIR, TXT_DIR, OUT_DIR,
          OUT_DIR / "states", OUT_DIR / "candidates", OUT_DIR / "themes"]:
    d.mkdir(parents=True, exist_ok=True)

# ── Stop words (PT-BR) ────────────────────────────────────────────────────────

STOP = set("""
a ao aos aquela aquelas aquele aqueles aqui as até com como da das de dela
delas dele deles depois do dos e ela elas ele eles em entre era eram esse
essa esses essas este esta estes estas eu já lhe lhes lo los mais mas me
mesmo meu meus minha minhas muito na nas no nos o os ou para pela pelas
pelo pelos por qual quando que quem se seja sem ser seu seus sua suas
também te teu teus tinha tu tua tuas um uma uns umas você vocês nos é
foi foram ter há tem têm só mas não sobre ainda assim através bem cada
caso cidade deve devem pode podem todas todos todo toda forma ações ação
além área dentro desde fazer junto maior menos mesmos mesmas neste nesta
nestes nestas nosso nossa nossos nossas outros outras outro outra parte
poder primeiro primeira projeto proposta pública público públicos públicas
sendo suas seus tendo todas todos sendo mediante mediante conforme segundo
segundo através quanto quais quais cujo cuja cujos cujas onde quando embora
porém entretanto todavia contudo além disso portanto assim sendo dessa
desse deste desta nessa nesse neste desta dele dela
""".split())

# ── Temas pré-definidos ───────────────────────────────────────────────────────

THEMES = {
    "saúde": [
        "saúde","hospital","ubs","sus","médico","enfermagem","posto de saúde",
        "vacina","urgência","emergência","atenção básica","agente de saúde",
    ],
    "educação": [
        "educação","escola","ensino","professor","aluno","creche","infantil",
        "fundamental","médio","evasão escolar","merenda","alfabetização",
    ],
    "saneamento básico": [
        "saneamento","esgoto","água","abastecimento","tratamento de água",
        "coleta de lixo","drenagem","córrego","fossas","pluvial",
    ],
    "segurança pública": [
        "segurança","violência","crime","policial","câmera","guarda municipal",
        "iluminação","monitoramento","patrulhamento","ocorrência",
    ],
    "infraestrutura": [
        "infraestrutura","asfalto","pavimentação","calçada","estrada","ponte",
        "obras","viaduto","recape","bueiro","drenagem urbana",
    ],
    "meio ambiente": [
        "meio ambiente","ambiental","reciclagem","lixo","resíduos","floresta",
        "arborização","sustentável","rio","mata ciliar","desmatamento",
    ],
    "emprego e renda": [
        "emprego","trabalho","renda","economia","empreendedorismo","geração de emprego",
        "microempreendedor","mei","qualificação profissional","capacitação",
    ],
    "habitação": [
        "habitação","moradia","casa","regularização fundiária","sem teto",
        "aluguel social","conjuntos habitacionais","lotes","terrenos",
    ],
    "transporte e mobilidade": [
        "transporte","ônibus","mobilidade","trânsito","ciclofaixa","bicicleta",
        "van","lotação","mototáxi","calçada acessível","semáforo",
    ],
    "assistência social": [
        "assistência social","cras","creas","vulnerabilidade","família",
        "bolsa família","benefício","proteção social","cesta básica","abrigo",
    ],
    "cultura, esporte e lazer": [
        "cultura","esporte","lazer","biblioteca","museu","teatro","quadra",
        "praça","academia ao ar livre","festival","arena","poliesportivo",
    ],
    "tecnologia e inovação": [
        "tecnologia","digital","inovação","startup","conectividade","wi-fi",
        "internet","smart city","governo digital","app municipal",
    ],
    "agricultura e rural": [
        "agricultura","agropecuária","produtor rural","campo","cooperativa",
        "orgânico","irrigação","extensão rural","feira","agroindústria",
    ],
    "turismo": [
        "turismo","turistas","hotel","pousada","patrimônio histórico",
        "atrativo","roteiro turístico","parque","ecoturismo",
    ],
    "mulher": [
        "mulher","feminino","feminicídio","gênero","machismo",
        "violência doméstica","maria da penha","casa da mulher","equidade",
    ],
    "criança e adolescente": [
        "criança","adolescente","menor","proteção","eca","conselho tutelar",
        "creche","brinquedoteca","reforço escolar","vulnerabilidade infantil",
    ],
    "idoso": [
        "idoso","terceira idade","envelhecimento","longevidade",
        "cuidado ao idoso","aposentado","centro de convivência","ilpi",
    ],
    "pessoa com deficiência": [
        "deficiência","pcd","acessibilidade","inclusão","cadeirante",
        "libras","braille","rampa","adaptação","rede de apoio",
    ],
    "LGBTQIA+": [
        "lgbtqia","lgbt","diversidade","homofobia","orientação sexual",
        "transexual","transfobia","direitos lgbtqia",
    ],
    "transparência e ética": [
        "transparência","corrupção","ética","accountability",
        "prestação de contas","portal da transparência","combate à corrupção",
    ],
    "finanças públicas": [
        "finanças","orçamento","fiscal","tributo","iptu","iss",
        "dívida pública","responsabilidade fiscal","arrecadação",
    ],
    "saúde mental": [
        "saúde mental","caps","psicológico","psiquiátrico","depressão",
        "transtorno","bem-estar mental","ansiedade","suicídio",
    ],
    "racismo e igualdade racial": [
        "racismo","racial","negro","afro","quilombola","discriminação racial",
        "igualdade racial","cotas","comunidades quilombolas",
    ],
    "povos indígenas": [
        "indígena","índio","aldeia","terra indígena","demarcação",
        "povos originários","cultura indígena",
    ],
    "energia e iluminação": [
        "energia solar","renovável","iluminação pública","led",
        "energia limpa","eficiência energética","painel solar",
    ],
    "combate às drogas": [
        "drogas","dependência química","tratamento","prevenção","crack",
        "álcool","comunidade terapêutica","caps ad","vício",
    ],
    "gestão pública": [
        "gestão","eficiência","modernização","desburocratização",
        "servidor público","concurso","reforma administrativa","planejamento",
    ],
    "segurança alimentar": [
        "segurança alimentar","fome","nutricional","banco de alimentos",
        "restaurante popular","horta","alimentação saudável",
    ],
    "regularização fundiária": [
        "regularização fundiária","título","propriedade","documentação",
        "usucapião","lote","habitação irregular","favela",
    ],
    "trabalho infantil": [
        "trabalho infantil","exploração infantil","menor trabalhando",
        "erradicação do trabalho infantil",
    ],
}


# ── Utilitários ───────────────────────────────────────────────────────────────

def normalize(text: str) -> str:
    """Remove acentos, lowercase – para busca sem acento."""
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()


def download(url: str, dest: Path, label: str = "") -> bool:
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  ✓ já baixado: {dest.name}")
        return True
    print(f"  ↓ {label or url}")
    try:
        r = requests.get(url, timeout=120, stream=True)
        r.raise_for_status()
        with open(dest, "wb") as fh:
            for chunk in r.iter_content(65536):
                fh.write(chunk)
        sz = dest.stat().st_size
        print(f"  ✓ {dest.name}  ({sz/1e6:.1f} MB)")
        return True
    except Exception as exc:
        print(f"  ✗ falha {label}: {exc}")
        dest.unlink(missing_ok=True)
        return False


def pdf_to_text(pdf_bytes: bytes) -> str:
    """Extrai texto de bytes PDF. Retorna '' se falhar ou for apenas imagem."""
    tmp = RAW_DIR / "_tmp_extract.pdf"
    try:
        tmp.write_bytes(pdf_bytes)
        with pdfplumber.open(tmp) as pdf:
            pages = []
            for page in pdf.pages[:60]:
                t = page.extract_text()
                if t:
                    pages.append(t.strip())
            return "\n".join(pages)
    except Exception:
        return ""
    finally:
        tmp.unlink(missing_ok=True)


# ── 1. Candidatos ─────────────────────────────────────────────────────────────

def load_candidates():
    print("\n[1] Dados de candidatos...")
    zp = RAW_DIR / "consulta_cand_2024.zip"
    download(CAND_URL, zp, "candidatos 2024")

    csv_dir = RAW_DIR / "cand_csv"
    csv_dir.mkdir(exist_ok=True)
    with zipfile.ZipFile(zp) as zf:
        zf.extractall(csv_dir)

    # Arquivo BRASIL ou concatenação de UFs
    candidates_files = sorted(csv_dir.glob("consulta_cand_2024_BRASIL.csv"))
    if not candidates_files:
        candidates_files = sorted(csv_dir.glob("*.csv"))

    dfs = []
    for f in candidates_files:
        try:
            df = pd.read_csv(f, sep=";", encoding="latin1",
                             low_memory=False, on_bad_lines="skip")
            dfs.append(df)
        except Exception as e:
            print(f"  ✗ {f.name}: {e}")

    if not dfs:
        raise RuntimeError("Nenhum CSV de candidatos encontrado.")

    df = pd.concat(dfs, ignore_index=True)
    print(f"  Total de candidatos: {len(df):,}")

    # Normalizar colunas
    df.columns = [c.strip() for c in df.columns]

    # Prefeitos (CD_CARGO == 11) – se coluna existir
    if "CD_CARGO" in df.columns:
        prefeitos = df[df["CD_CARGO"] == 11].copy()
    elif "DS_CARGO" in df.columns:
        prefeitos = df[df["DS_CARGO"].str.upper().str.contains("PREFEITO", na=False)].copy()
    else:
        prefeitos = df.copy()

    print(f"  Candidatos a prefeito: {len(prefeitos):,}")
    return df, prefeitos


# ── 2. Download dos planos ────────────────────────────────────────────────────

def download_plans() -> dict:
    print("\n[2] Planos de governo por estado...")
    result = {}
    for uf in STATES:
        dest = RAW_DIR / f"proposta_governo_2024_{uf}.zip"
        ok = download(PLAN_URL.format(uf), dest, f"planos {uf}")
        result[uf] = dest if ok else None
    return result


# ── 3. Extração de texto ──────────────────────────────────────────────────────

def extract_texts(plan_zips: dict) -> tuple[dict, dict]:
    """
    Retorna:
        texts  – {sq_candidato: {"uf": UF, "text": str}}
        report – relatório de integridade
    """
    print("\n[3] Extraindo texto dos PDFs...")

    report = {
        "total_pdfs": 0, "with_text": 0,
        "empty_scan": 0, "failed": 0,
        "by_state": {},
    }
    texts: dict = {}

    for uf, zp in plan_zips.items():
        if zp is None or not zp.exists():
            report["by_state"][uf] = {"total": 0, "with_text": 0, "empty": 0, "failed": 0}
            continue

        uf_txt = TXT_DIR / uf
        uf_txt.mkdir(exist_ok=True)
        st = {"total": 0, "with_text": 0, "empty": 0, "failed": 0}

        try:
            with zipfile.ZipFile(zp) as zf:
                pdfs = [n for n in zf.namelist() if n.lower().endswith(".pdf")]
                print(f"  {uf}: {len(pdfs)} PDFs")

                for pdf_name in tqdm(pdfs, desc=f"  {uf}", leave=False):
                    sq = Path(pdf_name).stem.strip()
                    cache = uf_txt / f"{sq}.txt"
                    st["total"] += 1
                    report["total_pdfs"] += 1

                    if cache.exists():
                        text = cache.read_text("utf-8")
                    else:
                        try:
                            raw = zf.read(pdf_name)
                            text = pdf_to_text(raw)
                        except Exception as e:
                            print(f"    ✗ {sq}: {e}")
                            text = ""
                            st["failed"] += 1
                            report["failed"] += 1
                        cache.write_text(text, "utf-8")

                    if text.strip():
                        st["with_text"] += 1
                        report["with_text"] += 1
                    else:
                        st["empty"] += 1
                        report["empty_scan"] += 1

                    texts[sq] = {"uf": uf, "text": text}

        except Exception as e:
            print(f"  ✗ erro ao abrir {zp.name}: {e}")

        report["by_state"][uf] = st

    pct = report["with_text"] / max(1, report["total_pdfs"]) * 100
    print(f"\n  Resumo de extração:")
    print(f"    PDFs totais    : {report['total_pdfs']:,}")
    print(f"    Com texto      : {report['with_text']:,}  ({pct:.1f}%)")
    print(f"    Sem texto(scan): {report['empty_scan']:,}")
    print(f"    Com falha      : {report['failed']:,}")

    return texts, report


# ── 4. Cruzamento candidatos × textos ────────────────────────────────────────

def build_candidates(prefeitos: pd.DataFrame, texts: dict) -> list[dict]:
    print("\n[4] Cruzando candidatos com planos...")

    col = lambda name: name if name in prefeitos.columns else None

    cand_map: dict[str, dict] = {}
    for _, row in prefeitos.iterrows():
        sq = str(row.get("SQ_CANDIDATO", "")).strip()
        cand_map[sq] = {
            "id":           sq,
            "nome":         str(row.get("NM_CANDIDATO", "")).strip(),
            "nome_urna":    str(row.get("NM_URNA_CANDIDATO", "")).strip(),
            "partido":      str(row.get("SG_PARTIDO", "")).strip(),
            "uf":           str(row.get("SG_UF", "")).strip(),
            "municipio":    str(row.get("NM_MUNICIPIO", "")).strip(),
            "cd_municipio": str(row.get("CD_MUNICIPIO", "")).strip(),
            "situacao":     str(row.get("DS_SITUACAO_CANDIDATURA", "")).strip(),
            "has_plan":     False,
            "text_len":     0,
            "text":         "",
        }

    matched = 0
    for sq, info in texts.items():
        text = info["text"].strip()
        if sq in cand_map:
            if text:
                cand_map[sq]["has_plan"] = True
                cand_map[sq]["text_len"] = len(text)
                cand_map[sq]["text"]     = text
                matched += 1
        else:
            # PDF existe mas SQ não está no CSV de prefeitos (vereador / outra eleição)
            if text:
                cand_map[sq] = {
                    "id": sq, "nome": f"Candidato {sq}", "nome_urna": "",
                    "partido": "?", "uf": info["uf"], "municipio": "?",
                    "cd_municipio": "", "situacao": "", "has_plan": True,
                    "text_len": len(text), "text": text,
                }

    print(f"  Planos cruzados: {matched:,}")
    return list(cand_map.values())


# ── 5. Análise de temas ────────────────────────────────────────────────────────

def analyze_themes(candidates: list[dict]) -> dict:
    print("\n[5] Análise de temas...")
    theme_data: dict = {}

    for theme, keywords in THEMES.items():
        kw_norm = [normalize(k) for k in keywords]
        matches = []

        for c in candidates:
            text = c.get("text", "")
            if not text:
                continue
            tn = normalize(text)

            found_kw = []
            snippet   = ""
            for kw, kwn in zip(keywords, kw_norm):
                idx = tn.find(kwn)
                if idx != -1:
                    found_kw.append(kw)
                    if not snippet:
                        s = max(0, idx - 80)
                        e = min(len(text), idx + len(kw) + 150)
                        snippet = "…" + text[s:e].strip() + "…"

            if found_kw:
                matches.append({
                    "id":           c["id"],
                    "nome":         c.get("nome_urna") or c["nome"],
                    "partido":      c.get("partido", ""),
                    "municipio":    c.get("municipio", ""),
                    "uf":           c.get("uf", ""),
                    "kws":          found_kw[:4],
                    "snippet":      snippet[:300],
                })

        theme_data[theme] = {
            "name":       theme,
            "keywords":   keywords,
            "count":      len(matches),
            "candidates": matches,           # all – frontend paginates
        }
        print(f"  {theme:30s}: {len(matches):>6,} candidatos")

    return theme_data


# ── 6. Análise por partido ────────────────────────────────────────────────────

def analyze_parties(candidates: list[dict]) -> dict:
    print("\n[6] Análise por partido...")
    parties: dict = defaultdict(lambda: {
        "total": 0, "with_plan": 0,
        "themes": defaultdict(int), "cands": [],
    })

    for c in candidates:
        p = c.get("partido", "?") or "?"
        parties[p]["total"] += 1
        if c.get("has_plan"):
            parties[p]["with_plan"] += 1
            tn = normalize(c.get("text", ""))
            for theme, keywords in THEMES.items():
                for kw in keywords:
                    if normalize(kw) in tn:
                        parties[p]["themes"][theme] += 1
                        break
        parties[p]["cands"].append({
            "id": c["id"],
            "nome": c.get("nome_urna") or c["nome"],
            "municipio": c.get("municipio", ""),
            "uf": c.get("uf", ""),
        })

    result = {}
    for p, d in parties.items():
        result[p] = {
            "party":        p,
            "total":        d["total"],
            "with_plan":    d["with_plan"],
            "pct_plan":     round(d["with_plan"] / max(1, d["total"]) * 100, 1),
            "themes":       dict(d["themes"]),
            "cands_sample": d["cands"][:100],
        }

    print(f"  Partidos processados: {len(result)}")
    return result


# ── 7. Detecção de plágio ─────────────────────────────────────────────────────

def get_ngrams(text: str, n: int) -> list[str]:
    words = re.findall(r"[a-záéíóúàâêôãõüç]{3,}", text.lower())
    return [" ".join(words[i:i+n]) for i in range(len(words) - n + 1)]


def detect_plagiarism(candidates: list[dict],
                      ngram_size: int = 9,
                      min_copies: int = 3) -> dict:
    """
    Encontra trechos copiados entre planos de governo.
    ngram_size : tamanho da janela de palavras (padrão 9)
    min_copies : mínimo de candidatos distintos para ser plágio
    """
    print(f"\n[7] Detecção de plágio  (n-gram={ngram_size}, min_copies={min_copies})...")

    with_text = [c for c in candidates if c.get("text") and len(c["text"]) > 300]
    print(f"  Candidatos com texto: {len(with_text):,}")

    # ngram → {set of candidate IDs}
    ngram_index: dict[str, set] = defaultdict(set)

    for c in with_text:
        cid = c["id"]
        for ng in set(get_ngrams(c["text"], ngram_size)):
            ngram_index[ng].add(cid)

    # Filtrar pelo mínimo de cópias
    shared = {ng: ids for ng, ids in ngram_index.items() if len(ids) >= min_copies}
    print(f"  N-grams compartilhados: {len(shared):,}")

    # Ordenar por frequência (mais copiados primeiro)
    top = sorted(shared.items(), key=lambda x: len(x[1]), reverse=True)[:300]

    # Construir resultado
    cand_lookup = {c["id"]: c for c in with_text}
    copied_ids: set = set()
    phrases = []

    for phrase, ids in top:
        ids_list = list(ids)
        for cid in ids_list:
            copied_ids.add(cid)

        examples = []
        for cid in ids_list[:5]:
            c = cand_lookup.get(cid)
            if not c:
                continue
            text = c["text"]
            idx = text.lower().find(phrase.split()[0])
            if idx != -1:
                s = max(0, idx - 60)
                e = min(len(text), idx + len(phrase) + 120)
                ctx = text[s:e].strip()
            else:
                ctx = phrase
            examples.append({
                "id":        cid,
                "nome":      c.get("nome_urna") or c["nome"],
                "partido":   c.get("partido", ""),
                "municipio": c.get("municipio", ""),
                "uf":        c.get("uf", ""),
                "context":   ctx[:400],
            })

        phrases.append({
            "phrase":   phrase,
            "count":    len(ids_list),
            "cand_ids": ids_list[:200],
            "examples": examples,
        })

    pct = len(copied_ids) / max(1, len(with_text)) * 100

    result = {
        "total_analyzed":           len(with_text),
        "candidates_with_copies":   len(copied_ids),
        "pct_with_copies":          round(pct, 1),
        "unique_shared_phrases":    len(shared),
        "top_phrases":              phrases,
    }
    print(f"  Candidatos com trechos copiados: {len(copied_ids):,}  ({pct:.1f}%)")
    return result


# ── 8. Exportação ─────────────────────────────────────────────────────────────

def export_all(candidates, theme_data, party_data, plagiarism, report):
    print("\n[8] Exportando JSONs...")

    def dump(obj, path, indent=None):
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(obj, fh, ensure_ascii=False,
                      separators=(",", ":") if indent is None else None,
                      indent=indent)

    # ── metadata.json ──────────────────────────────────────────────────────
    meta = [
        {k: c[k] for k in ("id","nome","nome_urna","partido","uf",
                             "municipio","cd_municipio","has_plan","text_len")}
        for c in candidates
    ]
    dump(meta, OUT_DIR / "metadata.json")
    print(f"  metadata.json  : {len(meta):,} candidatos")

    # ── report.json ────────────────────────────────────────────────────────
    total     = len(candidates)
    has_plan  = sum(1 for c in candidates if c.get("has_plan"))
    rpt = {
        "generated_at":    datetime.now().isoformat(),
        "total_candidates": total,
        "with_plan":        has_plan,
        "without_plan":     total - has_plan,
        "pct_with_plan":    round(has_plan / max(1, total) * 100, 1),
        "extraction":       report,
        "by_state":         {},
    }
    for uf in STATES:
        uf_c = [c for c in candidates if c.get("uf") == uf]
        wp   = sum(1 for c in uf_c if c.get("has_plan"))
        rpt["by_state"][uf] = {
            "total":     len(uf_c),
            "with_plan": wp,
            "pct":       round(wp / max(1, len(uf_c)) * 100, 1),
        }
    dump(rpt, OUT_DIR / "report.json", indent=2)

    # ── Por estado ─────────────────────────────────────────────────────────
    for uf in STATES:
        uf_c = [c for c in candidates if c.get("uf") == uf]
        uf_out = []
        for c in uf_c:
            entry = {k: c.get(k, "") for k in
                     ("id","nome","nome_urna","partido","uf",
                      "municipio","cd_municipio","has_plan","text_len")}
            entry["snippet"] = (c.get("text","")[:400]) if c.get("has_plan") else ""
            uf_out.append(entry)
        dump(uf_out, OUT_DIR / "states" / f"{uf}.json")

    # ── Candidatos individuais (full text) ─────────────────────────────────
    ind_count = 0
    for c in candidates:
        if c.get("has_plan") and c.get("text"):
            dump({
                "id":        c["id"],
                "nome":      c["nome"],
                "nome_urna": c.get("nome_urna",""),
                "partido":   c.get("partido",""),
                "uf":        c.get("uf",""),
                "municipio": c.get("municipio",""),
                "text":      c["text"],
            }, OUT_DIR / "candidates" / f"{c['id']}.json")
            ind_count += 1
    print(f"  Candidatos individuais: {ind_count:,}")

    # ── Temas ──────────────────────────────────────────────────────────────
    themes_index = []
    for name, data in theme_data.items():
        slug = re.sub(r"[^a-z0-9]+", "_", normalize(name)).strip("_")
        dump(data, OUT_DIR / "themes" / f"{slug}.json")
        themes_index.append({
            "name":     name,
            "slug":     slug,
            "keywords": data["keywords"],
            "count":    data["count"],
        })
    dump(themes_index, OUT_DIR / "themes.json", indent=2)
    print(f"  Temas: {len(themes_index)}")

    # ── Partidos ───────────────────────────────────────────────────────────
    dump(party_data, OUT_DIR / "parties.json", indent=2)
    print(f"  Partidos: {len(party_data)}")

    # ── Plágio ─────────────────────────────────────────────────────────────
    dump(plagiarism, OUT_DIR / "plagiarism.json", indent=2)
    print("  plagiarism.json  ✓")

    print("\n✓ Todos os arquivos exportados em:", OUT_DIR)


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 65)
    print("Pipeline: Planos de Governo – Eleições Municipais 2024")
    print("=" * 65)

    df, prefeitos  = load_candidates()
    plan_zips      = download_plans()
    texts, extr_rp = extract_texts(plan_zips)
    candidates     = build_candidates(prefeitos, texts)
    theme_data     = analyze_themes(candidates)
    party_data     = analyze_parties(candidates)
    plagiarism     = detect_plagiarism(candidates)
    export_all(candidates, theme_data, party_data, plagiarism, extr_rp)

    print("\n✓ Pipeline concluído com sucesso!")

#!/usr/bin/env python3
"""
Análise dos dados do SIGSIF com recortes de interesse jornalístico.
Roda sobre os CSVs baixados por: sigsif_scraper.py bulk

    python3 analise_pautas.py
"""
import csv, collections, os, re, sys, unicodedata

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados_abertos")
csv.field_size_limit(10_000_000)


def ler(nome):
    caminho = os.path.join(DIR, nome)
    if not os.path.exists(caminho):
        sys.exit(f"faltando {caminho} - rode: python3 sigsif_scraper.py bulk")
    return list(csv.DictReader(open(caminho, encoding="utf-8", errors="replace"),
                               delimiter=";"))


def norm(s):
    """As bases misturam grafias: 'Contaminacao', 'CONTAMINAÇÃO', 'Contaminação'.
    Somar sem normalizar duplica categorias e distorce qualquer ranking."""
    s = unicodedata.normalize("NFKD", (s or "").strip().lower())
    return re.sub(r"\s+", " ", "".join(c for c in s if not unicodedata.combining(c)))


def titulo(t):
    print(f"\n{'='*72}\n{t}\n{'='*72}")


def suspensoes():
    """Quem perdeu habilitação para exportar, para onde e quando."""
    rows = ler("sigsifestabelecimentosnacionais.csv")
    susp = [r for r in rows if r["DT_SUSPENSAO"].strip()]
    titulo(f"HABILITAÇÕES SUSPENSAS PARA EXPORTAÇÃO ({len(susp)} de {len(rows)})")

    # Uma linha = um par planta+país. Uma planta descredenciada de 20 mercados
    # vira 20 linhas. Contar linhas superestima o número de empresas atingidas
    # e chega a inverter a ordem dos anos - conte plantas distintas também.
    print("\n-- por ano (linhas x plantas distintas) --")
    linhas = collections.Counter(r["DT_SUSPENSAO"][:4] for r in susp)
    plantas = collections.defaultdict(set)
    for r in susp:
        plantas[r["DT_SUSPENSAO"][:4]].add(r["SIF"])
    print(f"   {'ano':6s}{'linhas':>8}{'plantas':>9}")
    for k in sorted(linhas):
        print(f"   {k:6s}{linhas[k]:>8}{len(plantas[k]):>9}")
    print(f"   plantas distintas na série toda: {len({r['SIF'] for r in susp})}")

    print("\n-- países que mais suspenderam plantas brasileiras --")
    for k, v in collections.Counter(r["PAIS"] for r in susp).most_common(12):
        print(f"   {v:5d}  {k}")

    print("\n-- plantas com mais suspensões --")
    c = collections.Counter((r["SIF"], r["ESTABELECIMENTO"][:42], r["UF"]) for r in susp)
    for (s, e, uf), v in c.most_common(15):
        print(f"   {v:4d}  SIF {s:>5}  {uf}  {e}")


def sancoes():
    """Varre o texto livre das ocorrências atrás de punições. É onde ficam
    suspensões, exclusões e delistagens - com o nº do processo SEI, que é o
    gancho para o pedido de acesso à informação."""
    rows = ler("sigsifestabelecimentosregistradosnosif.csv")
    termos = ["suspens", "exclus", "delist", "cancelament", "descredenc",
              "interdi", "autuac"]
    achados = collections.defaultdict(list)
    for r in rows:
        d = norm(r["DESCRICAO_OCORRENCIA"])
        for t in termos:
            if t in d:
                achados[t].append(r)
    titulo("OCORRÊNCIAS COM TERMOS DE SANÇÃO (texto livre)")
    for t in termos:
        print(f"   {len(achados[t]):6d}  {t}")

    print("\n-- empresas com mais ocorrências de suspensão/exclusão --")
    alvo = achados["suspens"] + achados["exclus"] + achados["delist"]
    c = collections.Counter(r["RAZAO_SOCIAL"][:45] for r in alvo)
    for k, v in c.most_common(15):
        print(f"   {v:5d}  {k}")

    sei = set()
    for r in alvo:
        sei |= set(re.findall(r"\d{5}\.\d{6}/\d{4}-\d{2}", r["DESCRICAO_OCORRENCIA"]))
    print(f"\n-- {len(sei)} processos SEI distintos citados (pedir via LAI) --")
    for s in sorted(sei)[:10]:
        print(f"   {s}")


def concentracao():
    """Um estabelecimento = um par SIF+CNPJ. O CSV traz uma LINHA POR
    OCORRÊNCIA, então contar linhas infla o número de plantas em ~8x."""
    rows = ler("sigsifestabelecimentosregistradosnosif.csv")
    plantas = {(r["NR_SIF"], r["CPF_CNPJ"]): r for r in rows}
    titulo(f"CONCENTRAÇÃO - {len(plantas)} plantas (em {len(rows)} linhas de CSV)")

    raiz, nome = collections.Counter(), {}
    for (sif, doc), r in plantas.items():
        if "/" in doc:                      # CNPJ: os 8 primeiros dígitos = grupo
            raiz[doc[:10]] += 1
            nome.setdefault(doc[:10], r["RAZAO_SOCIAL"])
    print("\n-- grupos com mais plantas --")
    for k, v in raiz.most_common(12):
        print(f"   {v:4d}  {k}  {nome[k][:48]}")

    tot = sum(raiz.values())
    for n in (5, 10, 20):
        top = sum(v for _, v in raiz.most_common(n))
        print(f"   top {n:2d} grupos: {top:5d}/{tot} plantas ({100*top/tot:.1f}%)")

    # No CSV o CPF vem mascarado ("***.***.453-**"), então não dá para filtrar
    # por quantidade de dígitos - o teste é a presença do asterisco.
    print("\n-- plantas no nome de PESSOA FÍSICA (CPF) --")
    pf = [r for (s, d), r in plantas.items() if "*" in d]
    print(f"   {len(pf)} plantas registradas em CPF (de {len(plantas)})")
    for k, v in collections.Counter(r["UF"] for r in pf).most_common(8):
        print(f"     {v:4d}  {k}")
    for k, v in collections.Counter(r["AREA_CATEGORIA"] for r in pf).most_common(5):
        print(f"     {v:4d}  {k}")

    print("\n-- distribuição por UF e área --")
    for k, v in collections.Counter(r["UF"] for r in plantas.values()).most_common(10):
        print(f"   {v:5d}  {k}")
    for k, v in collections.Counter(r["AREA_CATEGORIA"] for r in plantas.values()).most_common():
        print(f"   {v:5d}  {k}")


def condenacoes():
    """2,2 mi de linhas de carcaças condenadas. Só tem UF de procedência -
    não dá para nomear a planta. Serve para tendência, não para acusação."""
    titulo("CONDENAÇÕES DE CARCAÇAS")
    diag, ano, dest = collections.Counter(), collections.Counter(), collections.Counter()
    caminho = os.path.join(DIR, "sigsifrelatoriocondenacao.csv")
    if not os.path.exists(caminho):
        print("   (csv de condenação ausente)"); return
    for x in csv.DictReader(open(caminho, encoding="utf-8", errors="replace"), delimiter=";"):
        try: t = int(x["TOTAL_PARTES_AFETADAS"])
        except (ValueError, TypeError): continue
        diag[norm(x["DIAGNOSTICO"])] += t          # normaliza: há grafias duplicadas
        ano[x["MES_ANO"][-4:]] += t
        dest[norm(x["DESTINO_CONDENACAO"])] += t
    print("\n-- diagnósticos (normalizados) --")
    for k, v in diag.most_common(12):
        print(f"   {v:>15,}  {k[:55]}")
    print("\n-- destino --")
    for k, v in dest.most_common(6):
        print(f"   {v:>15,}  {k[:55]}")
    print("\n-- por ano --")
    for k in sorted(ano):
        if k >= "2015":
            print(f"   {k}: {ano[k]:>15,}")


if __name__ == "__main__":
    for f in (suspensoes, sancoes, concentracao, condenacoes):
        try: f()
        except SystemExit as e: print(e)

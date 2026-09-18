#!/usr/bin/env python3
"""
Cruza as fazendas que a Friboi declara como fornecedoras com os embargos
ambientais do Ibama.

ENTRADA: um CSV com as colunas date;plot;ranch;city - exatamente os campos
que a API de rastreabilidade devolve (`ranch` = fazenda, `city` = município).
Você obtém essas linhas consultando a página no navegador (veja
friboi_links.py). O formato é o mesmo caso um dia haja acesso oficial.

SAÍDA: para cada fazenda, os embargos do Ibama cujo NOME_IMOVEL bate no mesmo
município - com nome do embargado, CPF/CNPJ, área, data e coordenadas.

    python3 cruza_fazendas.py --entrada fazendas.csv

LIMITE QUE VOCÊ PRECISA CONHECER
A JBS parou de publicar as coordenadas das fazendas em 2019. Sobrou nome +
município. Nome de fazenda não é identificador: existem dezenas de "Fazenda
Santa Maria" pelo país, e o mesmo imóvel aparece grafado de formas diferentes.
Então o que sai daqui é PISTA, não prova: cada acerto precisa ser confirmado
no CAR, no processo do Ibama e com a empresa antes de virar texto.
"""
import argparse, csv, os, re, sys, unicodedata, collections

csv.field_size_limit(100_000_000)
DIR = os.path.dirname(os.path.abspath(__file__))

# ruído que atrapalha a comparação de nomes de imóvel
RUIDO = {"fazenda", "faz", "faz.", "sitio", "sítio", "chacara", "chácara",
         "estancia", "estância", "agropecuaria", "agropecuária", "retiro",
         "gleba", "lote", "setor", "da", "de", "do", "das", "dos", "e"}


def norm(s):
    s = unicodedata.normalize("NFKD", (s or "").strip().lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]", " ", s)


# Nomes que o Ibama usa como preenchimento, não como identificação. Casar por
# eles gera acerto falso: "ZONA RURAL" bate com qualquer coisa no município.
# São 7,6% dos embargos ativos nomeados.
GENERICO = re.compile(
    r"zona rural|n[aã]o identificad|desconhecid|sem nome|sem morador|"
    r"local do embargo|n[aã]o informad|^\s*(area|área|lote|gleba|s/?n)\b|^\s*\d+\s*$",
    re.I)


def chave(nome):
    """Reduz 'Fazenda Santa Júlia - Retiro São Domingos' a {santa, julia,
    sao, domingos}: compara o miolo do nome, ignorando genéricos."""
    return frozenset(p for p in norm(nome).split() if p and p not in RUIDO)


def carrega_embargos(caminho):
    idx = collections.defaultdict(list)
    with open(caminho, encoding="utf-8-sig", errors="replace") as f:
        for x in csv.DictReader(f, delimiter=";"):
            nome = (x.get("NOME_IMOVEL") or "").strip()
            if not nome or GENERICO.search(nome):
                continue
            if (x.get("SIT_DESEMBARGO") or "").strip().upper() in ("SIM", "S"):
                continue                      # já desembargado
            k = chave(nome)
            if k:
                idx[(norm(x.get("MUNICIPIO")), k)].append(x)
    return idx


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--entrada", required=True,
                    help="CSV com date;plot;ranch;city vindo da rastreabilidade")
    ap.add_argument("--embargos",
                    default=os.path.join(DIR, "externos", "ibama_embargo.csv"))
    ap.add_argument("--saida", default=os.path.join(DIR, "cruzamento_fazendas.csv"))
    ap.add_argument("--parcial", action="store_true",
                    help="também aponta coincidência parcial de nome (mais ruído)")
    a = ap.parse_args()

    for p in (a.entrada, a.embargos):
        if not os.path.exists(p):
            sys.exit(f"faltando {p}\n(baixe os embargos com: python3 monitor_diario.py --so-baixar)")

    idx = carrega_embargos(a.embargos)
    # índice auxiliar por município, para a busca parcial
    por_mun = collections.defaultdict(list)
    for (mun, k), v in idx.items():
        por_mun[mun].append((k, v))

    linhas, achados = [], 0
    with open(a.entrada, encoding="utf-8-sig") as f:
        amostra = f.read(4096); f.seek(0)
        dial = csv.Sniffer().sniff(amostra, delimiters=";,") if amostra else csv.excel
        for r in csv.DictReader(f, dialect=dial):
            ranch = (r.get("ranch") or r.get("fazenda") or "").strip()
            city = (r.get("city") or r.get("municipio") or "").strip()
            if not ranch:
                continue
            k, mun = chave(ranch), norm(city)
            hits = list(idx.get((mun, k), []))
            tipo = "exato" if hits else ""
            if not hits and a.parcial and k:
                for k2, v in por_mun.get(mun, []):
                    # sobreposição forte: quase todas as palavras em comum
                    if k2 and len(k & k2) >= max(1, min(len(k), len(k2)) - 1):
                        hits += v; tipo = "parcial"
            if not hits:
                linhas.append({"fazenda": ranch, "municipio": city,
                               "data_abate": r.get("date", ""), "lote": r.get("plot", ""),
                               "match": "", "embargado": "", "cpf_cnpj": "",
                               "area_ha": "", "data_embargo": "", "num_tad": "",
                               "lat": "", "lon": ""})
                continue
            achados += 1
            for e in hits:
                linhas.append({
                    "fazenda": ranch, "municipio": city,
                    "data_abate": r.get("date", ""), "lote": r.get("plot", ""),
                    "match": tipo,
                    "embargado": (e.get("NOME_EMBARGADO") or "").strip(),
                    "cpf_cnpj": (e.get("CPF_CNPJ_EMBARGADO") or "").strip(),
                    "area_ha": e.get("QTD_AREA_EMBARGADA", ""),
                    "data_embargo": (e.get("DAT_EMBARGO") or "")[:10],
                    "num_tad": e.get("NUM_TAD", ""),
                    "lat": e.get("NUM_LATITUDE_TAD", ""),
                    "lon": e.get("NUM_LONGITUDE_TAD", ""),
                })

    with open(a.saida, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(linhas[0].keys()), delimiter=";")
        w.writeheader(); w.writerows(linhas)
    print(f"fazendas consultadas : {len({l['fazenda'] for l in linhas})}")
    print(f"com embargo no mesmo município: {achados}")
    print(f"-> {a.saida}")
    for l in [x for x in linhas if x["match"]][:10]:
        print(f"   [{l['match']}] {l['fazenda'][:34]:36s} {l['municipio'][:16]:17s} "
              f"{l['area_ha']:>10} ha  {l['embargado'][:26]}")
    print("\nCada linha é pista, não prova: confirme no CAR, no processo do Ibama\n"
          "e com a empresa antes de publicar.")


if __name__ == "__main__":
    main()

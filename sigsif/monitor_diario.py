#!/usr/bin/env python3
"""
Monitor diário: o que mudou hoje nas bases públicas que cercam a cadeia da
carne. Guarda um instantâneo por dia e reporta só a diferença.

    python3 monitor_diario.py              # baixa, compara e reporta
    python3 monitor_diario.py --so-baixar  # só atualiza as bases

Acompanha:
  1. SIGSIF/MAPA  - estabelecimentos que entraram ou saíram do registro
  2. SIGSIF       - novas suspensões de habilitação para exportar
  3. Ibama        - novos embargos nos municípios onde a JBS tem abatedouro

O que NÃO entra aqui: a rastreabilidade da Friboi. A API dela exige
reCAPTCHA validado no servidor, então não há caminho automatizado legítimo -
essa consulta é manual (friboi_links.py monta os links).

Para rodar todo dia, um cron:
    0 7 * * *  cd /caminho/sigsif && python3 monitor_diario.py >> monitor.log 2>&1
"""
import argparse, csv, datetime, json, os, re, sys, unicodedata
import urllib.request

csv.field_size_limit(100_000_000)
DIR = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.join(DIR, "externos")
SNAP = os.path.join(DIR, "snapshots")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

IBAMA_EMBARGO = ("https://stibamadadosabertosprd.blob.core.windows.net/dados-abertos/"
                 "dados/TERMOS_DE_EMBARGO/TERMO_EMBARGO/termo_de_embargo.csv")
# o catálogo do Ibama publica este arquivo sob .../TERMOS/TERMO_EMBARGO/,
# caminho que responde 404. O que funciona é TERMOS_DE_EMBARGO/TERMO_EMBARGO/.


def norm(s):
    s = unicodedata.normalize("NFKD", (s or "").strip().lower())
    return "".join(c for c in s if not unicodedata.combining(c))


def baixa(url, destino, rotulo):
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    print(f"  {rotulo} ...", end="", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    tmp = destino + ".parcial"
    with urllib.request.urlopen(req, timeout=900) as resp, open(tmp, "wb") as f:
        n = 0
        while True:
            b = resp.read(1 << 20)
            if not b:
                break
            f.write(b); n += len(b)
    os.replace(tmp, destino)          # troca atômica: nunca deixa arquivo pela metade
    print(f" {n/1e6:.1f} MB")


def atualiza():
    print("baixando bases:")
    sys.path.insert(0, DIR)
    import sigsif_scraper as s
    s.bulk()
    s.lista()
    baixa(IBAMA_EMBARGO, os.path.join(EXT, "ibama_embargo.csv"), "Ibama - embargos")


def municipios_jbs():
    """Municípios com abatedouro JBS/Friboi, a partir do que já foi raspado."""
    site = os.path.join(DIR, "estabelecimentos.csv")
    reg = os.path.join(DIR, "dados_abertos", "sigsifestabelecimentosregistradosnosif.csv")
    if not (os.path.exists(site) and os.path.exists(reg)):
        return set()
    sifs = {x["sif"] for x in csv.DictReader(open(site, encoding="utf-8"), delimiter=";")
            if re.search(r"\bJBS\b|FRIBOI", x["razao_social"], re.I)}
    muns = set()
    for r in csv.DictReader(open(reg, encoding="utf-8"), delimiter=";"):
        if r["NR_SIF"] in sifs and "ABATEDOURO" in (r.get("CATEGORIA_CLASSE") or ""):
            muns.add((norm(r["MUNICIPIO"]), r["UF"]))
    return muns


def estado_atual():
    est = {}
    p = os.path.join(DIR, "estabelecimentos.csv")
    if os.path.exists(p):
        est = {x["sif"]: x["razao_social"]
               for x in csv.DictReader(open(p, encoding="utf-8"), delimiter=";")}
    susp = {}
    p = os.path.join(DIR, "dados_abertos", "sigsifestabelecimentosnacionais.csv")
    if os.path.exists(p):
        for x in csv.DictReader(open(p, encoding="utf-8", errors="replace"), delimiter=";"):
            if x["DT_SUSPENSAO"].strip():
                susp[f"{x['SIF']}|{x['PAIS']}|{x['DT_SUSPENSAO'][:10]}"] = \
                    f"{x['ESTABELECIMENTO'][:40]} / {x['PAIS']}"
    emb = {}
    muns = municipios_jbs()
    p = os.path.join(EXT, "ibama_embargo.csv")
    if os.path.exists(p) and muns:
        for x in csv.DictReader(open(p, encoding="utf-8-sig", errors="replace"), delimiter=";"):
            if (x.get("SIT_DESEMBARGO") or "").strip().upper() in ("SIM", "S"):
                continue
            if (norm(x.get("MUNICIPIO")), x.get("UF")) in muns:
                emb[x.get("NUM_TAD", "")] = (
                    f"{(x.get('NOME_IMOVEL') or '(sem nome)')[:38]} - "
                    f"{x.get('MUNICIPIO')}/{x.get('UF')} - "
                    f"{x.get('QTD_AREA_EMBARGADA')} ha - {(x.get('DAT_EMBARGO') or '')[:10]}")
    return {"estabelecimentos": est, "suspensoes": susp, "embargos_jbs": emb}


def diff(hoje, ontem, titulo, limite=25):
    novos = {k: v for k, v in hoje.items() if k not in ontem}
    sumidos = {k: v for k, v in ontem.items() if k not in hoje}
    if not novos and not sumidos:
        print(f"\n{titulo}: sem mudança ({len(hoje)} registros)")
        return
    print(f"\n{titulo}: +{len(novos)} / -{len(sumidos)}  (total {len(hoje)})")
    for k, v in list(novos.items())[:limite]:
        print(f"   + {v}")
    for k, v in list(sumidos.items())[:limite]:
        print(f"   - {v}")
    if len(novos) + len(sumidos) > limite:
        print(f"   ... (lista completa no snapshot)")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--so-baixar", action="store_true")
    ap.add_argument("--sem-baixar", action="store_true",
                    help="compara usando o que já está em disco")
    a = ap.parse_args()

    if not a.sem_baixar:
        atualiza()
    if a.so_baixar:
        return

    os.makedirs(SNAP, exist_ok=True)
    hoje = estado_atual()
    anteriores = sorted(f for f in os.listdir(SNAP) if f.endswith(".json"))
    data = datetime.date.today().isoformat()
    alvo = os.path.join(SNAP, f"{data}.json")

    print(f"\n{'='*66}\nMONITOR SIGSIF + IBAMA - {data}\n{'='*66}")
    ant = [f for f in anteriores if f != f"{data}.json"]
    if not ant:
        print("\nprimeiro dia: nada para comparar ainda.")
        for k, v in hoje.items():
            print(f"   {k}: {len(v)} registros")
    else:
        ontem = json.load(open(os.path.join(SNAP, ant[-1]), encoding="utf-8"))
        print(f"comparando com {ant[-1]}")
        diff(hoje["estabelecimentos"], ontem.get("estabelecimentos", {}),
             "ESTABELECIMENTOS COM SIF")
        diff(hoje["suspensoes"], ontem.get("suspensoes", {}),
             "SUSPENSÕES DE HABILITAÇÃO")
        diff(hoje["embargos_jbs"], ontem.get("embargos_jbs", {}),
             "EMBARGOS DO IBAMA EM MUNICÍPIO COM ABATEDOURO JBS")

    json.dump(hoje, open(alvo, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"\nsnapshot salvo em {alvo}")


if __name__ == "__main__":
    main()

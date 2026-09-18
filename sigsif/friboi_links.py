#!/usr/bin/env python3
"""
Monta a lista de consultas a fazer na rastreabilidade da Friboi (JBS),
partindo dos estabelecimentos do SIGSIF.

    https://www.friboi.com.br/qualidade/rastreabilidade/

A consulta pede SIF + data de produção. O SIF vem do SIGSIF; a data é a do
lote que você tem em mãos (ou a janela que quer cobrir).

POR QUE ISTO GERA LINKS, E NÃO RESPOSTAS
A página chama `GET /api/traceability?search=<SIF><ddMMyy>` com o header
`x-recaptcha-token`. O servidor valida o token: sem ele responde 403
`token_required`; com um token inválido, 403 `recaptcha_invalid`. É um
controle de acesso antiautomação, deliberado, num site privado - diferente
do SIGSIF, onde só faltava User-Agent. Então aqui o script prepara o
trabalho e quem consulta é você, no navegador, no seu ritmo.

O link já vem preenchido: a própria Friboi aceita
`?parm=<SIF>457</SIF><DATA_PROD>15/03/2026</DATA_PROD>` e preenche o
formulário sozinha (recurso do site, provavelmente para QR code).

Uso:
    python3 friboi_links.py --datas 2026-03-15,2026-03-16
    python3 friboi_links.py --datas 2026-03-15 --uf PA,RO,MT
    python3 friboi_links.py --datas 2026-03-15 --grupo MINERVA
"""
import argparse, csv, datetime, os, re, urllib.parse

DIR = os.path.dirname(os.path.abspath(__file__))
PAGINA = "https://www.friboi.com.br/qualidade/rastreabilidade/"


def carrega():
    """Junta a lista viva do site (razão social, situação) com área e
    município do CSV de dados abertos."""
    p_site = os.path.join(DIR, "estabelecimentos.csv")
    p_reg = os.path.join(DIR, "dados_abertos",
                         "sigsifestabelecimentosregistradosnosif.csv")
    for p in (p_site, p_reg):
        if not os.path.exists(p):
            raise SystemExit(f"faltando {p} - rode antes:\n"
                             "  python3 sigsif_scraper.py bulk\n"
                             "  python3 sigsif_scraper.py lista")
    site = list(csv.DictReader(open(p_site, encoding="utf-8"), delimiter=";"))
    info = {}
    for r in csv.DictReader(open(p_reg, encoding="utf-8"), delimiter=";"):
        d = info.setdefault(r["NR_SIF"], {"uf": r["UF"], "mun": r["MUNICIPIO"],
                                          "area": set(), "classe": set()})
        d["area"].add(r["AREA_CATEGORIA"])
        d["classe"].add(r["CATEGORIA_CLASSE"])
    return site, info


def link(sif, data):
    """data: datetime.date -> URL com o formulário já preenchido."""
    parm = f"<SIF>{sif}</SIF><DATA_PROD>{data.strftime('%d/%m/%Y')}</DATA_PROD>"
    return PAGINA + "?" + urllib.parse.urlencode({"parm": parm})


def busca_api(sif, data):
    """O `search` que a página monta: SIF + data em ddMMyy. Fica registrado
    para você conferir no DevTools o que o site envia - não para automatizar."""
    return f"{sif}{data.strftime('%d%m%y')}"


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--datas", required=True,
                    help="datas de produção, AAAA-MM-DD separadas por vírgula")
    ap.add_argument("--grupo", default="JBS|FRIBOI",
                    help="regex de razão social (padrão: JBS|FRIBOI)")
    ap.add_argument("--uf", help="filtra por UF, separadas por vírgula")
    ap.add_argument("--todas-classes", action="store_true",
                    help="não restringe a abatedouros")
    ap.add_argument("--saida", default="consultas_friboi.csv")
    a = ap.parse_args()

    try:
        datas = [datetime.date.fromisoformat(d.strip())
                 for d in a.datas.split(",")]
    except ValueError as e:
        raise SystemExit(f"data inválida: {e}")
    ufs = {u.strip().upper() for u in a.uf.split(",")} if a.uf else None

    site, info = carrega()
    alvo = []
    for x in site:
        if not re.search(a.grupo, x["razao_social"], re.I):
            continue
        i = info.get(x["sif"])
        if not i:
            continue
        if ufs and i["uf"] not in ufs:
            continue
        if not a.todas_classes and not any("ABATEDOURO" in c for c in i["classe"]):
            continue
        alvo.append((x, i))

    linhas = []
    for x, i in sorted(alvo, key=lambda t: int(t[0]["sif"])):
        for d in datas:
            linhas.append({
                "sif": x["sif"], "razao_social": x["razao_social"],
                "uf": i["uf"], "municipio": i["mun"],
                "data_producao": d.isoformat(),
                "search_da_api": busca_api(x["sif"], d),
                "url": link(x["sif"], d),
            })

    caminho = os.path.join(DIR, a.saida)
    with open(caminho, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(linhas[0].keys()), delimiter=";")
        w.writeheader(); w.writerows(linhas)

    print(f"{len(alvo)} estabelecimentos x {len(datas)} datas = {len(linhas)} consultas")
    print(f"-> {caminho}\n")
    for l in linhas[:5]:
        print(f"  SIF {l['sif']:>5} {l['uf']} {l['municipio'][:20]:20} {l['data_producao']}")
        print(f"     {l['url']}")
    if len(linhas) > 5:
        print(f"  ... e mais {len(linhas)-5}")
    print("\nAbra os links no navegador. O reCAPTCHA roda normalmente para você;\n"
          "não há caminho automatizado legítimo para esta etapa.")


if __name__ == "__main__":
    main()

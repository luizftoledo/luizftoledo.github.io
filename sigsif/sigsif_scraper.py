#!/usr/bin/env python3
"""
Raspagem do SIGSIF/MAPA - Serviço de Inspeção Federal.

Três camadas, da mais barata para a mais cara:
  bulk    - baixa os 11 CSVs do portal de dados abertos (segundos)
  lista   - varre a consulta pública paginada (~3.2 mil estabelecimentos)
  detalhe - abre a ficha de cada SIF: 4 abas, inclui o histórico de
            ocorrências/habilitações que não vem nos CSVs

Uso:
    python3 sigsif_scraper.py bulk
    python3 sigsif_scraper.py lista
    python3 sigsif_scraper.py detalhe [--limite N]
"""
import argparse, csv, json, os, re, sys, time
import urllib.parse, urllib.request

BASE = "https://extranet.agricultura.gov.br/sigsif_cons"
LISTA = f"{BASE}/!ap_estabelec_nacional_lista"
DETALHE = f"{BASE}/!ap_estabelec_nacional_detalhe"
CKAN = "https://dados.agricultura.gov.br/api/3/action/package_show?id=servico-de-inspecao-federal-sif"

# Sem User-Agent de navegador o servidor derruba a conexão (curl: 52) e o
# portal de dados abertos devolve 403.
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
HDRS = {"User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9"}
OUT = os.path.dirname(os.path.abspath(__file__))
PAGINA = 15          # registros por página, fixo no sistema
PAUSA = 0.3          # cortesia com o servidor do MAPA


def get(url, data=None, tentativas=4):
    """GET/POST com retentativa exponencial. O SIGSIF cai com alguma frequência."""
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, data=data, headers=HDRS)
            return urllib.request.urlopen(req, timeout=90).read().decode("latin-1")
        except Exception as e:
            if i == tentativas - 1:
                raise
            espera = 2 ** i
            print(f"    ! {type(e).__name__} - retentativa em {espera}s", file=sys.stderr)
            time.sleep(espera)


def limpa(html):
    """Remove scripts e tags, devolve texto. O HTML é de 2004: tags em caixa
    alta, sem aspas, tabelas aninhadas. Regex aqui é mais robusto que parser."""
    html = re.sub(r"<script.*?</script>", "", html, flags=re.S | re.I)
    txt = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"[\s ]+", " ", txt.replace("&nbsp;", " ")).strip()


# ---------------------------------------------------------------- bulk
def bulk():
    """Baixa todos os recursos CSV do dataset no portal de dados abertos."""
    pkg = json.loads(get(CKAN))["result"]
    destino = os.path.join(OUT, "dados_abertos")
    os.makedirs(destino, exist_ok=True)
    print(f"dataset: {pkg['title']}  (atualizado {pkg['metadata_modified']})")
    for r in pkg["resources"]:
        if (r.get("format") or "").upper() != "CSV":
            continue
        nome = r["url"].rsplit("/", 1)[-1]
        alvo = os.path.join(destino, nome)
        print(f"  baixando {nome} ...", end="", flush=True)
        req = urllib.request.Request(r["url"], headers=HDRS)
        with urllib.request.urlopen(req, timeout=600) as resp, open(alvo, "wb") as f:
            n = 0
            while True:
                bloco = resp.read(1 << 20)
                if not bloco:
                    break
                f.write(bloco); n += len(bloco)
        print(f" {n/1e6:.1f} MB")
    print(f"-> {destino}")


# --------------------------------------------------------------- lista
def linhas_da_pagina(html):
    """Extrai as linhas da tabela de resultado, com o id interno do link."""
    html = re.sub(r"<script.*?</script>", "", html, flags=re.S | re.I)
    out = []
    for tr in re.findall(r"<TR[^>]*>(.*?)</TR>", html, re.S | re.I):
        tds = [re.sub(r"<[^>]+>", "", t).replace("&nbsp;", " ").strip()
               for t in re.findall(r"<TD[^>]*>(.*?)</TD>", tr, re.S | re.I)]
        if len(tds) < 4 or not tds[2].isdigit():
            continue
        link = re.search(r"id_estabelecimento=(\d+)&p_id_pessoa_fisica=(\d*)"
                         r"&p_id_pessoa_juridica=(\d*)", tr, re.I)
        out.append({
            "cpf_cnpj": tds[0], "razao_social": tds[1],
            "sif": tds[2], "situacao": tds[3],
            "id_estabelecimento": link.group(1) if link else "",
            # preenchido só quando o titular é pessoa física
            "id_pessoa_fisica": link.group(2) if link else "",
            "id_pessoa_juridica": link.group(3) if link else "",
        })
    return out


def lista():
    """Varre a consulta inteira. A validação que exige preencher um campo é
    só JavaScript no navegador - o servidor aceita a busca vazia e pagina
    tudo por p_linha_inicial."""
    campos = {"nr_sif": "", "nm_razao_social": "", "nr_cnpj": "",
              "nm_sort": "nr_sif", "p_tipo_consulta": ""}
    # p_linha_inicial é 0-based: começar em 1 pula o primeiro
    # estabelecimento da lista (o SIF 1, da BRF).
    vistos, todos, off = set(), [], 0
    while True:
        campos["p_linha_inicial"] = off
        html = get(LISTA, urllib.parse.urlencode(campos).encode())
        linhas = linhas_da_pagina(html)
        if not linhas:
            break
        novas = [l for l in linhas if l["sif"] not in vistos]
        for l in novas:
            vistos.add(l["sif"])
        todos += novas
        print(f"\r  offset {off:>5}  coletados {len(todos)}", end="", flush=True)
        off += PAGINA
        time.sleep(PAUSA)
    alvo = os.path.join(OUT, "estabelecimentos.csv")
    with open(alvo, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(todos[0].keys()), delimiter=";")
        w.writeheader(); w.writerows(todos)
    print(f"\n-> {len(todos)} estabelecimentos em {alvo}")


# ------------------------------------------------------------- detalhe
def parse_detalhe(html):
    """A ficha tem 4 abas. Os dados cadastrais estão em <INPUT DISABLED VALUE=...>,
    mas áreas, classes e o histórico de ocorrências NÃO estão no HTML: são
    injetados por chamadas JavaScript no fim da página. Quem limpa as tags
    antes de ler perde justamente o histórico de habilitações e suspensões."""
    reg = {}
    campos = {
        "nr_cnpj": "cnpj", "nm_razao_social": "razao_social",
        "nm_fantasia": "nome_fantasia", "nr_sif": "sif",
        "dt_reserva": "data_reserva", "dt_registro": "data_registro",
        "nr_processo": "nr_processo", "cs_estabelecimento": "situacao",
        "tx_logradouro": "logradouro", "nm_bairro": "bairro",
        "nr_cep": "cep", "nm_municipio": "municipio", "sg_uf": "uf",
        "nr_telefone": "telefone", "nr_fax": "fax", "tx_site": "site",
        "id_estabelecimento": "id_estabelecimento",
    }
    sem_js = re.sub(r"<script.*?</script>", "", html, flags=re.S | re.I)
    for tag in re.findall(r"<INPUT[^>]*>", sem_js, re.I):
        n = re.search(r'NAME="([^"]+)"', tag, re.I)
        v = re.search(r'VALUE="([^"]*)"', tag, re.I)
        if n and n.group(1) in campos:
            reg[campos[n.group(1)]] = (v.group(1).strip() if v else "")
    mail = re.search(r"mailto:([^\"'>\s]+)", sem_js, re.I)
    reg["email"] = mail.group(1) if mail else ""

    def js(fn, n):
        """Lê os argumentos das chamadas incluirX("a"[,"b"]) geradas pelo servidor."""
        arg = r'"((?:[^"\\]|\\.)*)"'
        pat = re.escape(fn) + r"\(\s*" + r"\s*,\s*".join([arg] * n) + r"\s*\)"
        out = []
        for m in re.finditer(pat, html):
            vals = [re.sub(r"\\n", " ", g).replace('\\"', '"').strip()
                    for g in m.groups()]
            if any(v.startswith("p") and v[1:2].isupper() for v in vals):
                continue          # pula a própria definição da função
            out.append(vals)
        return out

    reg["areas_atuacao"] = [a[0] for a in js("incluirAreaAtuacao", 1)]
    reg["categorias_classes"] = [c[0] for c in js("incluirClasse", 1)]
    reg["ocorrencias"] = [{"data": d, "descricao": re.sub(r"\s+", " ", t)}
                          for d, t in js("incluirOcorrenciaHab", 2)]
    return reg


def detalhe(limite=None):
    origem = os.path.join(OUT, "estabelecimentos.csv")
    if not os.path.exists(origem):
        sys.exit("rode 'lista' antes de 'detalhe'")
    alvo = os.path.join(OUT, "detalhes.jsonl")
    feitos = set()
    if os.path.exists(alvo):   # retomável: relê o que já foi salvo
        for l in open(alvo, encoding="utf-8"):
            try: feitos.add(json.loads(l)["_sif"])
            except Exception: pass
    linhas = list(csv.DictReader(open(origem, encoding="utf-8"), delimiter=";"))
    if limite:
        linhas = linhas[:limite]
    with open(alvo, "a", encoding="utf-8") as f:
        for i, l in enumerate(linhas, 1):
            if l["sif"] in feitos:
                continue
            q = urllib.parse.urlencode({
                "id_estabelecimento": l["id_estabelecimento"],
                "p_id_pessoa_fisica": l["id_pessoa_fisica"],
                "p_id_pessoa_juridica": l["id_pessoa_juridica"]})
            try:
                d = parse_detalhe(get(f"{DETALHE}?{q}"))
            except Exception as e:
                print(f"\n  ! SIF {l['sif']}: {e}", file=sys.stderr); continue
            d["_sif"] = l["sif"]; d["_razao_social"] = l["razao_social"]
            f.write(json.dumps(d, ensure_ascii=False) + "\n"); f.flush()
            print(f"\r  {i}/{len(linhas)}  SIF {l['sif']}", end="", flush=True)
            time.sleep(PAUSA)
    print(f"\n-> {alvo}")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("etapa", choices=["bulk", "lista", "detalhe"])
    p.add_argument("--limite", type=int)
    a = p.parse_args()
    {"bulk": bulk, "lista": lista,
     "detalhe": lambda: detalhe(a.limite)}[a.etapa]()

import os
import json
import zipfile
import pathlib
import traceback
from urllib.parse import urlparse

import requests
import pandas as pd


DATASET_SLUG = "fiscalizacao-termo-de-embargo"
API_URL = "https://dadosabertos.ibama.gov.br/api/3/action/package_show"


def get_base_dirs() -> tuple[str, str]:
    """Return base download dir and extraction dir alongside this script."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.join(script_dir, "ibama_termo_embargo_downloads")
    extract_dir = os.path.join(base_dir, "extracted")
    os.makedirs(base_dir, exist_ok=True)
    os.makedirs(extract_dir, exist_ok=True)
    return base_dir, extract_dir


def safe_filename(name: str) -> str:
    name = "".join(c if c.isalnum() or c in (" ", ".", "_", "-", "(", ")") else "_" for c in name)
    return "_".join(name.split())


def guess_ext(url: str, fallback: str = "") -> str:
    path = urlparse(url).path
    ext = pathlib.Path(path).suffix.lower()
    return ext or fallback


def download_file(url: str, dest_path: str):
    with requests.get(url, stream=True, timeout=180) as r:
        r.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)


def read_csv_preview(path: str, nrows: int = 3) -> pd.DataFrame:
    last_err = None
    for enc in ("utf-8", "utf-8-sig", "latin1"):
        try:
            return pd.read_csv(path, engine="python", sep=None, encoding=enc, nrows=nrows, low_memory=False)
        except UnicodeDecodeError:
            continue
        except Exception as e:
            last_err = e
    if last_err is not None:
        raise last_err
    raise RuntimeError("Falha desconhecida ao ler CSV: " + path)


def read_excel_preview(path: str, nrows: int = 3) -> pd.DataFrame:
    try:
        # pandas recente suporta nrows em read_excel
        return pd.read_excel(path, nrows=nrows)
    except TypeError:
        # fallback se a versão do pandas não suportar nrows
        df = pd.read_excel(path)
        return df.head(nrows)


def main():
    base_dir, extract_dir = get_base_dirs()
    print(f"Base dir: {base_dir}")

    # 1) Buscar recursos no CKAN
    print("Consultando API CKAN do IBAMA...")
    resp = requests.get(API_URL, params={"id": DATASET_SLUG}, timeout=60)
    resp.raise_for_status()
    payload = resp.json()
    if not payload.get("success"):
        raise RuntimeError("Falha na API CKAN do IBAMA. Conteúdo: " + json.dumps(payload)[:500])

    resources = payload["result"].get("resources", [])
    print(f"Recursos encontrados: {len(resources)}")
    for i, res in enumerate(resources, 1):
        print(f" - [{i}] {res.get('name') or res.get('id')} | format={res.get('format')} | url={res.get('url')}")

    # 2) Filtrar arquivos baixáveis
    valid_formats = {"CSV", "ZIP", "XLSX", "ODS"}
    candidate_resources = []
    for res in resources:
        fmt = (res.get("format") or "").upper().strip()
        url = res.get("url")
        if not url:
            continue
        ext = guess_ext(url)
        if fmt in valid_formats or ext in {".csv", ".zip", ".xlsx", ".xls", ".ods"}:
            candidate_resources.append(res)

    print(f"Recursos elegíveis p/ download: {len(candidate_resources)}")

    # 3) Download e extração
    downloaded_paths: list[str] = []
    for res in candidate_resources:
        url = res["url"]
        name = res.get("name") or res.get("id") or "arquivo"
        fmt = (res.get("format") or "").upper().strip()
        ext = guess_ext(url)
        if not ext:
            if fmt == "CSV":
                ext = ".csv"
            elif fmt == "ZIP":
                ext = ".zip"
            elif fmt in ("XLSX", "XLS", "ODS"):
                ext = "." + fmt.lower()
            else:
                ext = ""

        filename = safe_filename(f"{name}{ext}")
        dest_path = os.path.join(base_dir, filename)
        print(f"Baixando: {name} -> {dest_path}")
        try:
            download_file(url, dest_path)
            downloaded_paths.append(dest_path)
            if dest_path.lower().endswith(".zip"):
                with zipfile.ZipFile(dest_path, "r") as z:
                    z.extractall(extract_dir)
                print(f"  Extraído em: {extract_dir}")
        except Exception as e:
            print(f"  Erro ao baixar {url}: {e}")

    # 4) Listar tudo e abrir tabelas
    all_files: list[str] = []
    for root, _, files in os.walk(base_dir):
        for f in files:
            all_files.append(os.path.join(root, f))

    if not all_files:
        print("Nenhum arquivo baixado/encontrado.")
        return

    print("\nArquivos encontrados:")
    for p in sorted(all_files):
        print(" -", p)

    print("\nPré-visualização (3 linhas):")
    for p in sorted(all_files):
        lp = p.lower()
        try:
            if lp.endswith(".csv"):
                df = read_csv_preview(p, nrows=3)
                print(f"\nCSV: {p}")
                print(df.to_string(index=False))
            elif lp.endswith((".xlsx", ".xls", ".ods")):
                df = read_excel_preview(p, nrows=3)
                print(f"\nPLANILHA: {p}")
                print(df.to_string(index=False))
        except Exception:
            print(f"Falha ao ler {p}:")
            print(traceback.format_exc())


if __name__ == "__main__":
    main()







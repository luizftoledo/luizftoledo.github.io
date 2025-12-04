import os
from typing import List

import pandas as pd

try:
    import tabula  # type: ignore
except Exception as exc:  # pragma: no cover
    raise RuntimeError("tabula-py não está instalado. Instale com: pip install tabula-py pandas") from exc


def read_tables_from_page(pdf_path: str, page_number: int) -> List[pd.DataFrame]:
    """Lê tabelas de uma página usando primeiro o modo lattice; se não houver, tenta stream.

    Retorna uma lista (possivelmente vazia) de DataFrames.
    """
    # Primeiro tenta lattice (melhor para tabelas com linhas demarcatórias)
    try:
        tables = tabula.read_pdf(
            pdf_path,
            pages=str(page_number),
            multiple_tables=True,
            lattice=True,
            guess=True,
        ) or []
    except Exception:
        tables = []

    # Se nada encontrado, tenta stream (melhor para tabelas baseadas em espaçamento)
    if not tables:
        try:
            tables = tabula.read_pdf(
                pdf_path,
                pages=str(page_number),
                multiple_tables=True,
                lattice=False,
                stream=True,
                guess=True,
            ) or []
        except Exception:
            tables = []

    return tables


def clean_table(df: pd.DataFrame) -> pd.DataFrame:
    """Limpa uma tabela removendo colunas/linhas totalmente vazias e normalizando índices."""
    # Remove colunas completamente vazias
    df = df.dropna(axis=1, how="all")
    # Remove linhas completamente vazias
    df = df.dropna(axis=0, how="all")
    # Remove colunas duplicadas por nome quando houver
    if not df.empty:
        df = df.loc[:, ~df.columns.duplicated()]
    # Normaliza índices
    return df.reset_index(drop=True)


def extract_tables_to_csv(
    pdf_path: str,
    start_page: int,
    end_page: int,
    output_csv_path: str,
) -> None:
    """Extrai tabelas do PDF nas páginas especificadas e salva um CSV consolidado.

    - Adiciona coluna "page" indicando a página de origem.
    - Ignora tabelas muito pequenas (por exemplo, 1 coluna ou < 2 linhas significativas).
    """
    consolidated: List[pd.DataFrame] = []

    for page in range(start_page, end_page + 1):
        tables = read_tables_from_page(pdf_path, page)
        for table in tables:
            df = clean_table(table)
            # Filtra tabelas muito pequenas
            if df.shape[1] < 2 or df.shape[0] < 2:
                continue
            df.insert(0, "page", page)
            consolidated.append(df)

    if not consolidated:
        raise RuntimeError(
            f"Nenhuma tabela válida encontrada entre as páginas {start_page}-{end_page}."
        )

    # Alinhar colunas: concat com sort para unir esquemas distintos
    result = pd.concat(consolidated, ignore_index=True, sort=False)
    # Salva CSV em UTF-8 com BOM para melhor compatibilidade com Excel
    result.to_csv(output_csv_path, index=False, encoding="utf-8-sig")


if __name__ == "__main__":
    PDF_FILE = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "Laudo_140_2022_NUTEC_DPF_SNM_PA-dia-do-fogo-2-com-Apendice.pdf",
        )
    )
    OUTPUT_CSV = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "tabelas_laudo_pag10-43.csv",
        )
    )

    extract_tables_to_csv(PDF_FILE, 10, 43, OUTPUT_CSV)









import datetime
import pandas as pd
import requests
from fpdf import FPDF
from requests.exceptions import RequestException

# Dataset resource ID for autos de infração
RESOURCE_ID = "b2aba344-95df-43c0-b2ba-f4353cfd9a00"
DATASET_API = "https://dadosabertos.ibama.gov.br/api/3/action/package_show?id=fiscalizacao-auto-de-infracao"


def get_resource_url(resource_id: str) -> str:
    """Fetch package metadata and return the download URL for the given resource."""
    resp = requests.get(DATASET_API)
    resp.raise_for_status()
    data = resp.json()
    resources = data.get("result", {}).get("resources", [])
    for res in resources:
        if res.get("id") == resource_id:
            return res.get("url")
    raise ValueError("Resource ID not found")


def fetch_daily_data(url: str, date: datetime.date) -> pd.DataFrame:
    """Download the CSV file and filter rows for the given date."""
    df = pd.read_csv(url, sep=";", encoding="utf-8")
    date_col = "DATA_AUTO" if "DATA_AUTO" in df.columns else df.columns[0]
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    return df[df[date_col].dt.date == date]


def generate_pdf(data: pd.DataFrame, date: datetime.date, output: str):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(0, 10, f"Resumo de autos de infração do dia {date.isoformat()}", ln=True)
    pdf.ln(5)
    if data.empty:
        pdf.cell(0, 10, "Nenhum auto de infração encontrado para a data informada.", ln=True)
    else:
        pdf.cell(0, 10, f"Total de autos: {len(data)}", ln=True)
        pdf.ln(5)
        for _, row in data.iterrows():
            numero = row.get("NUMERO_AUTO", "N/A")
            valor = row.get("VALOR", "N/A")
            descricao = row.get("DESCRICAO", "")
            pdf.multi_cell(0, 10, f"Auto {numero} - Valor: {valor}\n{descricao}")
            pdf.ln(2)
    pdf.output(output)


def main():
    today = datetime.date.today()
    try:
        url = get_resource_url(RESOURCE_ID)
        daily_data = fetch_daily_data(url, today)
    except RequestException as exc:
        print(f"Erro ao baixar dados: {exc}")
        return
    output_file = f"autos_{today.isoformat()}.pdf"
    generate_pdf(daily_data, today, output_file)
    print(f"PDF gerado: {output_file}")


if __name__ == "__main__":
    main()

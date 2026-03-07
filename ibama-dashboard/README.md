# IBAMA Dashboard (GitHub Pages)

Dashboard estatico com dados de autos de infracao do IBAMA e ICMBio.

## Arquivos principais

- `index.html`: interface (scrollytelling, busca, exportacao, IA).
- `app.js`: logica da busca local e interacoes.
- `data/metadata.json`: metadados de atualizacao e contagens.
- `data/ibama_records.jsonl.gz`: base otimizada do IBAMA.
- `data/icmbio_records.jsonl.gz`: base otimizada do ICMBio.

## Atualizacao diaria (sem depender do seu computador)

Workflow: `.github/workflows/update-ibama-dashboard.yml`

- Agenda: 10:00 (horario de Brasilia), equivalente a `13:00 UTC`.
- Roda no GitHub Actions.
- Baixa as fontes oficiais.
- Compara tamanho da fonte nova com a anterior.
- Se a nova for menor, nao substitui.
- Se for maior (ou igual), gera novos `.jsonl.gz` e atualiza `metadata.json`.
- Faz commit automatico em `main`.

## Build manual local

```bash
cd <seu-repositorio>
python3 scripts/build_ibama_dashboard_data.py
```

Forcar atualizacao ignorando comparacao de tamanho:

```bash
python3 scripts/build_ibama_dashboard_data.py --force
```

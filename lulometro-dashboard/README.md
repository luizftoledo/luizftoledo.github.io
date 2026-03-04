# Lulometro (GitHub Pages)

Dashboard para comparar discursos e entrevistas de presidentes brasileiros por palavra-chave.

## Entregas

- `index.html`: interface principal do dashboard.
- `app.js`: busca, filtros, gráficos e tabela.
- `data/records.jsonl.gz`: base completa com textos integrais.
- `data/items.json`: tabela de metadados para consumo rápido.
- `data/super_tabela.csv`: exportação tabular (data, nome, local, link, etc.).
- `data/metadata.json`: status da atualização diária.
- `data/sources.json`: diagnóstico de fontes e rastreamento.

## Atualização diária

Workflow: `.github/workflows/update-lulometro-dashboard.yml`

Pipeline:

1. Rastreia listagens do Planalto (`entrevistas`, `discursos-e-pronunciamentos`).
2. Rastreia ex-presidentes na Biblioteca da Presidência.
3. Atualiza incrementalmente apenas URLs novas/incompletas.
4. Regrava os arquivos em `lulometro-dashboard/data`.
5. Sincroniza a base no BigQuery (quando secrets/vars estiverem configurados).
6. Faz commit automático somente quando há mudança.

## BigQuery + Looker Studio

Script de sincronização:

- `scripts/sync_lulometro_bigquery.py`

Tabelas criadas/atualizadas no dataset:

- `records` (texto completo, `WRITE_TRUNCATE` a cada atualização)
- `items` (metadados leves, `WRITE_TRUNCATE`)
- `pipeline_runs` (histórico de execuções, `WRITE_APPEND`)
- View `records_light` (sem campo de texto integral)
- View `records_full_text` (com campo `text`)

Configuração no GitHub (repo settings):

1. Secret `GCP_SA_KEY`: JSON completo da service account.
2. Variable `BQ_PROJECT_ID`: id do projeto GCP.
3. Variable `BQ_DATASET`: dataset do BigQuery.
4. Variable opcional `BQ_LOCATION`: localização do dataset (default `US`).

Com isso, o workflow diário já faz raspagem + publicação no site + upload no BigQuery para consumo no Looker Studio.

Fallbacks configurados no workflow (quando as variables não existirem):

- `BQ_PROJECT_ID`: `militares-376417`
- `BQ_DATASET`: `militares`
- `BQ_LOCATION`: `US`

Ou seja, com o secret `GCP_SA_KEY` já definido, o upload ao BigQuery pode rodar mesmo sem criar variables no GitHub.

## Build local

```bash
cd <repo>
python3 scripts/build_lulometro_data.py
```

Sincronizar para BigQuery manualmente:

```bash
python3 scripts/sync_lulometro_bigquery.py \
  --project <gcp_project_id> \
  --dataset <bq_dataset> \
  --location US
```

Modo debug (limita novos fetches):

```bash
python3 scripts/build_lulometro_data.py --max-new-details 100
```

Modo em lotes (útil para recuperar base grande sem perder progresso):

```bash
python3 scripts/build_lulometro_data.py --skip-crawl --max-details 2000
```

Evitar insistir em URLs que já falharam várias vezes:

```bash
python3 scripts/build_lulometro_data.py --max-failures 3
```

Forçar refetch de detalhes:

```bash
python3 scripts/build_lulometro_data.py --force-details
```

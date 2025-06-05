# Ibama Daily Scraper

Este script baixa o dataset de autos de infração do Ibama por meio da API de dados abertos e gera um PDF com o resumo dos autos do dia corrente.

## Como usar

1. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

2. Execute o script:
   ```bash
   python ibama_scraper.py
   ```

Um arquivo `autos_<data>.pdf` será criado no mesmo diretório com o resumo do dia.
Abra esse PDF com seu leitor de PDF favorito para visualizar o resultado.

Para agendar a execução diária em um sistema Linux, adicione o script ao `cron`.

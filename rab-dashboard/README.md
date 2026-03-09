# RAB Dashboard

Dashboard estática para pesquisa de proprietários de aeronaves (RAB/ANAC).

## Campos de busca
- Prefixo da aeronave
- Nome do proprietário
- CPF/CNPJ (com ou sem pontuação)

A pesquisa é case-insensitive e accent-insensitive.

## Base usada
Arquivo escolhido: `aeronaves_proprietarios.csv` (RAB), por concentrar os campos de titularidade (`prefixo`, `nome` e `cpf/cnpj`) necessários para investigação de donos de aeronaves.

## Limitações de execução neste ambiente
Tentativas de download direto dos arquivos oficiais em `gov.br` e `sistemas.anac.gov.br` retornaram `HTTP 403` no proxy deste ambiente de execução. A dashboard foi publicada com o esquema final e pronta para receber o snapshot completo em `data/rab_owners_snapshot.json`.

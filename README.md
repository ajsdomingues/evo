# Evo

Aplicação local para carregar folhas de prémio (xls/xlsx) de várias semanas
e visualizar a evolução do prémio por operador ao longo do tempo.

## Stack

- Next.js 16 (App Router)
- React 19
- PostgreSQL (`pg`)
- `xlsx` para parsing de ficheiros
- Recharts para gráficos

## Setup

1. Instalar dependências:

   ```
   npm install
   ```

2. Criar uma base de dados PostgreSQL local, p. ex.:

   ```
   createdb evo
   ```

3. Copiar `.env.example` para `.env` e preencher `DATABASE_URL`:

   ```
   cp .env.example .env
   ```

4. Correr em modo dev:

   ```
   npm run dev
   ```

   A tabela `premios` é criada automaticamente na primeira chamada a qualquer
   endpoint.

5. Abrir http://localhost:3000

## Produção

```
npm run build
npm run start
```

## Formato dos ficheiros xls

O parser suporta três formatos, detetados automaticamente:

- **Padrão**: colunas `operador | nome | prémio | data`
- **Pivotado**: datas como cabeçalhos de coluna, valores do prémio por célula
- **Fim-de-semana**: cabeçalhos com data + turno (p. ex. `08/03/2026 Domingo (00h-08h)`)

## Deduplicação

Cada linha (operador, prémio, data, turno) é única via índice
`uq_premios_dedup`. Re-carregar o mesmo ficheiro não duplica registos.

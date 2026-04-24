# Evo

Aplicação local para carregar folhas de prémio (xls/xlsx) de várias semanas
e visualizar a evolução do prémio por operador ao longo do tempo.

## Stack

- Next.js 16 (App Router)
- React 19
- PostgreSQL (`pg`)
- `xlsx` para parsing de ficheiros
- Recharts para gráficos

## Instalação numa Debian 13 fresca

Comandos como root (se não for root, prefixa `sudo`).

### 1. Dependências do sistema

```bash
apt update
apt install -y curl ca-certificates gnupg git npm postgresql postgresql-contrib
```

> Se a versão do `nodejs` vinda do apt for < 20, instala via NodeSource:
> ```bash
> curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
> apt install -y nodejs
> ```

Verifica:
```bash
node -v    # >= 20
npm -v
psql --version
```

### 2. Arrancar Postgres e criar a base de dados

```bash
service postgresql start
su - postgres -c "createuser -s root"
su - postgres -c "createdb evo"
su - postgres -c "psql -c \"ALTER USER root WITH PASSWORD 'evo';\""
```

### 3. Clonar e instalar o projeto

```bash
cd /root
git clone https://github.com/ajsdomingues/evo.git
cd evo
npm install
```

### 4. Configurar ligação à BD

```bash
echo 'DATABASE_URL=postgres://root:evo@localhost:5432/evo' > .env
```

### 5. Correr em dev

```bash
npm run dev
```

Abre `http://localhost:3000` ou, se acedes de outra máquina, `http://<ip>:3000`.
Para permitir um IP específico de rede, edita `next.config.ts` e acrescenta-o
a `allowedDevOrigins`.

A tabela `premios` é criada automaticamente no primeiro request.

## Produção

```bash
npm run build
npm run start      # porta 3000 por defeito
# npm run start -- -p 3200   # outra porta
```

## Formato dos ficheiros xls

O parser suporta três formatos, detetados automaticamente:

- **Padrão**: colunas `operador | nome | prémio | data`
- **Pivotado**: datas como cabeçalhos de coluna, valores do prémio por célula
- **Fim-de-semana**: cabeçalhos com data + turno (p. ex. `08/03/2026 Domingo (00h-08h)`)

## Deduplicação

Cada linha (operador, prémio, data, turno) é única via índice
`uq_premios_dedup`. Re-carregar o mesmo ficheiro não duplica registos.

#!/bin/bash
# Inicia o servidor do app de casamento e abre no navegador

cd "$(dirname "$0")"

echo ""
echo "💍 Casamento de Scarlet & Matheus"
echo "   Iniciando servidor..."
echo ""

# Verifica se o node está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale em: https://nodejs.org"
    exit 1
fi

# Instala dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Abre o Safari após 1 segundo
(sleep 1 && open -a Safari http://localhost:3333) &

# Inicia o servidor
node server.js

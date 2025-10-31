#!/bin/bash

# ========================================
# BOTOF C - INSTALAÇÃO AUTOMÁTICA
# REPO: https://github.com/werbertofc/Bot-ofc
# NÃO CRIA media (já existe no GitHub)
# ========================================

echo "========================================"
echo "   BOTOF C - INSTALAÇÃO DO GITHUB"
echo "   REPO: werbertofc/Bot-ofc"
echo "========================================"

# 1. URL do repositório
REPO_URL="https://github.com/werbertofc/Bot-ofc.git"

# 2. Atualiza ou clona
if [ -d ".git" ]; then
  echo "[1/4] Atualizando bot do GitHub..."
  git pull || echo "Aviso: git pull falhou, continuando..."
else
  echo "[1/4] Clonando bot do GitHub..."
  rm -rf * 2>/dev/null || true
  git clone "$REPO_URL" . || {
    echo "ERRO: Não foi possível clonar!"
    echo "Link: $REPO_URL"
    exit 1
  }
fi

# 3. Instala Node.js (se necessário)
echo "[2/4] Verificando Node.js..."
if ! command -v node &> /dev/null; then
  echo "Node.js não encontrado. Instalando..."
  pkg install -y nodejs
fi

# 4. Instala dependências
echo "[3/4] Instalando node_modules..."
npm install --no-bin-links @whiskeysockets/baileys pino qrcode-terminal

# 5. Finaliza
echo "[4/4] Tudo pronto!"

# ========================================
echo ""
echo "INSTALAÇÃO CONCLUÍDA!"
echo "REPOSITÓRIO: https://github.com/werbertofc/Bot-ofc"
echo ""
echo "PARA INICIAR:"
echo "   node index.js"
echo ""
echo "RECOMENDADO (nunca cai):"
echo "   npm install -g pm2"
echo "   pm2 start index.js --name botofc"
echo "   pm2 startup"
echo "   pm2 save"
echo ""
echo "QR CODE VAI APARECER!"
echo "ESCANEIE COM O WHATSAPP OFICIAL"
echo "========================================"

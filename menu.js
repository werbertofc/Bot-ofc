// menu.js - MENU COM IMAGEM + TEXTO
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MENU_IMAGE = path.join(__dirname, 'media', 'menu.jpg');

export const enviarMenu = async (sock, from) => {
  const caption = `
*BOT OFC - MENU*
criador: @werbert_ofc

*GRUPOS*
/grupos → Lista seus grupos
/addgrupo <nome> → Autoriza
/remgrupo <nome> → Remove
/listagrupos → Grupos permitidos

*ANÚNCIOS*
/anuncio <nome> <texto> → Cria (cite mídia)
/listar → Todos os anúncios
/ver <nome> → Mostra
/usar <nome> → Ativo manual
/autoanuncio <nome> → Ativa auto
/desativarauto → Desliga auto

*CONFIG*
/delay 30 → Define delay base
/enviaragora → Envia ativo agora

*STATUS*
/status → Status completo
  `.trim();

  try {
    if (fs.existsSync(MENU_IMAGE)) {
      await sock.sendMessage(from, {
        image: fs.readFileSync(MENU_IMAGE),
        caption: caption
      });
      console.log(`[MENU] Enviado com IMAGEM LOCAL`);
    } else {
      await sock.sendMessage(from, {
        image: { url: 'https://i.imgur.com/8Y3g9.jpg' },
        caption: caption
      });
      console.log(`[MENU] Enviado com IMAGEM ONLINE (fallback)`);
    }
  } catch (err) {
    console.log(`[ERRO MENU] ${err.message}`);
    await sock.sendMessage(from, { text: caption });
  }
};

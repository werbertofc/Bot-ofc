// index.js - BotOfc (WHATSAPP + RECONEXÃO + ANTI-BAN + TODAS FUNÇÕES)
import makeWASocket, { useMultiFileAuthState, DisconnectReason, downloadMediaMessage } from "@whiskeysockets/baileys";
import P from "pino";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import qrcode from 'qrcode-terminal';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// === CONFIGURAÇÃO ===
const config = {
  prefixo: "/",
  dono: "558688950534",
  delay_padrao: 20
};

const ownerJid = `${config.dono.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

let grupos = [];
let anuncios = { anuncios: {}, anuncio_ativo: null, anuncio_auto: null, delay: config.delay_padrao };
let ultimaMensagem = {};
let ultimaEnvioGrupo = {};
let delayEnvio = config.delay_padrao;

// === LOGS ===
const log = (msg) => console.log(`[BOT] ${new Date().toLocaleTimeString()} → ${msg}`);

// === CARREGAR DADOS ===
if (fs.existsSync("./grupos.json")) grupos = JSON.parse(fs.readFileSync("./grupos.json", "utf-8"));
if (fs.existsSync("./anuncios.json")) {
  const loaded = JSON.parse(fs.readFileSync("./anuncios.json", "utf-8"));
  anuncios = { ...anuncios, ...loaded };
}
delayEnvio = anuncios.delay || config.delay_padrao;

const salvar = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// === SESSÃO ===
const authDir = "./QR-SALVO/auth";
const isLoggedIn = fs.existsSync(path.join(authDir, "creds.json"));

if (!isLoggedIn && fs.existsSync(authDir)) {
  log("Apagando sessão antiga...");
  fs.rmSync(authDir, { recursive: true, force: true });
}

const { state, saveCreds } = await useMultiFileAuthState(authDir);

let sock;

// === ANTI-BAN ===
const getRandomDelay = () => Math.floor(Math.random() * (45000 - 15000 + 1)) + 15000;
const podeEnviar = (groupId) => {
  const agora = Date.now();
  const ultimo = ultimaEnvioGrupo[groupId] || 0;
  if ((agora - ultimo) < 10 * 60 * 1000) {
    log(`[ANTI-BAN] Ignorando grupo ${groupId.split('@')[0]} (já enviado nos últimos 10 min)`);
    return false;
  }
  ultimaEnvioGrupo[groupId] = agora;
  return true;
};

// === INICIAR BOT ===
const startBot = () => {
  sock = makeWASocket({
    printQRInTerminal: false,
    auth: state,
    logger: P({ level: "silent" }),
    browser: ["BotOfc", "Chrome", "1.0"],
    reconnect: true,
    maxRetries: Infinity
  });

  // === CONEXÃO ===
  sock.ev.on("connection.update", (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr && !isLoggedIn) {
      console.clear();
      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║        BOTOF C - ESCANEIE O QR CODE      ║');
      console.log('║           COM O WHATSAPP OFICIAL         ║');
      console.log('╚══════════════════════════════════════════╝\n');
      qrcode.generate(qr, { small: true });
      console.log('\n');
      log("QR GERADO – ESCANEIE AGORA!");
    }

    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        log("Conexão perdida. Reconectando em 5 segundos...");
        setTimeout(startBot, 5000);
      } else {
        log("Deslogado. Apague QR-SALVO para novo login.");
      }
    } else if (connection === "open") {
      console.clear();
      log("BOT CONECTADO COM SUCESSO!");
      if (!isLoggedIn) {
        log("Sessão salva em: ./QR-SALVO/auth");
        log("Para novo número: rm -rf ./QR-SALVO");
      }
      log("ANTI-BAN ATIVADO: 10 min por grupo + delay aleatório");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // === MENSAGENS ===
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const senderName = msg.pushName || sender.split('@')[0];
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const isGroup = from.endsWith("@g.us");

    log(`Mensagem de ${senderName} (${isGroup ? 'GRUPO' : 'PV'}): ${body}`);

    // RESPOSTA AUTOMÁTICA
    if (isGroup && grupos.includes(from) && anuncios.anuncio_auto) {
      const agora = Date.now();
      if (!ultimaMensagem[from] || agora - ultimaMensagem[from] > 10000) {
        ultimaMensagem[from] = agora;
        const delayAleatorio = getRandomDelay();
        setTimeout(() => {
          if (podeEnviar(from)) {
            enviarAnuncio(from, anuncios.anuncio_auto);
          }
        }, delayAleatorio);
        log(`Auto-resposta agendada (delay: ${delayAleatorio/1000}s)`);
      }
    }

    if (!body.startsWith(config.prefixo) || sender !== ownerJid) return;

    const args = body.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    log(`Comando do dono: /${cmd} ${args.join(' ')}`);

    const enviar = (texto) => sock.sendMessage(from, { text: texto }, { quoted: msg });

    // === MENU ===
    if (cmd === "menu") {
      const menu = `
*BOT OFC - MENU*
criador: @werbert_ofc
/grupos → Lista seus grupos
/addgrupo <nome> → Autoriza
/remgrupo <nome> → Remove
/listagrupos → Grupos permitidos

/anuncio <nome> <texto> → Cria (cite mídia)
/listar → Todos os anúncios
/ver <nome> → Mostra
/usar <nome> → Ativo manual
/autoanuncio <nome> → Ativa auto
/desativarauto → Desliga auto
/delay 30 → Define delay base
/enviaragora → Envia ativo agora
/status → Status completo
      `.trim();
      return enviar(menu);
    }

    // === GRUPOS ===
    if (cmd === "grupos") {
      const groups = await sock.groupFetchAllParticipating();
      const lista = Object.values(groups).map(g => `• ${g.subject}`).join("\n") || "Nenhum grupo.";
      return enviar(`*SEUS GRUPOS (copie o nome exato):*\n\n${lista}`);
    }

    if (cmd === "addgrupo") {
      const nome = args.join(" ");
      const groups = await sock.groupFetchAllParticipating();
      const grupo = Object.values(groups).find(g => g.subject === nome);
      if (!grupo) return enviar("Grupo não encontrado. Use /grupos");
      if (grupos.includes(grupo.id)) return enviar("Já autorizado!");
      grupos.push(grupo.id);
      salvar("./grupos.json", grupos);
      return enviar(`Autorizado: ${nome}`);
    }

    if (cmd === "remgrupo") {
      const nome = args.join(" ");
      const groups = await sock.groupFetchAllParticipating();
      const grupo = Object.values(groups).find(g => g.subject === nome);
      if (!grupo) return enviar("Grupo não encontrado.");
      grupos = grupos.filter(id => id !== grupo.id);
      salvar("./grupos.json", grupos);
      return enviar(`Removido: ${nome}`);
    }

    if (cmd === "listagrupos") {
      if (grupos.length === 0) return enviar("Nenhum grupo autorizado.");
      const lista = await Promise.all(grupos.map(async id => {
        try {
          const meta = await sock.groupMetadata(id);
          return `• ${meta.subject}`;
        } catch { return `• ID: ${id.split("@")[0]} (inválido)`; }
      }));
      return enviar(`*GRUPOS AUTORIZADOS (${grupos.length}):*\n\n${lista.join("\n")}`);
    }

    // === ANÚNCIOS ===
    if (cmd === "anuncio") {
      if (args.length < 2) return enviar("Use: /anuncio <nome> <texto>\nResponda imagem/vídeo!");

      const nome = args[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const texto = args.slice(1).join(" ");

      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted || (!quoted.imageMessage && !quoted.videoMessage)) {
        return enviar("Responda uma imagem ou vídeo!");
      }

      log("Baixando mídia citada...");
      try {
        const buffer = await downloadMediaMessage(
          { key: msg.key, message: quoted },
          'buffer',
          {},
          { logger: P({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
        );

        const tipo = quoted.imageMessage ? "image" : "video";
        const ext = tipo === "image" ? ".jpg" : ".mp4";
        const caminho = `./media/anuncio_${nome}${ext}`;
        fs.mkdirSync("./media", { recursive: true });
        fs.writeFileSync(caminho, buffer);
        log(`Mídia salva: ${caminho}`);

        anuncios.anuncios[nome] = { texto, midia: caminho, tipo };
        salvar("./anuncios.json", anuncios);

        return enviar(`Anúncio *${nome}* salvo!\nUse: /usar ${nome} ou /autoanuncio ${nome}`);
      } catch (err) {
        log(`Erro ao baixar: ${err.message}`);
        return enviar("Erro ao salvar mídia. Tente novamente.");
      }
    }

    if (cmd === "listar") {
      const lista = Object.keys(anuncios.anuncios)
        .map(n => {
          const ativo = anuncios.anuncio_ativo === n ? " (ATIVO)" : "";
          const auto = anuncios.anuncio_auto === n ? " (AUTO)" : "";
          return `• ${n}${ativo}${auto}`;
        })
        .join("\n") || "Nenhum anúncio.";
      return enviar(`*ANÚNCIOS*\n\n${lista}`);
    }

    if (cmd === "ver" && args[0]) {
      const nome = args[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const a = anuncios.anuncios[nome];
      if (!a) return enviar("Anúncio não existe.");
      return enviar(`*${nome}*\n\n${a.texto}\nMídia: ${a.tipo}`);
    }

    if (cmd === "usar" && args[0]) {
      const nome = args[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!anuncios.anuncios[nome]) return enviar("Anúncio não existe.");
      anuncios.anuncio_ativo = nome;
      salvar("./anuncios.json", anuncios);
      return enviar(`Anúncio ATIVO: *${nome}*`);
    }

    if (cmd === "autoanuncio" && args[0]) {
      const nome = args[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!anuncios.anuncios[nome]) return enviar("Anúncio não existe. Use /listar");
      const anterior = anuncios.anuncio_auto;
      anuncios.anuncio_auto = nome;
      salvar("./anuncios.json", anuncios);
      return enviar(anterior ? `Auto alterado para *${nome}*` : `Auto ativado: *${nome}*`);
    }

    if (cmd === "desativarauto") {
      if (!anuncios.anuncio_auto) return enviar("Auto já está OFF.");
      const anterior = anuncios.anuncio_auto;
      anuncios.anuncio_auto = null;
      salvar("./anuncios.json", anuncios);
      return enviar(`Auto DESATIVADO (era: *${anterior}*)`);
    }

    if (cmd === "delay") {
      const seg = parseInt(args[0]);
      if (isNaN(seg) || seg < 5) return enviar("Use: /delay 20 (mínimo 5)");
      delayEnvio = seg;
      anuncios.delay = seg;
      salvar("./anuncios.json", anuncios);
      return enviar(`Delay base: ${seg}s (aleatório: ${seg}-45s)`);
    }

    if (cmd === "enviaragora") {
      if (!anuncios.anuncio_ativo) return enviar("Defina um anúncio ativo com /usar");
      let success = 0;
      for (const id of grupos) {
        if (podeEnviar(id)) {
          try {
            await enviarAnuncio(id, anuncios.anuncio_ativo);
            success++;
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 4000) + 3000));
          } catch (e) { log(`Erro ao enviar para ${id}`); }
        }
      }
      return enviar(`Enviado para ${success}/${grupos.length} grupos!`);
    }

    if (cmd === "status") {
      return enviar(`
*STATUS DO BOT*

Dono: ${config.dono}
Grupos autorizados: ${grupos.length}
Anúncios: ${Object.keys(anuncios.anuncios).length}
Ativo: ${anuncios.anuncio_ativo || "Nenhum"}
Auto: ${anuncios.anuncio_auto ? anuncios.anuncio_auto + " (ON)" : "OFF"}
Delay base: ${delayEnvio}s
ANTI-BAN: 10 min por grupo + delay aleatório
RECONEXÃO: AUTOMÁTICA
      `.trim());
    }
  });
};

// === ENVIO COM ANTI-BAN ===
const enviarAnuncio = async (to, nome) => {
  const a = anuncios.anuncios[nome];
  if (!a) return;

  const opts = { caption: a.texto };
  if (a.midia && fs.existsSync(a.midia)) {
    opts[a.tipo] = fs.readFileSync(a.midia);
  } else {
    opts.text = a.texto;
  }

  try {
    await sock.sendMessage(to, opts);
    log(`[OK] Anúncio "${nome}" enviado para: ${to.split('@')[0]}`);
  } catch (e) {
    log(`[ERRO] Falha ao enviar para: ${to.split('@')[0]}`);
  }
};

// === INICIAR ===
startBot();
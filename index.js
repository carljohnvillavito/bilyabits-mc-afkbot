const bedrock = require('bedrock-protocol');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const WEB_PORT = parseInt(process.env.PORT) || 3000;

const config = {
  host: process.env.MC_HOST || 'thehulagens.aternos.me',
  port: parseInt(process.env.MC_PORT) || 40436,
  username: process.env.MC_USERNAME || 'emeraldgod3v',
  offline: false,
  profilesFolder: './auth',
  afkMode: process.env.AFK_MODE || 'passive',
  afkMessage: process.env.AFK_MESSAGE || 'I am AFK',
  reconnectDelay: 30000,
  maxReconnectAttempts: 50,
  connectTimeout: 15000
};

let client = null;
let reconnectAttempts = 0;
let antiAfkInterval = null;
let reconnectTimeout = null;
let isConnecting = false;
let botStatus = 'starting';
let lastError = null;
let connectedAt = null;

function isAuthConfigured() {
  try {
    const authDir = path.resolve(config.profilesFolder);
    if (!fs.existsSync(authDir)) return false;
    const files = fs.readdirSync(authDir);
    return files.length > 0;
  } catch (e) {
    return false;
  }
}

function startAntiAfk() {
  if (antiAfkInterval) clearInterval(antiAfkInterval);

  console.log(`[Anti-AFK] Starting in ${config.afkMode.toUpperCase()} mode`);

  antiAfkInterval = setInterval(() => {
    if (!client) return;

    if (config.afkMode === 'active') {
      try {
        client.queue('text', {
          type: 'chat',
          needs_translation: false,
          source_name: client.username,
          xuid: '',
          platform_chat_id: '',
          message: `[Bot] ${config.afkMessage} - ${new Date().toLocaleTimeString()}`
        });
        console.log(`[Anti-AFK] Sent active ping: ${config.afkMessage}`);
      } catch (err) {
        console.error(`[Anti-AFK] Error sending packet: ${err.message}`);
      }
    } else {
      console.log('[Anti-AFK] Bot is connected and chilling...');
    }
  }, 60000);
}

function stopAntiAfk() {
  if (antiAfkInterval) {
    clearInterval(antiAfkInterval);
    antiAfkInterval = null;
  }
}

function cleanupClient() {
  if (client) {
    try {
      client.removeAllListeners();
      client.close();
    } catch (e) {
    }
    client = null;
  }
  stopAntiAfk();
}

function connect() {
  if (isConnecting) {
    console.log('[Bot] Already connecting, skipping duplicate attempt...');
    return;
  }

  isConnecting = true;
  botStatus = 'connecting';
  lastError = null;

  cleanupClient();

  console.log(`[Bot] Connecting to ${config.host}:${config.port}...`);
  console.log(`[Bot] User: ${config.username}`);

  try {
    client = bedrock.createClient({
      host: config.host,
      port: config.port,
      username: config.username,
      offline: config.offline,
      skipPing: false,
      followPort: true,
      profilesFolder: config.profilesFolder,
      connectTimeout: config.connectTimeout,
      conLog: console.log
    });

    function onBotReady(event) {
      if (botStatus === 'connected') return;
      console.log(`[Bot] Successfully ${event === 'join' ? 'joined' : 'spawned in'} the server!`);
      reconnectAttempts = 0;
      isConnecting = false;
      botStatus = 'connected';
      connectedAt = new Date().toISOString();
      startAntiAfk();
    }

    client.on('join', () => onBotReady('join'));
    client.on('spawn', () => onBotReady('spawn'));

    client.on('text', (packet) => {
      if (packet.type === 'chat' || packet.type === 'announcement') {
        console.log(`[Chat] ${packet.source_name || 'Server'}: ${packet.message}`);
      }
    });

    client.on('disconnect', (packet) => {
      const reason = packet.message || 'Unknown reason';
      console.warn(`[Bot] Disconnected: ${reason}`);
      lastError = `Disconnected: ${reason}`;
      botStatus = 'disconnected';
      isConnecting = false;
      connectedAt = null;
      cleanupClient();
      scheduleReconnect();
    });

    client.on('kick', (reason) => {
      const msg = reason.message || JSON.stringify(reason);
      console.warn(`[Bot] Kicked: ${msg}`);
      lastError = `Kicked: ${msg}`;
      botStatus = 'kicked';
      isConnecting = false;
      connectedAt = null;
      cleanupClient();
      scheduleReconnect();
    });

    client.on('error', (err) => {
      console.error(`[Bot] Error: ${err.message}`);
      lastError = err.message;
      botStatus = 'error';
      isConnecting = false;
      connectedAt = null;
      cleanupClient();
      scheduleReconnect();
    });

    client.on('close', () => {
      console.log('[Bot] Connection closed');
      isConnecting = false;
      if (botStatus !== 'error' && botStatus !== 'disconnected' && botStatus !== 'kicked') {
        botStatus = 'disconnected';
        connectedAt = null;
        cleanupClient();
        scheduleReconnect();
      }
    });

  } catch (err) {
    console.error(`[Bot] Failed to create client: ${err.message}`);
    lastError = err.message;
    botStatus = 'error';
    isConnecting = false;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (reconnectAttempts >= config.maxReconnectAttempts) {
    console.error('[Bot] Max reconnect attempts reached. Waiting 5 minutes before retrying...');
    reconnectAttempts = 0;
    reconnectTimeout = setTimeout(connect, 300000);
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(config.reconnectDelay * reconnectAttempts, 300000);
  console.log(`[Bot] Reconnecting in ${delay / 1000}s (Attempt ${reconnectAttempts}/${config.maxReconnectAttempts})...`);
  botStatus = 'reconnecting';

  reconnectTimeout = setTimeout(connect, delay);
}

const shutdown = () => {
  console.log('\n[Bot] Shutting down gracefully...');
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  cleanupClient();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

app.get('/', (req, res) => {
  res.json({
    name: 'Bilyabits MC AFK Bot',
    status: botStatus,
    target: `${config.host}:${config.port}`,
    mode: config.afkMode,
    reconnectAttempts: reconnectAttempts,
    connectedAt: connectedAt,
    lastError: lastError,
    authConfigured: isAuthConfigured(),
    uptime: process.uptime()
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(WEB_PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('Bilyabits Minecraft Bedrock AFK Bot');
  console.log('='.repeat(50));
  console.log(`Web server: http://0.0.0.0:${WEB_PORT}`);
  console.log(`Target: ${config.host}:${config.port}`);
  console.log(`Mode:   ${config.afkMode.toUpperCase()}`);
  console.log('='.repeat(50));

  const hasAuth = isAuthConfigured();

  if (hasAuth) {
    console.log('[Auth] Microsoft account found in auth folder. Using saved credentials.');
  } else {
    console.log('[Auth] No Microsoft account configured. Authentication will be required.');
    console.log('[Auth] You will be prompted to sign in with your Microsoft account...');
  }

  console.log('[Bot] Starting connection to Minecraft server...');
  connect();
});

const bedrock = require('bedrock-protocol');
const express = require('express');

const app = express();
const WEB_PORT = parseInt(process.env.PORT) || 10000;

const config = {
  host: process.env.MC_HOST || 'TheHulagens.aternos.me',
  port: parseInt(process.env.MC_PORT) || 40436,
  username: process.env.MC_USERNAME || 'emeraldgod3v',
  offline: false,
  profilesFolder: './auth',
  afkMode: process.env.AFK_MODE || 'passive',
  afkMessage: process.env.AFK_MESSAGE || 'I am AFK',
  reconnectDelay: 30000,
  maxReconnectAttempts: 50
};

let client = null;
let reconnectAttempts = 0;
let antiAfkInterval = null;
let reconnectTimeout = null;
let isConnecting = false;
let botStatus = 'starting';

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

  cleanupClient();

  console.log(`[Bot] Connecting to ${config.host}:${config.port}...`);
  console.log(`[Bot] User: ${config.username}`);

  try {
    client = bedrock.createClient({
      host: config.host,
      port: config.port,
      username: config.username,
      offline: config.offline,
      skipPing: true,
      profilesFolder: config.profilesFolder,
      conLog: console.log
    });

    client.on('join', () => {
      console.log('[Bot] Successfully joined the server!');
      reconnectAttempts = 0;
      isConnecting = false;
      botStatus = 'connected';
      startAntiAfk();
    });

    client.on('spawn', () => {
      console.log('[Bot] Spawned in the world!');
    });

    client.on('text', (packet) => {
      if (packet.type === 'chat' || packet.type === 'announcement') {
        console.log(`[Chat] ${packet.source_name || 'Server'}: ${packet.message}`);
      }
    });

    client.on('disconnect', (packet) => {
      console.warn(`[Bot] Disconnected: ${packet.message || 'Unknown reason'}`);
      botStatus = 'disconnected';
      isConnecting = false;
      cleanupClient();
      scheduleReconnect();
    });

    client.on('kick', (reason) => {
      console.warn(`[Bot] Kicked: ${reason.message || JSON.stringify(reason)}`);
      botStatus = 'kicked';
      isConnecting = false;
      cleanupClient();
      scheduleReconnect();
    });

    client.on('error', (err) => {
      console.error(`[Bot] Error: ${err.message}`);
      botStatus = 'error';
      isConnecting = false;
      cleanupClient();
      scheduleReconnect();
    });

    client.on('close', () => {
      console.log('[Bot] Connection closed');
      isConnecting = false;
      if (botStatus !== 'error' && botStatus !== 'disconnected' && botStatus !== 'kicked') {
        botStatus = 'disconnected';
        cleanupClient();
        scheduleReconnect();
      }
    });

  } catch (err) {
    console.error(`[Bot] Failed to create client: ${err.message}`);
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

  connect();
});


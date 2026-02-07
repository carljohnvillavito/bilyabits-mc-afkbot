const bedrock = require('bedrock-protocol');

// Configuration
const config = {
  host: process.env.MC_HOST || 'TheHulagens.aternos.me',
  port: parseInt(process.env.MC_PORT) || 19132, // Default Bedrock port
  username: process.env.MC_USERNAME || 'AFKBot',
  offline: false, // Microsoft auth always required for Bedrock
  profilesFolder: './auth', // Persistent auth storage
  // AFK Mode: 'passive' (stay connected silently) or 'active' (send chat/movements)
  afkMode: process.env.AFK_MODE || 'passive', 
  // Message to send in active mode
  afkMessage: process.env.AFK_MESSAGE || 'I am AFK',
  // Reconnection settings
  reconnectDelay: 30000,
  maxReconnectAttempts: 50
};

let client = null;
let reconnectAttempts = 0;
let antiAfkInterval = null;

// --- Anti-AFK Logic ---

function startAntiAfk() {
  if (antiAfkInterval) clearInterval(antiAfkInterval);
  
  console.log(`[Anti-AFK] Starting in ${config.afkMode.toUpperCase()} mode`);
  
  antiAfkInterval = setInterval(() => {
    if (!client) return;

    if (config.afkMode === 'active') {
      // ACTIVE MODE: Send chat message to prevent idle kick
      // Useful for servers that kick strictly for lack of packets
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
      // PASSIVE MODE: Just log status
      // Best for Aternos/strict anti-cheats that might flag automated packets
      console.log('[Anti-AFK] Bot is connected and chilling...');
    }
  }, 60000); // Every 60 seconds
}

function stopAntiAfk() {
  if (antiAfkInterval) {
    clearInterval(antiAfkInterval);
    antiAfkInterval = null;
  }
}

// --- Connection Logic ---

function connect() {
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
      // Fix for some server protocol versions
      conLog: console.log 
    });

    client.on('join', () => {
      console.log('✅ [Bot] Successfully joined the server!');
      reconnectAttempts = 0;
      startAntiAfk();
    });

    client.on('spawn', () => {
      console.log('🌍 [Bot] Spawned in the world!');
    });

    client.on('text', (packet) => {
      if (packet.type === 'chat' || packet.type === 'announcement') {
        // Optional: Log chat to console to monitor server
        // console.log(`[Chat] ${packet.source_name || 'Server'}: ${packet.message}`);
      }
    });

    client.on('disconnect', (packet) => {
      console.warn(`⚠️ [Bot] Disconnected: ${packet.message || 'Unknown reason'}`);
      stopAntiAfk();
      scheduleReconnect();
    });

    client.on('kick', (reason) => {
      console.warn(`🛑 [Bot] Kicked: ${reason.message || JSON.stringify(reason)}`);
      stopAntiAfk();
      scheduleReconnect();
    });

    client.on('error', (err) => {
      console.error(`❌ [Bot] Error: ${err.message}`);
      stopAntiAfk();
      // 'error' often is followed by 'close', so we let 'close' handle reconnect to avoid dupes
    });

    client.on('close', () => {
      console.log('🔌 [Bot] Connection closed');
      stopAntiAfk();
      scheduleReconnect();
    });

  } catch (err) {
    console.error(`❌ [Bot] Failed to create client: ${err.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectAttempts >= config.maxReconnectAttempts) {
    console.error('🚨 [Bot] Max reconnect attempts reached. Waiting 5 minutes before retrying...');
    reconnectAttempts = 0;
    setTimeout(connect, 300000); 
    return;
  }
  
  reconnectAttempts++;
  const delay = Math.min(config.reconnectDelay * reconnectAttempts, 300000); 
  console.log(`🔄 [Bot] Reconnecting in ${delay / 1000}s (Attempt ${reconnectAttempts}/${config.maxReconnectAttempts})...`);
  
  setTimeout(connect, delay);
}

// --- Signal Handling ---

const shutdown = () => {
  console.log('\n🛑 [Bot] Shutting down gracefully...');
  stopAntiAfk();
  if (client) {
    client.close();
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// --- Startup ---

console.log('='.repeat(50));
console.log('🤖 Bilyabits Minecraft Bedrock AFK Bot');
console.log('='.repeat(50));
console.log(`Target: ${config.host}:${config.port}`);
console.log(`Mode:   ${config.afkMode.toUpperCase()}`);
console.log('='.repeat(50));

connect();

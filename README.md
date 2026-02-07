# 🤖 Bilyabits Minecraft AFK Bot (Bedrock Edition)

![Docker](https://img.shields.io/badge/Docker-Enabled-blue?logo=docker) ![License](https://img.shields.io/badge/License-MIT-green) ![Minecraft](https://img.shields.io/badge/Minecraft-Bedrock-success?logo=minecraft)

A robust, 24/7 AFK bot designed to keep **Minecraft Bedrock Edition** servers online (perfect for Aternos, free tiers, or just keeping chunks loaded).

Built with Node.js and `bedrock-protocol`. Dockerized for easy deployment on VPS, Raspberry Pi, or local machines.

## ✨ Features

- **24/7 Persistence**: Auto-reconnects if kicked, server restarts, or connection drops.
- **Microsoft Auth**: Securely authenticates via Microsoft Device Code flow (token saved locally).
- **Dual Modes**:
  - `passive`: Silent mode (default). Just stays connected. Best for strict servers like Aternos to avoid "bad packet" kicks.
  - `active`: Sends periodic chat messages to prove activity (configurable).
- **Docker Ready**: One-command deployment.

---

## 🚀 Quick Start

### Method 1: Using Docker Compose (Recommended)

1. **Create a `docker-compose.yml` file:**

   ```yaml
   services:
     afk-bot:
       image: carljohnvillavito/bilyabits-mc-afkbot:latest
       container_name: mc-afk-bot
       restart: unless-stopped
       environment:
         - MC_HOST=your-server-address.aternos.me
         - MC_PORT=19132
         - MC_USERNAME=AFKBot
         - AFK_MODE=passive  # or 'active'
       volumes:
         - ./auth:/app/auth  # Persist login session
       stdin_open: true
       tty: true
   ```

2. **Run it:**
   ```bash
   docker compose up -d
   ```

3. **Authenticate (First Run Only):**
   Check the logs to get your Microsoft login code:
   ```bash
   docker compose logs -f
   ```
   Open the link provided (microsoft.com/link), enter the code, and you're done! The session is saved forever.

### Method 2: Docker CLI

```bash
docker run -d \
  --name mc-afk-bot \
  --restart unless-stopped \
  -e MC_HOST=your-server.com \
  -e MC_PORT=19132 \
  -v $(pwd)/auth:/app/auth \
  carljohnvillavito/bilyabits-mc-afkbot:latest
```

---

## ⚙️ Configuration

| Environment Variable | Default | Description |
|----------------------|---------|-------------|
| `MC_HOST` | (Required) | The server address / IP. |
| `MC_PORT` | `19132` | The Bedrock server port (usually 19132). |
| `MC_USERNAME` | `AFKBot` | Username for the bot. |
| `AFK_MODE` | `passive` | `passive` (silent) or `active` (sends chat). |
| `AFK_MESSAGE` | `I am AFK` | Message sent in `active` mode. |

---

## 🛠️ Troubleshooting

- **"Bad Packet" or Kicked immediately?**
  Set `AFK_MODE=passive`. Some servers (like Aternos) kick bots that send automated movements or chat spam. Passive mode just maintains the connection, which is usually enough.

- **Login Code Expired?**
  Restart the container (`docker compose restart`) to generate a new code.

- **Port Issues?**
  Double-check your server port. Bedrock defaults to `19132`, but Aternos assigns random ports (e.g., `40436`).

---

## 📦 Building from Source

```bash
# Clone repo
git clone https://github.com/yourusername/bilyabits-mc-afkbot.git
cd bilyabits-mc-afkbot

# Install dependencies
npm install

# Run locally
npm start
```

## 📝 License

MIT License. Created by [Carl John Villavito].

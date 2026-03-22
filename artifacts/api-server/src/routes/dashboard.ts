import { Router, type IRouter } from "express";
import {
  getBotStatus,
  restartBot,
  sendMessage,
  startAutoSend,
  stopAutoSend,
  getAutoSendStatus,
  updateAutoSendInterval,
} from "../lib/bot.js";
import { loadConfig, updateConfig } from "../lib/config.js";

const router: IRouter = Router();

router.get("/status", (_req, res) => {
  const bot = getBotStatus();
  const config = loadConfig();
  const autoSend = getAutoSendStatus();
  res.json({
    bot,
    autoSend,
    config: {
      autoReact: config.autoReact,
      clipboardMessenger: config.clipboardMessenger,
      hasToken: !!config.discordToken,
    },
  });
});

router.post("/auto-react", (req, res) => {
  const { enabled, emoji } = req.body as { enabled?: boolean; emoji?: string };
  const updated = updateConfig({
    autoReact: {
      enabled: enabled ?? loadConfig().autoReact.enabled,
      emoji: emoji ?? loadConfig().autoReact.emoji,
    },
  });
  res.json({ success: true, autoReact: updated.autoReact });
});

router.post("/clipboard-messenger", (req, res) => {
  const { enabled, channelId } = req.body as { enabled?: boolean; channelId?: string };
  const current = loadConfig();
  const updated = updateConfig({
    clipboardMessenger: {
      enabled: enabled ?? current.clipboardMessenger.enabled,
      channelId: channelId ?? current.clipboardMessenger.channelId,
    },
  });
  res.json({ success: true, clipboardMessenger: updated.clipboardMessenger });
});

router.post("/send-message", async (req, res) => {
  const config = loadConfig();
  if (!config.clipboardMessenger.enabled) {
    res.status(403).json({ success: false, error: "Clipboard Messenger is disabled" });
    return;
  }
  const { message, channelId } = req.body as { message?: string; channelId?: string };
  const targetChannel = channelId || config.clipboardMessenger.channelId;
  if (!message || !targetChannel) {
    res.status(400).json({ success: false, error: "Missing message or channelId" });
    return;
  }
  const result = await sendMessage(targetChannel, message);
  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

router.post("/auto-send/start", (req, res) => {
  const { message, channelId, intervalMs } = req.body as {
    message?: string;
    channelId?: string;
    intervalMs?: number;
  };
  if (!message || !channelId) {
    res.status(400).json({ success: false, error: "Missing message or channelId" });
    return;
  }
  const result = startAutoSend(message, channelId, intervalMs ?? 300);
  if (result.success) {
    res.json({ success: true, autoSend: getAutoSendStatus() });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

router.post("/auto-send/stop", (_req, res) => {
  stopAutoSend();
  res.json({ success: true, autoSend: getAutoSendStatus() });
});

router.post("/auto-send/interval", (req, res) => {
  const { intervalMs } = req.body as { intervalMs?: number };
  if (typeof intervalMs !== "number") {
    res.status(400).json({ success: false, error: "intervalMs must be a number" });
    return;
  }
  updateAutoSendInterval(intervalMs);
  res.json({ success: true, autoSend: getAutoSendStatus() });
});

router.post("/change-token", async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token || token.trim() === "") {
    res.status(400).json({ success: false, error: "Token cannot be empty" });
    return;
  }
  updateConfig({ discordToken: token.trim() });
  await restartBot(token.trim());
  const bot = getBotStatus();
  res.json({ success: true, bot });
});

router.post("/restart-bot", async (_req, res) => {
  await restartBot();
  const bot = getBotStatus();
  res.json({ success: true, bot });
});

export default router;

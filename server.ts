import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import {
  getWhatsAppStatus,
  getActivePhoneNumber,
  getWhatsAppLogs,
  validatePhoneNumber,
  startWhatsApp,
  cleanupSession,
  sendWhatsAppMessage,
  registerStateChangeCallback,
  addLog,
} from "./server/whatsapp-service";
import {
  getBotState,
  updateSettings,
  addAutoReply,
  deleteAutoReply,
  toggleCommand,
  updateGroupConfig,
  upsertGroupConfig,
  toggleFeature,
  addGroupBadword,
  removeGroupBadword,
  resetGroupXp
} from "./server/bot-config";

async function runFullStackServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  
  // Create HTTP server to share between Express and Node WS Server on same port
  const server = http.createServer(app);
  
  // Set up WebSocket server
  const wss = new WebSocketServer({ noServer: true });
  const activeWsClients = new Set<WebSocket>();

  // Upgrade routine for raw WebSocket connection in same port
  server.on("upgrade", (request, socket, head) => {
    const { pathname } = new URL(request.url || "", `http://${request.headers.host}`);
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Client subscription
  wss.on("connection", (ws) => {
    activeWsClients.add(ws);
    
    // Immediately send current state and whole historical rolling log to fresh client
    ws.send(
      JSON.stringify({
        type: "init",
        status: getWhatsAppStatus(),
        activePhoneNumber: getActivePhoneNumber(),
        logs: getWhatsAppLogs(),
        botState: getBotState(),
      })
    );

    ws.on("close", () => {
      activeWsClients.delete(ws);
    });
  });

  // Helper to broadcast changes
  const broadcastStateChanges = () => {
    const payload = JSON.stringify({
      type: "update",
      status: getWhatsAppStatus(),
      activePhoneNumber: getActivePhoneNumber(),
      logs: getWhatsAppLogs(),
      botState: getBotState(),
    });
    
    for (const ws of activeWsClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  };

  // Register WhatsApp state manager to trigger updates instantly to UI via websockets
  registerStateChangeCallback(broadcastStateChanges);

  // Body Parsing Middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // REST API Endpoints
  app.get("/api/status", (req, res) => {
    res.json({
      status: getWhatsAppStatus(),
      activePhoneNumber: getActivePhoneNumber(),
    });
  });

  app.get("/api/logs", (req, res) => {
    res.json(getWhatsAppLogs());
  });

  app.post("/api/pairing-code", async (req, res) => {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      addLog("Attempted pairing without providing a phone number", "warn");
      return res.status(400).json({ success: false, error: "Please enter a valid phone number." });
    }

    const validatedNumber = validatePhoneNumber(phoneNumber);
    if (!validatedNumber) {
      addLog(`Invalid phone number format provided: ${phoneNumber}`, "warn");
      return res.status(400).json({ 
        success: false, 
        error: "Invalid number. Please use numbers only with international format (e.g. 628123456789)." 
      });
    }

    addLog(`Initiating pairing code generation sequence for ${validatedNumber}...`, "info");
    
    try {
      // Disconnect existing session if any, reset clean state
      cleanupSession();
      
      // Request pairing code (passes number into start sequence)
      const code = await startWhatsApp(validatedNumber);
      
      if (code) {
        return res.json({ success: true, code, phoneNumber: validatedNumber });
      } else {
        return res.status(500).json({ 
          success: false, 
          error: "Failed to generate pairing code. Please try again or re-initiate connection." 
        });
      }
    } catch (err: any) {
      addLog(`Failed to request pairing code: ${err.message}`, "error");
      return res.status(500).json({ success: false, error: err.message || "An internal error occurred." });
    }
  });

  app.post("/api/disconnect", (req, res) => {
    addLog("Disconnect and session termination requested by panel...", "info");
    try {
      cleanupSession();
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/send-message", async (req, res) => {
    const { targetNumber, message } = req.body;

    if (!targetNumber || !message) {
      return res.status(400).json({ success: false, error: "Phone number and message are required." });
    }

    const validated = validatePhoneNumber(targetNumber);
    if (!validated) {
      return res.status(400).json({ success: false, error: "Recipient phone number is invalid." });
    }

    const success = await sendWhatsAppMessage(validated, message);
    if (success) {
      return res.json({ success: true });
    } else {
      return res.status(500).json({ success: false, error: "Failed to send message. Is the bot connected?" });
    }
  });

  app.get("/api/bot-state", (req, res) => {
    res.json(getBotState());
  });

  app.post("/api/bot-settings", (req, res) => {
    const { botName, adminPhone, prefix } = req.body;
    
    let cleanAdmin = adminPhone ? adminPhone.replace(/\D/g, "") : "";
    
    updateSettings({
      botName: botName ? botName.trim() : "WhatsApp Bot Official",
      adminPhone: cleanAdmin,
      prefix: prefix ? prefix.trim() : "/",
    });
    
    addLog(`Bot settings updated: Name="${botName}", Admin="${cleanAdmin}", Prefix="${prefix}"`, "info");
    broadcastStateChanges();
    res.json({ success: true, botState: getBotState() });
  });

  app.post("/api/auto-reply", (req, res) => {
    const { keyword, reply, matchType, groupId } = req.body;
    if (!keyword || !reply) {
      return res.status(400).json({ success: false, error: "Keyword and reply body are required." });
    }
    
    const added = addAutoReply(keyword, reply, matchType || "exact", groupId);
    addLog(`New auto-reply added: Keyword="${keyword}"${groupId ? ` for Group ID "${groupId}"` : ""}`, "success");
    broadcastStateChanges();
    res.json({ success: true, added });
  });

  app.post("/api/commands/toggle", (req, res) => {
    const { name, enabled } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: "Command name is required." });
    }
    const success = toggleCommand(name, enabled === true);
    if (success) {
      addLog(`Command "${name}" toggled to ${enabled ? "ON" : "OFF"}`, "info");
      broadcastStateChanges();
      res.json({ success: true, botState: getBotState() });
    } else {
      res.status(404).json({ success: false, error: "Command not found." });
    }
  });

  app.post("/api/groups/:id", (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const success = updateGroupConfig(id, updates);
    if (success) {
      addLog(`Group ${id} config updated: ${JSON.stringify(updates)}`, "info");
      broadcastStateChanges();
      res.json({ success: true, botState: getBotState() });
    } else {
      res.status(404).json({ success: false, error: "Group configuration not found." });
    }
  });

  app.post("/api/features/toggle", (req, res) => {
    const { name, enabled } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "Feature name is required." });
    const success = toggleFeature(name as any, enabled === true);
    if (success) {
      addLog(`Feature "${name}" toggled to ${enabled ? "ON" : "OFF"}`, "info");
      broadcastStateChanges();
      res.json({ success: true, botState: getBotState() });
    } else {
      res.status(400).json({ success: false, error: "Invalid feature name." });
    }
  });

  app.post("/api/groups/:id/badword", (req, res) => {
    const { id } = req.params;
    const { word, action } = req.body; // action: "add" | "remove"
    if (!word) return res.status(400).json({ success: false, error: "Word is required." });
    
    let success = false;
    if (action === "add") {
      success = addGroupBadword(id, word);
      if (success) addLog(`Badword "${word}" added to group ${id}`, "success");
    } else if (action === "remove") {
      success = removeGroupBadword(id, word);
      if (success) addLog(`Badword "${word}" removed from group ${id}`, "info");
    }
    
    if (success) {
      broadcastStateChanges();
      res.json({ success: true, botState: getBotState() });
    } else {
      res.status(400).json({ success: false, error: "Failed to perform badword action." });
    }
  });

  app.post("/api/groups/:id/reset-xp", (req, res) => {
    const { id } = req.params;
    resetGroupXp(id);
    addLog(`XP statistics cleared/reset for group ${id}`, "warn");
    broadcastStateChanges();
    res.json({ success: true, botState: getBotState() });
  });

  app.post("/api/groups", (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) {
      return res.status(400).json({ success: false, error: "Group ID and Name are required." });
    }
    const group = upsertGroupConfig(id, name);
    addLog(`Group added/updated manually in database: ${name} (${id})`, "success");
    broadcastStateChanges();
    res.json({ success: true, group, botState: getBotState() });
  });

  app.delete("/api/auto-reply/:id", (req, res) => {
    const { id } = req.params;
    const deleted = deleteAutoReply(id);
    if (deleted) {
      addLog(`Auto-reply deleted: ID="${id}"`, "info");
      broadcastStateChanges();
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: "Auto-reply not found." });
    }
  });

  // Client SPA integration paths (Vite & Static asset routes)
  if (process.env.NODE_ENV !== "production") {
    addLog("Mounting Vite developmental server middleware...", "info");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    addLog("Serving bundled production production assets from build bundle directory...", "info");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind and listen
  server.listen(PORT, "0.0.0.0", () => {
    addLog(`Control Panel Server live on secure host: http://0.0.0.0:${PORT}`, "success");
  });
}

runFullStackServer().catch((err) => {
  console.error("FATAL: Failed to boot fullstack application:", err);
});

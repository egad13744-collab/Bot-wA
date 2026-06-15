import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  KeyRound,
  Phone,
  Wifi,
  WifiOff,
  LogOut,
  Send,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  Sparkles,
  ArrowRightLeft,
  Mail,
  Trash2,
  PlusCircle,
  HelpCircle,
  User,
} from "lucide-react";

interface LogEntry {
  timestamp: string;
  message: string;
  type: "info" | "success" | "warn" | "error";
}

interface CommandConfig {
  name: string;
  enabled: boolean;
}

interface GroupConfig {
  id: string;
  name: string;
  enabled: boolean;
  autoReplyEnabled: boolean;
  welcomeEnabled: boolean;
  welcomeMessage: string;
  goodbyeEnabled: boolean;
  goodbyeMessage: string;
  antilinkEnabled: boolean;
  rankEnabled?: boolean;
  antibadwordEnabled?: boolean;
  badwordList?: string[];
  xpPerChat?: number;
  cooldown?: number;
}

interface UserXpStats {
  groupId: string;
  userId: string;
  name: string;
  xp: number;
  level: number;
  totalChat: number;
  joinedAt: number;
}

interface FeatureSettings {
  levelingEnabled: boolean;
  rankEnabled: boolean;
  antiBadwordEnabled: boolean;
  randomEnabled: boolean;
}

interface AutoReply {
  id: string;
  keyword: string;
  reply: string;
  matchType: "exact" | "contains";
  groupId?: string;
}

interface BotSettings {
  botName: string;
  adminPhone: string;
  prefix: string;
}

interface BotStats {
  messagesReceived: number;
  messagesSent: number;
}

interface BotState {
  settings: BotSettings;
  stats: BotStats;
  autoReplies: AutoReply[];
  commands: CommandConfig[];
  groups: GroupConfig[];
  xpData?: UserXpStats[];
  features?: FeatureSettings;
}

type WhatsAppStatus = "Disconnected" | "Connecting" | "Waiting Pairing" | "Connected";

export default function App() {
  const [status, setStatus] = useState<WhatsAppStatus>("Disconnected");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [activePhoneNumber, setActivePhoneNumber] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Dynamic Bot configuration state
  const [botState, setBotState] = useState<BotState>({
    settings: {
      botName: "WhatsApp Bot Official",
      adminPhone: "",
      prefix: "/",
    },
    stats: {
      messagesReceived: 0,
      messagesSent: 0,
    },
    autoReplies: [],
    commands: [],
    groups: [],
  });

  // Active Tab inside Right Container
  const [activeTab, setActiveTab] = useState<"terminal" | "commands" | "keywords" | "groups" | "settings">("terminal");

  // Bot Settings Modifying Form states
  const [inputBotName, setInputBotName] = useState("");
  const [inputAdminPhone, setInputAdminPhone] = useState("");
  const [inputPrefix, setInputPrefix] = useState("/");

  // Keyword Adding Form states
  const [newKeyword, setNewKeyword] = useState("");
  const [newReply, setNewReply] = useState("");
  const [newMatchType, setNewMatchType] = useState<"exact" | "contains">("exact");

  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);

  // Group Management & Customization States
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [manualGroupId, setManualGroupId] = useState("");
  const [manualGroupName, setManualGroupName] = useState("");
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [isSavingGroupConfig, setIsSavingGroupConfig] = useState(false);
  const [newGroupKeyword, setNewGroupKeyword] = useState("");
  const [newGroupReply, setNewGroupReply] = useState("");
  const [newGroupMatchType, setNewGroupMatchType] = useState<"exact" | "contains">("exact");
  const [isAddingGroupKeyword, setIsAddingGroupKeyword] = useState(false);

  // Test messages Sandbox states
  const [testRecipient, setTestRecipient] = useState("");
  const [testMessage, setTestMessage] = useState("Halo! Ini adalah pesan tes dari WhatsApp Bot Panel saya. 🚀");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // General Visual Utilities
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Track initial auto setup of settings form whenever botState is received from server
  useEffect(() => {
    if (botState && botState.settings) {
      setInputBotName(botState.settings.botName || "WhatsApp Bot Official");
      setInputAdminPhone(botState.settings.adminPhone || "");
      setInputPrefix(botState.settings.prefix || "/");
    }
  }, [botState]);

  // Auto scroll logs
  useEffect(() => {
    if (activeTab === "terminal") {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  // Connect WebSockets
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    let ws: WebSocket;
    let reconnectTimer: any;

    function connectWs() {
      console.log("Connecting to panel live WebSocket socket:", wsUrl);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket socket linked successfully");
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "init" || data.type === "update") {
            setStatus(data.status);
            setActivePhoneNumber(data.activePhoneNumber);
            setLogs(data.logs || []);
            
            if (data.botState) {
              setBotState(data.botState);
            }

            // Reset pending triggers depending on connectivity upgrades
            if (data.status === "Waiting Pairing") {
              setIsGenerating(false);
            } else if (data.status === "Connected") {
              setPairingCode(null);
              setIsGenerating(false);
            }
          }
        } catch (err) {
          console.error("Failed to parse websocket message packet:", err);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket closed. Attempting reconnect...");
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWs, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket client connection error:", error);
        ws.close();
      };
    }

    connectWs();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  // Baseline fetch on viewport load
  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => {
        setStatus(data.status);
        setActivePhoneNumber(data.activePhoneNumber);
      })
      .catch((err) => console.error("Error drawing original status:", err));

    fetch("/api/logs")
      .then((res) => res.json())
      .then((data) => setLogs(data || []))
      .catch((err) => console.error("Error drawing basic event logs:", err));

    fetch("/api/bot-state")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setBotState(data);
        }
      })
      .catch((err) => console.error("Error drawing state from DB:", err));
  }, []);

  // Format valid numbers
  const handlePhoneNumberChange = (val: string) => {
    const numericStr = val.replace(/[^\d+]/g, "");
    setPhoneNumber(numericStr);
    
    if (numericStr.startsWith("0")) {
      setValidationError("Ganti angka '0' di depan dengan kode negara (contoh: 62812xxxxxx untuk Indonesia)");
    } else if (numericStr.includes("+")) {
      setValidationError("Masukkan nomor angka saja tanpa tanda '+' (contoh: 62812xxxxxx)");
    } else if (numericStr.length > 0 && numericStr.length < 10) {
      setValidationError("Nomor ponsel terlalu pendek (minimal 10 digit)");
    } else {
      setValidationError(null);
    }
  };

  // Pairing code request
  const handleGeneratePairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) {
      setValidationError("Harap masukkan nomor WhatsApp Anda.");
      return;
    }

    const cleanNum = phoneNumber.replace(/\D/g, "");
    if (cleanNum.length < 10 || cleanNum.length > 15) {
      setValidationError("Format nomor salah. Minimal 10-15 digit angka.");
      return;
    }

    setIsGenerating(true);
    setPairingCode(null);
    setValidationError(null);

    try {
      const response = await fetch("/api/pairing-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: cleanNum }),
      });

      const result = await response.json();
      if (result.success) {
        setPairingCode(result.code);
      } else {
        setValidationError(result.error || "Gagal mendapatkan kode pairing. Silakan coba kembali.");
      }
    } catch (err: any) {
      setValidationError("Koneksi gagal. Periksa server dashboard Anda.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Disconnection handler
  const handleDisconnect = async () => {
    if (!confirm("Apakah Anda yakin ingin mematikan koneksi WhatsApp Bot dan menghapus sesi ini?")) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const response = await fetch("/api/disconnect", { method: "POST" });
      const result = await response.json();
      if (result.success) {
        setPairingCode(null);
        setPhoneNumber("");
      } else {
        alert("Gagal menghapus sesi: " + result.error);
      }
    } catch (err) {
      alert("Error menghubungi server.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Dispatch live sandbox test messages
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient || !testMessage) {
      setTestResult({ success: false, message: "Nomor penerima dan isi pesan wajib diisi." });
      return;
    }

    setIsSendingMessage(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetNumber: testRecipient,
          message: testMessage,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setTestResult({ success: true, message: "Pesan tes berhasil dikirim!" });
        setTestRecipient("");
      } else {
        setTestResult({ success: false, message: result.error || "Gagal menembak pesan." });
      }
    } catch (err) {
      setTestResult({ success: false, message: "Hubungan terputus dari host server." });
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Update dynamic general settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const response = await fetch("/api/bot-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botName: inputBotName,
          adminPhone: inputAdminPhone,
          prefix: inputPrefix,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setBotState(result.botState);
        alert("Konfigurasi bot tersimpan dalam database dengan aman! 🤖");
      } else {
        alert("Error saving settings.");
      }
    } catch (err) {
      console.error(err);
      alert("Gagal menyambungkan ke server.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Create new auto reply keyword to backend database
  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim() || !newReply.trim()) return;

    setIsAddingKeyword(true);
    try {
      const response = await fetch("/api/auto-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: newKeyword,
          reply: newReply,
          matchType: newMatchType,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setNewKeyword("");
        setNewReply("");
      } else {
        alert("Error adding auto-reply.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingKeyword(false);
    }
  };

  // Delete auto-reply term
  const handleDeleteKeyword = async (id: string) => {
    if (!confirm("Hapus respon otomatis untuk kata kunci ini?")) return;
    try {
      const response = await fetch(`/api/auto-reply/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!result.success) {
        alert("Error deleting keyword.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle a bot command status
  const handleToggleCommand = async (name: string, currentEnabled: boolean) => {
    try {
      const response = await fetch("/api/commands/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, enabled: !currentEnabled }),
      });
      const result = await response.json();
      if (result.success) {
        setBotState(result.botState);
      } else {
        alert("Error toggling command: " + result.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add a WhatsApp group config manually
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualGroupId.trim() || !manualGroupName.trim()) return;

    let finalId = manualGroupId.trim();
    if (!finalId.endsWith("@g.us")) {
      finalId = finalId + "@g.us";
    }

    setIsAddingGroup(true);
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: finalId, name: manualGroupName.trim() }),
      });
      const result = await response.json();
      if (result.success) {
        setBotState(result.botState);
        setManualGroupId("");
        setManualGroupName("");
        setSelectedGroupId(finalId);
      } else {
        alert("Grup gagal ditambahkan: " + result.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingGroup(false);
    }
  };

  // Save/Update configurations for a specific group (toggles, messages)
  const handleUpdateGroupConfig = async (
    groupId: string,
    updates: any
  ) => {
    setIsSavingGroupConfig(true);
    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const result = await response.json();
      if (result.success) {
        setBotState(result.botState);
      } else {
        alert("Gagal mengupdate konfigurasi grup.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingGroupConfig(false);
    }
  };

  // Create a group-specific auto-reply keyword
  const handleAddGroupKeyword = async (e: React.FormEvent, groupId: string) => {
    e.preventDefault();
    if (!newGroupKeyword.trim() || !newGroupReply.trim()) return;

    setIsAddingGroupKeyword(true);
    try {
      const response = await fetch("/api/auto-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: newGroupKeyword,
          reply: newGroupReply,
          matchType: newGroupMatchType,
          groupId: groupId,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setNewGroupKeyword("");
        setNewGroupReply("");
      } else {
        alert("Error adding group keyword auto-reply.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingGroupKeyword(false);
    }
  };

  const handleToggleFeature = async (featureName: string, value: boolean) => {
    try {
      const response = await fetch("/api/features/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureName, value })
      });
      const result = await response.json();
      if (result.success) {
        setBotState(result.botState);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetGroupXp = async (groupId: string) => {
    if (!window.confirm("Apakah Anda yakin ingin mereset semua XP keaktifan peserta di grup ini? Tindakan ini tidak dapat dibatalkan!")) {
      return;
    }
    try {
      const response = await fetch(`/api/groups/${groupId}/reset-xp`, {
        method: "POST"
      });
      const result = await response.json();
      if (result.success) {
        setBotState(result.botState);
        alert("Berhasil mereset semua XP keaktifan peserta di grup ini!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans" id="app_root">
      
      {/* Realtime Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between" id="app_header">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500 text-slate-950 p-2 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
              {botState?.settings?.botName || "WhatsApp Bot Connection Panel"}
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold px-2 py-0.5 rounded border border-emerald-500/20 uppercase">Prefix: {botState?.settings?.prefix || "/"}</span>
            </h1>
            <p className="text-xs text-slate-400">Panel Admin WA Bot Pairing Resmi Tanpa QR-Code</p>
          </div>
        </div>

        {/* Sync Socket network state indicator */}
        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-full text-xs">
          <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
          <span className="text-slate-350 text-slate-300 font-mono text-[11px] font-semibold">{wsConnected ? "Realtime Link Active" : "Host Disconnected"}</span>
        </div>
      </header>

      {/* Stats Counter Bar (Highly professional top metrics tracker) */}
      <section className="bg-slate-950/50 border-b border-slate-800 py-6 px-6 md:px-8" id="metrics_bar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl flex items-center space-x-4">
            <div className="bg-blue-500/10 text-blue-400 p-2.5 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Nama & Prefix Bot</p>
              <p className="text-sm font-extrabold text-white truncate max-w-[160px]">{botState?.settings?.botName}</p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl flex items-center space-x-4">
            <div className={`p-2.5 rounded-xl ${status === "Connected" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Status Mesin</p>
              <p className={`text-sm font-extrabold ${status === "Connected" ? "text-emerald-400" : "text-amber-400"}`}>{status}</p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl flex items-center space-x-4">
            <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-xl">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pesan Masuk (Receive)</p>
              <p className="text-xl font-mono font-bold text-slate-100">{botState?.stats?.messagesReceived || 0}</p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl flex items-center space-x-4">
            <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pesan Terkirim (Sent)</p>
              <p className="text-xl font-mono font-bold text-slate-100">{botState?.stats?.messagesSent || 0}</p>
            </div>
          </div>

        </div>
      </section>

      {/* Core Panels Grid Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard_grid">
        
        {/* Left Hand Controls Box (Connection & Testing Sandbox) */}
        <section className="lg:col-span-5 flex flex-col space-y-6" id="left_column_panel">
          
          {/* Active Status Widget */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 relative overflow-hidden" id="status_panel">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <h3 className="text-xs font-semibold text-slate-400 tracking-wider uppercase mb-3">Live Status Koneksi</h3>
            
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  status === "Connected" 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : status === "Waiting Pairing"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : status === "Connecting"
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}>
                  {status === "Connected" && <Wifi className="w-3.5 h-3.5" />}
                  {status === "Connecting" && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {status === "Waiting Pairing" && <Loader2 className="w-3.5 h-3.5 animate-pulse" />}
                  {status === "Disconnected" && <WifiOff className="w-3.5 h-3.5" />}
                  {status}
                </span>

                <div className="pt-1">
                  {status === "Connected" ? (
                    <div>
                      <p className="text-xs text-slate-400">Tertaut dengan:</p>
                      <p className="text-sm font-mono font-bold text-emerald-400">+{activePhoneNumber}</p>
                    </div>
                  ) : status === "Waiting Pairing" ? (
                    <p className="text-xs text-slate-350 text-slate-300">Masukkan kode pairing di ponsel Anda untuk menyelaraskan.</p>
                  ) : (
                    <p className="text-xs text-slate-400">Bot belum terhubung ke akun WhatsApp manapun.</p>
                  )}
                </div>
              </div>

              {/* Log out/Disconnect button */}
              {status !== "Disconnected" && (
                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/20 p-2.5 rounded-2xl transition duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1"
                  title="Putuskan koneksi bot"
                  id="disconnect_btn"
                >
                  {isDisconnecting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      <span className="text-[11px] font-bold px-1">Log Out</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Core Configuration Pairing steps card */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 flex flex-col space-y-4" id="setup_card">
            <div className="flex items-center space-x-2 text-white">
              <KeyRound className="w-5 h-5 text-emerald-400" />
              <h2 className="text-md font-bold">Langkah Koneksi Bot</h2>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Bot menggunakan metode pairing kode resmi WhatsApp. Silakan masukkan nomor HP akun yang ingin dijadikan bot untuk menerima kode.
            </p>

            <form onSubmit={handleGeneratePairingCode} className="space-y-4 pt-1">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300" htmlFor="phone_input">
                  Nomor HP Akun Bot (Format Internasional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    id="phone_input"
                    type="text"
                    required
                    disabled={status === "Connected" || status === "Waiting Pairing"}
                    placeholder="Contoh: 628123456789"
                    value={phoneNumber}
                    onChange={(e) => handlePhoneNumberChange(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm disabled:opacity-50 disabled:bg-slate-950 text-white placeholder-slate-650 tracking-wide font-mono"
                  />
                </div>
                {validationError && (
                  <p className="text-xs text-rose-450 text-rose-400 flex items-center gap-1 leading-relaxed">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {validationError}
                  </p>
                )}
              </div>

              {/* Generate Trigger Button */}
              {status !== "Connected" && status !== "Waiting Pairing" && (
                <button
                  type="submit"
                  disabled={isGenerating || !!validationError || !phoneNumber}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-3.5 px-4 rounded-xl font-bold text-sm transition duration-150 disabled:opacity-50 disabled:hover:bg-emerald-500 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/15 cursor-pointer"
                  id="generate_btn"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Meminta Kode Handshake...</span>
                    </>
                  ) : (
                    <>
                      <span>Generate Pairing Code</span>
                    </>
                  )}
                </button>
              )}
            </form>

            {/* Display pair code when active */}
            {(pairingCode || status === "Waiting Pairing") && (
              <div className="mt-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3" id="pairing_code_display">
                <p className="text-xs text-slate-400">Kode Pairing Anda:</p>
                {pairingCode ? (
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl md:text-3xl font-extrabold tracking-widest font-mono text-emerald-400 select-all px-4 py-2 bg-slate-950 rounded-xl border border-slate-800">
                      {pairingCode}
                    </span>
                    <button
                      onClick={copyToClipboard}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl hover:bg-slate-805 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                      title="Salin Kode"
                      id="copy_code_btn"
                    >
                      {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                    <span className="text-xs text-amber-400">Menghubungi server WhatsApp...</span>
                  </div>
                )}
                
                <div className="text-left w-full border-t border-slate-800 pt-3 text-[11px] text-slate-405 leading-relaxed space-y-2 mt-2">
                  <p className="text-amber-400 font-bold text-xs text-center">Buka WhatsApp Anda di HP:</p>
                  <ol className="list-decimal list-inside text-slate-300 pr-1 space-y-1">
                    <li>Buka menu <span className="text-white font-medium">Perangkat Tertaut (Linked Devices)</span></li>
                    <li>Ketuk <span className="text-white font-medium">Tautkan Perangkat (Link a Device)</span></li>
                    <li>Sebut <span className="text-white font-medium">Tautkan dengan nomor ponsel saja</span></li>
                    <li>Masukkan kode di atas yang tertera</li>
                  </ol>
                </div>
              </div>
            )}
          </div>

          {/* Sandbox Test Messages */}
          {status === "Connected" && (
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 flex flex-col space-y-4" id="test_sandbox_panel">
              <div className="flex items-center space-x-2 text-white">
                <Send className="w-5 h-5 text-emerald-400" />
                <h2 className="text-md font-bold">Kirim Pesan Uji Coba</h2>
              </div>
              <p className="text-xs text-slate-400">
                Uji pengiriman pesan keluar menggunakan jalur nomor bot Anda secara online.
              </p>

              <form onSubmit={handleSendMessage} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1" htmlFor="test_number">Nomor Penerima (Format Internasional)</label>
                  <input
                    id="test_number"
                    type="text"
                    required
                    placeholder="Contoh: 62895678888"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1" htmlFor="test_body">Isi Pesan</label>
                  <textarea
                    id="test_body"
                    required
                    rows={2}
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSendingMessage || !testRecipient}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/20 py-2.5 px-4 rounded-xl font-bold text-xs transition disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                  id="send_test_btn"
                >
                  {isSendingMessage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Kirim Sekarang</span>
                    </>
                  )}
                </button>
              </form>

              {testResult && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-1.5 ${
                  testResult.success ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                }`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          )}

        </section>

        {/* Right Hand Panels - Unified Tabs Workspace Container */}
        <section className="lg:col-span-7 flex flex-col h-[580px] lg:h-auto min-h-[500px]" id="logs_activity_panel">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl flex-1 flex flex-col overflow-hidden">
            
            {/* Header Tabs Controller */}
            <div className="border-b border-slate-800 bg-slate-950 px-4 py-2 flex items-center justify-between">
              
              <div className="flex space-x-1.5 overflow-x-auto py-1">
                <button
                  onClick={() => setActiveTab("terminal")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                    activeTab === "terminal" ? "bg-slate-900 text-white border border-slate-800" : "text-slate-400 hover:text-slate-200"
                  }`}
                  id="tab_terminal_ctrl"
                >
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Terminal Logs</span>
                </button>

                <button
                  onClick={() => setActiveTab("commands")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                    activeTab === "commands" ? "bg-slate-900 text-white border border-slate-800" : "text-slate-400 hover:text-slate-200"
                  }`}
                  id="tab_commands_ctrl"
                >
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span>Command Manager</span>
                </button>

                <button
                  onClick={() => setActiveTab("keywords")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                    activeTab === "keywords" ? "bg-slate-900 text-white border border-slate-800" : "text-slate-400 hover:text-slate-200"
                  }`}
                  id="tab_keywords_ctrl"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Auto-Reply Keywords</span>
                </button>

                <button
                  onClick={() => setActiveTab("groups")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                    activeTab === "groups" ? "bg-slate-900 text-white border border-slate-800" : "text-slate-400 hover:text-slate-200"
                  }`}
                  id="tab_groups_ctrl"
                >
                  <User className="w-4 h-4 text-rose-455 text-rose-400" />
                  <span>Group Management</span>
                </button>

                <button
                  onClick={() => setActiveTab("settings")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                    activeTab === "settings" ? "bg-slate-900 text-white border border-slate-800" : "text-slate-400 hover:text-slate-200"
                  }`}
                  id="tab_settings_ctrl"
                >
                  <Sliders className="w-4 h-4 text-blue-400" />
                  <span>Sistem & Admin</span>
                </button>
              </div>

              <div className="text-[10px] text-slate-500 font-mono hidden sm:inline mr-2">
                Active Config
              </div>
            </div>

            {/* Workplace Content Container depending on activeTab selection */}
            <div className="flex-1 overflow-y-auto bg-slate-900/40" id="tabs_workspace">
              
              {/* Tab 1: Terminal logs view */}
              {activeTab === "terminal" && (
                <div className="p-4 md:p-6 font-mono text-xs flex flex-col space-y-2 h-full">
                  {logs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 space-y-2 py-12">
                      <Terminal className="w-10 h-10 opacity-20" />
                      <p>Menunggu aktivitas event controller...</p>
                    </div>
                  ) : (
                    logs.map((log, index) => (
                      <div
                        key={index}
                        className="flex items-start text-[11px] leading-relaxed transition p-1 hover:bg-slate-850 rounded"
                      >
                        <span className="text-[10px] text-slate-500 select-none mr-3 w-[70px] flex-shrink-0">
                          [{log.timestamp}]
                        </span>
                        <span className={`flex-1 break-all ${
                          log.type === "success" 
                            ? "text-emerald-400" 
                            : log.type === "error" 
                            ? "text-rose-400 font-semibold" 
                            : log.type === "warn" 
                            ? "text-amber-300" 
                            : "text-slate-350"
                        }`}>
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              )}

              {/* Tab: Command Manager */}
              {activeTab === "commands" && (
                <div className="p-4 md:p-6 space-y-4">
                  <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                    <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-purple-400" />
                      <span>Sistem Pengendali Fitur Bot</span>
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                      Tentukan fitur / perintah mana saja yang diizinkan aktif dan dapat direspon oleh nomor Bot secara otomatis.
                    </p>

                    <div className="space-y-3">
                      {botState.commands && botState.commands.length > 0 ? (
                        botState.commands.map((cmd) => (
                          <div key={cmd.name} className="flex items-center justify-between p-3.5 bg-slate-900 border border-slate-800/60 rounded-xl hover:border-slate-700 transition">
                            <div>
                              <span className="font-mono text-xs font-extrabold text-slate-200">
                                {botState.settings.prefix || "/"}{cmd.name}
                              </span>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {cmd.name === "menu" && "Menampilkan daftar seluruh perintah/panduan bot"}
                                {cmd.name === "ping" && "Menguji responsivitas koneksi & latensi bot"}
                                {cmd.name === "status" && "Menampilkan status rincian host dan koneksi bot"}
                                {cmd.name === "runtime" && "Mengetahui secara live berapa lama bot telah online"}
                                {cmd.name === "bprofile" && "Laporan profil bot, versi, & statistik pesan"}
                                {cmd.name === "owner" && "Menampilkan kontak nomor admin owner bot"}
                                {cmd.name === "bvo" && "Mengunduh file sensor pesan sekali lihat (view once)"}
                                {cmd.name === "tts" && "Membuat stiker WhatsApp kustom dari teks input"}
                                {cmd.name === "its" && "Mengonversi file gambar masukan menjadi stiker"}
                              </p>
                            </div>

                            <button
                              onClick={() => handleToggleCommand(cmd.name, cmd.enabled)}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 focus:outline-none cursor-pointer ${
                                cmd.enabled 
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                                  : "bg-rose-500/10 text-rose-455 text-rose-400 border border-rose-500/25"
                              }`}
                              id={`toggle_cmd_${cmd.name}`}
                            >
                              <span className={`w-2 h-2 rounded-full ${cmd.enabled ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                              <span>{cmd.enabled ? "ACTIVE (ON)" : "DISABLED (OFF)"}</span>
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-xs text-slate-500 p-4">
                          Tidak ada command terdaftar di bot database.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Group Management */}
              {activeTab === "groups" && (
                <div className="p-4 md:p-6 space-y-6">
                  
                  {/* Manual enrollment of WhatsApp Groups */}
                  <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                    <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <PlusCircle className="w-4 h-4 text-rose-400" />
                      Daftarkan Grup Secara Sandboxed (Untuk Tes/Simulasi)
                    </h3>
                    
                    <form onSubmit={handleCreateGroup} className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3">
                      <div className="md:col-span-5">
                        <label className="block text-[10px] text-slate-400 mb-1" htmlFor="m_group_id">WhatsApp JID Grup ID</label>
                        <input
                          id="m_group_id"
                          type="text"
                          required
                          placeholder="contoh: 12036304381984@g.us"
                          value={manualGroupId}
                          onChange={(e) => setManualGroupId(e.target.value)}
                          className="block w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="block text-[10px] text-slate-400 mb-1" htmlFor="m_group_name">Nama Grup</label>
                        <input
                          id="m_group_name"
                          type="text"
                          required
                          placeholder="contoh: Grup Official A"
                          value={manualGroupName}
                          onChange={(e) => setManualGroupName(e.target.value)}
                          className="block w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                        />
                      </div>
                      <div className="md:col-span-3 flex items-end">
                        <button
                          type="submit"
                          disabled={isAddingGroup || !manualGroupId || !manualGroupName}
                          className="w-full bg-rose-500 hover:bg-rose-455 hover:bg-rose-400 text-slate-950 font-bold py-2 rounded-lg text-xs transition disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
                          id="manual_group_btn"
                        >
                          {isAddingGroup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                          <span>Tambah Grup</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Registered groups list selection */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                      Grup Aktif Terdaftar ({botState.groups?.length || 0})
                    </h4>

                    {(!botState.groups || botState.groups.length === 0) ? (
                      <div className="p-8 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-center text-xs text-slate-500">
                        Belum ada grup yang tersinkronisasi. Bot akan mendeteksi dan menyimpan grup secara otomatis begitu ada pesan masuk di dalam grup WhatsApp Anda, atau Anda dapat mendaftarkannya secara manual di atas untuk keperluan pengetesan!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {botState.groups.map((group) => (
                          <button
                            key={group.id}
                            onClick={() => setSelectedGroupId(selectedGroupId === group.id ? null : group.id)}
                            className={`p-4 rounded-xl text-left border transition focus:outline-none cursor-pointer flex flex-col justify-between h-[120px] ${
                              selectedGroupId === group.id 
                                ? "bg-slate-900 border-rose-500" 
                                : "bg-slate-950 border-slate-800/80 hover:border-slate-700"
                            }`}
                            id={`group_card_${group.id}`}
                          >
                            <div>
                              <div className="flex items-center justify-between w-full">
                                <span className="font-bold text-xs text-white truncate max-w-[150px]">{group.name}</span>
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                  group.enabled 
                                    ? "bg-emerald-500/10 text-emerald-400" 
                                    : "bg-rose-400/10 text-rose-400"
                                }`}>
                                  {group.enabled ? "Active" : "Disabled"}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{group.id}</p>
                            </div>

                            <div className="flex gap-2 text-[8px] font-mono mt-2 text-slate-405 text-slate-400 flex-wrap">
                              <span className={`px-1 py-0.5 rounded ${group.autoReplyEnabled ? "bg-amber-400/10 text-amber-400" : "bg-slate-900"}`}>
                                Auto-Reply: {group.autoReplyEnabled ? "ON" : "OFF"}
                              </span>
                              <span className={`px-1 py-0.5 rounded ${group.welcomeEnabled ? "bg-blue-400/10 text-blue-400" : "bg-slate-900"}`}>
                                Welcome: {group.welcomeEnabled ? "ON" : "OFF"}
                              </span>
                              <span className={`px-1 py-0.5 rounded ${group.antilinkEnabled ? "bg-rose-400/10 text-rose-455 text-rose-400" : "bg-slate-900"}`}>
                                Anti-Link: {group.antilinkEnabled ? "ON" : "OFF"}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Settings detail modal for selected group */}
                  {selectedGroupId && (() => {
                    const group = botState.groups?.find(g => g.id === selectedGroupId);
                    if (!group) return null;

                    // Group specific replies list
                    const groupReplies = botState.autoReplies?.filter(item => item.groupId === group.id) || [];

                    return (
                      <div className="bg-slate-950 border border-rose-500/30 p-6 rounded-2xl space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                              <Sliders className="w-4 h-4 text-rose-400" />
                              <span>Konfigurasi Grup: {group.name}</span>
                            </h3>
                            <p className="text-[10px] text-slate-500 font-mono">{group.id}</p>
                          </div>
                          <button 
                            onClick={() => setSelectedGroupId(null)}
                            className="text-xs text-rose-455 text-rose-400 hover:text-rose-350 cursor-pointer"
                          >
                            Tutup Detail Jendela
                          </button>
                        </div>

                        {/* General Group Toggle Switch */}
                        <div className="flex items-center justify-between p-3.5 bg-slate-900 border border-slate-850 rounded-xl">
                          <div>
                            <span className="text-xs font-bold text-slate-200">Izinkan Bot Merespon di Grup Ini</span>
                            <p className="text-[9px] text-slate-400">Jika dimatikan, bot akan diam / silent sepenuhnya di grup ini</p>
                          </div>
                          <button
                            onClick={() => handleUpdateGroupConfig(group.id, { enabled: !group.enabled })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                              group.enabled ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                            }`}
                            id={`group_toggle_enabled_${group.id}`}
                          >
                            {group.enabled ? "Enabled" : "Disabled"}
                          </button>
                        </div>

                        {/* Welcome Messages Config Section */}
                        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-slate-200">Sambut Anggota Baru (Welcome)</span>
                              <p className="text-[9px] text-slate-400">Kirim respon otomatis menyambut peserta baru ketika join</p>
                            </div>
                            <button
                              onClick={() => handleUpdateGroupConfig(group.id, { welcomeEnabled: !group.welcomeEnabled })}
                              className={`px-3 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                group.welcomeEnabled ? "bg-blue-500 text-slate-950" : "bg-slate-800 text-slate-400"
                              }`}
                              id={`group_toggle_welcome_${group.id}`}
                            >
                              {group.welcomeEnabled ? "Welcome ON" : "Welcome OFF"}
                            </button>
                          </div>
                          {group.welcomeEnabled && (
                            <div className="space-y-1.5 pt-2">
                              <label className="block text-[10px] text-slate-400">Isi Pengumuman Selamat Datang (Gunakan <span className="font-mono text-white font-bold">@user</span>)</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Selamat datang @user di grup kami! 🌸"
                                  defaultValue={group.welcomeMessage}
                                  onBlur={(e) => handleUpdateGroupConfig(group.id, { welcomeMessage: e.target.value })}
                                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                                />
                                <span className="text-[9px] text-slate-500 mt-2">Tab keluar / lepas fokus untuk menyimpan</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Goodbye Messages Config Section */}
                        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-slate-205 text-slate-200">Ucapkan Selamat Tinggal (Goodbye)</span>
                              <p className="text-[9px] text-slate-400">Kirim pesan otomatis perpisahan saat anggota keluar</p>
                            </div>
                            <button
                              onClick={() => handleUpdateGroupConfig(group.id, { goodbyeEnabled: !group.goodbyeEnabled })}
                              className={`px-3 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                group.goodbyeEnabled ? "bg-red-550 bg-red-500/20 text-red-400 border border-red-500/25" : "bg-slate-800 text-slate-400"
                              }`}
                              id={`group_toggle_goodbye_${group.id}`}
                            >
                              {group.goodbyeEnabled ? "Goodbye ON" : "Goodbye OFF"}
                            </button>
                          </div>
                          {group.goodbyeEnabled && (
                            <div className="space-y-1.5 pt-2">
                              <label className="block text-[10px] text-slate-400">Isi Pengumuman Selamat Tinggal (Gunakan <span className="font-mono text-white font-bold">@user</span>)</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="@user telah meninggalkan grup."
                                  defaultValue={group.goodbyeMessage}
                                  onBlur={(e) => handleUpdateGroupConfig(group.id, { goodbyeMessage: e.target.value })}
                                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                                />
                                <span className="text-[9px] text-slate-500 mt-2">Tab keluar / lepas fokus untuk menyimpan</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Anti Link Config Section */}
                        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-slate-200">Proteksi Anti Link (Anti Link)</span>
                              <p className="text-[9px] text-slate-400">Hapus secara otomatis link yang dikirim anggota biasa di dalam grup ini</p>
                            </div>
                            <button
                              onClick={() => handleUpdateGroupConfig(group.id, { antilinkEnabled: !group.antilinkEnabled })}
                              className={`px-3 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                group.antilinkEnabled ? "bg-rose-500 text-slate-950" : "bg-slate-800 text-slate-400"
                              }`}
                              id={`group_toggle_antilink_${group.id}`}
                            >
                              {group.antilinkEnabled ? "Anti-Link ON" : "Anti-Link OFF"}
                            </button>
                          </div>
                        </div>

                        {/* Anti Badword Config Section */}
                        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-slate-200">Saringan Kata Kasar (Anti Badword)</span>
                              <p className="text-[9px] text-slate-400">Moderasi otomatis untuk menyaring kata-kata tidak patut di grup ini</p>
                            </div>
                            <button
                              onClick={() => handleUpdateGroupConfig(group.id, { antibadwordEnabled: !group.antibadwordEnabled })}
                              className={`px-3 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                group.antibadwordEnabled ? "bg-red-500 text-slate-950" : "bg-slate-800 text-slate-400"
                              }`}
                              id={`group_toggle_antibadword_${group.id}`}
                            >
                              {group.antibadwordEnabled ? "Anti-Badword ON" : "Anti-Badword OFF"}
                            </button>
                          </div>

                          {group.antibadwordEnabled && (
                            <div className="space-y-3 pt-2">
                              <label className="block text-[10px] text-slate-400 font-semibold mb-1">Daftar Kata Terlarang (Gunakan tanda koma "," untuk mendaftarkan banyak kata)</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="anjing, babi, bangsat"
                                  value={group.badwordList?.join(", ") || ""}
                                  onChange={async (e) => {
                                    const words = e.target.value.split(",").map(w => w.trim()).filter(Boolean);
                                    await handleUpdateGroupConfig(group.id, { badwordList: words });
                                  }}
                                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                                />
                              </div>
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {(group.badwordList || []).map((word, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/20">
                                    {word}
                                    <button 
                                      onClick={async () => {
                                        const words = (group.badwordList || []).filter(w => w !== word);
                                        await handleUpdateGroupConfig(group.id, { badwordList: words });
                                      }}
                                      className="hover:text-red-300 font-bold ml-1 text-[9px] focus:outline-none"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Group Rank & XP Settings Section */}
                        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                            <div>
                              <span className="text-xs font-bold text-slate-200">Sistem Rank & Leveling Grup</span>
                              <p className="text-[9px] text-slate-400">Atur perolehan XP dan keaktifan khusus untuk grup ini</p>
                            </div>
                            <button
                              onClick={() => handleUpdateGroupConfig(group.id, { rankEnabled: !group.rankEnabled })}
                              className={`px-3 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                group.rankEnabled ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                              }`}
                              id={`group_toggle_rank_${group.id}`}
                            >
                              {group.rankEnabled ? "Rank Grup ON" : "Rank Grup OFF"}
                            </button>
                          </div>

                          {group.rankEnabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">XP Per Chat (Poin)</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  defaultValue={group.xpPerChat || 10}
                                  onBlur={(e) => handleUpdateGroupConfig(group.id, { xpPerChat: parseInt(e.target.value) || 10 })}
                                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white"
                                />
                                <span className="text-[8px] text-slate-500 mt-1 block">Rekomendasi default: 10 XP</span>
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">XP Cooldown (Detik)</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={300}
                                  defaultValue={group.cooldown || 15}
                                  onBlur={(e) => handleUpdateGroupConfig(group.id, { cooldown: parseInt(e.target.value) || 15 })}
                                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-white"
                                />
                                <span className="text-[8px] text-slate-500 mt-1 block">Cooldown spam pencegah farming XP</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Group Leaderboard Display Section */}
                        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                            <div>
                              <span className="text-xs font-bold text-slate-200">Klasemen Keaktifan Grup (Top 10 Leaderboard)</span>
                              <p className="text-[9px] text-slate-400">Peringkat anggota teraktif di dalam grup ini berdasarkan akumulasi XP</p>
                            </div>
                            <button
                              onClick={() => handleResetGroupXp(group.id)}
                              className="text-[10px] text-rose-400 hover:text-rose-300 font-bold border border-rose-500/20 px-2.5 py-1 rounded bg-rose-500/10 cursor-pointer"
                            >
                              Reset Group XP
                            </button>
                          </div>

                          {(() => {
                            const groupUsers = (botState.xpData || [])
                              .filter(u => u.groupId === group.id)
                              .sort((a, b) => b.xp - a.xp)
                              .slice(0, 10);

                            if (groupUsers.length === 0) {
                              return <p className="text-[11px] text-slate-500 italic pt-1">Belum ada aktivitas obrolan terekam di grup ini.</p>;
                            }

                            return (
                              <div className="space-y-1.5 pt-1 max-h-[250px] overflow-y-auto pr-1">
                                {groupUsers.map((user, idx) => {
                                  const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
                                  return (
                                    <div key={idx} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs font-bold w-6 text-center">{medal}</span>
                                        <div>
                                          <p className="text-xs font-bold text-slate-200">{user.name}</p>
                                          <p className="text-[9px] text-slate-500 font-mono">+{user.userId?.split("@")[0]}</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs font-bold text-emerald-400">{user.xp} XP</p>
                                        <p className="text-[9px] text-slate-400 font-medium">Level {user.level || 1} • {user.totalChat} chats</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Auto-reply keywords list specifically for this group */}
                        <div className="bg-slate-900 border border-slate-855 border-slate-855 border-slate-850 p-4 rounded-xl space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                            <div>
                              <span className="text-xs font-bold text-slate-200">Pemicu Keyword Auto-Reply Khusus Grup Ini</span>
                              <p className="text-[10px] text-slate-400">Aktifkan respon pesan otomatis spesifik bagi anggota grup ini</p>
                            </div>
                            <button
                              onClick={() => handleUpdateGroupConfig(group.id, { autoReplyEnabled: !group.autoReplyEnabled })}
                              className={`px-3 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                group.autoReplyEnabled ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-400"
                              }`}
                              id={`group_toggle_autoreply_${group.id}`}
                            >
                              {group.autoReplyEnabled ? "Auto-Reply ON" : "Auto-Reply OFF"}
                            </button>
                          </div>

                          {/* Form to add group level keyword */}
                          {group.autoReplyEnabled && (
                            <div className="space-y-3 pt-2">
                              <form onSubmit={(e) => handleAddGroupKeyword(e, group.id)} className="space-y-3 p-3 bg-slate-950 border border-slate-805 border-slate-800 rounded-xl">
                                <span className="text-[10px] font-bold text-amber-400 uppercase">Input keyword khusus grup:</span>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[9px] text-slate-400 mb-1">Keyword</label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="contoh: info, aturan"
                                      value={newGroupKeyword}
                                      onChange={(e) => setNewGroupKeyword(e.target.value)}
                                      className="block w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white animate-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] text-slate-400 mb-1">Kecocokan</label>
                                    <select
                                      value={newGroupMatchType}
                                      onChange={(e) => setNewGroupMatchType(e.target.value as "exact" | "contains")}
                                      className="block w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                                    >
                                      <option value="exact">Exact (Persis)</option>
                                      <option value="contains">Contains (Mengandung)</option>
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[9px] text-slate-400 mb-1">Isi Pesan Balasan</label>
                                  <textarea
                                    required
                                    rows={2}
                                    placeholder="Tulis balasan pesan otomatis disini..."
                                    value={newGroupReply}
                                    onChange={(e) => setNewGroupReply(e.target.value)}
                                    className="block w-full px-2.5 py-1.5 bg-slate-905 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                                  />
                                </div>

                                <button
                                  type="submit"
                                  disabled={isAddingGroupKeyword || !newGroupKeyword || !newGroupReply}
                                  className="bg-amber-450 bg-amber-400 hover:bg-amber-350 text-slate-950 font-bold px-3 py-1.5 rounded text-[11px] transition cursor-pointer"
                                >
                                  Tambah Keyword Grup
                                </button>
                              </form>

                              {/* render group specific keywords registered */}
                              <div className="space-y-2 pt-2">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wide block font-semibold">Keyword Terdaftar di Grup Ini ({groupReplies.length}):</span>
                                {groupReplies.length === 0 ? (
                                  <p className="text-[10px] text-slate-500 italic">Belum ada keyword pemicu khusus grup ini.</p>
                                ) : (
                                  groupReplies.map((item) => (
                                    <div key={item.id} className="p-3 bg-slate-950 border border-slate-800/60 rounded-xl flex items-start justify-between gap-3">
                                      <div className="text-xs space-y-1">
                                        <div className="flex gap-2 items-center">
                                          <span className="px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 font-bold font-mono text-[10px]">{item.keyword}</span>
                                          <span className="text-[9px] text-slate-500 font-mono">({item.matchType})</span>
                                        </div>
                                        <p className="text-slate-300 leading-relaxed text-[11px] whitespace-pre-wrap">{item.reply}</p>
                                      </div>
                                      <button
                                        onClick={() => handleDeleteKeyword(item.id)}
                                        className="text-slate-400 hover:text-rose-400 font-bold transition cursor-pointer text-xs"
                                      >
                                        Hapus
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })()}

                </div>
              )}

              {/* Tab 2: Keyword AutoReply dynamic manager */}
              {activeTab === "keywords" && (
                <div className="p-4 md:p-6 space-y-6">
                  
                  {/* Create keyword sub-card */}
                  <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
                    <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1">
                      <PlusCircle className="w-4 h-4 text-amber-400" />
                      Tambah Respon Kata Kunci Baru
                    </h3>

                    <form onSubmit={handleAddKeyword} className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
                      <div className="md:col-span-5">
                        <label className="block text-[10px] text-slate-400 mb-1" htmlFor="keyword_term">Kata Kunci</label>
                        <input
                          id="keyword_term"
                          type="text"
                          required
                          placeholder="contoh: harga, halo, help"
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          className="block w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                        />
                      </div>

                      <div className="md:col-span-4">
                        <label className="block text-[10px] text-slate-400 mb-1">Kecocokan</label>
                        <select
                          value={newMatchType}
                          onChange={(e) => setNewMatchType(e.target.value as "exact" | "contains")}
                          className="block w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                        >
                          <option value="exact">Exact (Persis Sama)</option>
                          <option value="contains">Contains (Mengandung Kata)</option>
                        </select>
                      </div>

                      <div className="md:col-span-12">
                        <label className="block text-[10px] text-slate-400 mb-1" htmlFor="keyword_body">Pesan Balas Otomatis</label>
                        <textarea
                          id="keyword_body"
                          required
                          placeholder="Tulis pesan balas otomatis yang diinginkan..."
                          rows={2}
                          value={newReply}
                          onChange={(e) => setNewReply(e.target.value)}
                          className="block w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <div className="md:col-span-12 flex justify-end">
                        <button
                          type="submit"
                          disabled={isAddingKeyword || !newKeyword.trim() || !newReply.trim()}
                          className="bg-amber-505 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition duration-150 disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                          id="add_keyword_btn"
                        >
                          {isAddingKeyword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                          <span>Simpan Keyword</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Registered keywords lists and tables */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Daftar Keyword Terdaftar ({botState.autoReplies.length})</h4>

                    {botState.autoReplies.length === 0 ? (
                      <div className="p-8 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-center text-xs text-slate-500">
                        Belum ada respon otomatis yang didaftarkan. Gunakan form di atas untuk mendaftarkan respon otomatis pertama Anda!
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {botState.autoReplies.map((item) => (
                          <div key={item.id} className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 flex items-start justify-between gap-4">
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-amber-500/10 text-amber-400 font-mono text-xs font-bold px-2 py-0.5 rounded border border-amber-500/10">
                                  {item.keyword}
                                </span>
                                <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800 font-mono">
                                  {item.matchType}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed break-words whitespace-pre-wrap">{item.reply}</p>
                            </div>
                            
                            <button
                              onClick={() => handleDeleteKeyword(item.id)}
                              className="text-slate-500 hover:text-rose-400 p-2 hover:bg-rose-500/10 rounded-xl transition cursor-pointer flex-shrink-0"
                              title="Hapus Keyword"
                              id={`delete_reply_${item.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Tab 3: Core Bot Configuration Settings */}
              {activeTab === "settings" && (
                <div className="p-4 md:p-6">
                  <form onSubmit={handleSaveSettings} className="space-y-5 bg-slate-950 border border-slate-800 p-6 rounded-2xl">
                    <div className="flex items-center space-x-2 text-white border-b border-slate-800 pb-3">
                      <Sliders className="w-5 h-5 text-blue-400" />
                      <div>
                        <h3 className="text-sm font-bold text-white">Pengaturan Identitas & Admin</h3>
                        <p className="text-[10px] text-slate-450 text-slate-400">Dimuat secara dinamis oleh system configuration file.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1" htmlFor="bot_name_input">Nama Bot Resmi</label>
                        <input
                          id="bot_name_input"
                          type="text"
                          required
                          value={inputBotName}
                          onChange={(e) => setInputBotName(e.target.value)}
                          className="block w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                        />
                        <p className="text-[10px] text-slate-550 text-slate-500 mt-1 leading-relaxed">Label identitas nama bot yang akan ditampilkan di web header serta pesan bantuan.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1" htmlFor="admin_phone_input">Nomor WhatsApp Admin Utama (Owner)</label>
                        <input
                          id="admin_phone_input"
                          type="text"
                          placeholder="contoh: 628123456789"
                          value={inputAdminPhone}
                          onChange={(e) => setInputAdminPhone(e.target.value)}
                          className="block w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-medium"
                        />
                        <p className="text-[10px] text-slate-550 text-slate-550 text-slate-500 mt-1 leading-relaxed">
                          Hanya nomor admin utama di atas yang dapat mengaktifkan restricted command khusus admin seperti <span className="text-slate-305 text-slate-300 font-mono font-bold">/status</span>. Kosongkan jika ingin mengizinkan siapapun mengetes perintah stats.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1" htmlFor="bot_prefix_input">Command Prefix (Awalan Perintah)</label>
                        <input
                          id="bot_prefix_input"
                          type="text"
                          maxLength={3}
                          value={inputPrefix}
                          onChange={(e) => setInputPrefix(e.target.value)}
                          className="block w-32 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold text-md"
                        />
                        <p className="text-[10px] text-slate-550 text-slate-500 mt-1 leading-relaxed">Simbol pengenal perintah bot (bawaan: <span className="font-mono font-semibold text-slate-300">/</span>). Contoh untuk menu bantuan: <span className="font-mono text-slate-300">/menu</span>.</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingSettings || !inputBotName.trim()}
                        className="bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold px-5 py-2.5 rounded-lg text-xs transition duration-150 disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                        id="save_settings_btn"
                      >
                        {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Simpan Config</span>
                      </button>
                    </div>
                  </form>

                  {/* Global Feature Controls (ON/OFF) */}
                  <div className="mt-6 space-y-5 bg-slate-950 border border-slate-800 p-6 rounded-2xl">
                    <div className="flex items-center space-x-2 text-white border-b border-slate-800 pb-3">
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h3 className="text-sm font-bold text-white">Kontrol Fitur Utama (Global Feature Manager)</h3>
                        <p className="text-[10px] text-slate-400">Aktifkan atau matikan fitur bot secara menyeluruh (realtime).</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Feature 1: Leveling */}
                      <div className="flex items-center justify-between p-3.5 bg-slate-900 border border-slate-850 rounded-xl">
                        <div>
                          <span className="text-xs font-bold text-slate-200">Sistem Leveling XP</span>
                          <p className="text-[9px] text-slate-400 font-medium">Izinkan anggota mengumpulkan XP dari aktivitas chatting</p>
                        </div>
                        <button
                          onClick={() => handleToggleFeature("levelingEnabled", !botState.features?.levelingEnabled)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            botState.features?.levelingEnabled ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {botState.features?.levelingEnabled ? "ON" : "OFF"}
                        </button>
                      </div>

                      {/* Feature 2: Group Rank */}
                      <div className="flex items-center justify-between p-3.5 bg-slate-900 border border-slate-850 rounded-xl">
                        <div>
                          <span className="text-xs font-bold text-slate-200">Sistem Rank Grup</span>
                          <p className="text-[9px] text-slate-400 font-medium font-medium">Kelola ranking keaktifan secara mandiri di setiap grup</p>
                        </div>
                        <button
                          onClick={() => handleToggleFeature("rankEnabled", !botState.features?.rankEnabled)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            botState.features?.rankEnabled ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {botState.features?.rankEnabled ? "ON" : "OFF"}
                        </button>
                      </div>

                      {/* Feature 3: Anti Badword */}
                      <div className="flex items-center justify-between p-3.5 bg-slate-900 border border-slate-850 rounded-xl">
                        <div>
                          <span className="text-xs font-bold text-slate-200">Saringan Anti Badword</span>
                          <p className="text-[9px] text-slate-400 font-medium">Hapus kata-kata kasar dan kirim peringatan otomatis</p>
                        </div>
                        <button
                          onClick={() => handleToggleFeature("antiBadwordEnabled", !botState.features?.antiBadwordEnabled)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            botState.features?.antiBadwordEnabled ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {botState.features?.antiBadwordEnabled ? "ON" : "OFF"}
                        </button>
                      </div>

                      {/* Feature 4: Random Features */}
                      <div className="flex items-center justify-between p-3.5 bg-slate-900 border border-slate-850 rounded-xl">
                        <div>
                          <span className="text-xs font-bold text-slate-200">Quotes & Humor Hiburan</span>
                          <p className="text-[9px] text-slate-400 font-medium">Akses ke command quote, fakta unik, dan lelucon random</p>
                        </div>
                        <button
                          onClick={() => handleToggleFeature("randomEnabled", !botState.features?.randomEnabled)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            botState.features?.randomEnabled ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {botState.features?.randomEnabled ? "ON" : "OFF"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Workplace Panel footer bar hints */}
            <div className="border-t border-slate-800/80 px-6 py-3.5 bg-slate-950/90 text-[10px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-450 text-blue-450" />
                <span>Admin Level: Master Authorizer</span>
              </span>
              <span className="text-emerald-500/80 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Active
              </span>
            </div>

          </div>
        </section>

      </main>

      {/* Main Bottom Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/40 py-4 px-6 text-center text-xs text-slate-500" id="app_footer_note">
        WhatsApp Bot Pairing Dashboard &bull; Powered by the official Baileys engine
      </footer>
    </div>
  );
}

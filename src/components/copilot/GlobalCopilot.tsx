"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export function GlobalCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const pathname = usePathname();
  const [userSelectedAsset, setUserSelectedAsset] = useState<"BTC" | "ETH" | null>(null);

  // Derive active asset from pathname if not explicitly overridden by user
  const routeAsset: "BTC" | "ETH" = pathname.includes("/analyze/ETH") ? "ETH" : "BTC";
  const activeAsset = userSelectedAsset ?? routeAsset;

  const { address, isConnected } = useAccount();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages or loading state
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  async function handleSend(content: string, assetOverride?: "BTC" | "ETH") {
    if (!content.trim() || loading) return;

    const targetAsset = assetOverride || activeAsset;
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/dreamdex/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset: targetAsset, messages: history }),
      });

      const data = await res.json();

      let reply = "";
      if (data.ok && data.explanation) {
        reply = data.explanation.summary;
        if (data.explanation.keyEvidence?.length) {
          reply += "\n\n" + data.explanation.keyEvidence.map((e: string) => `• ${e}`).join("\n");
        }
        if (data.explanation.uncertainty) {
          reply += "\n\n⚠ " + data.explanation.uncertainty;
        }
      } else {
        reply = data.error || "Unable to retrieve temporal intelligence. Please try again.";
      }

      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: reply,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: Message = {
        id: `e-${Date.now()}`,
        role: "assistant",
        content: "Network or RPC connection error. Please verify testnet connection.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  // Support external trigger events e.g. window.dispatchEvent(new CustomEvent("dreamdex-open-copilot"))
  useEffect(() => {
    function handleOpenEvent(e: Event) {
      const customEvent = e as CustomEvent<{ asset?: "BTC" | "ETH"; prompt?: string }>;
      setIsOpen(true);
      if (customEvent.detail?.asset) {
        setUserSelectedAsset(customEvent.detail.asset);
      }
      if (customEvent.detail?.prompt) {
        void handleSend(customEvent.detail.prompt, customEvent.detail.asset || activeAsset);
      }
    }

    window.addEventListener("dreamdex-open-copilot", handleOpenEvent);
    return () => {
      window.removeEventListener("dreamdex-open-copilot", handleOpenEvent);
    };
  });

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend(input);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  // Format wallet address to match "BJUC...CWTE" as shown in screenshot
  const displayWallet = isConnected && address
    ? `${address.replace(/^0x/, "").slice(0, 4).toUpperCase()}...${address.slice(-4).toUpperCase()}`
    : "SOMNIA TESTNET";

  const suggestions = [
    `Why is ${activeAsset} conviction moving?`,
    "What changed since the last snapshot?",
    "Explain conviction decay across horizons",
    "What would invalidate this market state?",
  ];

  return (
    <>
      {/* ── MINIMIZED TRIGGER ── */}
      {!isOpen && (
        <div
          className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 flex items-center"
          style={{ filter: "drop-shadow(0 10px 25px rgba(0,0,0,0.6))" }}
        >
          {/* ── MOBILE: icon-only circle ── */}
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open AI Copilot"
            className="sm:hidden relative w-12 h-12 rounded-full flex items-center justify-center bg-[#111319]/90 border border-white/15 backdrop-blur-xl shadow-xl cursor-pointer hover:border-blue-500/40 transition-all active:scale-95 duration-200"
          >
            {/* Rocket icon */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
              <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
              <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </svg>
            {/* Online dot */}
            <span className="absolute top-0.5 right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            </span>
          </button>

          {/* ── DESKTOP: full pill ── */}
          <div className="hidden sm:flex items-center">
            {/* Left circular chevron */}
            <button
              onClick={() => setIsOpen(true)}
              aria-label="Open AI Copilot"
              className="w-8 h-8 rounded-full bg-[#161922] hover:bg-[#202533] border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all -mr-3 z-10 cursor-pointer shadow-md"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="13 17 18 12 13 7" />
                <polyline points="6 17 11 12 6 7" />
              </svg>
            </button>

            {/* Main pill */}
            <button
              onClick={() => setIsOpen(true)}
              className="group relative flex items-center gap-2 pl-5 pr-4 py-2.5 rounded-full bg-[#111319]/90 hover:bg-[#151923] border border-white/12 hover:border-blue-500/40 backdrop-blur-xl transition-all duration-200 cursor-pointer text-white shadow-xl"
            >
              {/* Rocket SVG */}
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transform group-hover:scale-110 transition-transform"
              >
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
              </svg>
              <span className="font-sans text-[13px] font-semibold text-white tracking-tight">
                AI Copilot
              </span>
              {/* Online dot */}
              <span className="relative flex h-2 w-2 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              </span>
            </button>
          </div>
        </div>
      )}


      {/* ── EXPANDED FLOATING WINDOW (Matches Screenshot 1) ── */}
      {isOpen && (
        <div
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-[410px] h-[580px] max-h-[calc(100vh-80px)] rounded-2xl bg-[#0c0e14]/95 border border-white/10 backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="p-3.5 px-4 border-b border-white/[0.07] bg-white/[0.02] flex items-center justify-between select-none">
            {/* Left: Brain icon & Copilot title */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-950/50 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.25)] flex-shrink-0">
                {/* Stylized Brain SVG */}
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-5.04z" />
                  <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-5.04z" />
                </svg>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-sans text-[14px] font-bold text-white tracking-tight">
                    AI Copilot
                  </span>
                </div>

                {/* Subtitle with green dot & wallet address */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  <span className="font-mono text-[10px] text-zinc-400 tracking-wider font-medium uppercase">
                    {displayWallet}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Asset switch & Controls */}
            <div className="flex items-center gap-1">
              {/* Asset toggle pill */}
              <div className="flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.07] mr-1.5">
                {(["BTC", "ETH"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setUserSelectedAsset(a)}
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md transition-all cursor-pointer ${
                      activeAsset === a
                        ? "bg-blue-600/30 text-blue-400 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.2)]"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>

              {/* Collapse button >> */}
              <button
                onClick={() => setIsOpen(false)}
                title="Collapse"
                className="w-7 h-7 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="13 17 18 12 13 7" />
                  <polyline points="6 17 11 12 6 7" />
                </svg>
              </button>

              {/* Minimize button — */}
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize"
                className="w-7 h-7 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0 select-text scrollbar-thin">
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-6">
                {/* Large watermark brain icon */}
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-zinc-600/40 mb-3">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-5.04z" />
                    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-5.04z" />
                  </svg>
                </div>

                {/* Subtext matching Screenshot 1 */}
                <p className="font-mono text-[11px] text-zinc-500 leading-relaxed max-w-[240px]">
                  Agent primed, awaiting your command to strike the next edge.
                </p>

                {/* Quick suggestions */}
                <div className="flex flex-col w-full gap-1.5 mt-6 max-w-[320px]">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => void handleSend(s)}
                      disabled={loading}
                      className="w-full text-left px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-blue-500/30 font-mono text-[10px] text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <span className="truncate">{s}</span>
                      <span className="text-zinc-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Render conversation messages */}
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 ${
                    isUser ? "items-end" : "items-start"
                  }`}
                >
                  <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500 px-1">
                    {isUser ? "You" : "Copilot"}
                  </span>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed break-words ${
                      isUser
                        ? "bg-white/[0.07] border border-white/10 text-zinc-100 rounded-br-xs"
                        : "bg-[#131722]/90 border border-blue-500/20 text-zinc-200 rounded-bl-xs shadow-sm"
                    }`}
                  >
                    <div className="whitespace-pre-line font-sans">{msg.content}</div>
                  </div>
                </div>
              );
            })}

            {/* Thinking status */}
            {loading && (
              <div className="flex items-center gap-2 p-2 px-3 rounded-xl bg-blue-950/20 border border-blue-500/20 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                <span className="font-mono text-[10px] text-blue-400 font-semibold tracking-wider uppercase">
                  Analyzing temporal vectors...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Area */}
          <div className="p-3 border-t border-white/[0.07] bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/[0.04] border border-white/[0.08] focus-within:border-blue-500/40 focus-within:bg-white/[0.06] rounded-xl px-3.5 py-2 flex items-center gap-2 transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Command AI Copilot..."
                  disabled={loading}
                  className="bg-transparent border-none outline-none text-xs text-white placeholder:text-zinc-500 w-full font-sans"
                />
              </div>

              {/* Send Button */}
              <button
                onClick={() => void handleSend(input)}
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                  loading || !input.trim()
                    ? "bg-white/[0.03] text-zinc-600 border border-white/[0.05] cursor-not-allowed"
                    : "bg-blue-600/30 hover:bg-blue-600/50 text-blue-400 border border-blue-500/30 cursor-pointer shadow-[0_0_12px_rgba(59,130,246,0.25)] active:scale-95"
                }`}
              >
                {/* Angled Paper Airplane SVG (matching Screenshot 1) */}
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transform -rotate-12 translate-x-0.5 -translate-y-0.5"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>

            {/* Clear button when chat has messages */}
            {messages.length > 0 && (
              <div className="flex justify-center mt-2">
                <button
                  onClick={() => setMessages([])}
                  className="font-mono text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  Clear conversation
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

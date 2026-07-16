import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Sparkles, Loader2, Wrench } from "lucide-react";
import { sendAgentQuery } from "../hooks/useStadiumData.js";

const QUICK_ACTIONS = [
  {
    label: "Full Status Report",
    query:
      "Give me a comprehensive status report of all gates, zones, and active incidents right now.",
  },
  {
    label: "High Risk Zones",
    query:
      "Identify all zones with high or critical density levels and recommend crowd redistribution actions.",
  },
  {
    label: "Gate Optimization",
    query:
      "Analyze all gate throughput and queue lengths. Which gates need rerouting or should be closed?",
  },
  {
    label: "Emergency Readiness",
    query:
      "Assess our emergency readiness. Are there any emerging patterns that could lead to a crowd safety incident?",
  },
  {
    label: "Weather Impact",
    query: "What is the current weather status and how should it affect our operational decisions?",
  },
  {
    label: "Ticket Routing",
    query:
      "Suggest optimal gate assignments for the next batch of 500 VIP ticket holders arriving now.",
  },
];

/**
 * AICommandPanel Component.
 * Renders an AI command center interface for stadium staff to interact with an AI agent.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {Function} props.onClose - Callback function triggered when closing the panel.
 * @param {boolean} props.overlay - If true, displays the panel as a right-hand sidebar overlay with backdrop.
 * @param {boolean} [props._embedded] - Optional flag indicating if the panel is embedded layout-style (unused).
 * @returns {React.JSX.Element} The rendered AI Command Panel.
 */
export default function AICommandPanel({ onClose, overlay, _embedded }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "**CrowdPulse AI Command Center active.** I have real-time access to all stadium systems — gates, zones, crowd sensors, weather, and incident feeds. I can analyze conditions, reroute crowds, trigger emergency protocols, and optimize operations.\n\nWhat would you like me to do?",
      tools: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async (query) => {
    const msg = query || input.trim();
    if (!msg || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    setLoading(true);

    try {
      const result = await sendAgentQuery(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.response || result.fallback || "No response received.",
          tools: result.toolsUsed || [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again.", tools: [] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const containerClass = overlay
    ? "fixed right-0 top-0 bottom-0 w-full sm:w-[480px] z-50 bg-midnight-800/95 backdrop-blur-2xl border-l border-white/[0.06] shadow-2xl animate-slide-up flex flex-col"
    : "glass-card flex flex-col h-[calc(100vh-180px)] min-h-[500px]";

  return (
    <>
      {overlay && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      )}
      <div className={containerClass}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pulse-400 to-cyan-400 flex items-center justify-center">
              <Bot size={16} className="text-midnight-900" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">AI Command Agent</h3>
              <p className="text-[10px] text-pulse-400 font-mono">
                Gemini 2.0 Flash • Agentic Mode
              </p>
            </div>
          </div>
          {overlay && (
            <button onClick={onClose} aria-label="Close AI Command Panel" className="p-2 rounded-lg hover:bg-white/5 text-gray-400">
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-3 border-b border-white/[0.04] shrink-0 overflow-x-auto">
          <div className="flex gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handleSend(action.query)}
                disabled={loading}
                className="shrink-0 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px] font-medium text-gray-400 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.12] transition-all disabled:opacity-40"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages — log live region so new AI replies are announced politely. */}
        <div
          role="log"
          aria-live="polite"
          aria-label="Conversation with AI Command Agent"
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 animate-fade-in ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-pulse-400/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={12} className="text-pulse-400" aria-hidden="true" />
                </div>
              )}
              <div
                className={`max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-cyan-400/10 border border-cyan-400/15 rounded-2xl rounded-tr-md px-4 py-3"
                    : "flex-1"
                }`}
              >
                {msg.tools && msg.tools.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {msg.tools.map((t, ti) => (
                      <span
                        key={ti}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-400/10 text-purple-400 text-[10px] font-mono"
                      >
                        <Wrench size={9} aria-hidden="true" />
                        {t.tool}
                      </span>
                    ))}
                  </div>
                )}
                <div
                  className={`text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user" ? "text-cyan-100" : "text-gray-300"
                  }`}
                >
                  {formatMessage(msg.content)}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            // status role announces the loading state to assistive tech.
            <div className="flex items-center gap-3 animate-fade-in" role="status">
              <div className="w-7 h-7 rounded-lg bg-pulse-400/10 flex items-center justify-center shrink-0">
                <Loader2 size={12} className="text-pulse-400 animate-spin" aria-hidden="true" />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="inline-flex gap-1" aria-hidden="true">
                  <span
                    className="w-1.5 h-1.5 bg-pulse-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-pulse-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-pulse-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </span>
                Analyzing stadium systems...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-white/[0.04] shrink-0">
          <div className="flex items-center gap-2 bg-midnight-900/60 rounded-xl border border-white/[0.06] px-4 py-2 focus-within:border-pulse-400/30 transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Command the stadium AI..."
              aria-label="Command the stadium AI"
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
              disabled={loading}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              aria-label="Send query"
              className="p-2 rounded-lg bg-pulse-400/10 text-pulse-400 hover:bg-pulse-400/20 transition-colors disabled:opacity-30"
            >
              <Send size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Helper function to parse and format text messages with basic markdown-like syntax.
 * Converts bold markers and bullet points to styled HTML paragraphs.
 *
 * @param {string} text - The raw text message content.
 * @returns {React.ReactNode[]|string} An array of formatted JSX elements, or empty string.
 */
function formatMessage(text) {
  if (!text) return "";
  
  // Split the message by newline character to process each line individually
  return text.split("\n").map((line, i) => {
    // 1. Check if the line is entirely styled as bold (surrounded by **)
    if (line.startsWith("**") && line.endsWith("**")) {
      return (
        <p key={i} className="font-bold text-white mb-1">
          {line.replace(/\*\*/g, "")}
        </p>
      );
    }
    
    // 2. Check if the line represents a bullet list item (starting with '- ' or '• ')
    if (line.startsWith("- ") || line.startsWith("• ")) {
      return (
        <p key={i} className="ml-3 before:content-['›'] before:mr-2 before:text-pulse-400">
          {line.slice(2)}
        </p>
      );
    }
    
    // 3. For empty lines, render a line break
    if (line.trim() === "") return <br key={i} />;
    
    // 4. Handle inline bold patterns (e.g. "Some text **bold** more text")
    // The regex splits the string while keeping the separator (bold text) in the resulting array
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="mb-0.5">
        {parts.map((part, j) =>
          // If the part is wrapped in **, strip the asterisks and render as bold text
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j} className="text-white font-semibold">
              {part.slice(2, -2)}
            </strong>
          ) : (
            part
          )
        )}
      </p>
    );
  });
}

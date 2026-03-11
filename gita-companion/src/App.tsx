import { useChatStore } from "@/store/chatStore";
import { useSystemCheck } from "@/hooks/useSystemCheck";
import { useChat } from "@/hooks/useChat";
import { Sidebar } from "@/components/Sidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { InputBar } from "@/components/InputBar";
import { StatusBar } from "@/components/StatusBar";
import { SystemCheck } from "@/components/SystemCheck";

// ─────────────────────────────────────────────────────────────
//  MainLayout — rendered once the process is ready
// ─────────────────────────────────────────────────────────────

function MainLayout() {
  const { sidebarOpen, toggleSidebar, processStatus, getActiveConversation } =
    useChatStore();
  const { sendMessage } = useChat();
  const conv = getActiveConversation();

  return (
    <div className={`app-shell${sidebarOpen ? "" : " sidebar-closed"}`}>
      <Sidebar />

      <main className="main-content">
        {/* Header */}
        <header className="chat-header">
          <button
            className="btn-toggle-sidebar"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <div className="toggle-bars" aria-hidden>
              <span />
              <span />
              <span />
            </div>
          </button>

          <h1 className="header-title">
            {conv ? conv.title : "Gita Companion"}
          </h1>

          <div
            className={`header-pill${processStatus === "ready" ? " ready" : ""}`}
          >
            {processStatus === "ready" ? "Ready" : processStatus}
          </div>
        </header>

        <ChatWindow />
        <InputBar onSend={sendMessage} />
      </main>

      <StatusBar />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  App — boot gate
// ─────────────────────────────────────────────────────────────

export default function App() {
  useSystemCheck();

  const { processStatus } = useChatStore();
  const isReady =
    processStatus === "ready" || processStatus === "processing";

  if (!isReady) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1 }}>
          <SystemCheck />
        </div>
        <StatusBar />
      </div>
    );
  }

  return <MainLayout />;
}

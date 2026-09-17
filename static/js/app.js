// ===================================================================
// APEX MULTI-AGENT DEEP RESEARCH & AI CHAT - FRONTEND CONTROLLER
// ===================================================================

const API_BASE = window.location.origin;
let activeUser = null;
let activeEventSource = null;
let currentConversationId = null;
let researchTimerInterval = null;
let researchStartTime = null;
let cachedResearchHistory = [];
let cachedChatHistory = [];
let activeReportData = null;

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
    // Configure Marked.js options
    if (window.marked) {
        marked.setOptions({
            gfm: true,
            breaks: true,
            headerIds: false,
            mangle: false
        });
    }

    const token = getAuthToken();
    if (token) {
        try {
            const user = await apiFetch("/api/auth/me");
            setCurrentUser(user);
            showAppShell();
            switchView("dashboard");
            loadSystemStatus();
        } catch (err) {
            console.warn("Session expired or invalid:", err);
            clearAuth();
            showAuthView();
        }
    } else {
        showAuthView();
    }
});

// --- AUTHENTICATION HELPERS ---
function getAuthToken() {
    return localStorage.getItem("apex_access_token");
}

function setAuthToken(token) {
    localStorage.setItem("apex_access_token", token);
}

function getCurrentUser() {
    const userJson = localStorage.getItem("apex_user");
    return userJson ? JSON.parse(userJson) : null;
}

function setCurrentUser(user) {
    activeUser = user;
    localStorage.setItem("apex_user", JSON.stringify(user));
    updateUserUI(user);
}

function clearAuth() {
    localStorage.removeItem("apex_access_token");
    localStorage.removeItem("apex_user");
    activeUser = null;
}

function updateUserUI(user) {
    if (!user) return;
    const initials = user.full_name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2) || "U";
    document.getElementById("user-avatar-initials").textContent = initials;
    document.getElementById("user-display-name").textContent = user.full_name;
    document.getElementById("user-display-email").textContent = user.email;
    document.getElementById("dash-welcome-name").textContent = user.full_name.split(" ")[0];

    // Profile view
    const profInitials = document.getElementById("prof-avatar-initials");
    if (profInitials) profInitials.textContent = initials;
    const profName = document.getElementById("prof-full-name");
    if (profName) profName.textContent = user.full_name;
    const profEmail = document.getElementById("prof-email");
    if (profEmail) profEmail.textContent = user.email;
}

async function apiFetch(url, options = {}) {
    const token = getAuthToken();
    const headers = options.headers || {};
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    headers["Content-Type"] = headers["Content-Type"] || "application/json";

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        clearAuth();
        showAuthView();
        throw new Error("Session expired. Please sign in again.");
    }
    if (!res.ok) {
        let errDetail = `HTTP ${res.status}`;
        try {
            const errData = await res.json();
            errDetail = errData.detail || errData.message || errDetail;
        } catch (_) {}
        throw new Error(errDetail);
    }
    return res.json();
}

// --- AUTH VIEW INTERACTIONS ---
function showAuthView() {
    document.getElementById("view-auth").classList.remove("hidden");
    document.getElementById("app-shell").classList.add("hidden");
    lucide.createIcons();
}

function showAppShell() {
    document.getElementById("view-auth").classList.add("hidden");
    document.getElementById("app-shell").classList.remove("hidden");
    lucide.createIcons();
}

function switchAuthTab(tab) {
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const formLogin = document.getElementById("form-login");
    const formRegister = document.getElementById("form-register");
    const alertBox = document.getElementById("auth-alert");
    alertBox.classList.add("hidden");

    if (tab === "login") {
        tabLogin.className = "flex-1 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white transition-all shadow-md";
        tabRegister.className = "flex-1 py-2 text-sm font-semibold rounded-lg text-slate-400 hover:text-white transition-all";
        formLogin.classList.remove("hidden");
        formRegister.classList.add("hidden");
    } else {
        tabRegister.className = "flex-1 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white transition-all shadow-md";
        tabLogin.className = "flex-1 py-2 text-sm font-semibold rounded-lg text-slate-400 hover:text-white transition-all";
        formRegister.classList.remove("hidden");
        formLogin.classList.add("hidden");
    }
    lucide.createIcons();
}

function showAuthAlert(message, type = "error") {
    const alertBox = document.getElementById("auth-alert");
    alertBox.classList.remove("hidden");
    if (type === "error") {
        alertBox.className = "mb-4 p-3 rounded-xl text-xs border border-red-500/30 bg-red-500/10 text-red-300";
    } else {
        alertBox.className = "mb-4 p-3 rounded-xl text-xs border border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    }
    alertBox.textContent = message;
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const btn = document.getElementById("btn-login-submit");

    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⟳</span> Signing In...`;

    try {
        const data = await apiFetch("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });
        setAuthToken(data.access_token);
        setCurrentUser(data.user);
        showAppShell();
        switchView("dashboard");
        loadSystemStatus();
    } catch (err) {
        showAuthAlert(err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Sign In</span> <i data-lucide="arrow-right" class="w-4 h-4"></i>`;
        lucide.createIcons();
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const full_name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const btn = document.getElementById("btn-register-submit");

    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⟳</span> Creating Account...`;

    try {
        const data = await apiFetch("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, full_name, password })
        });
        setAuthToken(data.access_token);
        setCurrentUser(data.user);
        showAppShell();
        switchView("dashboard");
        loadSystemStatus();
    } catch (err) {
        showAuthAlert(err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Create Free Account</span> <i data-lucide="user-plus" class="w-4 h-4"></i>`;
        lucide.createIcons();
    }
}

function fillDemoAccount() {
    switchAuthTab("login");
    document.getElementById("login-email").value = "researcher@example.com";
    document.getElementById("login-password").value = "SecurePassword123!";
}

function logout() {
    clearAuth();
    if (activeEventSource) {
        activeEventSource.close();
        activeEventSource = null;
    }
    showAuthView();
}

// --- VIEW NAVIGATION ROUTER ---
function switchView(viewName) {
    const views = ["dashboard", "research", "chat", "history", "profile"];
    const titles = {
        dashboard: "Dashboard Overview",
        research: "Multi-Agent Deep Research",
        chat: "Simple AI Chat",
        history: "Research & Chat History",
        profile: "Profile & Environment Keys"
    };

    // Update nav button active classes
    views.forEach(v => {
        const btn = document.getElementById(`nav-${v}`);
        const content = document.getElementById(`view-${v}-content`);
        if (v === viewName) {
            btn.className = "nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition text-blue-400 bg-blue-500/10 border border-blue-500/20 shadow-sm";
            content.classList.remove("hidden");
        } else {
            btn.className = "nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition text-slate-300 hover:text-white hover:bg-slate-800/60";
            content.classList.add("hidden");
        }
    });

    document.getElementById("view-title").textContent = titles[viewName] || "Dashboard";
    lucide.createIcons();

    // Trigger view-specific loads
    if (viewName === "dashboard") loadDashboard();
    if (viewName === "chat") loadConversations();
    if (viewName === "history") loadHistory();
    if (viewName === "profile") loadProfile();
}

// --- SYSTEM & DIAGNOSTICS ---
async function loadSystemStatus() {
    try {
        const status = await apiFetch("/api/system/status");
        const mistralConfigured = status.mistral_ai?.status === "Configured";
        const tavilyConfigured = status.tavily_search?.status === "Configured";

        const indicatorText = document.getElementById("api-status-text");
        if (mistralConfigured && tavilyConfigured) {
            indicatorText.innerHTML = `<span class="text-emerald-400 font-semibold">Live AI Ready</span>`;
        } else if (mistralConfigured || tavilyConfigured) {
            indicatorText.innerHTML = `<span class="text-amber-400 font-semibold">Partial API Set</span>`;
        } else {
            indicatorText.innerHTML = `<span class="text-blue-300 font-semibold">Demo Mode Active</span>`;
        }

        // Profile badges
        const badgeMistral = document.getElementById("cfg-badge-mistral");
        if (badgeMistral) {
            badgeMistral.textContent = status.mistral_ai.status;
            badgeMistral.className = mistralConfigured
                ? "text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400"
                : "text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300";
        }

        const badgeTavily = document.getElementById("cfg-badge-tavily");
        if (badgeTavily) {
            badgeTavily.textContent = status.tavily_search.status;
            badgeTavily.className = tavilyConfigured
                ? "text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400"
                : "text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300";
        }
    } catch (e) {
        console.warn("Failed to load status:", e);
    }
}

// --- DASHBOARD OVERVIEW ---
async function loadDashboard() {
    try {
        const stats = await apiFetch("/api/stats");
        document.getElementById("stat-researches").textContent = stats.total_researches;
        document.getElementById("stat-messages").textContent = stats.total_messages;
        document.getElementById("stat-critic").textContent = stats.avg_critic_score;

        // Fetch recent researches for list
        const researches = await apiFetch("/api/history/research");
        const listEl = document.getElementById("dash-recent-list");
        if (!researches || researches.length === 0) {
            listEl.innerHTML = `
                <div class="text-center py-8 text-slate-500 text-xs">
                    No research reports generated yet. Click "Start Deep Research" above!
                </div>`;
            return;
        }

        listEl.innerHTML = researches.slice(0, 4).map(r => `
            <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition">
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center flex-shrink-0">
                        <i data-lucide="file-text" class="w-4 h-4"></i>
                    </div>
                    <div class="truncate">
                        <p class="text-xs font-semibold text-white truncate">${escapeHtml(r.topic)}</p>
                        <p class="text-[11px] text-slate-400">${new Date(r.created_at).toLocaleDateString()} • Critic Score: <span class="text-amber-300 font-semibold">${r.critic_score}</span></p>
                    </div>
                </div>
                <button onclick="viewPastReport(${r.id})" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex-shrink-0">
                    View Report
                </button>
            </div>
        `).join("");
        lucide.createIcons();
    } catch (err) {
        console.error("Dashboard error:", err);
    }
}

function loadProfile() {
    loadSystemStatus();
}

// --- DEEP RESEARCH ENGINE ---
function setResearchQuery(q) {
    const input = document.getElementById("research-topic-input");
    input.value = q;
    input.focus();
}

function startDeepResearch(e) {
    e.preventDefault();
    const topic = document.getElementById("research-topic-input").value.trim();
    if (!topic) return;

    // Reset UI states
    const btn = document.getElementById("btn-submit-research");
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-1.5">⟳</span> Running...`;

    document.getElementById("research-progress-section").classList.remove("hidden");
    document.getElementById("research-result-section").classList.add("hidden");

    resetAgentCards();

    // Start elapsed timer
    researchStartTime = Date.now();
    clearInterval(researchTimerInterval);
    const timerEl = document.getElementById("research-timer");
    researchTimerInterval = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - researchStartTime) / 1000);
        timerEl.textContent = `Elapsed: ${elapsedSec}s`;
    }, 1000);

    const logBox = document.getElementById("pipeline-live-logs");
    logBox.innerHTML = `<div>> Launching pipeline for: "${escapeHtml(topic)}"...</div>`;

    // Connect SSE Stream
    if (activeEventSource) {
        activeEventSource.close();
    }

    const token = getAuthToken();
    const sseUrl = `${API_BASE}/api/research/stream?topic=${encodeURIComponent(topic)}&token=${encodeURIComponent(token)}`;
    activeEventSource = new EventSource(sseUrl);

    activeEventSource.onmessage = (event) => {
        try {
            const payload = JSON.parse(event.data);
            handleStreamEvent(payload);
        } catch (err) {
            console.warn("SSE parse error:", err);
        }
    };

    activeEventSource.onerror = (err) => {
        console.error("SSE stream error:", err);
        activeEventSource.close();
        clearInterval(researchTimerInterval);
        btn.disabled = false;
        btn.innerHTML = `<span>Run Research</span> <i data-lucide="sparkles" class="w-4 h-4"></i>`;
        lucide.createIcons();
    };
}

function handleStreamEvent(event) {
    const logBox = document.getElementById("pipeline-live-logs");

    if (event.type === "step") {
        const data = event.data;
        const stepNum = data.step;

        // Append log
        const logLine = document.createElement("div");
        logLine.innerHTML = `<span class="text-blue-400">[${data.title}]</span> ${escapeHtml(data.description)}`;
        logBox.appendChild(logLine);
        logBox.scrollTop = logBox.scrollHeight;

        if (stepNum >= 1 && stepNum <= 4) {
            updateAgentCard(stepNum, data.status, data.description);
        }
    } else if (event.type === "result") {
        // Successful final research completed!
        clearInterval(researchTimerInterval);
        if (activeEventSource) {
            activeEventSource.close();
            activeEventSource = null;
        }

        // Mark all 4 agents as completed
        for (let i = 1; i <= 4; i++) {
            updateAgentCard(i, "completed", "Task finished successfully.");
        }

        const btn = document.getElementById("btn-submit-research");
        btn.disabled = false;
        btn.innerHTML = `<span>Run Research</span> <i data-lucide="sparkles" class="w-4 h-4"></i>`;

        renderResearchReport(event.data);

        // Confetti explosion
        if (window.confetti) {
            confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    } else if (event.type === "error") {
        clearInterval(researchTimerInterval);
        if (activeEventSource) {
            activeEventSource.close();
            activeEventSource = null;
        }
        const btn = document.getElementById("btn-submit-research");
        btn.disabled = false;
        btn.innerHTML = `<span>Run Research</span> <i data-lucide="sparkles" class="w-4 h-4"></i>`;
        alert("Research Pipeline Notice: " + event.message);
    }
}

function resetAgentCards() {
    for (let i = 1; i <= 4; i++) {
        const card = document.getElementById(`agent-card-${i}`);
        const icon = document.getElementById(`agent-icon-${i}`);
        const status = document.getElementById(`agent-status-${i}`);
        card.className = "glass-card p-4 rounded-xl border border-slate-800 transition-all";
        icon.innerHTML = `<i data-lucide="circle-dashed" class="w-4 h-4 text-slate-500"></i>`;
        status.textContent = "Waiting...";
        status.className = "text-[11px] text-slate-500 mt-3 truncate";
    }
    lucide.createIcons();
}

function updateAgentCard(stepNum, state, desc) {
    const card = document.getElementById(`agent-card-${stepNum}`);
    const icon = document.getElementById(`agent-icon-${stepNum}`);
    const status = document.getElementById(`agent-status-${stepNum}`);

    if (state === "running") {
        card.className = "glass-card p-4 rounded-xl agent-active transition-all";
        icon.innerHTML = `<span class="inline-block animate-spin text-blue-400">⟳</span>`;
        status.textContent = desc;
        status.className = "text-[11px] text-blue-300 mt-3 truncate font-medium";
    } else if (state === "completed") {
        card.className = "glass-card p-4 rounded-xl agent-completed transition-all";
        icon.innerHTML = `<i data-lucide="check" class="w-4 h-4 text-emerald-400"></i>`;
        status.textContent = desc;
        status.className = "text-[11px] text-emerald-400 mt-3 truncate font-medium";
    }
    lucide.createIcons();
}

function renderResearchReport(data) {
    activeReportData = data;
    document.getElementById("research-result-section").classList.remove("hidden");

    document.getElementById("report-topic-title").textContent = data.topic;
    document.getElementById("report-timestamp").textContent = `Generated on ${new Date().toLocaleString()}`;
    document.getElementById("report-critic-score").textContent = data.critic_score || "8.5/10";

    // Tab 1: Render markdown report
    const htmlReport = marked.parse(data.report || "");
    document.getElementById("report-rendered-markdown").innerHTML = htmlReport;

    // Tab 2: Critic feedback
    document.getElementById("critic-rendered-feedback").textContent = data.feedback || "No feedback recorded.";

    // Tab 3: Raw traces
    document.getElementById("raw-search-results").textContent = data.search_results || "No raw search results.";
    document.getElementById("raw-scraped-content").textContent = data.scraped_content || "No scraped content.";

    switchReportTab("full");
    document.getElementById("research-result-section").scrollIntoView({ behavior: "smooth" });
    lucide.createIcons();
}

function switchReportTab(tab) {
    const tabs = ["full", "critic", "sources"];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-report-${t}`);
        const content = document.getElementById(`report-tab-${t}-content`);
        if (t === tab) {
            btn.className = "px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white transition shadow";
            content.classList.remove("hidden");
        } else {
            btn.className = "px-4 py-2 text-xs font-semibold rounded-lg text-slate-400 hover:text-white transition";
            content.classList.add("hidden");
        }
    });
    lucide.createIcons();
}

function copyReportMarkdown() {
    if (!activeReportData || !activeReportData.report) return;
    navigator.clipboard.writeText(activeReportData.report).then(() => {
        alert("Report Markdown copied to clipboard!");
    });
}

// --- SIMPLE CHAT SECTION ---
async function loadConversations() {
    try {
        const convs = await apiFetch("/api/chat/conversations");
        const listEl = document.getElementById("chat-conv-list");

        if (!convs || convs.length === 0) {
            listEl.innerHTML = `<div class="text-center py-6 text-slate-500 text-xs">No conversations yet.<br>Click "New Chat" to begin!</div>`;
            return;
        }

        listEl.innerHTML = convs.map(c => `
            <div onclick="selectConversation('${c.id}')" id="conv-item-${c.id}" class="p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between text-xs ${c.id === currentConversationId ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-medium' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}">
                <div class="truncate flex-1 pr-2">
                    <p class="truncate text-slate-200 font-medium">${escapeHtml(c.title)}</p>
                    <span class="text-[10px] text-slate-500">${new Date(c.updated_at).toLocaleDateString()}</span>
                </div>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">${c.message_count || 0}</span>
            </div>
        `).join("");

        // If no active conversation, select the first one
        if (!currentConversationId && convs.length > 0) {
            selectConversation(convs[0].id);
        }
    } catch (err) {
        console.error("Error loading chat conversations:", err);
    }
}

async function createNewConversation() {
    try {
        const newConv = await apiFetch("/api/chat/conversations", {
            method: "POST",
            body: JSON.stringify({ title: "New Conversation" })
        });
        currentConversationId = newConv.id;
        await loadConversations();
        selectConversation(newConv.id);
    } catch (err) {
        alert("Could not create conversation: " + err.message);
    }
}

async function selectConversation(convId) {
    currentConversationId = convId;
    document.getElementById("btn-delete-conv").classList.remove("hidden");

    // Update highlight in list
    document.querySelectorAll("[id^='conv-item-']").forEach(el => {
        el.className = "p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between text-xs text-slate-400 hover:text-white hover:bg-slate-800/60";
    });
    const activeEl = document.getElementById(`conv-item-${convId}`);
    if (activeEl) {
        activeEl.className = "p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between text-xs bg-blue-600/20 text-blue-300 border border-blue-500/30 font-medium";
    }

    // Load messages
    try {
        const conv = await apiFetch(`/api/chat/conversations/${convId}`);
        document.getElementById("chat-active-title").textContent = conv.title;
        renderChatMessages(conv.messages || []);
    } catch (err) {
        console.error("Error loading conversation:", err);
    }
}

function renderChatMessages(messages) {
    const container = document.getElementById("chat-messages-container");
    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="max-w-md mx-auto text-center py-16 space-y-3">
                <div class="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <i data-lucide="message-square" class="w-6 h-6"></i>
                </div>
                <h4 class="text-base font-bold text-white">Conversation Started</h4>
                <p class="text-xs text-slate-400">Ask any question to begin chatting with your AI assistant.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = messages.map(m => {
        if (m.role === "user") {
            return `
                <div class="flex justify-end">
                    <div class="max-w-xl chat-bubble-user p-4 text-xs md:text-sm shadow-md">
                        <p class="whitespace-pre-wrap">${escapeHtml(m.content)}</p>
                    </div>
                </div>
            `;
        } else {
            const parsedHtml = marked.parse(m.content || "");
            return `
                <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-1 border border-emerald-500/20">
                        <i data-lucide="bot" class="w-4 h-4"></i>
                    </div>
                    <div class="max-w-2xl chat-bubble-assistant p-4 text-xs md:text-sm prose-custom shadow-md">
                        ${parsedHtml}
                    </div>
                </div>
            `;
        }
    }).join("");

    container.scrollTop = container.scrollHeight;
    lucide.createIcons();
}

function handleChatKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendChatMessage(e);
    }
}

async function handleSendChatMessage(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById("chat-input");
    const content = input.value.trim();
    if (!content) return;

    if (!currentConversationId) {
        await createNewConversation();
    }

    input.value = "";

    // Optimistically render user message
    const container = document.getElementById("chat-messages-container");
    const userMsgEl = document.createElement("div");
    userMsgEl.className = "flex justify-end";
    userMsgEl.innerHTML = `
        <div class="max-w-xl chat-bubble-user p-4 text-xs md:text-sm shadow-md">
            <p class="whitespace-pre-wrap">${escapeHtml(content)}</p>
        </div>
    `;
    container.appendChild(userMsgEl);
    container.scrollTop = container.scrollHeight;

    // Show typing indicator
    const typingIndicator = document.getElementById("chat-typing-indicator");
    typingIndicator.classList.remove("hidden");

    try {
        const assistantMsg = await apiFetch(`/api/chat/conversations/${currentConversationId}/messages`, {
            method: "POST",
            body: JSON.stringify({ content })
        });

        // Append assistant message
        const botMsgEl = document.createElement("div");
        botMsgEl.className = "flex items-start gap-3";
        botMsgEl.innerHTML = `
            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-1 border border-emerald-500/20">
                <i data-lucide="bot" class="w-4 h-4"></i>
            </div>
            <div class="max-w-2xl chat-bubble-assistant p-4 text-xs md:text-sm prose-custom shadow-md">
                ${marked.parse(assistantMsg.content || "")}
            </div>
        `;
        container.appendChild(botMsgEl);
        container.scrollTop = container.scrollHeight;
        lucide.createIcons();

        // Refresh conversation title in sidebar
        loadConversations();
    } catch (err) {
        alert("Error sending message: " + err.message);
    } finally {
        typingIndicator.classList.add("hidden");
    }
}

async function deleteActiveConversation() {
    if (!currentConversationId) return;
    if (!confirm("Are you sure you want to delete this conversation thread?")) return;

    try {
        await apiFetch(`/api/chat/conversations/${currentConversationId}`, { method: "DELETE" });
        currentConversationId = null;
        document.getElementById("btn-delete-conv").classList.add("hidden");
        document.getElementById("chat-active-title").textContent = "Select or create a chat";
        document.getElementById("chat-messages-container").innerHTML = "";
        await loadConversations();
    } catch (err) {
        alert("Error deleting conversation: " + err.message);
    }
}

// --- HISTORY SECTION ---
async function loadHistory() {
    try {
        const [researches, chats] = await Promise.all([
            apiFetch("/api/history/research"),
            apiFetch("/api/chat/conversations")
        ]);

        cachedResearchHistory = researches;
        cachedChatHistory = chats;

        // Update badge
        document.getElementById("nav-history-badge").textContent = researches.length + chats.length;

        renderResearchHistory(cachedResearchHistory);
        renderChatHistory(cachedChatHistory);
    } catch (err) {
        console.error("Error loading history:", err);
    }
}

function switchHistoryTab(tab) {
    const btnRes = document.getElementById("tab-hist-research");
    const btnChat = document.getElementById("tab-hist-chat");
    const conRes = document.getElementById("hist-research-container");
    const conChat = document.getElementById("hist-chat-container");

    if (tab === "research") {
        btnRes.className = "px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white transition";
        btnChat.className = "px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-400 hover:text-white transition";
        conRes.classList.remove("hidden");
        conChat.classList.add("hidden");
    } else {
        btnChat.className = "px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white transition";
        btnRes.className = "px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-400 hover:text-white transition";
        conChat.classList.remove("hidden");
        conRes.classList.add("hidden");
    }
    lucide.createIcons();
}

function filterHistory() {
    const term = document.getElementById("history-search-input").value.toLowerCase().trim();
    const filteredResearches = cachedResearchHistory.filter(r => r.topic.toLowerCase().includes(term));
    const filteredChats = cachedChatHistory.filter(c => c.title.toLowerCase().includes(term));

    renderResearchHistory(filteredResearches);
    renderChatHistory(filteredChats);
}

function renderResearchHistory(items) {
    const container = document.getElementById("hist-research-container");
    if (!items || items.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-slate-500 text-xs">No research history found.</div>`;
        return;
    }

    container.innerHTML = items.map(r => `
        <div class="glass-card p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4 hover:border-slate-700 transition">
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="microscope" class="w-5 h-5"></i>
                </div>
                <div class="truncate">
                    <h5 class="text-sm font-bold text-white truncate">${escapeHtml(r.topic)}</h5>
                    <p class="text-[11px] text-slate-400 mt-0.5">
                        ${new Date(r.created_at).toLocaleString()} • Score: <span class="text-amber-300 font-semibold">${r.critic_score}</span>
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <button onclick="viewPastReport(${r.id})" class="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-xs font-medium transition">
                    View Report
                </button>
                <button onclick="deleteResearchItem(${r.id})" class="p-1.5 text-slate-500 hover:text-red-400 transition" title="Delete">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `).join("");
    lucide.createIcons();
}

function renderChatHistory(items) {
    const container = document.getElementById("hist-chat-container");
    if (!items || items.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-slate-500 text-xs">No chat conversations found.</div>`;
        return;
    }

    container.innerHTML = items.map(c => `
        <div class="glass-card p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4 hover:border-slate-700 transition">
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="message-square" class="w-5 h-5"></i>
                </div>
                <div class="truncate">
                    <h5 class="text-sm font-bold text-white truncate">${escapeHtml(c.title)}</h5>
                    <p class="text-[11px] text-slate-400 mt-0.5">
                        ${new Date(c.updated_at).toLocaleString()} • ${c.message_count || 0} messages
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <button onclick="openChatFromHistory('${c.id}')" class="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 text-xs font-medium transition">
                    Open Chat
                </button>
            </div>
        </div>
    `).join("");
    lucide.createIcons();
}

async function viewPastReport(id) {
    try {
        const item = await apiFetch(`/api/research/${id}`);
        document.getElementById("modal-report-title").textContent = item.topic;
        document.getElementById("modal-critic-score").textContent = item.critic_score || "8.5/10";
        document.getElementById("modal-report-markdown").innerHTML = marked.parse(item.report || "");
        document.getElementById("modal-critic-feedback").textContent = item.feedback || "No feedback recorded.";

        document.getElementById("modal-report").classList.remove("hidden");
        lucide.createIcons();
    } catch (err) {
        alert("Could not load report: " + err.message);
    }
}

function closeReportModal() {
    document.getElementById("modal-report").classList.add("hidden");
}

async function deleteResearchItem(id) {
    if (!confirm("Are you sure you want to delete this research report?")) return;
    try {
        await apiFetch(`/api/history/research/${id}`, { method: "DELETE" });
        loadHistory();
    } catch (err) {
        alert("Could not delete report: " + err.message);
    }
}

function openChatFromHistory(convId) {
    switchView("chat");
    selectConversation(convId);
}

// Utility
function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

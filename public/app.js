const app = document.querySelector("#app");
let currentUser = null;
let entries = [];
let activeView = "dashboard";
let authMode = "login";

const icons = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/></svg>',
  overview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01" stroke-width="3" stroke-linecap="round"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  logout: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14m6-6-6 6-6-6"/></svg>',
  buffalo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 17c-2.2 0-3.5-1.6-3.5-3.5 0-1.4.7-2.2 1.8-2.6-.4-2.7 1.4-5.4 4.7-5.4 1.5 0 2.4.5 3 1.2 1.9-.5 4 .3 4.8 2.2 2 .3 3.2 1.7 3.2 3.7 0 2.3-1.6 4.4-4.3 4.4H7z"/><path d="M8 17v2m8-2v2M5.5 8 3 6m14.7 1L20 5m-8 5v.01"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/></svg>',
};

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Something went wrong. Please try again.");
  return data;
}

function renderAuth() {
  const isLogin = authMode === "login";
  app.innerHTML = `
    <div class="auth-layout">
      <section class="auth-art">
        <div class="auth-brand"><span class="brand-icon">H·L·B</span> High Low Buffalo</div>
        <div class="art-copy">
          <div class="eyebrow">Your daily ritual, in one place</div>
          <h1>A little more organized. Every day.</h1>
          <p>Keep your High, Low, and Buffalo entries together in a space that feels as good as a fresh start.</p>
        </div>
        <div class="art-footer">Your numbers. Your history. All yours.</div>
      </section>
      <section class="auth-main">
        <div class="auth-box">
          <h2>${isLogin ? "Welcome back" : "Create your account"}</h2>
          <p class="auth-intro">${isLogin ? "Sign in to pick up right where you left off." : "A few details and your daily tracker is ready."}</p>
          <div class="auth-switch" role="tablist">
            <button type="button" class="${isLogin ? "active" : ""}" data-mode="login">Sign in</button>
            <button type="button" class="${!isLogin ? "active" : ""}" data-mode="signup">Create account</button>
          </div>
          <div class="notice" id="auth-notice" role="status"></div>
          <form id="auth-form">
            <div class="field"><label for="email">Email address</label><input id="email" name="email" type="email" placeholder="you@example.com" autocomplete="email" required /></div>
            <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" placeholder="At least 8 characters" minlength="8" autocomplete="${isLogin ? "current-password" : "new-password"}" required /></div>
            <button class="primary-btn auth-submit" type="submit">${isLogin ? "Sign in" : "Create account"} ${icons.arrow}</button>
          </form>
          <p class="auth-note">Your account is private and only you can see your entries.</p>
        </div>
      </section>
    </div>`;
  app.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => { authMode = button.dataset.mode; renderAuth(); });
  });
  app.querySelector("#auth-form").addEventListener("submit", handleAuth);
}

async function handleAuth(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const notice = app.querySelector("#auth-notice");
  button.disabled = true;
  button.textContent = authMode === "login" ? "Signing in..." : "Creating account...";
  try {
    const data = await request(`/api/auth/${authMode}`, {
      method: "POST",
      body: JSON.stringify({ email: form.email.value.trim(), password: form.password.value }),
    });
    if (data.confirmation_required) {
      notice.textContent = "Check your email to confirm your account, then sign in.";
      notice.className = "notice show success";
      button.disabled = false;
      button.innerHTML = `Create account ${icons.arrow}`;
      return;
    }
    currentUser = data.user;
    await loadEntries();
    renderApp();
  } catch (error) {
    notice.textContent = error.message;
    notice.className = "notice show";
    button.disabled = false;
    button.innerHTML = `${authMode === "login" ? "Sign in" : "Create account"} ${icons.arrow}`;
  }
}

async function loadEntries() {
  entries = await request("/api/entries");
}

function formatDate(value, options = { year: "numeric", month: "short", day: "numeric" }) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, options);
}

function renderSidebar() {
  const initial = (currentUser?.email || "U").slice(0, 1).toUpperCase();
  return `
    <aside class="sidebar">
      <div class="side-brand"><span class="brand-icon">H·L·B</span> High Low Buffalo</div>
      <div class="nav-caption">Workspace</div>
      <nav aria-label="Main navigation">
        <button class="nav-item ${activeView === "dashboard" ? "active" : ""}" data-view="dashboard">${icons.dashboard} Dashboard</button>
        <button class="nav-item ${activeView === "overview" ? "active" : ""}" data-view="overview">${icons.overview} Overview</button>
      </nav>
      <div class="side-bottom">
        <div class="profile">
          <div class="avatar">${escapeHTML(initial)}</div>
          <div class="profile-copy"><strong>${escapeHTML(currentUser?.email || "Your account")}</strong><span>Personal workspace</span></div>
          <button class="logout-btn" id="logout" aria-label="Sign out" title="Sign out">${icons.logout}</button>
        </div>
      </div>
    </aside>`;
}

function entryForm() {
  const current = entries.find((entry) => entry.entry_date === todayISO());
  const selectedDate = app.querySelector("#entry-date")?.value || todayISO();
  const selected = entries.find((entry) => entry.entry_date === selectedDate);
  return `
    <div class="page-heading"><div><h1>Good ${greeting()}, ${escapeHTML((currentUser?.email || "there").split("@")[0])}.</h1><p>A fresh day, and a fresh page for your entries.</p></div></div>
    <section class="entry-card">
      <div class="card-heading">
        <div><h2>Your daily entry</h2><p>Keep track of today’s High, Low, and Buffalo.</p></div>
        <label class="date-field">${icons.calendar}<input id="entry-date" type="date" value="${escapeHTML(selectedDate)}" aria-label="Entry date" /></label>
      </div>
      <form id="entry-form">
        <div class="entry-fields">
          ${entryInput("high", "High", icons.up, "Add your high")}
          ${entryInput("low", "Low", icons.down, "Add your low")}
          ${entryInput("buffalo", "Buffalo", icons.buffalo, "Add your buffalo")}
        </div>
        <div class="form-footer"><span class="save-hint">Entries are private to your account.</span><button class="primary-btn" type="submit">${selected ? "Update entry" : "Save entry"} ${icons.arrow}</button></div>
        <div class="save-message" id="save-message" role="status"></div>
      </form>
    </section>`;

  function entryInput(key, label, icon, placeholder) {
    return `<label class="entry-field"><span class="entry-label"><span class="entry-symbol">${icon}</span>${label}</span><input name="${key}" maxlength="1000" value="${escapeHTML(selected?.[key] || (selectedDate === todayISO() ? current?.[key] : "") || "")}" placeholder="${placeholder}" /></label>`;
  }
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

function overview() {
  const rows = entries.map((entry) => `
    <tr>
      <td>${escapeHTML(formatDate(entry.entry_date))}</td>
      <td><span class="entry-value" title="${escapeHTML(entry.high)}">${escapeHTML(entry.high || "—")}</span></td>
      <td><span class="entry-value" title="${escapeHTML(entry.low)}">${escapeHTML(entry.low || "—")}</span></td>
      <td><span class="entry-value" title="${escapeHTML(entry.buffalo)}">${escapeHTML(entry.buffalo || "—")}</span></td>
    </tr>`).join("");
  return `
    <div class="page-heading"><div><h1>Your overview</h1><p>A look back at every entry you’ve made so far.</p></div></div>
    <div class="overview-stats"><div class="stat-card"><span>Total entries</span><strong>${entries.length}</strong></div><div class="stat-card"><span>Most recent</span><strong style="font-size:15px">${entries.length ? escapeHTML(formatDate(entries[0].entry_date, { month: "short", day: "numeric" })) : "—"}</strong></div></div>
    <div class="table-wrap">
      ${entries.length ? `<table><thead><tr><th>Date</th><th>High</th><th>Low</th><th>Buffalo</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty-state"><div class="empty-icon">${icons.spark}</div><h3>Your story starts today</h3><p>Your saved daily entries will show up here.</p></div>`}
    </div>`;
}

function renderApp() {
  if (!currentUser) { renderAuth(); return; }
  const viewMarkup = activeView === "overview" ? overview() : entryForm();
  app.innerHTML = `
    <div class="app-shell">
      ${renderSidebar()}
      <main class="main-area">
        <div class="topline"><span class="breadcrumb">Workspace <span style="color:#bec6be">/</span> ${activeView === "overview" ? "Overview" : "Dashboard"}</span><span class="today-badge"><span class="today-dot"></span>${formatDate(todayISO(), { weekday: "short", month: "short", day: "numeric" })}</span></div>
        ${viewMarkup}
      </main>
    </div>`;
  app.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
    activeView = button.dataset.view;
    renderApp();
  }));
  app.querySelector("#logout").addEventListener("click", handleLogout);
  const dateInput = app.querySelector("#entry-date");
  if (dateInput) {
    dateInput.addEventListener("change", () => {
      const date = dateInput.value || todayISO();
      const entry = entries.find((item) => item.entry_date === date);
      app.querySelector('[name="high"]').value = entry?.high || "";
      app.querySelector('[name="low"]').value = entry?.low || "";
      app.querySelector('[name="buffalo"]').value = entry?.buffalo || "";
      app.querySelector("#entry-form button[type=submit]").textContent = entry ? "Update entry" : "Save entry";
    });
    app.querySelector("#entry-form").addEventListener("submit", handleSave);
  }
}

async function handleSave(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const message = app.querySelector("#save-message");
  button.disabled = true;
  button.textContent = "Saving...";
  message.textContent = "";
  message.className = "save-message";
  try {
    await request("/api/entries", {
      method: "PUT",
      body: JSON.stringify({
        entry_date: app.querySelector("#entry-date").value,
        high: form.high.value.trim(),
        low: form.low.value.trim(),
        buffalo: form.buffalo.value.trim(),
      }),
    });
    await loadEntries();
    renderApp();
    const saveMessage = app.querySelector("#save-message");
    saveMessage.textContent = "Your entry is saved.";
  } catch (error) {
    message.textContent = error.message;
    message.className = "save-message error";
    button.disabled = false;
    button.innerHTML = `Save entry ${icons.arrow}`;
  }
}

async function handleLogout() {
  let logoutError = "";
  try { await request("/api/auth/logout", { method: "POST" }); }
  catch (error) { logoutError = error.message; }
  currentUser = null;
  entries = [];
  renderAuth();
  if (logoutError) {
    const notice = app.querySelector("#auth-notice");
    notice.textContent = `You’ve been signed out, but the session could not be revoked remotely: ${logoutError}`;
    notice.className = "notice show";
  }
}

async function start() {
  try {
    const data = await request("/api/session");
    if (data.user) {
      currentUser = data.user;
      await loadEntries();
      renderApp();
    } else {
      renderAuth();
    }
  } catch (error) {
    app.innerHTML = `<main class="loading-screen"><div><div class="brand-mark">H<span>·</span>L<span>·</span>B</div><p style="color:#78827b;font-size:13px">${escapeHTML(error.message)}</p></div></main>`;
  }
}

start();

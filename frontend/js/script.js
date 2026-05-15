const API_BASE = "http://127.0.0.1:8080/api";
const page = location.pathname.split("/").pop() || "login.html";
const loader = document.getElementById("loader");
const toast = document.getElementById("toast");

/* ── OFFLINE MOCK API ─────────────────────────────────────────────── */
function animateValue(obj, start, end, duration, isCurrency = false) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const value = Math.floor(easeOutQuart * (end - start) + start);
    obj.innerHTML = isCurrency ? money(value) : value;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("page-transition");
  document.querySelectorAll(".sidebar-nav a").forEach(link => {
    if (link.hostname === window.location.hostname && !link.hash && link.target !== "_blank") {
      link.addEventListener("click", e => {
        e.preventDefault();
        document.body.classList.remove("page-transition");
        document.body.classList.add("page-transition-out");
        setTimeout(() => { window.location.href = link.href; }, 300);
      });
    }
  });
});
function mockDb(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
}
function mockSave(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

async function executeFirebaseApi(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};
  const uid = userId();
  
  if (!uid && !path.includes("/auth")) {
    throw new Error("Unauthorized");
  }

  /* EXPENSES */
  if (path.includes("/expenses")) {
    if (path.includes("/profile")) {
      const docRef = db.collection("profiles").doc(uid);
      if (method === "POST") { await docRef.set(body, { merge: true }); return body; }
      const doc = await docRef.get();
      return doc.exists ? doc.data() : { monthlySalary: 0, totalSavings: 0, spendingLimit: 0 };
    }
    if (path.includes("/close-month")) {
      const docRef = db.collection("profiles").doc(uid);
      const doc = await docRef.get();
      const p = doc.exists ? doc.data() : { monthlySalary: 0, totalSavings: 0 };
      
      const snap = await db.collection("expenses").where("userId", "==", uid).get();
      const expenses = snap.docs.map(d => d.data());
      const now = new Date();
      const total = expenses
        .filter(e => { const d = new Date(e.expenseDate); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
        .reduce((s, e) => s + Number(e.amount), 0);
        
      const salary = Number(p.monthlySalary || 0);
      const added  = Math.max(0, salary - total);
      p.totalSavings = Number(p.totalSavings || 0) + added;
      
      await docRef.set(p, { merge: true });
      return { addedSavings: added };
    }
    if (path.includes("/summary")) {
      const docRef = db.collection("profiles").doc(uid);
      const doc = await docRef.get();
      const p = doc.exists ? doc.data() : { monthlySalary: 0, totalSavings: 0, spendingLimit: 0 };
      
      const snap = await db.collection("expenses").where("userId", "==", uid).get();
      const expenses = snap.docs.map(d => d.data());
      
      const now = new Date();
      const rangeMatch = e => {
        if (!e.expenseDate) return false;
        const d = new Date(e.expenseDate + "T00:00:00");
        const range = (path.match(/range=(\w+)/) || [])[1] || "month";
        if (range === "day")   return d.toDateString() === now.toDateString();
        if (range === "week")  { const w = new Date(now); w.setDate(now.getDate()-7); return d >= w; }
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      };
      
      const total = expenses.filter(rangeMatch).reduce((s, e) => s + Number(e.amount), 0);
      const salary = Number(p.monthlySalary || 0);
      const savings = Number(p.totalSavings  || 0);
      const limit = Number(p.spendingLimit || 0);
      const remaining = salary - total;
      const rate = salary > 0 ? Math.round(((salary - total) / salary) * 100) : 0;
      const alert = limit > 0 && total > limit ? `⚠️ You exceeded your ₹${limit} spending limit!` : "";
      return { totalExpenses: total, remainingBalance: remaining, totalSavings: savings, savingsRate: rate, monthlySalary: salary, alert };
    }
    if (path.includes("/analysis")) {
      const snap = await db.collection("expenses").where("userId", "==", uid).get();
      const expenses = snap.docs.map(d => d.data());
      const cats = {};
      expenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + Number(e.amount); });
      const top = Object.entries(cats).sort((a,b) => b[1]-a[1])[0];
      return { categoryTotals: cats, insight: top ? `You spend most on ${top[0]}.` : "Add expenses to unlock insights." };
    }
    if (path.includes("/export")) { 
      throw new Error("Export requires Cloud Functions."); 
    }
    if (method === "DELETE" && path.match(/\/expenses\/\w+/)) {
      const id = path.split("/expenses/")[1];
      await db.collection("expenses").doc(id).delete();
      return null;
    }
    if (method === "POST") {
      const item = { ...body, userId: uid, createdAt: new Date().toISOString() };
      const docRef = await db.collection("expenses").add(item);
      return { id: docRef.id, ...item };
    }
    if (method === "GET") {
      const snap = await db.collection("expenses").where("userId", "==", uid).orderBy("createdAt", "desc").get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  }

  /* TODOS */
  if (path.includes("/todos")) {
    if (path.match(/\/todos\/\w+\/complete/)) {
      const id = path.split("/todos/")[1].split("/")[0];
      await db.collection("todos").doc(id).update({ status: "COMPLETED" });
      return { id, status: "COMPLETED" };
    }
    if (method === "DELETE" && path.match(/\/todos\/\w+/)) {
      const id = path.split("/todos/")[1];
      await db.collection("todos").doc(id).delete();
      return null;
    }
    if (path.includes("/productivity")) {
      const snap = await db.collection("todos").where("userId", "==", uid).get();
      const todos = snap.docs.map(d => d.data());
      const done  = todos.filter(t => t.status === "COMPLETED");
      const prodMin = done.reduce((s,t) => s + Number(t.minutesSpent||0), 0);
      const pct  = todos.length ? Math.round((done.length/todos.length)*100) : 0;
      return { productiveMinutes: prodMin, wasteMinutes: 0, insight: `${pct}% tasks completed.` };
    }
    if (method === "POST") {
      const item = { ...body, id: Date.now().toString(), status: "PENDING", userId: uid, createdAt: new Date().toISOString() };
      const docRef = await db.collection("todos").add(item);
      return { id: docRef.id, ...item };
    }
    if (method === "GET") {
      const snap = await db.collection("todos").where("userId", "==", uid).orderBy("createdAt", "desc").get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  }

  /* DASHBOARD */
  if (path.includes("/dashboard")) {
    return { notifications: [], expenseAnalysis: { monthTotal: 0 } };
  }

  /* NOTIFICATIONS */
  if (path.match(/\/notifications\/\w+\/read/)) {
    const id = path.split("/notifications/")[1].split("/")[0];
    await db.collection("notifications").doc(id).update({ readStatus: true });
    return { id, readStatus: true };
  }
  if (path.includes("/notifications")) {
    const snap = await db.collection("notifications").where("userId", "==", uid).get();
    let notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (notifs.length === 0) {
      notifs = [
        { id: "1", message: "Welcome to Trackify! Add your first expense.", createdAt: new Date().toISOString(), readStatus: false },
        { id: "2", message: "Set your monthly salary in Expenses.", createdAt: new Date().toISOString(), readStatus: false }
      ];
    }
    return notifs;
  }

  /* LENDING */
  if (path.includes("/lending")) {
    if (method === "DELETE" && path.match(/\/lending\/\w+/)) {
      const id = path.split("/lending/")[1];
      await db.collection("lending").doc(id).delete();
      return null;
    }
    if (method === "POST") {
      const item = { ...body, userId: uid, createdAt: new Date().toISOString() };
      const docRef = await db.collection("lending").add(item);
      return { id: docRef.id, ...item };
    }
    if (method === "GET") {
      const snap = await db.collection("lending").where("userId", "==", uid).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  }

  return null;
}
/* ── END FIREBASE BRIDGE ─────────────────────────────────────────────── */

function userId() {
  if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
    return firebase.auth().currentUser.uid;
  }
  return localStorage.getItem("smartLifeUserId");
}

function applyTheme(theme) {
  const activeTheme = theme || localStorage.getItem("smartLifeTheme") || "night";
  document.body.classList.toggle("day-mode", activeTheme === "day");
  document.querySelectorAll("[data-theme]").forEach(button => {
    button.classList.toggle("active", button.dataset.theme === activeTheme);
    button.textContent = activeTheme === "day" ? "🌙" : "☀️";
  });
  document.querySelectorAll(".notification-btn span").forEach(icon => {
    icon.textContent = "🔔";
  });
  localStorage.setItem("smartLifeTheme", activeTheme);
}

function setupTheme() {
  applyTheme();
  document.querySelectorAll("[data-theme]").forEach(button => {
    button.addEventListener("click", () => {
      const next = localStorage.getItem("smartLifeTheme") === "day" ? "night" : "day";
      applyTheme(next);
    });
  });
}

function setupDropdowns() {
  document.querySelectorAll("[data-dropdown-trigger]").forEach(trigger => {
    trigger.addEventListener("click", event => {
      event.preventDefault();
      const target = document.getElementById(trigger.dataset.dropdownTrigger);
      document.querySelectorAll(".app-dropdown.open").forEach(menu => {
        if (menu !== target) menu.classList.remove("open");
      });
      if (target) target.classList.toggle("open");
    });
  });

  document.addEventListener("click", event => {
    if (!event.target.closest("[data-dropdown-trigger], .app-dropdown")) {
      document.querySelectorAll(".app-dropdown.open").forEach(menu => menu.classList.remove("open"));
    }
  });
}

function setupProfileModal() {
  ensureProfileModal();
  const modal = document.getElementById("profileModal");
  const open = document.getElementById("openProfileModal");
  const close = document.getElementById("closeProfileModal");
  const form = document.getElementById("profileFormModal");
  const nameInput = document.getElementById("profileNameInput");
  const emailInput = document.getElementById("profileEmailInput");
  const imageInput = document.getElementById("profileImageInput");
  const preview = document.getElementById("profileImagePreview");

  updateProfileLabels();
  if (!modal || !open) return;

  open.addEventListener("click", () => {
    nameInput.value = localStorage.getItem("smartLifeName") || "Aman Kumar";
    emailInput.value = localStorage.getItem("smartLifeEmail") || "";
    renderProfileImage(preview);
    modal.classList.add("open");
  });
  close?.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", event => {
    if (event.target === modal) modal.classList.remove("open");
  });
  imageInput?.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_WIDTH = 150;
        const MAX_HEIGHT = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        try {
          localStorage.setItem("smartLifeProfileImage", dataUrl);
          renderProfileImage(preview);
        } catch (e) {
          showToast("Image too large, please select a smaller one.");
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    const newName = nameInput.value || "Aman Kumar";
    const newEmail = emailInput.value || "";
    const currentEmail = localStorage.getItem("smartLifeEmail") || "";

    if (newEmail && newEmail !== currentEmail && localStorage.getItem("smartLifeUserId") && localStorage.getItem("smartLifeUserId") !== "googleUser") {
      try {
        await api(`/auth/request-otp`, {
          method: "POST",
          body: JSON.stringify({ email: newEmail })
        });
        showEmailChangeOtpModal(newEmail, newName, modal);
      } catch (err) {
        showToast("Failed to request OTP: " + err.message);
      }
    } else {
      localStorage.setItem("smartLifeName", newName);
      if (newEmail) localStorage.setItem("smartLifeEmail", newEmail);
      updateProfileLabels();
      modal.classList.remove("open");
      showToast("Profile updated");
    }
  });
}

function showEmailChangeOtpModal(newEmail, newName, profileModalElement) {
  if (document.getElementById("emailOtpModal")) document.getElementById("emailOtpModal").remove();
  document.body.insertAdjacentHTML("beforeend", `
    <div class="profile-modal-backdrop open" id="emailOtpModal" style="z-index: 10000;">
      <form class="profile-modal" id="emailOtpFormModal">
        <div class="profile-modal-head" style="justify-content: center; margin-bottom: 1rem;">
          <h2 style="font-size: 1.5rem;">Verify New Email 📧</h2>
        </div>
        <p style="text-align: center; color: var(--muted); margin-bottom: 1.5rem;">We've sent a 6-digit code to <strong>${newEmail}</strong> to confirm the change.</p>
        <label>
          Enter OTP Code
          <input type="text" id="emailOtpInput" placeholder="123456" required style="padding: 0.9rem 1rem; text-align: center; font-size: 1.2rem; letter-spacing: 0.5rem;" maxlength="6">
        </label>
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
          <button class="ghost-btn" type="button" id="cancelEmailOtp" style="flex: 1;">Cancel</button>
          <button class="primary-btn" type="submit" style="flex: 1;">Confirm Change</button>
        </div>
        <div style="text-align: center; margin-top: 1.5rem;">
          <button type="button" id="resendEmailOtpBtn" class="ghost-btn" style="font-size: 0.85rem;" disabled>Resend OTP in <span id="resendEmailTimer">30</span>s</button>
        </div>
      </form>
    </div>
  `);

  let timeLeft = 30;
  const resendBtn = document.getElementById("resendEmailOtpBtn");
  const timerSpan = document.getElementById("resendEmailTimer");
  
  const countdown = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(countdown);
      resendBtn.disabled = false;
      resendBtn.innerHTML = "Resend OTP";
    } else {
      timerSpan.textContent = timeLeft;
    }
  }, 1000);

  resendBtn.addEventListener("click", async () => {
    resendBtn.disabled = true;
    resendBtn.innerHTML = `Resend OTP in <span id="resendEmailTimer">30</span>s`;
    timeLeft = 30;
    
    try {
      await api(`/auth/request-otp`, {
        method: "POST",
        body: JSON.stringify({ email: newEmail })
      });
      showToast("OTP Resent!");
      
      const newCountdown = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
          clearInterval(newCountdown);
          resendBtn.disabled = false;
          resendBtn.innerHTML = "Resend OTP";
        } else {
          document.getElementById("resendEmailTimer").textContent = timeLeft;
        }
      }, 1000);
    } catch (err) {
      showToast(err.message);
      resendBtn.disabled = false;
      resendBtn.innerHTML = "Resend OTP";
    }
  });

  document.getElementById("cancelEmailOtp").addEventListener("click", () => {
    clearInterval(countdown);
    document.getElementById("emailOtpModal").remove();
  });

  document.getElementById("emailOtpFormModal").addEventListener("submit", async (e) => {
    e.preventDefault();
    const otp = document.getElementById("emailOtpInput").value.trim();
    const userId = localStorage.getItem("smartLifeUserId");
    try {
      await api("/auth/email", {
        method: "PUT",
        body: JSON.stringify({ userId, newEmail, otp })
      });
      
      localStorage.setItem("smartLifeName", newName);
      localStorage.setItem("smartLifeEmail", newEmail);
      updateProfileLabels();
      
      clearInterval(countdown);
      document.getElementById("emailOtpModal").remove();
      if (profileModalElement) profileModalElement.classList.remove("open");
      showToast("Email updated successfully!");
    } catch (err) {
      showToast(err.message);
    }
  });
}

function ensureProfileModal() {
  if (document.getElementById("profileModal")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="profile-modal-backdrop" id="profileModal">
      <form class="profile-modal" id="profileFormModal">
        <div class="profile-modal-head">
          <h2>Edit Profile</h2>
          <button class="icon-circle" type="button" id="closeProfileModal">×</button>
        </div>
        <div class="profile-image-preview" id="profileImagePreview" data-profile-image data-profile-initials>AK</div>
        <label>
          Upload Profile Image
          <input type="file" id="profileImageInput" accept="image/*">
        </label>
        <label>
          Name
          <input type="text" id="profileNameInput" placeholder="Your name">
        </label>
        <label>
          Email
          <input type="email" id="profileEmailInput" placeholder="you@example.com">
        </label>
        <button class="primary-btn" type="submit">Save Profile</button>
      </form>
    </div>
  `);
}

function updateProfileLabels() {
  const name = localStorage.getItem("smartLifeName") || "Aman Kumar";
  document.querySelectorAll("[data-profile-name]").forEach(node => node.textContent = name);
  document.querySelectorAll("[data-profile-initials]").forEach(node => node.textContent = initials(name));
  document.querySelectorAll("[data-profile-image]").forEach(renderProfileImage);
  // Dynamic greeting
  const greetingEl = document.getElementById("headerGreeting");
  if (greetingEl) {
    const hour = new Date().getHours();
    const period = (hour >= 21 || hour < 4) ? "night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    greetingEl.innerHTML = `Good ${period}, <span data-profile-name>${name}</span>`;
  }
}

function initials(name) {
  return name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase() || "AK";
}

function renderProfileImage(node) {
  if (!node) return;
  const image = localStorage.getItem("smartLifeProfileImage");
  if (image) {
    node.innerHTML = `<img src="${image}" alt="Profile image">`;
  } else {
    node.textContent = initials(localStorage.getItem("smartLifeName") || "Aman Kumar");
  }
}

function setupNotificationPanel() {
  const list = document.getElementById("notificationDropdownList");
  const badge = document.getElementById("notificationBadge");
  if (!list) return;
  api(`/notifications?userId=${userId()}`)
    .then(notifications => {
      const fallback = [
        { message: "Task overdue", createdAt: new Date().toISOString() },
        { message: "High spending alert", createdAt: new Date().toISOString() },
        { message: "Reminder pending", createdAt: new Date().toISOString() }
      ];
      const items = notifications.length ? notifications.slice(0, 5) : fallback;
      list.innerHTML = items.map(item => `
        <div class="dropdown-item">
          <span>${item.message}</span>
          <small>${dateText(item.createdAt)}</small>
        </div>
      `).join("");
      if (badge) {
        badge.textContent = String(items.length);
        badge.style.display = items.length ? "grid" : "none";
      }
    })
    .catch(() => {
      list.innerHTML = `
        <div class="dropdown-item"><span>Task overdue</span><small>Now</small></div>
        <div class="dropdown-item"><span>High spending alert</span><small>Today</small></div>
        <div class="dropdown-item"><span>Reminder pending</span><small>Today</small></div>
      `;
      if (badge) { badge.textContent = "3"; badge.style.display = "grid"; }
    });
}

function showLoader(show) {
  if (loader) loader.classList.toggle("active", show);
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
}

function showSkeletons(containerId, count = 3, height = "80px") {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = Array(count).fill(`<div class="skeleton" style="height: ${height}; width: 100%; margin-bottom: 1rem;"></div>`).join("");
}

async function api(path, options = {}) {
  // All API calls now perfectly bridge over to Firebase Firestore!
  return await executeFirebaseApi(path, options);
}

function requireLogin() {
  if (page !== "login.html" && !userId()) {
    location.href = "login.html";
  }
}

function setupLogout() {
  const button = document.getElementById("logoutBtn");
  if (!button) return;
  button.addEventListener("click", async () => {
    if (typeof firebase !== 'undefined') {
      await firebase.auth().signOut();
    }
    localStorage.removeItem("smartLifeUserId");
    localStorage.removeItem("smartLifeEmail");
    location.href = "login.html";
  });
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function dateText(value) {
  if (!value) return "No date";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined });
}

function emptyState(text) {
  return `<div class="list-item"><span class="muted">${text}</span></div>`;
}

async function initLogin() {
  const form = document.getElementById("authForm");
  const registerBtn = document.getElementById("registerBtn");
  const message = document.getElementById("message");
  const googleBtn = document.getElementById("googleBtn");

  if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;
        
        if (user.displayName) {
          localStorage.setItem("smartLifeName", user.displayName);
        }

        localStorage.setItem("smartLifeUserId", user.uid);
        localStorage.setItem("smartLifeEmail", user.email);
        location.href = "dashboard.html";
      } catch (error) {
        message.textContent = "Google Login failed: " + error.message;
        const form = document.getElementById("authForm");
        if(form) { form.classList.remove("error-shake"); void form.offsetWidth; form.classList.add("error-shake"); }
      }
    });
  }

  async function submit(mode) {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const nameInput = document.getElementById("fullName");
    const fullName = nameInput ? nameInput.value.trim() : "";
    
    if (mode === "forgot-password") {
      try {
        await firebase.auth().sendPasswordResetEmail(email);
        message.textContent = "Reset link sent to your email!";
        message.style.color = "var(--accent)";
        const form = document.getElementById("authForm");
        if(form) { form.classList.remove("success-glow"); void form.offsetWidth; form.classList.add("success-glow"); }
      } catch (error) {
        message.textContent = error.message;
        message.style.color = "var(--danger)";
        const form = document.getElementById("authForm");
        if(form) { form.classList.remove("error-shake"); void form.offsetWidth; form.classList.add("error-shake"); }
      }
      return;
    }

    if (password.length < 6) {
      message.textContent = "Password must be at least 6 characters.";
      message.style.color = "var(--danger)";
      const form = document.getElementById("authForm");
      if(form) { form.classList.remove("error-shake"); void form.offsetWidth; form.classList.add("error-shake"); }
      return;
    }

    if (mode === "register") {
      if (!fullName) {
        message.textContent = "Please enter your full name.";
        message.style.color = "var(--danger)";
        const form = document.getElementById("authForm");
        if(form) { form.classList.remove("error-shake"); void form.offsetWidth; form.classList.add("error-shake"); }
        return;
      }
      const confirmPasswordInput = document.getElementById("confirmPassword");
      if (confirmPasswordInput && password !== confirmPasswordInput.value) {
        message.textContent = "Passwords do not match.";
        message.style.color = "var(--danger)";
        const form = document.getElementById("authForm");
        if(form) { form.classList.remove("error-shake"); void form.offsetWidth; form.classList.add("error-shake"); }
        return;
      }
      try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: fullName });
        localStorage.setItem("smartLifeName", fullName);
        localStorage.setItem("smartLifeUserId", userCredential.user.uid);
        localStorage.setItem("smartLifeEmail", userCredential.user.email);
        
        const form = document.getElementById("authForm");
        if(form) { form.classList.remove("success-glow"); void form.offsetWidth; form.classList.add("success-glow"); }
        
        setTimeout(() => { location.href = "dashboard.html"; }, 600);
      } catch (error) {
        message.textContent = error.message;
        const form = document.getElementById("authForm");
        if(form) { form.classList.remove("error-shake"); void form.offsetWidth; form.classList.add("error-shake"); }
      }
      return;
    }

    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      localStorage.setItem("smartLifeUserId", userCredential.user.uid);
      localStorage.setItem("smartLifeEmail", userCredential.user.email);
      
      const form = document.getElementById("authForm");
      if(form) { form.classList.remove("success-glow"); void form.offsetWidth; form.classList.add("success-glow"); }
      
      setTimeout(() => {
        location.href = "dashboard.html";
      }, 600);
    } catch (error) {
      message.textContent = error.message;
      const form = document.getElementById("authForm");
      if(form) { form.classList.remove("error-shake"); void form.offsetWidth; form.classList.add("error-shake"); }
    }
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const submitBtn = document.querySelector("button[type='submit']");
      const mode = submitBtn ? submitBtn.dataset.mode : "login";
      submit(mode);
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener("click", (e) => {
      e.preventDefault();
      submit("register");
    });
  }
  
  const forgotBtn = document.getElementById("forgotPasswordBtn");
  if (forgotBtn) {
    forgotBtn.addEventListener("click", () => submit("forgot-password"));
  }
}

async function initDashboard() {
  showSkeletons("dashboardActivityFeed", 3, "60px");
  showSkeletons("dashboardTaskFeed", 3, "60px");
  
  let data = null;
  let summary = null;
  try {
    data = await api(`/dashboard?userId=${userId()}`);
    summary = await api(`/expenses/summary?userId=${userId()}&range=month`);
  } catch (error) {
    showToast(error.message);
  }

  const monthlyTotal = Number(summary?.totalExpenses || data?.expenseAnalysis?.monthTotal || 0);
  const salary = Number(summary?.monthlySalary || 0);
  const remaining = Number(summary?.remainingBalance || 0);
  const savings = Number(summary?.totalSavings || 0);
  const savingsRate = Number(summary?.savingsRate || 0);
  const hasData = monthlyTotal > 0 || salary > 0 || savings > 0;
  const notificationCount = data?.notifications?.filter(notification => !notification.readStatus).length ?? 0;
  const monthTotal = document.getElementById("monthTotal");
  const overviewAmount = document.getElementById("overviewAmount");
  const notificationBadge = document.getElementById("notificationBadge");

  if (monthTotal) animateValue(monthTotal, 0, monthlyTotal, 1200, true);
  if (overviewAmount) animateValue(overviewAmount, 0, monthlyTotal, 1200, true);
  if (notificationBadge) {
    if (notificationCount > 0) {
      animateValue(notificationBadge, 0, notificationCount, 800, false);
      notificationBadge.style.display = "grid";
    } else {
      notificationBadge.style.display = "none";
    }
  }
  
  const balEl = document.getElementById("dashboardBalance");
  if (balEl) {
    if (hasData) animateValue(balEl, 0, remaining, 1200, true);
    else balEl.textContent = money(0);
  }
  setText("dashboardBalanceNote", hasData ? "Remaining balance" : "Add data to see insights");
  
  const salEl = document.getElementById("dashboardSalary");
  if (salEl) animateValue(salEl, 0, salary, 1000, true);
  
  const savEl = document.getElementById("dashboardSavings");
  if (savEl) animateValue(savEl, 0, savings, 1000, true);
  
  setText("dashboardSavingsNote", hasData ? `${savingsRate}% saving rate` : "Add salary first");
  const savingsRing = document.getElementById("dashboardSavingsRing");
  if (savingsRing) {
    setTimeout(() => {
      savingsRing.style.setProperty("--value", String(Math.min(100, Math.max(0, savingsRate))));
    }, 100);
    const span = savingsRing.querySelector("span");
    animateValue(span, 0, Math.round(savingsRate), 1000, false);
    span.innerHTML += "%";
  }
  if (!hasData) {
    setHtml("dashboardActivityFeed", `<div class="dropdown-item"><span>Add expenses to see recent activity.</span></div>`);
    setHtml("dashboardTaskFeed", `<div class="dropdown-item"><span>Add tasks to see upcoming work.</span></div>`);
  }

  const taskProgressRing = document.querySelector(".task-progress .progress-ring");
  if (taskProgressRing) {
    if (!hasData) {
      taskProgressRing.style.setProperty("--value", "0");
      taskProgressRing.querySelector("span").textContent = "0%";
      document.querySelector(".progress-breakdown").innerHTML = `
        <p><strong>0 of 0 tasks completed</strong></p>
        <div><span class="dot done"></span>Completed <strong>0 (0%)</strong></div>
        <div><span class="dot doing"></span>In Progress <strong>0 (0%)</strong></div>
        <div><span class="dot waiting"></span>Pending <strong>0 (0%)</strong></div>
      `;
    }
  }

  setupDashboardChart(hasData ? "month" : "empty");
  setupDashboardControls();
  setupExports();
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function setHtml(id, value) {
  const node = document.getElementById(id);
  if (node) node.innerHTML = value;
}

function setupExports() {
  const pdf = document.getElementById("exportPdfLink");
  const excel = document.getElementById("exportExcelLink");
  if (pdf) pdf.addEventListener("click", (e) => { e.preventDefault(); downloadFile(`${API_BASE}/expenses/export/pdf?userId=${userId()}`, "export.pdf"); });
  if (excel) excel.addEventListener("click", (e) => { e.preventDefault(); downloadFile(`${API_BASE}/expenses/export/excel?userId=${userId()}`, "export.xlsx"); });
}

let dashboardExpenseChart;
const dashboardChartData = {
  empty: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    values: [0, 0, 0, 0, 0, 0, 0]
  },
  week: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    values: [1250, 2450, 980, 3100, 1780, 4020, 2140]
  },
  month: {
    labels: ["1 May", "5 May", "8 May", "12 May", "15 May", "18 May", "22 May", "25 May", "29 May"],
    values: [7200, 10800, 6400, 11600, 15720, 20500, 12800, 21800, 24250]
  },
  year: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    values: [42000, 38600, 45500, 39700, 15720, 28200, 33400, 41900, 36200, 48100, 44500, 52600]
  }
};

function setupDashboardChart(range = "month") {
  const ctx = document.getElementById("dashboardExpenseChart");
  if (!ctx || typeof Chart === "undefined") return;
  const current = dashboardChartData[range];
  const gradient = ctx.getContext("2d").createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, "rgba(130, 87, 255, 0.48)");
  gradient.addColorStop(1, "rgba(130, 87, 255, 0.02)");

  if (dashboardExpenseChart) {
    dashboardExpenseChart.data.labels = current.labels;
    dashboardExpenseChart.data.datasets[0].data = current.values;
    dashboardExpenseChart.update();
    return;
  }

  dashboardExpenseChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: current.labels,
      datasets: [{
        label: "Expense",
        data: current.values,
        borderColor: "#8d63ff",
        backgroundColor: gradient,
        pointBackgroundColor: "#8d63ff",
        pointBorderColor: "#cbbcff",
        pointHoverRadius: 7,
        pointRadius: 4,
        borderWidth: 3,
        fill: true,
        tension: 0.38
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: "easeOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(6, 17, 35, 0.92)",
          borderColor: "rgba(141, 99, 255, 0.6)",
          borderWidth: 1,
          callbacks: {
            label: context => money(context.parsed.y)
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(120, 164, 255, 0.08)" },
          ticks: { color: "#9fb0d2" }
        },
        y: {
          grid: { color: "rgba(120, 164, 255, 0.1)" },
          ticks: {
            color: "#9fb0d2",
            callback: value => `${value / 1000}k`
          }
        }
      }
    }
  });
}

function setupDashboardControls() {
  const filters = document.getElementById("chartFilters");
  if (!filters) return;
  filters.addEventListener("click", event => {
    const button = event.target.closest("button[data-range]");
    if (!button) return;
    filters.querySelectorAll("button").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    setupDashboardChart(button.dataset.range);
  });
}

async function initExpenses() {
  selectedExpenseDate = new Date();
  visibleExpenseMonth = new Date(selectedExpenseDate.getFullYear(), selectedExpenseDate.getMonth(), 1);
  document.getElementById("expenseDate").value = isoDate(selectedExpenseDate);
  setupExpenseExports();
  await Promise.all([loadExpenseProfile(), loadExpenses(), loadExpenseSummary("month"), loadExpenseAnalysis()]);

  document.getElementById("expenseForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await api(`/expenses?userId=${userId()}`, {
      method: "POST",
      body: JSON.stringify({
        description: document.getElementById("expenseDescription").value,
        amount: document.getElementById("expenseAmount").value,
        category: document.getElementById("expenseCategory").value,
        expenseDate: document.getElementById("expenseDate").value
      })
    });
    event.target.reset();
    document.getElementById("expenseDate").value = isoDate(selectedExpenseDate);
    showToast("Expense added");
    await Promise.all([loadExpenses(), loadExpenseSummary(currentExpenseRange), loadExpenseAnalysis()]);
  });

  document.getElementById("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await api(`/expenses/profile?userId=${userId()}`, {
      method: "POST",
      body: JSON.stringify({
        monthlySalary: document.getElementById("monthlySalary").value || 0,
        totalSavings: document.getElementById("totalSavings").value || 0,
        spendingLimit: document.getElementById("spendingLimit").value || 0
      })
    });
    showToast("Financial setup saved");
    await loadExpenseSummary(currentExpenseRange);
  });

  document.getElementById("expenseSearch").addEventListener("input", renderExpenseList);
  document.getElementById("expenseRangeFilters").addEventListener("click", async event => {
    const button = event.target.closest("button[data-range]");
    if (!button) return;
    currentExpenseRange = button.dataset.range;
    document.querySelectorAll("#expenseRangeFilters button").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    await loadExpenseSummary(currentExpenseRange);
  });

  document.getElementById("prevMonth").addEventListener("click", () => changeExpenseMonth(-1));
  document.getElementById("nextMonth").addEventListener("click", () => changeExpenseMonth(1));
  document.getElementById("closeMonthBtn").addEventListener("click", closeExpenseMonth);
}

let allExpenses = [];
let currentExpenseRange = "month";
let selectedExpenseDate = new Date();
let visibleExpenseMonth = new Date();

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function loadExpenses() {
  showSkeletons("expenseList", 5, "70px");
  allExpenses = await api(`/expenses?userId=${userId()}`);
  renderExpenseCalendar();
  renderExpenseList();
  updateSelectedDayTotals();
}

function renderExpenseList() {
  const list = document.getElementById("expenseList");
  if (!list) return;
  const search = (document.getElementById("expenseSearch")?.value || "").toLowerCase();
  const expenses = allExpenses.filter(expense => {
    const text = `${expense.description || ""} ${expense.category || ""}`.toLowerCase();
    return text.includes(search);
  });
  const count = document.getElementById("expenseCount");
  if (count) count.textContent = `${expenses.length} records`;
  list.innerHTML = expenses.length ? expenses.map(expense => `
    <div class="list-item">
      <div class="item-line"><strong>${expense.description || expense.category}</strong><span>${money(expense.amount)}</span></div>
      <span class="pill">${expense.category}</span>
      <span class="muted">${dateText(expense.expenseDate)}</span>
      <button class="danger-btn" onclick="deleteExpense(${expense.id})">Delete</button>
    </div>
  `).join("") : emptyState("No expenses yet.");
}

async function deleteExpense(id) {
  await api(`/expenses/${id}`, { method: "DELETE" });
  showToast("Expense deleted");
  await Promise.all([loadExpenses(), loadExpenseSummary(currentExpenseRange), loadExpenseAnalysis()]);
}

let expenseChart;
let categoryChart;
async function loadExpenseAnalysis() {
  const data = await api(`/expenses/analysis?userId=${userId()}`);
  const insight = document.getElementById("expenseInsight");
  if (insight) insight.textContent = data.insight;
  const topCategory = Object.entries(data.categoryTotals || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";
  const topCategoryNode = document.getElementById("topCategory");
  if (topCategoryNode) topCategoryNode.textContent = topCategory;
  const labels = Object.keys(data.categoryTotals);
  const values = Object.values(data.categoryTotals);
  const ctx = document.getElementById("expenseChart");
  if (!ctx || typeof Chart === "undefined") return;
  if (expenseChart) expenseChart.destroy();
  expenseChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dailyChartLabels(),
      datasets: [{
        data: dailyChartValues(),
        borderColor: "#8d63ff",
        backgroundColor: "rgba(141, 99, 255, 0.22)",
        fill: true,
        tension: 0.35
      }]
    },
    options: chartOptions(false)
  });
  const categoryCtx = document.getElementById("categoryChart");
  if (!categoryCtx) return;
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(categoryCtx, {
    type: "doughnut",
    data: {
      labels: labels.length ? labels : ["No data"],
      datasets: [{ data: values.length ? values : [1], backgroundColor: ["#35d0ba", "#ffcb5b", "#ff8b8b", "#7fa7ff", "#bd7dff"] }]
    },
    options: chartOptions(true)
  });
}

async function loadExpenseProfile() {
  const profile = await api(`/expenses/profile?userId=${userId()}`);
  document.getElementById("monthlySalary").value = profile.monthlySalary || "";
  document.getElementById("totalSavings").value = profile.totalSavings || "";
  document.getElementById("spendingLimit").value = profile.spendingLimit || "";
}

async function loadExpenseSummary(range) {
  const data = await api(`/expenses/summary?userId=${userId()}&range=${range}`);
  document.getElementById("expenseTotal").textContent = money(data.totalExpenses);
  document.getElementById("remainingBalance").textContent = money(data.remainingBalance);
  document.getElementById("savingsTotal").textContent = money(data.totalSavings);
  document.getElementById("savingsRate").textContent = `${data.savingsRate || 0}% saving rate`;
  document.getElementById("monthlyTotalExpense").textContent = money(data.totalExpenses);
  const remainingSavingsDisplay = document.getElementById("remainingSavingsDisplay");
  if (remainingSavingsDisplay) remainingSavingsDisplay.textContent = money(data.remainingBalance);
  document.getElementById("spendingAlert").textContent = data.alert || "";
  updateSelectedDayTotals();
}

function renderExpenseCalendar() {
  const calendar = document.getElementById("expenseCalendar");
  if (!calendar) return;
  const title = document.getElementById("calendarTitle");
  title.textContent = visibleExpenseMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const year = visibleExpenseMonth.getFullYear();
  const month = visibleExpenseMonth.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const totals = expenseTotalsByDate();
  let html = "";
  for (let i = 0; i < first.getDay(); i++) {
    html += "<span></span>";
  }
  for (let day = 1; day <= last.getDate(); day++) {
    const date = new Date(year, month, day);
    const key = isoDate(date);
    const total = totals[key] || 0;
    const level = total > 200 ? "red" : total > 100 ? "yellow" : total > 0 ? "green" : "";
    const active = key === isoDate(selectedExpenseDate) ? "active" : "";
    html += `<button type="button" class="${active} ${total ? "has-spend" : ""} ${level}" onclick="selectExpenseDate('${key}')">${day}${total ? `<small>${money(total)}</small>` : ""}</button>`;
  }
  calendar.innerHTML = html;
}

function selectExpenseDate(value) {
  selectedExpenseDate = new Date(`${value}T00:00:00`);
  document.getElementById("expenseDate").value = value;
  document.getElementById("selectedExpenseDate").textContent = selectedExpenseDate.toDateString();
  renderExpenseCalendar();
  updateSelectedDayTotals();
}

function changeExpenseMonth(offset) {
  visibleExpenseMonth = new Date(visibleExpenseMonth.getFullYear(), visibleExpenseMonth.getMonth() + offset, 1);
  renderExpenseCalendar();
}

function expenseTotalsByDate() {
  return allExpenses.reduce((totals, expense) => {
    totals[expense.expenseDate] = (totals[expense.expenseDate] || 0) + Number(expense.amount || 0);
    return totals;
  }, {});
}

function updateSelectedDayTotals() {
  const key = isoDate(selectedExpenseDate);
  const daily = allExpenses.filter(expense => expense.expenseDate === key).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const monthly = allExpenses.filter(expense => {
    const date = new Date(`${expense.expenseDate}T00:00:00`);
    return date.getMonth() === selectedExpenseDate.getMonth() && date.getFullYear() === selectedExpenseDate.getFullYear();
  }).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const selectedDayTotal = document.getElementById("selectedDayTotal");
  if (selectedDayTotal) selectedDayTotal.textContent = money(daily);
  const dailyNode = document.getElementById("dailyTotal");
  const monthlyNode = document.getElementById("monthlyTotalExpense");
  if (dailyNode) dailyNode.textContent = money(daily);
  if (monthlyNode) monthlyNode.textContent = money(monthly);
}

function dailyChartLabels() {
  const totals = expenseTotalsByDate();
  return Object.keys(totals).slice(-14);
}

function dailyChartValues() {
  const totals = expenseTotalsByDate();
  const values = Object.values(totals).slice(-14);
  return values.length ? values : [0];
}

function chartOptions(showLegend) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: showLegend, labels: { color: document.body.classList.contains("day-mode") ? "#071427" : "#f7fbff" } } },
    scales: showLegend ? undefined : {
      x: { ticks: { color: "#9fb0d2" }, grid: { color: "rgba(120, 164, 255, 0.1)" } },
      y: { ticks: { color: "#9fb0d2" }, grid: { color: "rgba(120, 164, 255, 0.1)" } }
    }
  };
}

async function closeExpenseMonth() {
  const data = await api(`/expenses/close-month?userId=${userId()}`, { method: "POST" });
  showToast(`Added to savings: ${money(data.addedSavings)}`);
  await Promise.all([loadExpenseProfile(), loadExpenseSummary(currentExpenseRange)]);
}

function setupExpenseExports() {
  const pdf = document.getElementById("expensePdfExport");
  const excel = document.getElementById("expenseExcelExport");
  if (pdf) pdf.addEventListener("click", (e) => { e.preventDefault(); downloadFile(`${API_BASE}/expenses/export/pdf?userId=${userId()}`, "expenses.pdf"); });
  if (excel) excel.addEventListener("click", (e) => { e.preventDefault(); downloadFile(`${API_BASE}/expenses/export/excel?userId=${userId()}`, "expenses.xlsx"); });
}

async function downloadFile(url, filename) {
  showLoader(true);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Export failed");
    const blob = await response.blob();
    const a = document.createElement("a");
    a.href = window.URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Export successful");
  } catch (err) {
    showToast("Error exporting file");
  } finally {
    showLoader(false);
  }
}

async function loadLending() {
  const records = await api(`/lending?userId=${userId()}`);
  const list = document.getElementById("lendingList");
  list.innerHTML = records.length ? records.map(record => `
    <div class="list-item">
      <div class="item-line"><strong>${record.personName}</strong><span>${money(record.amount)}</span></div>
      <span class="pill">${record.type === "YOU_GAVE" ? "You gave" : "You borrowed"}</span>
      <span class="muted">Due: ${dateText(record.dueDate)}</span>
      <button class="danger-btn" onclick="deleteLending(${record.id})">Delete</button>
    </div>
  `).join("") : emptyState("No lending records yet.");
}

async function deleteLending(id) {
  await api(`/lending/${id}`, { method: "DELETE" });
  showToast("Record deleted");
  await loadLending();
}

async function initTodos() {
  setupExports();
  setupGoals();
  await Promise.all([loadTodos(), loadProductivity()]);
  document.getElementById("todoForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await api(`/todos?userId=${userId()}`, {
      method: "POST",
      body: JSON.stringify({
        task: document.getElementById("todoTask").value,
        priority: document.getElementById("todoPriority").value,
        deadline: document.getElementById("todoDeadline").value,
        recurrence: document.getElementById("todoRecurrence").value,
        minutesSpent: document.getElementById("todoMinutes").value || 0
      })
    });
    event.target.reset();
    showToast("Task added");
    await Promise.all([loadTodos(), loadProductivity()]);
  });
}

let allTodos = [];

async function loadTodos() {
  showSkeletons("pendingTodoList", 3, "80px");
  showSkeletons("overdueTodoList", 1, "80px");
  showSkeletons("completedTodoList", 2, "80px");
  allTodos = await api(`/todos?userId=${userId()}`);
  renderGoalList();
  renderTodoGroups();
}

function renderTodoGroups() {
  const now = new Date();
  const pending = [];
  const overdue = [];
  const completed = [];
  allTodos.forEach(todo => {
    if (todo.status === "COMPLETED") {
      completed.push(todo);
    } else if (todo.deadline && new Date(todo.deadline) < now) {
      overdue.push(todo);
    } else {
      pending.push(todo);
    }
  });
  setHtml("pendingTodoList", todoGroupHtml(pending, "pending"));
  setHtml("overdueTodoList", todoGroupHtml(overdue, "overdue"));
  setHtml("completedTodoList", todoGroupHtml(completed, "completed"));
  const total = allTodos.length;
  const percent = total ? Math.round((completed.length / total) * 100) : 0;
  setText("todoProductivitySummary", total ? `You completed ${percent}% tasks this week` : "Add tasks to see weekly productivity.");
}

function todoGroupHtml(todos, group) {
  if (!todos.length) return emptyState(`No ${group} tasks.`);
  return todos.map(todo => `
    <div class="todo-clean-item adding" data-todo-id="${todo.id}">
      <div class="todo-clean-head">
        <strong>${todo.task}</strong>
        <span class="priority-label ${todo.priority.toLowerCase()}">${titleCase(todo.priority)}</span>
      </div>
      <div class="todo-clean-meta">
        <span class="deadline ${group}">${deadlineLabel(todo, group)}</span>
        <span>${todo.recurrence === "NONE" ? "One-time" : `Repeats ${titleCase(todo.recurrence)}`}</span>
      </div>
      <div class="todo-actions">
        ${todo.status === "COMPLETED" ? "" : `<button class="primary-btn" onclick="completeTodo(${todo.id})">✅ Complete</button>`}
        <button class="danger-btn" onclick="deleteTodo(${todo.id})">🗑 Delete</button>
      </div>
    </div>
  `).join("");
}

function deadlineLabel(todo, group) {
  if (!todo.deadline) return "No deadline";
  if (group === "overdue") return `Overdue: ${dateText(todo.deadline)}`;
  if (group === "completed") return `Completed`;
  return `Reminder: ${dateText(todo.deadline)}`;
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function setupGoals() {
  const add = document.getElementById("addGoalBtn");
  add?.addEventListener("click", () => {
    const input = document.getElementById("goalNameInput");
    const name = input.value.trim();
    if (!name) return;
    const goals = getGoals();
    goals.push({ name, color: "green" });
    localStorage.setItem("smartLifeGoals", JSON.stringify(goals));
    input.value = "";
    renderGoalOptions();
    renderGoalList();
  });
  renderGoalOptions();
}

function getGoals() {
  return JSON.parse(localStorage.getItem("smartLifeGoals") || "null") || [
    { name: "Study Daily", color: "green" },
    { name: "Fitness", color: "blue" },
    { name: "Save Money", color: "orange" }
  ];
}

function renderGoalOptions() {
  const select = document.getElementById("todoGoal");
  if (!select) return;
  select.innerHTML = getGoals().map(goal => `<option>${goal.name}</option>`).join("");
}

function renderGoalList() {
  const goals = getGoals();
  const node = document.getElementById("goalList");
  if (!node) return;
  document.getElementById("goalCount").textContent = `(${goals.length})`;
  const total = Math.max(1, allTodos.length);
  const completed = allTodos.filter(todo => todo.status === "COMPLETED").length;
  node.innerHTML = goals.map((goal, index) => {
    return `
      <div class="goal-row">
        <span class="goal-icon ${goal.color}">${goal.name.slice(0, 1)}</span>
        <div>
          <strong>${goal.name}</strong>
          <div class="goal-progress" style="color:${goal.color === "orange" ? "#ff9d2f" : goal.color === "blue" ? "#3479f6" : "#25e4aa"}"><span style="width:0%"></span></div>
        </div>
        <span>0 / 5 tasks</span>
      </div>
    `;
  }).join("");
}

async function completeTodo(id) {
  await api(`/todos/${id}/complete`, { method: "PUT" });
  showToast("Task completed successfully");
  await Promise.all([loadTodos(), loadProductivity()]);
}

async function deleteTodo(id) {
  await api(`/todos/${id}`, { method: "DELETE" });
  showToast("Task deleted");
  await Promise.all([loadTodos(), loadProductivity()]);
}

let productivityChart;
async function loadProductivity() {
  const data = await api(`/todos/productivity?userId=${userId()}`);
  const insightNode = document.getElementById("productivityInsight");
  if (insightNode) insightNode.textContent = data.insight;
  const ctx = document.getElementById("productivityChart");
  if (!ctx) return;
  if (productivityChart) productivityChart.destroy();
  
  const isDayMode = document.body.classList.contains("day-mode");
  const textColor = isDayMode ? "#555e68" : "#f7fbff";
  const borderColor = isDayMode ? "#ffffff" : "#08152b";

  productivityChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Productive", "Waste"],
      datasets: [{ 
        data: [data.productiveMinutes || 1, data.wasteMinutes || 0], 
        backgroundColor: ["#35d0ba", "#ff6b6b"],
        borderColor: borderColor,
        borderWidth: 2
      }]
    },
    options: { 
      cutout: "75%",
      plugins: { 
        legend: { labels: { color: textColor } } 
      } 
    }
  });
}

async function initNotifications() {
  const notifications = await api(`/notifications?userId=${userId()}`);
  const list = document.getElementById("notificationList");
  list.innerHTML = notifications.length ? notifications.map(notification => `
    <div class="list-item">
      <div class="item-line">
        <strong>${notification.message}</strong>
        <span class="pill">${notification.readStatus ? "Read" : "New"}</span>
      </div>
      <span class="muted">${dateText(notification.createdAt)}</span>
      ${notification.readStatus ? "" : `<button class="primary-btn" onclick="readNotification(${notification.id})">Mark Read</button>`}
    </div>
  `).join("") : emptyState("No notifications yet.");
}

async function readNotification(id) {
  await api(`/notifications/${id}/read`, { method: "PUT" });
  showToast("Notification marked read");
  await initNotifications();
}

// Todo App Extensions (Phase 1-6)

let currentTodoView = "all";

function setupTodoAppExtensions() {
  // Views filter
  document.querySelectorAll(".todo-views button").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".todo-views button").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      currentTodoView = e.target.dataset.view;
      renderTodoGroups();
    });
  });

  // Search & Sort
  const searchInput = document.getElementById("todoSearch");
  const sortSelect = document.getElementById("todoSort");
  if (searchInput) searchInput.addEventListener("input", renderTodoGroups);
  if (sortSelect) sortSelect.addEventListener("change", renderTodoGroups);

  // Focus Mode
  const focusBtn = document.getElementById("focusModeToggle");
  if (focusBtn) {
    focusBtn.addEventListener("click", () => {
      document.body.classList.toggle("focus-mode");
    });
  }

  // Pomodoro
  setupPomodoro();

  // Command Palette
  setupCommandPalette();

  // Streak Calculation
  calculateStreak();

  // Reminders / PWA
  if ("Notification" in window && Notification.permission !== "denied" && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(console.error);
  }

  // Mock AI Suggestions and Location Reminders
  setTimeout(() => {
    // Location Mock
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(() => {
        showToast("📍 Location Reminder: You're near 'Supermarket'. Don't forget: Buy Milk!");
      }, () => {}, { timeout: 5000 });
    }
    
    // AI Suggestion Mock
    const highPriority = allTodos.find(t => t.priority === "HIGH" && t.status !== "COMPLETED");
    if (highPriority) {
      setTimeout(() => showToast(`🤖 AI Suggestion: Focus on "${highPriority.task}" next!`), 3000);
    }
  }, 2000);
}

function getFilteredAndSortedTodos() {
  const search = (document.getElementById("todoSearch")?.value || "").toLowerCase();
  const sort = document.getElementById("todoSort")?.value || "date-desc";
  const now = new Date();
  
  let filtered = allTodos.filter(todo => {
    if (search && !todo.task.toLowerCase().includes(search)) return false;
    
    const taskDate = todo.deadline ? new Date(todo.deadline) : null;
    if (currentTodoView === "today") {
      if (!taskDate || taskDate.toDateString() !== now.toDateString()) return false;
    } else if (currentTodoView === "upcoming") {
      if (!taskDate || taskDate <= now) return false;
    } else if (currentTodoView === "important") {
      if (todo.priority !== "HIGH") return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sort === "priority") {
      const p = { "HIGH": 3, "MEDIUM": 2, "LOW": 1 };
      return p[b.priority] - p[a.priority];
    } else if (sort === "date-asc") {
      return new Date(a.deadline || 0) - new Date(b.deadline || 0);
    } else {
      return new Date(b.deadline || 0) - new Date(a.deadline || 0);
    }
  });

  return filtered;
}

// Override renderTodoGroups to use filtering/sorting
const originalRenderTodoGroups = renderTodoGroups;
renderTodoGroups = function() {
  const filteredTodos = getFilteredAndSortedTodos();
  
  const now = new Date();
  const pending = [];
  const overdue = [];
  const completed = [];
  
  filteredTodos.forEach(todo => {
    if (todo.status === "COMPLETED") completed.push(todo);
    else if (todo.deadline && new Date(todo.deadline) < now) overdue.push(todo);
    else pending.push(todo);
  });
  
  setHtml("pendingTodoList", todoGroupHtml(pending, "pending"));
  setHtml("overdueTodoList", todoGroupHtml(overdue, "overdue"));
  setHtml("completedTodoList", todoGroupHtml(completed, "completed"));
  
  const total = filteredTodos.length;
  const percent = total ? Math.round((completed.length / total) * 100) : 0;
  setText("todoProductivitySummary", total ? `You completed ${percent}% of filtered tasks` : "Add tasks to see weekly productivity.");
  
  // Linear Progress Bar update
  const bar = document.getElementById("linearProgressBar");
  if (bar) bar.style.width = `${percent}%`;

  // Remove slide-in animation class after it plays
  setTimeout(() => {
    document.querySelectorAll(".todo-clean-item.adding").forEach(el => el.classList.remove("adding"));
  }, 400);

  setupDragAndDrop();
  setupInlineEditing();
};

function setupInlineEditing() {
  document.querySelectorAll(".todo-clean-item:not([data-edit-init]) .todo-clean-head strong").forEach(title => {
    title.closest(".todo-clean-item").setAttribute("data-edit-init", "1");
    title.style.cursor = "text";
    title.title = "Click to edit";
    title.addEventListener("click", function() {
      if (this.getAttribute("contenteditable") === "true") return;
      this.setAttribute("contenteditable", "true");
      this.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(this);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      const originalText = this.innerText;
      
      this.onblur = () => {
        this.setAttribute("contenteditable", "false");
        const newText = this.innerText.trim();
        if (newText && newText !== originalText) {
          // Get the task id from the item's data attribute
          const item = this.closest(".todo-clean-item");
          const id = item.dataset.todoId;
          if (id) {
            const todo = allTodos.find(t => String(t.id) === String(id));
            if (todo) {
              todo.task = newText;
              showToast("✅ Task updated");
            }
          }
        } else if (!newText) {
          this.innerText = originalText;
        }
      };
      
      this.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.blur();
        }
        if (e.key === "Escape") {
          this.innerText = originalText;
          this.setAttribute("contenteditable", "false");
        }
      };
    });
  });
}

function setupDragAndDrop() {
  const items = document.querySelectorAll(".todo-clean-item:not([data-drag-init])");
  const lists = document.querySelectorAll(".todo-clean-list:not([data-drag-list])");

  items.forEach(item => {
    item.setAttribute("draggable", "true");
    item.setAttribute("data-drag-init", "1");
    item.classList.add("draggable");
    
    item.addEventListener("dragstart", () => {
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
    });
  });

  lists.forEach(list => {
    list.setAttribute("data-drag-list", "1");
    list.addEventListener("dragover", e => {
      e.preventDefault();
      const dragging = document.querySelector(".dragging");
      if (!dragging) return;
      const afterEl = getDragAfterElement(list, e.clientY);
      if (!afterEl) list.appendChild(dragging);
      else list.insertBefore(dragging, afterEl);
    });
  });
}

function getDragAfterElement(container, y) {
  const items = [...container.querySelectorAll(".todo-clean-item:not(.dragging)")];
  return items.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function calculateStreak() {
  const streakEl = document.getElementById("dailyStreak");
  if (!streakEl) return;
  // Mock logic: randomly generate a streak based on local storage history
  let streak = parseInt(localStorage.getItem("smartLifeStreak") || "0");
  const lastActive = localStorage.getItem("smartLifeLastActive");
  const today = new Date().toDateString();
  
  if (lastActive !== today) {
    streak += 1;
    localStorage.setItem("smartLifeStreak", streak);
    localStorage.setItem("smartLifeLastActive", today);
  }
  streakEl.textContent = streak;
}

let pomodoroTimer;
let pomodoroTimeLeft = 25 * 60;
function setupPomodoro() {
  const toggle = document.getElementById("pomodoroToggle");
  const panel = document.getElementById("pomodoroPanel");
  const startBtn = document.getElementById("pomodoroStart");
  const resetBtn = document.getElementById("pomodoroReset");
  const display = document.getElementById("pomodoroTime");
  
  if (!toggle || !panel) return;

  toggle.addEventListener("click", () => panel.classList.toggle("open"));

  function updateDisplay() {
    const m = Math.floor(pomodoroTimeLeft / 60).toString().padStart(2, "0");
    const s = (pomodoroTimeLeft % 60).toString().padStart(2, "0");
    display.textContent = `${m}:${s}`;
  }

  startBtn.addEventListener("click", () => {
    if (pomodoroTimer) {
      clearInterval(pomodoroTimer);
      pomodoroTimer = null;
      startBtn.textContent = "Start";
    } else {
      startBtn.textContent = "Pause";
      pomodoroTimer = setInterval(() => {
        if (pomodoroTimeLeft > 0) {
          pomodoroTimeLeft--;
          updateDisplay();
        } else {
          clearInterval(pomodoroTimer);
          pomodoroTimer = null;
          startBtn.textContent = "Start";
          showToast("Pomodoro finished! Take a break.");
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Pomodoro Finished", { body: "Time for a 5-minute break!" });
          }
        }
      }, 1000);
    }
  });

  resetBtn.addEventListener("click", () => {
    clearInterval(pomodoroTimer);
    pomodoroTimer = null;
    pomodoroTimeLeft = 25 * 60;
    startBtn.textContent = "Start";
    updateDisplay();
  });
}

function setupCommandPalette() {
  const palette = document.getElementById("commandPalette");
  const input = document.getElementById("commandInput");
  const results = document.getElementById("commandResults");
  
  if (!palette) return;

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "k") {
      e.preventDefault();
      palette.classList.add("open");
      input.focus();
    }
    if (e.key === "Escape") {
      palette.classList.remove("open");
    }
  });

  palette.addEventListener("click", (e) => {
    if (e.target === palette) palette.classList.remove("open");
  });

  input.addEventListener("input", () => {
    const q = input.value.toLowerCase();
    results.innerHTML = "";
    if (!q) return;
    
    // Command Mock Results
    const commands = [
      { text: "Add task: " + q.replace("add task:", "").trim(), action: () => {
          document.getElementById("todoTask").value = q.replace("add task:", "").trim();
          palette.classList.remove("open");
          document.getElementById("todoTask").focus();
      }},
      { text: "Switch to Dashboard", action: () => location.href = "dashboard.html" },
      { text: "Toggle Focus Mode", action: () => document.getElementById("focusModeToggle").click() }
    ];
    
    commands.forEach(cmd => {
      const div = document.createElement("div");
      div.className = "command-item";
      div.textContent = cmd.text;
      div.onclick = cmd.action;
      results.appendChild(div);
    });
  });
}

// Smart Input Interceptor
if (document.getElementById("todoForm")) {
  document.getElementById("todoForm").addEventListener("submit", (e) => {
    const taskInput = document.getElementById("todoTask");
    const deadlineInput = document.getElementById("todoDeadline");
    const priorityInput = document.getElementById("todoPriority");
    const raw = taskInput.value;
    const val = raw.toLowerCase();

    // ── Priority Detection ──
    if (val.includes("high"))        priorityInput.value = "HIGH";
    else if (val.includes("medium")) priorityInput.value = "MEDIUM";
    else if (val.includes("low"))    priorityInput.value = "LOW";

    // ── Time detection ──
    let hours = 9; // default 9am
    const time12 = val.match(/(\d{1,2})(am|pm)/);
    const time24 = val.match(/(\d{1,2}):(\d{2})/);
    if (time12) {
      hours = parseInt(time12[1]);
      if (time12[2] === "pm" && hours !== 12) hours += 12;
    } else if (time24) {
      hours = parseInt(time24[1]);
    } else if (val.includes("6pm")) {
      hours = 18;
    } else if (val.includes("noon") || val.includes("12pm")) {
      hours = 12;
    } else if (val.includes("midnight")) {
      hours = 23;
    } else if (val.includes("evening") || val.includes("tonight")) {
      hours = 20;
    } else if (val.includes("morning")) {
      hours = 9;
    }

    // ── Date Detection ──
    let targetDate = null;
    if (val.includes("tomorrow")) {
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (val.includes("today") || val.includes("tonight")) {
      targetDate = new Date();
    } else if (val.includes("next week")) {
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 7);
    } else if (val.includes("monday")) {
      targetDate = nextWeekday(1);
    } else if (val.includes("tuesday")) {
      targetDate = nextWeekday(2);
    } else if (val.includes("wednesday")) {
      targetDate = nextWeekday(3);
    } else if (val.includes("thursday")) {
      targetDate = nextWeekday(4);
    } else if (val.includes("friday")) {
      targetDate = nextWeekday(5);
    }

    if (targetDate) {
      targetDate.setHours(hours, 0, 0, 0);
      const tzOffset = targetDate.getTimezoneOffset() * 60000;
      deadlineInput.value = (new Date(targetDate - tzOffset)).toISOString().slice(0, 16);
    } else if (!deadlineInput.value) {
      // Set default deadline: tomorrow at 9am if no deadline specified
      const def = new Date();
      def.setDate(def.getDate() + 1);
      def.setHours(9, 0, 0, 0);
      const tzOffset = def.getTimezoneOffset() * 60000;
      deadlineInput.value = (new Date(def - tzOffset)).toISOString().slice(0, 16);
    }

    // ── Clean up task name ──
    taskInput.value = raw
      .replace(/\b(high|medium|low|urgent|important)\b/gi, "")
      .replace(/\b(tomorrow|today|tonight|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
      .replace(/\d{1,2}(am|pm)/gi, "")
      .replace(/\d{1,2}:\d{2}/g, "")
      .replace(/\b(morning|evening|noon|midnight)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Guard: if task name is now empty, restore original
    if (!taskInput.value) taskInput.value = raw;

  }, true); // capture phase: runs BEFORE browser HTML5 validation
}

function nextWeekday(dayNum) {
  const d = new Date();
  const diff = (dayNum - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

// Hook setup into the main flow
const originalInitTodos = initTodos;
initTodos = async function() {
  await originalInitTodos();
  setupTodoAppExtensions();
};

setupTheme();
setupDropdowns();
setupProfileModal();
setupNotificationPanel();
requireLogin();
setupLogout();

if (page === "login.html") initLogin();
if (page === "dashboard.html") initDashboard().catch(error => showToast(error.message));
if (page === "expense.html") initExpenses().catch(error => showToast(error.message));
if (page === "todo.html") initTodos().catch(error => showToast(error.message));
if (page === "notifications.html") initNotifications().catch(error => showToast(error.message));

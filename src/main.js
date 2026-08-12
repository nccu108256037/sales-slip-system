import { supabase } from "./lib/supabase.js";
import "./styles/main.css";

const app = document.getElementById("app");

/* =========================================================
   GLOBAL STATE
async function init() {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    showLogin();
    return;
  }

  await startApp(user);
}

/* =========================================================
   AUTH

        </div>

        <form id="loginForm">

          <label class="field">

            <span class="field-label">
              Email
            </span>

            <input
              id="email"
              type="email"
              required
              autocomplete="username"
              placeholder="請輸入 Email"
            >

          </label>

          <br>

          <label class="field">

            <span class="field-label">
              密碼
            </span>

            <input
              id="password"
              type="password"
              required
              autocomplete="current-password"
              placeholder="請輸入密碼"
            >

          </label>

          <br>

          <div id="loginMessage"></div>

          <button
            id="loginButton"
            type="submit"
            class="btn btn-primary btn-block"
          >
            登入系統
          </button>

        </form>

      </section>

    </main>
  `;

  document
    .getElementById("loginForm")
    .addEventListener("submit", login);
}

async function login(event) {
  event.preventDefault();

  const email =
    document
      .getElementById("email")
      .value
      .trim();

  const password =
    document
      .getElementById("password")
      .value;

  const button =
    document.getElementById("loginButton");

  const message =
    document.getElementById("loginMessage");

  message.innerHTML = "";

  button.disabled = true;
  button.textContent = "登入中...";

  const {
    data,
    error
  } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    message.innerHTML = `
      <div class="message message-error">
        登入失敗，請確認帳號或密碼。
      </div>
    `;

    button.disabled = false;
    button.textContent = "登入系統";

    return;
  }

  await startApp(data.user);
}

async function startApp(user) {
  const {
    data: profile,
    error
  } = await supabase
    .from("profiles")
    .select(`
      id,
      display_name,
      role,
      is_active,
      default_receipt_width
    `)
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    app.innerHTML = `
      <main class="login-page">

        <section class="login-card">

          <div class="message message-error">
            找不到此帳號的 profiles 資料。
          </div>

        </section>

      </main>
    `;

    return;
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();

    app.innerHTML = `
      <main class="login-page">

        <section class="login-card">

          <div class="message message-error">
            此帳號已停用。
          </div>

        </section>

      </main>
    `;

    return;
  }

  currentUser = user;
  currentProfile = profile;

  selectedReceiptWidth =
    Number(profile.default_receipt_width) === 58
      ? 58
      : 80;

  await loadStaff();

  currentPage = "workbench";
  selectedOrderId = null;

  await renderApp();
}

async function logout() {
  await supabase.auth.signOut();

  showLogin();
}

/* =========================================================
   STAFF

init();

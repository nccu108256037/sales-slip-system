import { supabase } from "./lib/supabase.js";

const app = document.getElementById("app");

async function init() {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    await showLoggedIn(user);
  } else {
    showLogin();
  }
}

function showLogin() {
  app.innerHTML = `
    <main style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#f4f7f6;
      padding:20px;
      font-family:Arial,'Microsoft JhengHei',sans-serif;
    ">

      <section style="
        width:100%;
        max-width:420px;
        background:white;
        padding:32px;
        border-radius:20px;
        box-shadow:0 15px 50px rgba(0,0,0,.08);
      ">

        <div style="text-align:center;margin-bottom:28px;">

          <div style="
            display:inline-block;
            padding:6px 12px;
            background:#e4f3f0;
            color:#0f766e;
            border-radius:999px;
            font-size:13px;
            font-weight:bold;
            margin-bottom:14px;
          ">
            神隊友 × 好貨倉
          </div>

          <h1 style="
            margin:0 0 8px;
            font-size:26px;
          ">
            銷貨配送管理系統
          </h1>

          <div style="color:#777;">
            員工／管理員登入
          </div>

        </div>

        <form id="loginForm">

          <label style="
            display:block;
            margin-bottom:18px;
          ">

            <div style="
              font-weight:bold;
              margin-bottom:7px;
            ">
              Email
            </div>

            <input
              id="email"
              type="email"
              required
              autocomplete="username"
              placeholder="請輸入 Email"
              style="
                width:100%;
                box-sizing:border-box;
                padding:14px;
                border:1px solid #d8e0de;
                border-radius:10px;
                font-size:16px;
              "
            >

          </label>

          <label style="
            display:block;
            margin-bottom:18px;
          ">

            <div style="
              font-weight:bold;
              margin-bottom:7px;
            ">
              密碼
            </div>

            <input
              id="password"
              type="password"
              required
              autocomplete="current-password"
              placeholder="請輸入密碼"
              style="
                width:100%;
                box-sizing:border-box;
                padding:14px;
                border:1px solid #d8e0de;
                border-radius:10px;
                font-size:16px;
              "
            >

          </label>

          <div
            id="message"
            style="
              min-height:22px;
              color:#c62828;
              margin-bottom:10px;
              font-size:14px;
            "
          ></div>

          <button
            id="loginButton"
            type="submit"
            style="
              width:100%;
              padding:14px;
              border:0;
              border-radius:10px;
              background:#0f766e;
              color:white;
              font-size:16px;
              font-weight:bold;
              cursor:pointer;
            "
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
    document.getElementById("email").value.trim();

  const password =
    document.getElementById("password").value;

  const button =
    document.getElementById("loginButton");

  const message =
    document.getElementById("message");

  message.textContent = "";

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
    message.textContent =
      "登入失敗，請確認帳號或密碼。";

    button.disabled = false;
    button.textContent = "登入系統";

    return;
  }

  await showLoggedIn(data.user);
}

async function showLoggedIn(user) {
  const {
    data: profile,
    error
  } = await supabase
    .from("profiles")
    .select(
      "id, display_name, role, is_active, default_receipt_width"
    )
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    app.innerHTML = `
      <div style="
        padding:40px;
        font-family:Arial,'Microsoft JhengHei',sans-serif;
      ">
        找不到此帳號的 profiles 資料。
      </div>
    `;
    return;
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();

    app.innerHTML = `
      <div style="
        padding:40px;
        font-family:Arial,'Microsoft JhengHei',sans-serif;
      ">
        此帳號已停用。
      </div>
    `;

    return;
  }

  const roleName =
    profile.role === "owner"
      ? "老闆"
      : profile.role === "admin"
      ? "管理員"
      : "員工";

  app.innerHTML = `
    <main style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#f4f7f6;
      padding:20px;
      font-family:Arial,'Microsoft JhengHei',sans-serif;
    ">

      <section style="
        width:100%;
        max-width:420px;
        background:white;
        padding:32px;
        border-radius:20px;
        box-shadow:0 15px 50px rgba(0,0,0,.08);
        text-align:center;
      ">

        <div style="
          color:#0f766e;
          font-weight:bold;
          margin-bottom:12px;
        ">
          登入成功
        </div>

        <h1 style="
          margin:0 0 8px;
        ">
          ${escapeHtml(profile.display_name)}
        </h1>

        <div style="
          color:#666;
          margin-bottom:24px;
        ">
          ${roleName}
        </div>

        <div style="
          background:#edf8f5;
          color:#0f766e;
          padding:14px;
          border-radius:10px;
          margin-bottom:20px;
          font-weight:bold;
        ">
          Supabase 已成功連線
        </div>

        <button
          id="logoutButton"
          style="
            width:100%;
            padding:14px;
            border:0;
            border-radius:10px;
            background:#222;
            color:white;
            font-size:16px;
            font-weight:bold;
            cursor:pointer;
          "
        >
          登出
        </button>

      </section>

    </main>
  `;

  document
    .getElementById("logoutButton")
    .addEventListener("click", logout);
}

async function logout() {
  await supabase.auth.signOut();
  showLogin();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    showLogin();
  }
});

init();

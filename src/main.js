import { supabase } from "./lib/supabase.js";
import "./styles/main.css";

const app = document.getElementById("app");

/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;
let currentProfile = null;
let staff = [];

let currentPage = "workbench";
let itemCounter = 0;

let selectedOrderId = null;
let selectedReceiptWidth = 80;
let selectedOrderDate = taiwanToday();

/* =========================================================
   INIT
========================================================= */

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
========================================================= */

function showLogin() {
  currentUser = null;
  currentProfile = null;
  staff = [];

  selectedOrderId = null;

  app.innerHTML = `
    <main class="login-page">

      <section class="login-card">

        <div class="login-brand">

          <div class="brand-badge">
            神隊友 × 好貨倉
          </div>

          <h1>
            銷貨配送管理系統
          </h1>

          <p>
            員工／管理員登入
          </p>

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
========================================================= */

async function loadStaff() {
  const {
    data,
    error
  } = await supabase
    .from("profiles")
    .select(`
      id,
      display_name,
      role,
      is_active
    `)
    .order("display_name");

  if (error) {
    console.error(error);

    staff = [];

    return;
  }

  staff = data || [];
}

function activeStaff() {
  return staff.filter(
    person =>
      person.is_active === true
  );
}

function staffName(id) {
  if (!id) {
    return "尚未指派";
  }

  return (
    staff.find(
      person =>
        person.id === id
    )?.display_name
    ||
    "未知人員"
  );
}

/* =========================================================
   APP SHELL
========================================================= */

async function renderApp() {
  app.innerHTML = `
    <div class="app-shell">

      <header class="topbar">

        <div class="topbar-inner">

          <div>

            <div class="topbar-brand">
              神隊友 × 好貨倉
            </div>

            <div
              class="topbar-title"
              id="pageHeaderTitle"
            >
              工作台
            </div>

          </div>

          <div class="user-chip">
            ${escapeHtml(
              currentProfile.display_name
            )}
          </div>

        </div>

      </header>

      <main
        class="page"
        id="pageContent"
      ></main>

      ${renderBottomNav()}

    </div>
  `;

  bindNavigation();

  await renderCurrentPage();
}

function renderBottomNav() {
  return `
    <nav class="bottom-nav">

      ${navButton(
        "workbench",
        "⌂",
        "工作台"
      )}

      ${navButton(
        "new-order",
        "＋",
        "新增訂單",
        true
      )}

      ${navButton(
        "today-orders",
        "▤",
        "今日訂單"
      )}

      ${navButton(
        "deliveries",
        "▣",
        "待配送"
      )}

      ${navButton(
        "my",
        "●",
        "我的"
      )}

    </nav>
  `;
}

function navButton(
  page,
  icon,
  label,
  special = false
) {
  const active =
    currentPage === page;

  return `
    <button
      class="
        nav-button
        ${active ? "active" : ""}
        ${special ? "new-order" : ""}
      "
      data-page="${page}"
      type="button"
    >

      <span class="nav-icon">
        ${icon}
      </span>

      <span>
        ${label}
      </span>

    </button>
  `;
}

function bindNavigation() {
  document
    .querySelectorAll("[data-page]")
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          selectedOrderId = null;

          currentPage =
            button.dataset.page;

          await renderApp();

        }
      );

    });
}

async function renderCurrentPage() {
  switch (currentPage) {

    case "new-order":
      setPageTitle("新增訂單");
      renderNewOrder();
      break;

    case "today-orders":
      setPageTitle("今日訂單");
      await renderTodayOrders();
      break;

    case "order-detail":
      setPageTitle("訂單詳情");
      await renderOrderDetail();
      break;

    case "deliveries":
      setPageTitle("今日待配送");
      await renderDeliveries();
      break;

    case "my":
      setPageTitle("我的");
      renderMyPage();
      break;

    default:
      setPageTitle("工作台");
      await renderWorkbench();
      break;
  }
}

function setPageTitle(title) {
  const el =
    document.getElementById(
      "pageHeaderTitle"
    );

  if (el) {
    el.textContent = title;
  }
}

/* =========================================================
   WORKBENCH
========================================================= */

async function renderWorkbench() {
  const content =
    document.getElementById(
      "pageContent"
    );

  content.innerHTML = `
    <div class="empty">
      載入今日資料中...
    </div>
  `;

  const today = taiwanToday();

  const {
    data,
    error
  } = await supabase
    .from("orders")
    .select(`
      id,
      receivable,
      entered_by,
      order_taker_id,
      delivery_person_id,
      delivery_status,
      status
    `)
    .eq("business_date", today)
    .eq("status", "active");

  if (error) {
    console.error(error);

    content.innerHTML = `
      <div class="message message-error">
        今日資料讀取失敗。
      </div>
    `;

    return;
  }

  const orders =
    data || [];

  const myOrders =
    orders.filter(
      order =>
        order.order_taker_id
        === currentUser.id
    ).length;

  const myDeliveries =
    orders.filter(
      order =>
        order.delivery_person_id
          === currentUser.id
        &&
        order.delivery_status
          !== "completed"
    ).length;

  const unassigned =
    orders.filter(
      order =>
        !order.delivery_person_id
        &&
        order.delivery_status
          !== "completed"
    ).length;

  const enteredByMe =
    orders.filter(
      order =>
        order.entered_by
          === currentUser.id
    ).length;

  const total =
    orders.reduce(
      (sum, order) =>
        sum +
        Number(
          order.receivable || 0
        ),
      0
    );

  const managerStats =
    isManager()
      ? `
        <div class="stat-card">

          <div class="stat-label">
            今日接單金額
          </div>

          <div class="stat-number money">
            ${money(total)}
          </div>

        </div>
      `
      : "";

  content.innerHTML = `
    <div class="page-title">

      <h1>
        ${getGreeting()}，
        ${escapeHtml(
          currentProfile.display_name
        )}
      </h1>

      <p>
        ${formatTodayChinese()}
      </p>

    </div>

    <div class="stats-grid">

      <div class="stat-card">

        <div class="stat-label">
          我的接單
        </div>

        <div class="stat-number">
          ${myOrders}
        </div>

      </div>

      <div class="stat-card">

        <div class="stat-label">
          我的待配送
        </div>

        <div class="stat-number">
          ${myDeliveries}
        </div>

      </div>

      <div class="stat-card">

        <div class="stat-label">
          未分配配送
        </div>

        <div class="stat-number">
          ${unassigned}
        </div>

      </div>

      <div class="stat-card">

        <div class="stat-label">
          我今日登單
        </div>

        <div class="stat-number">
          ${enteredByMe}
        </div>

      </div>

      ${managerStats}

    </div>

    <div class="card">

      <div class="card-title">
        快速開始
      </div>

      <button
        class="btn btn-primary btn-block"
        id="quickNewOrder"
        type="button"
      >
        ＋ 新增訂單
      </button>

    </div>
  `;

  document
    .getElementById(
      "quickNewOrder"
    )
    .addEventListener(
      "click",
      async () => {

        currentPage =
          "new-order";

        await renderApp();

      }
    );
}

/* =========================================================
   NEW ORDER
========================================================= */

function renderNewOrder() {
  itemCounter = 0;

  const content =
    document.getElementById(
      "pageContent"
    );

  const today =
    taiwanToday();

  content.innerHTML = `
    <div class="page-title">

      <h1>
        新增訂單
      </h1>

      <p>
        建立後會直接儲存至公司系統
      </p>

    </div>

    <div id="orderMessage"></div>

    <form id="newOrderForm">

      <section class="card">

        <div class="card-title">
          店家資料
        </div>

        <div class="form-grid">

          <label class="field">

            <span class="field-label">
              品牌
            </span>

            <select id="brand">

              <option value="teammate">
                神隊友
              </option>

              <option value="warehouse">
                好貨倉
              </option>

            </select>

          </label>

          <label class="field">

            <span class="field-label">
              訂單日期
            </span>

            <input
              id="businessDate"
              type="date"
              value="${today}"
              required
            >

          </label>

          <label class="field full">

            <span class="field-label">
              店家名稱 *
            </span>

            <input
              id="customerName"
              type="text"
              placeholder="例如：熊霸便當製所"
              required
            >

          </label>

          <label class="field">

            <span class="field-label">
              聯絡電話
            </span>

            <input
              id="customerPhone"
              type="tel"
              placeholder="可留空"
            >

          </label>

          <label class="field">

            <span class="field-label">
              店家地址
            </span>

            <input
              id="customerAddress"
              type="text"
              placeholder="可留空"
            >

          </label>

        </div>

      </section>

      <section class="card">

        <div class="section-title">

          <h2>
            商品明細
          </h2>

          <button
            id="addItemButton"
            type="button"
            class="btn btn-secondary"
          >
            ＋ 新增品項
          </button>

        </div>

        <div id="itemsContainer"></div>

        <div class="total-box">

          <div class="total-row">

            <div>

              <div class="total-label">
                應收現金
              </div>

              <div
                class="total-value"
                id="orderTotal"
              >
                $0
              </div>

            </div>

            <div id="totalQuantity">
              0 件
            </div>

          </div>

        </div>

      </section>

      <section class="card">

        <div class="card-title">
          配送安排
        </div>

        <div class="form-grid">

          <label class="field">

            <span class="field-label">
              預計配送日期 *
            </span>

            <input
              id="deliveryDate"
              type="date"
              value="${today}"
              required
            >

          </label>

          <label class="field">

            <span class="field-label">
              配送時段 *
            </span>

            <select id="deliverySlot">

              <option value="morning">
                上午
              </option>

              <option
                value="afternoon"
                selected
              >
                下午
              </option>

              <option value="evening">
                晚上
              </option>

              <option value="specific">
                指定時間
              </option>

              <option value="anytime">
                不限時段
              </option>

            </select>

          </label>

          <label
            class="field full"
            id="deliveryTimeField"
            style="display:none;"
          >

            <span class="field-label">
              指定配送時間 *
            </span>

            <input
              id="deliveryTime"
              type="time"
            >

          </label>

          ${renderAssignmentFields()}

          <label class="field full">

            <span class="field-label">
              銷貨單備註
            </span>

            <textarea
              id="receiptNote"
              placeholder="這裡會印在銷貨單上"
            ></textarea>

          </label>

          <label class="field full">

            <span class="field-label">
              配送內部備註
            </span>

            <textarea
              id="internalNote"
              placeholder="只有公司內部看得到"
            ></textarea>

          </label>

        </div>

      </section>

      <div class="form-actions">

        <button
          id="saveOrderButton"
          type="submit"
          class="btn btn-primary btn-block"
        >
          儲存訂單
        </button>

      </div>

    </form>
  `;

  addItemRow();

  document
    .getElementById(
      "addItemButton"
    )
    .addEventListener(
      "click",
      addItemRow
    );

  document
    .getElementById(
      "deliverySlot"
    )
    .addEventListener(
      "change",
      toggleDeliveryTime
    );

  document
    .getElementById(
      "newOrderForm"
    )
    .addEventListener(
      "submit",
      submitOrder
    );
}

function renderAssignmentFields() {
  if (isManager()) {
    const options =
      activeStaff()
        .map(person => `
          <option value="${person.id}">
            ${escapeHtml(
              person.display_name
            )}
          </option>
        `)
        .join("");

    return `
      <label class="field">

        <span class="field-label">
          接單人員
        </span>

        <select id="orderTaker">

          <option value="">
            尚未指派
          </option>

          ${options}

        </select>

      </label>

      <label class="field">

        <span class="field-label">
          配送人員
        </span>

        <select id="deliveryPerson">

          <option value="">
            尚未指派
          </option>

          ${options}

        </select>

      </label>
    `;
  }

  return `
    <div class="field full">

      <span class="field-label">
        任務負責
      </span>

      <div class="checkbox-row">

        <label class="check-option">

          <input
            id="selfOrderTaker"
            type="checkbox"
          >

          我負責接單

        </label>

        <label class="check-option">

          <input
            id="selfDelivery"
            type="checkbox"
          >

          我負責配送

        </label>

      </div>

    </div>
  `;
}

function addItemRow() {
  itemCounter += 1;

  const container =
    document.getElementById(
      "itemsContainer"
    );

  const card =
    document.createElement(
      "div"
    );

  card.className =
    "item-card";

  card.dataset.itemId =
    String(itemCounter);

  card.innerHTML = `
    <div class="item-top">

      <div class="item-number">
        品項
      </div>

      <button
        type="button"
        class="
          btn
          btn-danger-soft
          remove-item
        "
      >
        刪除
      </button>

    </div>

    <div class="item-grid">

      <label
        class="
          field
          item-name-field
        "
      >

        <span class="field-label">
          品名
        </span>

        <input
          class="item-name"
          type="text"
          placeholder="商品名稱"
          required
        >

      </label>

      <label class="field">

        <span class="field-label">
          數量
        </span>

        <input
          class="item-qty"
          type="number"
          min="0.01"
          step="0.01"
          value="1"
          required
        >

      </label>

      <label class="field">

        <span class="field-label">
          單價
        </span>

        <input
          class="item-price"
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
          required
        >

      </label>

    </div>

    <div class="item-amount">

      金額：

      <span class="item-total">
        $0
      </span>

    </div>
  `;

  container.appendChild(card);

  card
    .querySelector(
      ".item-qty"
    )
    .addEventListener(
      "input",
      calculateTotals
    );

  card
    .querySelector(
      ".item-price"
    )
    .addEventListener(
      "input",
      calculateTotals
    );

  card
    .querySelector(
      ".remove-item"
    )
    .addEventListener(
      "click",
      () => {

        const allItems =
          document.querySelectorAll(
            ".item-card"
          );

        if (
          allItems.length <= 1
        ) {
          return;
        }

        card.remove();

        renumberItems();

        calculateTotals();

      }
    );

  renumberItems();
  calculateTotals();
}

function renumberItems() {
  document
    .querySelectorAll(
      ".item-card"
    )
    .forEach(
      (card, index) => {

        card
          .querySelector(
            ".item-number"
          )
          .textContent =
            `品項 ${index + 1}`;

      }
    );
}

function calculateTotals() {
  let total = 0;
  let quantityTotal = 0;

  document
    .querySelectorAll(
      ".item-card"
    )
    .forEach(card => {

      const quantity =
        Number(
          card
            .querySelector(
              ".item-qty"
            )
            .value
        ) || 0;

      const price =
        Number(
          card
            .querySelector(
              ".item-price"
            )
            .value
        ) || 0;

      const amount =
        quantity * price;

      quantityTotal +=
        quantity;

      total +=
        amount;

      card
        .querySelector(
          ".item-total"
        )
        .textContent =
          money(amount);

    });

  document
    .getElementById(
      "orderTotal"
    )
    .textContent =
      money(total);

  document
    .getElementById(
      "totalQuantity"
    )
    .textContent =
      `${formatNumber(
        quantityTotal
      )} 件`;
}

function toggleDeliveryTime() {
  const slot =
    document.getElementById(
      "deliverySlot"
    ).value;

  const field =
    document.getElementById(
      "deliveryTimeField"
    );

  const input =
    document.getElementById(
      "deliveryTime"
    );

  if (
    slot === "specific"
  ) {
    field.style.display = "";
    input.required = true;
  } else {
    field.style.display =
      "none";

    input.required = false;
    input.value = "";
  }
}

async function submitOrder(event) {
  event.preventDefault();

  const button =
    document.getElementById(
      "saveOrderButton"
    );

  const message =
    document.getElementById(
      "orderMessage"
    );

  message.innerHTML = "";

  const items =
    [
      ...document.querySelectorAll(
        ".item-card"
      )
    ]
      .map(card => ({
        item_name:
          card
            .querySelector(
              ".item-name"
            )
            .value
            .trim(),

        quantity:
          Number(
            card
              .querySelector(
                ".item-qty"
              )
              .value
          ),

        unit_price:
          Number(
            card
              .querySelector(
                ".item-price"
              )
              .value
          )
      }));

  if (
    items.some(
      item =>
        !item.item_name
        ||
        !item.quantity
        ||
        item.quantity <= 0
        ||
        Number.isNaN(
          item.unit_price
        )
        ||
        item.unit_price < 0
    )
  ) {
    message.innerHTML = `
      <div class="message message-error">
        請檢查所有商品的品名、數量與單價。
      </div>
    `;

    return;
  }

  let orderTakerId =
    null;

  let deliveryPersonId =
    null;

  if (isManager()) {
    orderTakerId =
      document
        .getElementById(
          "orderTaker"
        )
        .value
      ||
      null;

    deliveryPersonId =
      document
        .getElementById(
          "deliveryPerson"
        )
        .value
      ||
      null;
  } else {
    if (
      document.getElementById(
        "selfOrderTaker"
      ).checked
    ) {
      orderTakerId =
        currentUser.id;
    }

    if (
      document.getElementById(
        "selfDelivery"
      ).checked
    ) {
      deliveryPersonId =
        currentUser.id;
    }
  }

  const deliverySlot =
    document.getElementById(
      "deliverySlot"
    ).value;

  const deliveryTime =
    deliverySlot === "specific"
      ? (
          document
            .getElementById(
              "deliveryTime"
            )
            .value
          ||
          null
        )
      : null;

  const payload = {
    p_brand:
      document.getElementById(
        "brand"
      ).value,

    p_business_date:
      document.getElementById(
        "businessDate"
      ).value,

    p_customer_name:
      document
        .getElementById(
          "customerName"
        )
        .value
        .trim(),

    p_customer_phone:
      document
        .getElementById(
          "customerPhone"
        )
        .value
        .trim()
      ||
      null,

    p_customer_address:
      document
        .getElementById(
          "customerAddress"
        )
        .value
        .trim()
      ||
      null,

    p_receipt_note:
      document
        .getElementById(
          "receiptNote"
        )
        .value
        .trim()
      ||
      null,

    p_internal_delivery_note:
      document
        .getElementById(
          "internalNote"
        )
        .value
        .trim()
      ||
      null,

    p_scheduled_delivery_date:
      document.getElementById(
        "deliveryDate"
      ).value,

    p_delivery_slot:
      deliverySlot,

    p_scheduled_delivery_time:
      deliveryTime,

    p_order_taker_id:
      orderTakerId,

    p_delivery_person_id:
      deliveryPersonId,

    p_items:
      items
  };

  button.disabled = true;
  button.textContent =
    "儲存中...";

  const {
    data,
    error
  } = await supabase.rpc(
    "create_order",
    payload
  );

  if (error) {
    console.error(error);

    message.innerHTML = `
      <div class="message message-error">

        建立訂單失敗：

        ${escapeHtml(
          error.message
        )}

      </div>
    `;

    button.disabled = false;
    button.textContent =
      "儲存訂單";

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    return;
  }

  const result =
    Array.isArray(data)
      ? data[0]
      : data;

  message.innerHTML = `
    <div class="message message-success">

      訂單建立成功！

      <br>

      單號：

      <strong>
        ${escapeHtml(
          result?.new_order_number
          ||
          ""
        )}
      </strong>

      <br>

      金額：

      <strong>
        ${money(
          result?.new_total
          ||
          0
        )}
      </strong>

    </div>
  `;

  button.disabled = false;
  button.textContent =
    "儲存訂單";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  setTimeout(
    async () => {

      currentPage =
        "today-orders";

      await renderApp();

    },
    1000
  );
}

/* =========================================================
   TODAY ORDERS
========================================================= */

async function renderTodayOrders() {
  const content =
    document.getElementById(
      "pageContent"
    );

  content.innerHTML = `
    <div class="empty">
      讀取今日訂單...
    </div>
  `;

  const {
    data,
    error
  } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      brand,
      customer_name,
      receivable,
      entered_by,
      order_taker_id,
      delivery_person_id,
      delivery_status,
      scheduled_delivery_date,
      scheduled_delivery_time,
      delivery_slot,
      created_at,
      status,
      first_issued_at,
      first_issued_by,
      receipt_revision
    `)
    .eq(
      "business_date",
      taiwanToday()
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );

  if (error) {
    console.error(error);

    content.innerHTML = `
      <div class="message message-error">
        今日訂單讀取失敗。
      </div>
    `;

    return;
  }

  const orders =
    (data || [])
      .filter(
        order =>
          order.status
          !== "voided"
      );

  content.innerHTML = `
    <div class="page-title">

      <h1>
        今日訂單
      </h1>

      <p>
        共 ${orders.length} 張
      </p>

    </div>

    ${
      orders.length
        ? orders
            .map(
              renderOrderCard
            )
            .join("")
        : `
          <div class="card empty">
            今天還沒有訂單。
          </div>
        `
    }
  `;

  bindTodayOrderButtons();
}

function renderOrderCard(order) {
  const printStatus =
    order.first_issued_at
      ? `
        <span class="status status-completed">
          已出單
        </span>
      `
      : `
        <span class="status status-pending">
          未出單
        </span>
      `;

  const employeePrintLocked =
    Boolean(
      order.first_issued_at
    )
    &&
    !isManager();

  return `
    <article class="order-card">

      <div class="order-head">

        <div>

          <div class="order-store">
            ${escapeHtml(
              order.customer_name
            )}
          </div>

          <div class="order-number">
            ${escapeHtml(
              order.order_number
            )}
          </div>

        </div>

        <div class="order-price">
          ${money(
            order.receivable
          )}
        </div>

      </div>

      <div class="order-meta">

        <div>
          品牌：
          ${
            order.brand
              === "teammate"
              ? "神隊友"
              : "好貨倉"
          }
        </div>

        <div>
          登單：
          ${escapeHtml(
            staffName(
              order.entered_by
            )
          )}
        </div>

        <div>
          接單：
          ${escapeHtml(
            staffName(
              order.order_taker_id
            )
          )}
        </div>

        <div>
          配送：
          ${escapeHtml(
            staffName(
              order.delivery_person_id
            )
          )}
        </div>

        <div>
          預計：
          ${escapeHtml(
            deliveryDateLabel(
              order
            )
          )}
        </div>

        <div class="status-row">

          ${deliveryStatusBadge(
            order.delivery_status
          )}

          ${printStatus}

        </div>

      </div>

      <div class="order-actions">

        <button
          type="button"
          class="
            btn
            btn-secondary
            view-order-button
          "
          data-order-id="${order.id}"
        >
          查看訂單
        </button>

        <button
          type="button"
          class="
            btn
            ${
              employeePrintLocked
                ? "btn-secondary"
                : "btn-primary"
            }
            print-order-button
          "
          data-order-id="${order.id}"
          ${
            employeePrintLocked
              ? "disabled"
              : ""
          }
        >
          ${
            order.first_issued_at
              ? (
                  isManager()
                    ? "再次出單"
                    : "已出單"
                )
              : "出單收據"
          }
        </button>

      </div>

    </article>
  `;
}

function bindTodayOrderButtons() {
  document
    .querySelectorAll(
      ".view-order-button"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          selectedOrderId =
            button.dataset.orderId;

          currentPage =
            "order-detail";

          await renderApp();

        }
      );

    });

  document
    .querySelectorAll(
      ".print-order-button:not(:disabled)"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          selectedOrderId =
            button.dataset.orderId;

          currentPage =
            "order-detail";

          await renderApp();

        }
      );

    });
}

/* =========================================================
   ORDER DETAIL
========================================================= */

async function renderOrderDetail() {
  const content =
    document.getElementById(
      "pageContent"
    );

  if (!selectedOrderId) {
    currentPage =
      "today-orders";

    await renderApp();

    return;
  }

  content.innerHTML = `
    <div class="empty">
      讀取訂單資料...
    </div>
  `;

  const {
    data: order,
    error: orderError
  } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      brand,
      business_date,
      customer_name,
      customer_phone,
      customer_address,
      subtotal,
      receivable,
      receipt_note,
      internal_delivery_note,
      entered_by,
      order_taker_id,
      delivery_person_id,
      scheduled_delivery_date,
      delivery_slot,
      scheduled_delivery_time,
      delivery_status,
      receipt_revision,
      first_issued_at,
      first_issued_by,
      status,
      created_at
    `)
    .eq(
      "id",
      selectedOrderId
    )
    .single();

  if (
    orderError
    ||
    !order
  ) {
    console.error(
      orderError
    );

    content.innerHTML = `
      <div class="message message-error">
        找不到這張訂單。
      </div>
    `;

    return;
  }

  const {
    data: items,
    error: itemError
  } = await supabase
    .from("order_items")
    .select(`
      id,
      item_index,
      item_name,
      quantity,
      unit_price,
      amount
    `)
    .eq(
      "order_id",
      selectedOrderId
    )
    .order(
      "item_index",
      {
        ascending: true
      }
    );

  if (itemError) {
    console.error(
      itemError
    );

    content.innerHTML = `
      <div class="message message-error">
        訂單品項讀取失敗。
      </div>
    `;

    return;
  }

  const receiptStatus =
    order.first_issued_at
      ? `
        <span class="status status-completed">
          已出單
        </span>
      `
      : `
        <span class="status status-pending">
          未出單
        </span>
      `;

  content.innerHTML = `
    <div class="page-title">

      <h1>
        ${escapeHtml(
          order.customer_name
        )}
      </h1>

      <p>
        單號：
        ${escapeHtml(
          order.order_number
        )}
      </p>

    </div>

    <section class="card">

      <div class="order-detail-head">

        <div>
          ${receiptStatus}
        </div>

        <div class="order-price">
          ${money(
            order.receivable
          )}
        </div>

      </div>

      <div class="detail-grid">

        <div>

          <span>
            品牌
          </span>

          <strong>
            ${
              order.brand
                === "teammate"
                ? "神隊友"
                : "好貨倉"
            }
          </strong>

        </div>

        <div>

          <span>
            訂單日期
          </span>

          <strong>
            ${escapeHtml(
              order.business_date
            )}
          </strong>

        </div>

        <div>

          <span>
            登單人員
          </span>

          <strong>
            ${escapeHtml(
              staffName(
                order.entered_by
              )
            )}
          </strong>

        </div>

        <div>

          <span>
            接單人員
          </span>

          <strong>
            ${escapeHtml(
              staffName(
                order.order_taker_id
              )
            )}
          </strong>

        </div>

        <div>

          <span>
            配送人員
          </span>

          <strong>
            ${escapeHtml(
              staffName(
                order.delivery_person_id
              )
            )}
          </strong>

        </div>

        <div>

          <span>
            配送時間
          </span>

          <strong>
            ${escapeHtml(
              deliveryDateLabel(
                order
              )
            )}
          </strong>

        </div>

      </div>

      ${
        order.first_issued_at
          ? `
            <div class="issue-info">

              已由
              <strong>
                ${escapeHtml(
                  staffName(
                    order.first_issued_by
                  )
                )}
              </strong>
              出單

              <br>

              ${formatDateTime(
                order.first_issued_at
              )}

            </div>
          `
          : ""
      }

    </section>

    <section class="card">

      <div class="card-title">
        電子銷貨單預覽
      </div>

      <div class="receipt-width-switch">

        <button
          type="button"
          class="
            receipt-width-button
            ${
              selectedReceiptWidth
                === 58
                ? "active"
                : ""
            }
          "
          data-width="58"
        >
          58mm
        </button>

        <button
          type="button"
          class="
            receipt-width-button
            ${
              selectedReceiptWidth
                === 80
                ? "active"
                : ""
            }
          "
          data-width="80"
        >
          80mm
        </button>

      </div>

      <div class="receipt-preview-shell">

        ${buildReceiptMarkup(
          order,
          items || [],
          selectedReceiptWidth
        )}

      </div>

      ${buildPrintControls(
        order
      )}

    </section>

    <button
      type="button"
      id="backToOrders"
      class="
        btn
        btn-secondary
        btn-block
      "
    >
      ← 返回今日訂單
    </button>
  `;

  document
    .querySelectorAll(
      ".receipt-width-button"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          selectedReceiptWidth =
            Number(
              button.dataset.width
            );

          await renderOrderDetail();

        }
      );

    });

  const printButton =
    document.getElementById(
      "confirmPrintButton"
    );

  if (printButton) {
    printButton.addEventListener(
      "click",
      async () => {

        await printReceipt(
          order,
          items || []
        );

      }
    );
  }

  document
    .getElementById(
      "backToOrders"
    )
    .addEventListener(
      "click",
      async () => {

        selectedOrderId =
          null;

        currentPage =
          "today-orders";

        await renderApp();

      }
    );
}

/* =========================================================
   PRINT CONTROLS
========================================================= */

function buildPrintControls(order) {
  if (
    order.first_issued_at
    &&
    !isManager()
  ) {
    return `
      <div class="print-locked-box">

        <strong>
          此訂單已出單
        </strong>

        <div>
          出單人：
          ${escapeHtml(
            staffName(
              order.first_issued_by
            )
          )}
        </div>

        <div>
          一般員工無法再次出單。
        </div>

      </div>
    `;
  }

  const reprint =
    Boolean(
      order.first_issued_at
    );

  return `
    ${
      reprint
        ? `
          <label class="
            field
            print-reason-field
          ">

            <span class="field-label">
              再次出單原因 *
            </span>

            <select id="reprintReason">

              <option value="">
                請選擇原因
              </option>

              <option value="印表機卡紙">
                印表機卡紙
              </option>

              <option value="印字不清楚">
                印字不清楚
              </option>

              <option value="客戶要求補單">
                客戶要求補單
              </option>

              <option value="訂單修改後重印">
                訂單修改後重印
              </option>

              <option value="其他">
                其他
              </option>

            </select>

          </label>
        `
        : `
          <div class="print-warning">

            <strong>
              首次出單請先確認
            </strong>

            <div>
              印表機已連線、紙張已裝好，
              並確認目前使用
              ${selectedReceiptWidth}mm。
            </div>

            ${
              !isManager()
                ? `
                  <div style="margin-top:6px;">
                    一般員工每張訂單只有一次出單機會。
                  </div>
                `
                : ""
            }

          </div>
        `
    }

    <button
      id="confirmPrintButton"
      type="button"
      class="
        btn
        btn-primary
        btn-block
        print-main-button
      "
    >
      ${
        reprint
          ? "確認再次出單"
          : "確認並出單"
      }
      ・
      ${selectedReceiptWidth}mm
    </button>
  `;
}

/* =========================================================
   AUTHORIZE + PRINT
========================================================= */

async function printReceipt(
  order,
  items
) {
  let reason =
    null;

  if (
    order.first_issued_at
  ) {
    const reasonSelect =
      document.getElementById(
        "reprintReason"
      );

    reason =
      reasonSelect?.value
      ||
      null;

    if (!reason) {
      alert(
        "請先選擇再次出單原因。"
      );

      return;
    }
  }

  const confirmed =
    window.confirm(
      order.first_issued_at
        ? `確認再次出單？\n紙寬：${selectedReceiptWidth}mm`
        : `確認正式出單？\n紙寬：${selectedReceiptWidth}mm\n\n確認後系統會記錄為已出單。`
    );

  if (!confirmed) {
    return;
  }

  /*
    必須先同步開新視窗，
    避免 iPhone / Safari
    因為 RPC await 而阻擋 popup。
  */
  const printWindow =
    window.open(
      "",
      "_blank"
    );

  if (!printWindow) {
    alert(
      "瀏覽器阻擋了列印視窗，請允許此網站開啟彈出視窗。"
    );

    return;
  }

  printWindow.document.open();

  printWindow.document.write(`
    <!doctype html>

    <html lang="zh-Hant-TW">

      <head>
        <meta charset="UTF-8">
        <title>準備出單</title>
      </head>

      <body style="
        margin:0;
        padding:30px;
        font-family:
          Arial,
          'Microsoft JhengHei',
          sans-serif;
      ">

        正在確認出單權限...

      </body>

    </html>
  `);

  printWindow.document.close();

  const {
    error
  } = await supabase.rpc(
    "authorize_receipt_print",
    {
      p_order_id:
        order.id,

      p_width:
        selectedReceiptWidth,

      p_reason:
        reason
    }
  );

  if (error) {
    console.error(
      error
    );

    printWindow.close();

    alert(
      `出單失敗：${error.message}`
    );

    await renderOrderDetail();

    return;
  }

  const printHtml =
    buildPrintableDocument(
      order,
      items,
      selectedReceiptWidth
    );

  printWindow.document.open();

  printWindow.document.write(
    printHtml
  );

  printWindow.document.close();

  setTimeout(
    () => {

      try {
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        console.error(
          error
        );
      }

    },
    500
  );

  setTimeout(
    async () => {

      await renderOrderDetail();

    },
    900
  );
}

/* =========================================================
   RECEIPT
========================================================= */

function buildReceiptMarkup(
  order,
  items,
  width
) {
  const brandName =
    order.brand === "teammate"
      ? "神隊友"
      : "好貨倉";

  const slogan =
    order.brand === "teammate"
      ? "餐飲老闆們的靠山"
      : "用最實惠的批發價來挺你";

  const totalQuantity =
    items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.quantity || 0
        ),
      0
    );

  return `
    <div
      class="
        thermal-receipt
        receipt-${width}
      "
    >

      <div class="receipt-brand">
        ${escapeHtml(
          brandName
        )}
      </div>

      <div class="receipt-slogan">
        ${escapeHtml(
          slogan
        )}
      </div>

      <div class="receipt-title">
        銷貨單
      </div>

      <div class="receipt-rule"></div>

      <div class="receipt-info">

        <div>

          <span>
            單號
          </span>

          <strong>
            ${escapeHtml(
              order.order_number
            )}
          </strong>

        </div>

        <div>

          <span>
            日期
          </span>

          <strong>
            ${escapeHtml(
              order.business_date
            )}
          </strong>

        </div>

        <div>

          <span>
            店家
          </span>

          <strong>
            ${escapeHtml(
              order.customer_name
            )}
          </strong>

        </div>

        ${
          order.customer_phone
            ? `
              <div>

                <span>
                  電話
                </span>

                <strong>
                  ${escapeHtml(
                    order.customer_phone
                  )}
                </strong>

              </div>
            `
            : ""
        }

        ${
          order.customer_address
            ? `
              <div>

                <span>
                  地址
                </span>

                <strong>
                  ${escapeHtml(
                    order.customer_address
                  )}
                </strong>

              </div>
            `
            : ""
        }

      </div>

      <div class="receipt-rule"></div>

      <table class="receipt-table">

        <thead>

          <tr>

            <th class="receipt-product">
              品名
            </th>

            <th>
              數量
            </th>

            <th>
              單價
            </th>

            <th>
              金額
            </th>

          </tr>

        </thead>

        <tbody>

          ${
            items.map(
              item => `
                <tr>

                  <td class="receipt-product">
                    ${escapeHtml(
                      item.item_name
                    )}
                  </td>

                  <td>
                    ${formatNumber(
                      Number(
                        item.quantity
                      )
                    )}
                  </td>

                  <td>
                    ${formatPlainMoney(
                      item.unit_price
                    )}
                  </td>

                  <td>
                    ${formatPlainMoney(
                      item.amount
                    )}
                  </td>

                </tr>
              `
            ).join("")
          }

        </tbody>

      </table>

      <div class="receipt-rule"></div>

      <div class="receipt-summary">

        <div>

          <span>
            品項數
          </span>

          <strong>
            ${items.length}
          </strong>

        </div>

        <div>

          <span>
            數量
          </span>

          <strong>
            ${formatNumber(
              totalQuantity
            )}
          </strong>

        </div>

        <div>

          <span>
            總計
          </span>

          <strong>
            ${formatPlainMoney(
              order.subtotal
            )}
          </strong>

        </div>

      </div>

      ${
        order.receipt_note
          ? `
            <div class="receipt-rule"></div>

            <div class="receipt-note">

              <strong>
                備註：
              </strong>

              ${escapeHtml(
                order.receipt_note
              )}

            </div>
          `
          : ""
      }

      <div class="receipt-rule strong"></div>

      <div class="receipt-total">

        <span>
          應收款
        </span>

        <strong>
          ${formatPlainMoney(
            order.receivable
          )}
        </strong>

      </div>

      <div class="receipt-rule strong"></div>

      <div class="receipt-footer">

        <strong>
          感謝您的訂購！
        </strong>

        <div>
          祝您生意興隆！
        </div>

      </div>

    </div>
  `;
}

/* =========================================================
   PRINTABLE DOCUMENT
========================================================= */

function buildPrintableDocument(
  order,
  items,
  width
) {
  const receipt =
    buildReceiptMarkup(
      order,
      items,
      width
    );

  return `
<!doctype html>

<html lang="zh-Hant-TW">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="
      width=device-width,
      initial-scale=1
    "
  >

  <title>
    ${escapeHtml(
      order.order_number
    )}
  </title>

  <style>

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;

      background: #ffffff;

      color: #000000;
    }

    body {
      width: ${width}mm;

      font-family:
        "Microsoft JhengHei",
        "Noto Sans TC",
        Arial,
        sans-serif;

      -webkit-print-color-adjust:
        exact;

      print-color-adjust:
        exact;
    }

    .thermal-receipt {
      margin: 0;

      background: #ffffff;

      color: #000000;
    }

    .receipt-58 {
      width: 58mm;

      padding:
        2.5mm
        2mm;

      font-size: 10.5px;
    }

    .receipt-80 {
      width: 80mm;

      padding:
        3mm
        3mm;

      font-size: 12px;
    }

    .receipt-brand {
      text-align: center;

      font-size: 30px;

      line-height: 1.1;

      font-weight: 900;
    }

    .receipt-58
    .receipt-brand {
      font-size: 24px;
    }

    .receipt-slogan {
      margin-top: 3px;

      text-align: center;

      font-size: .92em;

      font-weight: 700;
    }

    .receipt-title {
      margin-top: 7px;

      text-align: center;

      font-size: 1.35em;

      font-weight: 900;
    }

    .receipt-rule {
      margin:
        7px
        0;

      border-top:
        1px
        dashed
        #000;
    }

    .receipt-rule.strong {
      border-top:
        2px
        solid
        #000;
    }

    .receipt-info {
      display: grid;

      gap: 3px;
    }

    .receipt-info > div {
      display: grid;

      grid-template-columns:
        38px
        1fr;

      gap: 5px;
    }

    .receipt-info span {
      white-space: nowrap;
    }

    .receipt-info strong {
      overflow-wrap: anywhere;
    }

    .receipt-table {
      width: 100%;

      border-collapse:
        collapse;

      table-layout:
        fixed;
    }

    .receipt-table th,
    .receipt-table td {
      padding:
        3px
        1px;

      text-align: right;

      vertical-align:
        top;

      word-break:
        break-word;
    }

    .receipt-table th {
      border-bottom:
        1px
        solid
        #000;

      font-weight: 900;
    }

    .receipt-table
    .receipt-product {
      width: 42%;

      text-align: left;
    }

    .receipt-58
    .receipt-table
    .receipt-product {
      width: 39%;
    }

    .receipt-summary {
      display: grid;

      gap: 3px;
    }

    .receipt-summary > div {
      display: flex;

      justify-content:
        space-between;

      gap: 8px;
    }

    .receipt-note {
      font-size: 1.08em;

      font-weight: 700;

      line-height: 1.45;

      overflow-wrap:
        anywhere;
    }

    .receipt-total {
      display: flex;

      justify-content:
        space-between;

      align-items:
        baseline;

      gap: 8px;

      padding:
        5px
        0;

      font-size: 1.35em;

      font-weight: 900;
    }

    .receipt-total strong {
      font-size: 1.45em;
    }

    .receipt-footer {
      padding-top: 5px;

      text-align: center;

      line-height: 1.55;
    }

    @page {
      margin: 0;
    }

    @media print {

      html,
      body {
        width: ${width}mm;
      }

      .thermal-receipt {
        box-shadow: none;
      }

    }

  </style>

</head>

<body>

  ${receipt}

</body>

</html>
  `;
}

/* =========================================================
   DELIVERIES
========================================================= */

async function renderDeliveries() {
  const content =
    document.getElementById(
      "pageContent"
    );

  content.innerHTML = `
    <div class="empty">
      讀取配送案件...
    </div>
  `;

  const today =
    taiwanToday();

  const {
    data,
    error
  } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      customer_name,
      customer_address,
      receivable,
      delivery_person_id,
      delivery_status,
      scheduled_delivery_date,
      delivery_slot,
      scheduled_delivery_time,
      status,
      created_at
    `)
    .eq(
      "scheduled_delivery_date",
      today
    )
    .eq(
      "status",
      "active"
    )
    .neq(
      "delivery_status",
      "completed"
    )
    .order(
      "created_at",
      {
        ascending: true
      }
    );

  if (error) {
    console.error(error);

    content.innerHTML = `
      <div class="message message-error">
        配送資料讀取失敗。
      </div>
    `;

    return;
  }

  const orders =
    data || [];

  const unassigned =
    orders.filter(
      order =>
        !order.delivery_person_id
    ).length;

  const delivering =
    orders.filter(
      order =>
        order.delivery_status
        === "delivering"
    ).length;

  content.innerHTML = `
    <div class="page-title">

      <h1>
        今日待配送
      </h1>

      <p>
        今日尚未完成的配送案件
      </p>

    </div>

    <div class="stats-grid">

      <div class="stat-card">

        <div class="stat-label">
          未分配
        </div>

        <div class="stat-number">
          ${unassigned}
        </div>

      </div>

      <div class="stat-card">

        <div class="stat-label">
          配送中
        </div>

        <div class="stat-number">
          ${delivering}
        </div>

      </div>

    </div>

    <br>

    ${
      orders.length
        ? orders
            .map(
              order => `
                <article class="order-card">

                  <div class="order-head">

                    <div>

                      <div class="order-store">
                        ${escapeHtml(
                          order.customer_name
                        )}
                      </div>

                      <div class="order-number">
                        ${escapeHtml(
                          order.order_number
                        )}
                      </div>

                    </div>

                    <div class="order-price">
                      ${money(
                        order.receivable
                      )}
                    </div>

                  </div>

                  <div class="order-meta">

                    <div>
                      配送：
                      ${escapeHtml(
                        staffName(
                          order.delivery_person_id
                        )
                      )}
                    </div>

                    <div>
                      ${escapeHtml(
                        deliveryDateLabel(
                          order
                        )
                      )}
                    </div>

                    ${
                      order.customer_address
                        ? `
                          <div>

                            地址：

                            ${escapeHtml(
                              order.customer_address
                            )}

                          </div>
                        `
                        : ""
                    }

                    <div>

                      ${deliveryStatusBadge(
                        order.delivery_status
                      )}

                    </div>

                  </div>

                </article>
              `
            )
            .join("")
        : `
          <div class="card empty">
            今天沒有待配送案件。
          </div>
        `
    }
  `;
}

/* =========================================================
   MY PAGE
========================================================= */

function renderMyPage() {
  const content =
    document.getElementById(
      "pageContent"
    );

  content.innerHTML = `
    <div class="page-title">

      <h1>
        我的
      </h1>

      <p>
        個人帳號與工作資料
      </p>

    </div>

    <section class="card">

      <div class="profile-name">
        ${escapeHtml(
          currentProfile.display_name
        )}
      </div>

      <div class="profile-role">
        ${roleLabel(
          currentProfile.role
        )}
      </div>

    </section>

    <section class="card">

      <div class="card-title">
        我的出單設定
      </div>

      <div style="
        color:var(--muted);
        line-height:1.7;
      ">

        預設紙寬：

        <strong>
          ${selectedReceiptWidth}mm
        </strong>

      </div>

    </section>

    <section class="card">

      <div class="card-title">
        我的現金
      </div>

      <p style="
        margin:0;
        color:var(--muted);
      ">
        現金收款與交回倉庫功能，
        下一階段接上。
      </p>

    </section>

    <button
      id="logoutButton"
      class="
        btn
        btn-dark
        btn-block
      "
      type="button"
    >
      登出系統
    </button>
  `;

  document
    .getElementById(
      "logoutButton"
    )
    .addEventListener(
      "click",
      logout
    );
}

/* =========================================================
   HELPERS
========================================================= */

function isManager() {
  return (
    currentProfile.role
      === "owner"
    ||
    currentProfile.role
      === "admin"
  );
}

function roleLabel(role) {
  switch (role) {

    case "owner":
      return "老闆";

    case "admin":
      return "管理員";

    default:
      return "一般員工";
  }
}

function deliveryStatusBadge(
  status
) {
  const labels = {
    pending:
      "待分配",

    assigned:
      "已指派",

    accepted:
      "已接管",

    delivering:
      "配送中",

    completed:
      "配送完成",

    partial:
      "部分完成",

    failed:
      "配送失敗"
  };

  const className =
    status === "completed"
      ? "status-completed"
      : (
          status
            === "delivering"
          ||
          status
            === "accepted"
        )
        ? "status-active"
        : "status-pending";

  return `
    <span
      class="
        status
        ${className}
      "
    >
      ${labels[status] || status}
    </span>
  `;
}

function deliveryDateLabel(
  order
) {
  const slotLabels = {
    morning:
      "上午",

    afternoon:
      "下午",

    evening:
      "晚上",

    specific:
      "指定時間",

    anytime:
      "不限時段"
  };

  let result =
    order.scheduled_delivery_date
    ||
    "";

  result +=
    ` ${
      slotLabels[
        order.delivery_slot
      ]
      ||
      ""
    }`;

  if (
    order.delivery_slot
      === "specific"
    &&
    order.scheduled_delivery_time
  ) {
    result +=
      ` ${
        String(
          order.scheduled_delivery_time
        ).slice(
          0,
          5
        )
      }`;
  }

  return result.trim();
}

function taiwanToday() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Asia/Taipei",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit"
    }
  ).format(
    new Date()
  );
}

function formatTodayChinese() {
  return new Intl.DateTimeFormat(
    "zh-TW",
    {
      timeZone:
        "Asia/Taipei",

      year:
        "numeric",

      month:
        "long",

      day:
        "numeric",

      weekday:
        "long"
    }
  ).format(
    new Date()
  );
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "zh-TW",
    {
      timeZone:
        "Asia/Taipei",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false
    }
  ).format(
    new Date(value)
  );
}

function getGreeting() {
  const hour =
    Number(
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "Asia/Taipei",

          hour:
            "2-digit",

          hour12:
            false
        }
      ).format(
        new Date()
      )
    );

  if (hour < 12) {
    return "早安";
  }

  if (hour < 18) {
    return "午安";
  }

  return "晚安";
}

function money(value) {
  const number =
    Number(
      value || 0
    );

  return new Intl.NumberFormat(
    "zh-TW",
    {
      style:
        "currency",

      currency:
        "TWD",

      maximumFractionDigits:
        0
    }
  ).format(
    number
  );
}

function formatPlainMoney(
  value
) {
  return new Intl.NumberFormat(
    "zh-TW",
    {
      maximumFractionDigits:
        2
    }
  ).format(
    Number(
      value || 0
    )
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat(
    "zh-TW",
    {
      maximumFractionDigits:
        2
    }
  ).format(
    value
  );
}

function escapeHtml(value) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

/* =========================================================
   AUTH LISTENER
========================================================= */

supabase.auth.onAuthStateChange(
  event => {

    if (
      event === "SIGNED_OUT"
    ) {
      showLogin();
    }

  }
);

/* =========================================================
   START
========================================================= */

init();

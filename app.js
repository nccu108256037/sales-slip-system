"use strict";

/*
  神隊友／好貨倉銷貨單系統

  本系統刻意不使用：
  - localStorage
  - sessionStorage
  - IndexedDB
  - Cookie
  - 後端資料庫

  所有資料只存在目前頁面的記憶體中。
  重新整理或關閉頁面後，資料即消失。
*/

const elements = {
  brand: document.getElementById("brand"),
  orderDate: document.getElementById("orderDate"),
  orderNumber: document.getElementById("orderNumber"),

  customerName: document.getElementById("customerName"),
  customerPhone: document.getElementById("customerPhone"),
  customerAddress: document.getElementById("customerAddress"),

  notes: document.getElementById("notes"),
  receivable: document.getElementById("receivable"),

  itemsBody: document.getElementById("itemsBody"),
  itemRowTemplate: document.getElementById("itemRowTemplate"),

  itemCount: document.getElementById("itemCount"),
  quantityTotal: document.getElementById("quantityTotal"),
  grandTotal: document.getElementById("grandTotal"),

  addItemBtn: document.getElementById("addItemBtn"),
  addItemMobileBtn: document.getElementById("addItemMobileBtn"),

  regenerateNumberBtn:
    document.getElementById("regenerateNumberBtn"),

  syncReceivableBtn:
    document.getElementById("syncReceivableBtn"),

  newOrderBtn: document.getElementById("newOrderBtn"),

  print58Btn: document.getElementById("print58Btn"),
  print80Btn: document.getElementById("print80Btn"),

  printArea: document.getElementById("printArea")
};

/*
  僅記錄目前頁面開啟期間產生過的單號。

  注意：
  重新整理頁面後，這個 Set 會消失。
  因為使用者要求完全不保存資料。
*/
const generatedNumbers = new Set();

let grandTotalValue = 0;
let receivableWasManuallyEdited = false;

/* 初始化 */
function initializeApp() {
  elements.orderDate.value = getTodayDateString();

  generateOrderNumber();

  addItemRow();
  addItemRow();
  addItemRow();

  bindEvents();
  recalculateOrder();
}

/* 綁定事件 */
function bindEvents() {
  elements.addItemBtn.addEventListener(
    "click",
    () => addItemRow(true)
  );

  elements.addItemMobileBtn.addEventListener(
    "click",
    () => addItemRow(true)
  );

  elements.brand.addEventListener(
    "change",
    generateOrderNumber
  );

  elements.orderDate.addEventListener(
    "change",
    generateOrderNumber
  );

  elements.regenerateNumberBtn.addEventListener(
    "click",
    generateOrderNumber
  );

  elements.syncReceivableBtn.addEventListener(
    "click",
    syncReceivableWithTotal
  );

  elements.receivable.addEventListener(
    "input",
    () => {
      receivableWasManuallyEdited = true;
    }
  );

  elements.newOrderBtn.addEventListener(
    "click",
    createNewOrder
  );

  elements.print58Btn.addEventListener(
    "click",
    () => printReceipt("58")
  );

  elements.print80Btn.addEventListener(
    "click",
    () => printReceipt("80")
  );
}

/* 今日日期 YYYY-MM-DD */
function getTodayDateString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* 將日期轉成 YYYYMMDD */
function formatDateForOrderNumber(dateString) {
  if (!dateString) {
    return getTodayDateString().replaceAll("-", "");
  }

  return dateString.replaceAll("-", "");
}

/* 取得品牌代碼 */
function getBrandCode() {
  return elements.brand.value === "warehouse"
    ? "1"
    : "0";
}

/*
  產生銷貨單號

  神隊友：
  YYYYMMDD0XXX

  好貨倉：
  YYYYMMDD1XXX

  XXX 為 000 到 999 之間的隨機數字。

  只保證目前頁面開啟期間不重複。
*/
function generateOrderNumber() {
  const datePart = formatDateForOrderNumber(
    elements.orderDate.value
  );

  const brandCode = getBrandCode();

  let orderNumber = "";
  let attempts = 0;

  do {
    const randomNumber =
      cryptoRandomInteger(0, 999);

    const randomPart =
      String(randomNumber).padStart(3, "0");

    orderNumber =
      `${datePart}${brandCode}${randomPart}`;

    attempts += 1;

    if (attempts > 1100) {
      alert(
        "目前頁面已產生過太多編號，請重新整理頁面。"
      );

      return;
    }
  } while (generatedNumbers.has(orderNumber));

  generatedNumbers.add(orderNumber);

  elements.orderNumber.value = orderNumber;
}

/* 使用瀏覽器加密亂數 */
function cryptoRandomInteger(min, max) {
  const range = max - min + 1;

  if (
    window.crypto &&
    typeof window.crypto.getRandomValues === "function"
  ) {
    const randomArray = new Uint32Array(1);

    window.crypto.getRandomValues(randomArray);

    return min + (randomArray[0] % range);
  }

  return Math.floor(
    Math.random() * range
  ) + min;
}

/* 增加品項列 */
function addItemRow(shouldFocus = false) {
  const fragment =
    elements.itemRowTemplate.content.cloneNode(true);

  const row = fragment.querySelector(".item-row");

  const nameInput =
    row.querySelector(".item-name");

  const quantityInput =
    row.querySelector(".item-quantity");

  const priceInput =
    row.querySelector(".item-price");

  const amountInput =
    row.querySelector(".item-amount");

  const deleteButton =
    row.querySelector(".delete-item-button");

  /*
    數量或單價改變時，自動計算金額。
    使用者仍然可以直接修改金額欄。
  */
  quantityInput.addEventListener(
    "input",
    () => {
      calculateRowAmount(row);
      recalculateOrder();
    }
  );

  priceInput.addEventListener(
    "input",
    () => {
      calculateRowAmount(row);
      recalculateOrder();
    }
  );

  amountInput.addEventListener(
    "input",
    recalculateOrder
  );

  nameInput.addEventListener(
    "input",
    recalculateOrder
  );

  deleteButton.addEventListener(
    "click",
    () => {
      row.remove();

      ensureAtLeastOneRow();
      renumberRows();
      recalculateOrder();
    }
  );

  elements.itemsBody.appendChild(fragment);

  renumberRows();
  recalculateOrder();

  if (shouldFocus) {
    requestAnimationFrame(() => {
      nameInput.focus();
    });
  }
}

/* 數量 × 單價 */
function calculateRowAmount(row) {
  const quantity = parseNumber(
    row.querySelector(".item-quantity").value
  );

  const price = parseNumber(
    row.querySelector(".item-price").value
  );

  const amountInput =
    row.querySelector(".item-amount");

  if (
    quantityInputIsEmpty(row) &&
    priceInputIsEmpty(row)
  ) {
    amountInput.value = "";

    return;
  }

  const amount = quantity * price;

  amountInput.value =
    formatEditableNumber(amount);
}

function quantityInputIsEmpty(row) {
  return (
    row.querySelector(".item-quantity").value.trim() === ""
  );
}

function priceInputIsEmpty(row) {
  return (
    row.querySelector(".item-price").value.trim() === ""
  );
}

/* 確保至少一列 */
function ensureAtLeastOneRow() {
  if (
    elements.itemsBody.querySelectorAll(".item-row")
      .length === 0
  ) {
    addItemRow();
  }
}

/* 重新排列編號 */
function renumberRows() {
  const rows =
    elements.itemsBody.querySelectorAll(".item-row");

  rows.forEach((row, index) => {
    row.querySelector(".item-index").textContent =
      String(index + 1);
  });
}

/* 重新計算整張訂單 */
function recalculateOrder() {
  const rows = getValidItemRows();

  let itemCount = 0;
  let quantityTotal = 0;
  let total = 0;

  rows.forEach((row) => {
    const name =
      row.querySelector(".item-name").value.trim();

    const quantity =
      parseNumber(
        row.querySelector(".item-quantity").value
      );

    const amount =
      parseNumber(
        row.querySelector(".item-amount").value
      );

    const hasAnyContent =
      name !== "" ||
      quantity !== 0 ||
      amount !== 0;

    if (hasAnyContent) {
      itemCount += 1;
      quantityTotal += quantity;
      total += amount;
    }
  });

  grandTotalValue = total;

  elements.itemCount.textContent =
    String(itemCount);

  elements.quantityTotal.textContent =
    formatEditableNumber(quantityTotal);

  elements.grandTotal.textContent =
    formatCurrency(total);

  /*
    尚未手動修改應收款時，
    應收款自動跟著總計更新。
  */
  if (!receivableWasManuallyEdited) {
    elements.receivable.value =
      formatEditableNumber(total);
  }
}

/* 應收款同步總計 */
function syncReceivableWithTotal() {
  elements.receivable.value =
    formatEditableNumber(grandTotalValue);

  receivableWasManuallyEdited = false;
}

/* 建立新單 */
function createNewOrder() {
  const hasContent = orderHasContent();

  if (hasContent) {
    const confirmed = window.confirm(
      "目前資料不會被保存。確定要全部清空並建立新單嗎？"
    );

    if (!confirmed) {
      return;
    }
  }

  clearOrderForm();
}

/* 判斷目前是否有輸入內容 */
function orderHasContent() {
  const customerHasContent =
    elements.customerName.value.trim() !== "" ||
    elements.customerPhone.value.trim() !== "" ||
    elements.customerAddress.value.trim() !== "" ||
    elements.notes.value.trim() !== "";

  const itemHasContent =
    getValidItemRows().some((row) => {
      return (
        row.querySelector(".item-name").value.trim() !== "" ||
        row.querySelector(".item-quantity").value.trim() !== "" ||
        row.querySelector(".item-price").value.trim() !== "" ||
        row.querySelector(".item-amount").value.trim() !== ""
      );
    });

  return customerHasContent || itemHasContent;
}

/* 清空表單 */
function clearOrderForm() {
  elements.brand.value = "teammate";
  elements.orderDate.value = getTodayDateString();

  elements.customerName.value = "";
  elements.customerPhone.value = "";
  elements.customerAddress.value = "";
  elements.notes.value = "";

  elements.receivable.value = "";

  receivableWasManuallyEdited = false;

  elements.itemsBody.innerHTML = "";

  addItemRow();
  addItemRow();
  addItemRow();

  generateOrderNumber();
  recalculateOrder();

  elements.customerName.focus();
}

/* 取得所有品項列 */
function getValidItemRows() {
  return Array.from(
    elements.itemsBody.querySelectorAll(".item-row")
  );
}

/* 取得有效列印品項 */
function getPrintableItems() {
  const rows = getValidItemRows();

  return rows
    .map((row, index) => {
      const name =
        row.querySelector(".item-name").value.trim();

      const quantity =
        parseNumber(
          row.querySelector(".item-quantity").value
        );

      const price =
        parseNumber(
          row.querySelector(".item-price").value
        );

      const amount =
        parseNumber(
          row.querySelector(".item-amount").value
        );

      return {
        index: index + 1,
        name,
        quantity,
        price,
        amount
      };
    })
    .filter((item) => {
      return (
        item.name !== "" ||
        item.quantity !== 0 ||
        item.price !== 0 ||
        item.amount !== 0
      );
    });
}

/* 列印 */
function printReceipt(width) {
  const items = getPrintableItems();

  if (items.length === 0) {
    alert("請至少輸入一筆品項後再列印。");

    return;
  }

  const isWarehouse =
    elements.brand.value === "warehouse";

  const brandName =
    isWarehouse
      ? "好貨倉"
      : "神隊友";

  const brandSlogan =
    isWarehouse
      ? "用最實惠的批發價來挺你"
      : "餐飲老闆們的靠山";

  const customerName =
    elements.customerName.value.trim();

  const customerPhone =
    elements.customerPhone.value.trim();

  const customerAddress =
    elements.customerAddress.value.trim();

  const notes =
    elements.notes.value.trim();

  const receivable =
    parseNumber(elements.receivable.value);

  const printWidth =
    width === "58"
      ? "54mm"
      : "76mm";

  document.documentElement.style.setProperty(
    "--print-width",
    printWidth
  );

  const receiptClass =
    width === "58"
      ? "receipt receipt-58"
      : "receipt receipt-80";

  const itemsHtml = items
    .map((item, index) => {
      return `
        <tr>
          <td class="receipt-index">
            ${index + 1}
          </td>

          <td class="receipt-name">
            ${escapeHtml(item.name || "未填品名")}
          </td>

          <td class="receipt-qty">
            ${formatEditableNumber(item.quantity)}
          </td>

          <td class="receipt-price">
            ${formatMoneyWithoutSymbol(item.price)}
          </td>

          <td class="receipt-amount">
            ${formatMoneyWithoutSymbol(item.amount)}
          </td>
        </tr>
      `;
    })
    .join("");

  elements.printArea.innerHTML = `
    <div class="${receiptClass}">

      <div class="receipt-header">
        <h1 class="receipt-brand">
          ${escapeHtml(brandName)}
        </h1>

        <p class="receipt-slogan">
          ${escapeHtml(brandSlogan)}
        </p>

        <p class="receipt-title">
          銷貨單
        </p>
      </div>

      <hr class="receipt-divider receipt-divider-strong" />

      <div class="receipt-info">
        <div>
          單號：${escapeHtml(elements.orderNumber.value)}
        </div>

        <div>
          日期：${escapeHtml(elements.orderDate.value)}
        </div>

        ${
          customerName
            ? `
              <div>
                店家：${escapeHtml(customerName)}
              </div>
            `
            : ""
        }

        ${
          customerPhone
            ? `
              <div>
                電話：${escapeHtml(customerPhone)}
              </div>
            `
            : ""
        }

        ${
          customerAddress
            ? `
              <div>
                地址：${escapeHtml(customerAddress)}
              </div>
            `
            : ""
        }
      </div>

      <hr class="receipt-divider" />

      <table class="receipt-table">
        <thead>
          <tr>
            <th class="receipt-index">
              #
            </th>

            <th class="receipt-name">
              品名
            </th>

            <th class="receipt-qty">
              數量
            </th>

            <th class="receipt-price">
              單價
            </th>

            <th class="receipt-amount">
              金額
            </th>
          </tr>
        </thead>

        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="receipt-summary">

        <div class="receipt-summary-row">
          <span>
            品項數
          </span>

          <strong>
            ${items.length}
          </strong>
        </div>

        <div class="receipt-summary-row">
          <span>
            總計
          </span>

          <strong>
            ${formatCurrency(grandTotalValue)}
          </strong>
        </div>

        <div class="receipt-payable-box">
          <span class="receipt-payable-label">
            應收款
          </span>

          <strong class="receipt-payable-value">
            ${formatCurrency(receivable)}
          </strong>
        </div>

      </div>

      ${
        notes
          ? `
            <hr class="receipt-divider" />

            <div class="receipt-notes-block">
              <div class="receipt-notes-title">
                備註：
              </div>

              <div class="receipt-notes">
                ${escapeHtml(notes)}
              </div>
            </div>
          `
          : ""
      }

      <hr class="receipt-divider" />

      <div class="receipt-footer">
        <div>
          感謝您的訂購！
        </div>

        <div>
          祝您生意興隆！
        </div>
      </div>

    </div>
  `;

  /*
    稍微延遲，確保列印區 DOM 已更新。
  */
  window.setTimeout(() => {
    window.print();
  }, 50);
}

/* 數字轉換 */
function parseNumber(value) {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

/* 輸入框使用格式 */
function formatEditableNumber(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(
    Number(value.toFixed(2))
  );
}

/* 顯示金額 */
function formatCurrency(value) {
  const number = Number.isFinite(value)
    ? value
    : 0;

  return new Intl.NumberFormat(
    "zh-TW",
    {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 2
    }
  ).format(number);
}

/* 列印表格使用，不顯示貨幣符號 */
function formatMoneyWithoutSymbol(value) {
  const number = Number.isFinite(value)
    ? value
    : 0;

  return new Intl.NumberFormat(
    "zh-TW",
    {
      maximumFractionDigits: 2
    }
  ).format(number);
}

/* 防止使用者輸入的內容成為 HTML */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

initializeApp();

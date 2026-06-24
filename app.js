const LEGACY_STORAGE_KEY = "classbank.students.v1";
const DATABASE_KEY = "classbank.database.v2";
const ACTIVE_TEACHER_KEY = "classbank.activeTeacher.v2";

const currencySymbols = {
  USD: "$",
  EUR: "EUR",
  GBP: "GBP",
  CAD: "CAD",
  AUD: "AUD",
  JPY: "JPY",
  GHS: "GHS",
  NGN: "NGN",
  ZAR: "ZAR",
  KES: "KES",
  INR: "INR",
  PHP: "PHP",
  CREATIVE: "Creative"
};

const state = {
  db: { teachers: [] },
  activeTeacherId: null,
  students: [],
  currency: "USD",
  stream: null,
  scanTimer: null,
  detector: null,
  deferredInstallPrompt: null
};

const memoryStorage = new Map();
const appRoot = document.currentScript?.previousElementSibling?.id === "classbank-root"
  ? document.currentScript.previousElementSibling
  : document.querySelector("#classbank-root") || document;

let els = {};

function collectElements() {
  els = {
    teacherSelect: appRoot.querySelector("#teacherSelect"),
    teacherName: appRoot.querySelector("#teacherName"),
    createTeacher: appRoot.querySelector("#createTeacher"),
    exportTeacherData: appRoot.querySelector("#exportTeacherData"),
    importTeacherData: appRoot.querySelector("#importTeacherData"),
    importTeacherFile: appRoot.querySelector("#importTeacherFile"),
    installApp: appRoot.querySelector("#installApp"),
    studentNames: appRoot.querySelector("#studentNames"),
    currencySelect: appRoot.querySelector("#currencySelect"),
    generateCards: appRoot.querySelector("#generateCards"),
    clearAll: appRoot.querySelector("#clearAll"),
    printCards: appRoot.querySelector("#printCards"),
    downloadSvgSheet: appRoot.querySelector("#downloadSvgSheet"),
    downloadSvgCards: appRoot.querySelector("#downloadSvgCards"),
    teacherBadge: appRoot.querySelector("#teacherBadge"),
    studentCount: appRoot.querySelector("#studentCount"),
    currencyBadge: appRoot.querySelector("#currencyBadge"),
    cardsGrid: appRoot.querySelector("#cardsGrid"),
    accountStudent: appRoot.querySelector("#accountStudent"),
    transactionType: appRoot.querySelector("#transactionType"),
    transactionAmount: appRoot.querySelector("#transactionAmount"),
    transactionMemo: appRoot.querySelector("#transactionMemo"),
    applyTransaction: appRoot.querySelector("#applyTransaction"),
    clearStatement: appRoot.querySelector("#clearStatement"),
    downloadStatement: appRoot.querySelector("#downloadStatement"),
    statementPreview: appRoot.querySelector("#statementPreview"),
    cameraPreview: appRoot.querySelector("#cameraPreview"),
    cameraEmpty: appRoot.querySelector("#cameraEmpty"),
    startScanner: appRoot.querySelector("#startScanner"),
    stopScanner: appRoot.querySelector("#stopScanner"),
    scannerStatus: appRoot.querySelector("#scannerStatus"),
    scanResult: appRoot.querySelector("#scanResult")
  };
}

function blankTeacher(name) {
  return {
    id: createId(),
    name,
    currency: "USD",
    students: [],
    createdAt: new Date().toISOString()
  };
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function readStoredValue(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return memoryStorage.has(key) ? memoryStorage.get(key) : fallback;
  }
}

function writeStoredValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    memoryStorage.set(key, value);
  }
}

function activeTeacher() {
  return state.db.teachers.find((teacher) => teacher.id === state.activeTeacherId) || null;
}

function normalizeStudent(student) {
  return {
    transactions: [],
    ...student,
    balance: Number(student.balance || 0),
    transactions: Array.isArray(student.transactions) ? student.transactions : []
  };
}

function loadDatabase() {
  const saved = JSON.parse(readStoredValue(DATABASE_KEY, "null"));

  if (saved && Array.isArray(saved.teachers)) {
    state.db = {
      teachers: saved.teachers.map((teacher) => ({
        ...teacher,
        students: Array.isArray(teacher.students) ? teacher.students.map(normalizeStudent) : []
      }))
    };
    state.activeTeacherId = readStoredValue(ACTIVE_TEACHER_KEY, "") || state.db.teachers[0]?.id || null;
    return;
  }

  const legacy = JSON.parse(readStoredValue(LEGACY_STORAGE_KEY, "{}"));
  const starter = blankTeacher("Teacher");
  starter.currency = legacy.currency || "USD";
  starter.students = Array.isArray(legacy.students) ? legacy.students.map(normalizeStudent) : [];
  state.db = { teachers: [starter] };
  state.activeTeacherId = starter.id;
  saveDatabase();
}

function syncActiveTeacher() {
  const teacher = activeTeacher();

  if (!teacher) {
    const starter = blankTeacher("Teacher");
    state.db.teachers.push(starter);
    state.activeTeacherId = starter.id;
    saveDatabase();
    return syncActiveTeacher();
  }

  state.students = teacher.students;
  state.currency = teacher.currency || "USD";
  els.currencySelect.value = state.currency;
}

function saveDatabase() {
  const teacher = activeTeacher();
  if (teacher) {
    teacher.students = state.students;
    teacher.currency = state.currency;
  }

  writeStoredValue(DATABASE_KEY, JSON.stringify(state.db));
  writeStoredValue(ACTIVE_TEACHER_KEY, state.activeTeacherId || "");
}

function luhnCheckDigit(numberWithoutCheck) {
  const digits = numberWithoutCheck.split("").map(Number).reverse();
  const total = digits.reduce((sum, digit, index) => {
    if (index % 2 === 0) {
      const doubled = digit * 2;
      return sum + (doubled > 9 ? doubled - 9 : doubled);
    }
    return sum + digit;
  }, 0);
  return String((10 - (total % 10)) % 10);
}

function randomDigits(length) {
  if (!globalThis.crypto?.getRandomValues) {
    return Array.from({ length }, () => String(Math.floor(Math.random() * 10))).join("");
  }

  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => String(byte % 10)).join("");
}

function createCardNumber() {
  const body = `7777${randomDigits(11)}`;
  return `${body}${luhnCheckDigit(body)}`;
}

function formatCardNumber(cardNumber) {
  return cardNumber.replace(/(.{4})/g, "$1 ").trim();
}

function createStudent(name) {
  const now = new Date().toISOString();
  return {
    id: createId(),
    name,
    cardNumber: createCardNumber(),
    cvc: randomDigits(3),
    pin: randomDigits(4),
    currency: state.currency,
    balance: 0,
    transactions: [{
      id: createId(),
      date: now,
      type: "opening",
      amount: 0,
      memo: "Account opened",
      balance: 0
    }],
    createdAt: now
  };
}

function qrPayload(student) {
  return JSON.stringify({
    app: "ClassBank",
    id: student.id,
    name: student.name,
    cardNumber: student.cardNumber,
    cvc: student.cvc,
    pin: student.pin,
    currency: student.currency
  });
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeFileName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "student";
}

function qrFactory() {
  if (typeof window.qrcode === "function") return window.qrcode;
  if (typeof globalThis.qrcode === "function") return globalThis.qrcode;
  if (typeof qrcode === "function") return qrcode;
  return null;
}

function qrPathData(payload, x, y, size) {
  const createQr = qrFactory();
  if (!createQr) return "";

  const qr = createQr(0, "M");
  qr.addData(payload);
  qr.make();

  const count = qr.getModuleCount();
  const cell = size / count;
  const commands = [];

  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        const px = (x + col * cell).toFixed(3);
        const py = (y + row * cell).toFixed(3);
        const cs = cell.toFixed(3);
        commands.push(`M${px} ${py}h${cs}v${cs}h-${cs}z`);
      }
    }
  }

  return commands.join("");
}

function laserCardContent(student, offsetX = 0, offsetY = 0) {
  const x = (value) => (offsetX + value).toFixed(3);
  const y = (value) => (offsetY + value).toFixed(3);
  const payload = qrPayload(student);
  const qrPath = qrPathData(payload, offsetX + 61.1, offsetY + 26.2, 17.6);
  const cardNumber = formatCardNumber(student.cardNumber);

  return `
    <g id="card-${escapeXml(student.id)}" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">
      <rect x="${x(0.5)}" y="${y(0.5)}" width="84.6" height="52.98" rx="3.18" stroke-width="0.25"/>
      <path d="M${x(5)} ${y(12)}H${x(47)}" stroke-width="0.18"/>
      <path d="M${x(5)} ${y(44.5)}H${x(54)}" stroke-width="0.18"/>
      <path d="M${x(56.5)} ${y(8)}C${x(64)} ${y(13)} ${x(73)} ${y(13)} ${x(80.5)} ${y(8)}" stroke-width="0.16"/>
      <path d="M${x(56.5)} ${y(12)}C${x(64)} ${y(17)} ${x(73)} ${y(17)} ${x(80.5)} ${y(12)}" stroke-width="0.16"/>
    </g>
    <g id="text-${escapeXml(student.id)}" fill="#000" stroke="none" font-family="Arial, Helvetica, sans-serif">
      <text x="${x(5)}" y="${y(8.5)}" font-size="4.2" font-weight="700">ClassBank</text>
      <text x="${x(80.5)}" y="${y(8.5)}" font-size="3.2" font-weight="700" text-anchor="end">${escapeXml(student.currency)}</text>
      <text x="${x(5)}" y="${y(22)}" font-size="5.2" font-weight="700">${escapeXml(student.name)}</text>
      <text x="${x(5)}" y="${y(31)}" font-size="4.2" letter-spacing="0.45">${escapeXml(cardNumber)}</text>
      <text x="${x(5)}" y="${y(39)}" font-size="3.2" font-weight="700">PIN ${escapeXml(student.pin)}</text>
      <text x="${x(25)}" y="${y(39)}" font-size="3.2" font-weight="700">CVC ${escapeXml(student.cvc)}</text>
      <text x="${x(5)}" y="${y(49.2)}" font-size="2.45">ID ${escapeXml(student.id.slice(0, 8))}</text>
    </g>
    <g id="qr-${escapeXml(student.id)}">
      <rect x="${x(59.4)}" y="${y(24.5)}" width="21" height="21" rx="1" fill="none" stroke="#000" stroke-width="0.18"/>
      <path d="${qrPath}" fill="#000" stroke="none"/>
      <text x="${x(69.9)}" y="${y(49.2)}" font-family="Arial, Helvetica, sans-serif" font-size="2.4" text-anchor="middle" fill="#000">SCAN</text>
    </g>
  `;
}

function laserCardSvg(student) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="85.6mm" height="53.98mm" viewBox="0 0 85.6 53.98">
  <title>${escapeXml(student.name)} ClassBank card</title>
  ${laserCardContent(student)}
</svg>
`;
}

function laserSheetSvg(students) {
  const columns = 2;
  const cardWidth = 85.6;
  const cardHeight = 53.98;
  const gap = 6;
  const margin = 6;
  const rows = Math.ceil(students.length / columns);
  const width = margin * 2 + columns * cardWidth + (columns - 1) * gap;
  const height = margin * 2 + rows * cardHeight + Math.max(0, rows - 1) * gap;
  const cards = students.map((student, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + col * (cardWidth + gap);
    const y = margin + row * (cardHeight + gap);
    return laserCardContent(student, x, y);
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">
  <title>ClassBank student card sheet</title>
  ${cards}
</svg>
`;
}

function downloadSvg(filename, contents) {
  const blob = new Blob([contents], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadStudentSvg(studentId) {
  const student = state.students.find((item) => item.id === studentId);
  if (!student) return;

  downloadSvg(`${safeFileName(student.name)}-classbank-card.svg`, laserCardSvg(student));
}

function downloadSvgSheet() {
  if (state.students.length === 0) {
    els.studentNames.focus();
    return;
  }

  downloadSvg("classbank-student-card-sheet.svg", laserSheetSvg(state.students));
}

function downloadAllStudentSvgs() {
  if (state.students.length === 0) {
    els.studentNames.focus();
    return;
  }

  state.students.forEach((student, index) => {
    window.setTimeout(() => {
      downloadSvg(`${safeFileName(student.name)}-classbank-card.svg`, laserCardSvg(student));
    }, index * 180);
  });
}

function renderQr(container, student) {
  container.textContent = "";
  const payload = qrPayload(student);
  const createQr = qrFactory();

  if (createQr) {
    try {
      const qr = createQr(0, "M");
      qr.addData(payload);
      qr.make();
      container.innerHTML = qr.createSvgTag(2, 1, `QR code for ${student.name}`);
      return;
    } catch {
      container.textContent = "";
    }
  }

  const img = document.createElement("img");
  img.alt = `QR code for ${student.name}`;
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=168x168&data=${encodeURIComponent(payload)}`;
  img.addEventListener("error", () => {
    container.innerHTML = '<span class="qr-error">QR unavailable</span>';
  });
  container.append(img);
}

function moneyLabel(student, amount = student.balance) {
  const symbol = currencySymbols[student.currency] || student.currency;
  return `${symbol} ${Number(amount).toFixed(2)}`;
}

function renderTeachers() {
  els.teacherSelect.textContent = "";
  state.db.teachers.forEach((teacher) => {
    const option = document.createElement("option");
    option.value = teacher.id;
    option.textContent = teacher.name;
    option.selected = teacher.id === state.activeTeacherId;
    els.teacherSelect.append(option);
  });
}

function renderAccounts() {
  const currentValue = els.accountStudent.value;
  els.accountStudent.textContent = "";

  if (state.students.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No students yet";
    els.accountStudent.append(option);
    renderStatementPreview();
    return;
  }

  state.students.forEach((student) => {
    const option = document.createElement("option");
    option.value = student.id;
    option.textContent = `${student.name} - ${moneyLabel(student)}`;
    els.accountStudent.append(option);
  });

  if (state.students.some((student) => student.id === currentValue)) {
    els.accountStudent.value = currentValue;
  }

  renderStatementPreview();
}

function selectedAccount() {
  return state.students.find((student) => student.id === els.accountStudent.value) || state.students[0] || null;
}

function renderStatementPreview() {
  const student = selectedAccount();

  if (!student) {
    els.statementPreview.innerHTML = "<span>No account selected.</span>";
    return;
  }

  const transactions = [...student.transactions].slice(-6).reverse();
  const rows = transactions.map((transaction) => `
    <div class="statement-row">
      <div class="statement-main">
        <span>${new Date(transaction.date).toLocaleDateString()}</span>
        <strong>${escapeXml(transaction.memo || transaction.type)}</strong>
      </div>
      <div class="statement-money">
        <span>${moneyLabel(student, transaction.amount)}</span>
        <small>Balance ${moneyLabel(student, transaction.balance)}</small>
      </div>
    </div>
  `).join("");

  els.statementPreview.innerHTML = `
    <div class="statement-head">
      <strong>${escapeXml(student.name)}</strong>
      <span>${moneyLabel(student)}</span>
    </div>
    ${rows || "<span>No transactions yet.</span>"}
  `;
}

function render() {
  const teacher = activeTeacher();
  renderTeachers();
  els.studentCount.textContent = `${state.students.length} student${state.students.length === 1 ? "" : "s"}`;
  els.currencyBadge.textContent = state.currency;
  els.teacherBadge.textContent = teacher ? teacher.name : "No teacher";
  els.cardsGrid.textContent = "";

  if (state.students.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Enter student names to generate classroom bank cards.";
    els.cardsGrid.append(empty);
    renderAccounts();
    return;
  }

  state.students.forEach((student) => {
    const article = document.createElement("article");
    article.className = "student-card";
    article.dataset.id = student.id;

    article.innerHTML = `
      <div class="card-face">
        <div class="card-top">
          <span class="card-brand">ClassBank</span>
          <span>${student.currency}</span>
        </div>
        <div class="student-name"></div>
        <div class="card-number">${formatCardNumber(student.cardNumber)}</div>
        <div class="card-bottom">
          <span>PIN ${student.pin}</span>
          <span>CVC ${student.cvc}</span>
        </div>
      </div>
      <div class="card-details">
        <div class="detail-list">
          <div><span>Student</span><strong class="detail-name"></strong></div>
          <div><span>Balance</span><strong>${moneyLabel(student)}</strong></div>
          <div><span>ID</span><strong>${student.id.slice(0, 8)}</strong></div>
        </div>
        <div class="qr-box" aria-label="QR code"></div>
      </div>
      <div class="card-actions">
        <button class="ghost copy-card" type="button">Copy details</button>
        <button class="ghost download-svg-card" type="button">SVG</button>
        <button class="ghost remove-card" type="button">Remove</button>
      </div>
    `;

    article.querySelector(".student-name").textContent = student.name;
    article.querySelector(".detail-name").textContent = student.name;
    renderQr(article.querySelector(".qr-box"), student);
    els.cardsGrid.append(article);
  });

  renderAccounts();
}

function generateCards() {
  const names = els.studentNames.value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);

  if (names.length === 0) {
    els.studentNames.focus();
    return;
  }

  const existingByName = new Map(state.students.map((student) => [
    student.name.trim().toLowerCase(),
    student
  ]));

  names.forEach((name) => {
    if (!existingByName.has(name.toLowerCase())) {
      state.students.push(createStudent(name));
    }
  });

  saveDatabase();
  render();
}

async function copyDetails(studentId) {
  const student = state.students.find((item) => item.id === studentId);
  if (!student) return;

  const details = [
    `Student: ${student.name}`,
    `Currency: ${student.currency}`,
    `Card number: ${formatCardNumber(student.cardNumber)}`,
    `CVC: ${student.cvc}`,
    `PIN: ${student.pin}`,
    `QR payload: ${qrPayload(student)}`
  ].join("\n");

  await navigator.clipboard.writeText(details);
}

function removeStudent(studentId) {
  state.students = state.students.filter((student) => student.id !== studentId);
  saveDatabase();
  render();
}

function createOrSwitchTeacher() {
  const requestedName = els.teacherName.value.trim();

  if (!requestedName) {
    state.activeTeacherId = els.teacherSelect.value || state.activeTeacherId;
    syncActiveTeacher();
    saveDatabase();
    render();
    return;
  }

  const existing = state.db.teachers.find((teacher) => (
    teacher.name.toLowerCase() === requestedName.toLowerCase()
  ));

  if (existing) {
    state.activeTeacherId = existing.id;
  } else {
    const teacher = blankTeacher(requestedName);
    state.db.teachers.push(teacher);
    state.activeTeacherId = teacher.id;
  }

  els.teacherName.value = "";
  syncActiveTeacher();
  saveDatabase();
  render();
}

function applyTransaction() {
  const student = selectedAccount();
  if (!student) return;

  const rawAmount = Number(els.transactionAmount.value);
  if (!Number.isFinite(rawAmount) || rawAmount < 0) {
    els.transactionAmount.focus();
    return;
  }

  const type = els.transactionType.value;
  const previousBalance = Number(student.balance || 0);
  let amount = rawAmount;
  let nextBalance = previousBalance;

  if (type === "deposit") {
    nextBalance += rawAmount;
  } else if (type === "withdraw") {
    amount = -rawAmount;
    nextBalance -= rawAmount;
  } else {
    amount = rawAmount - previousBalance;
    nextBalance = rawAmount;
  }

  student.balance = Number(nextBalance.toFixed(2));
  student.transactions.push({
    id: createId(),
    date: new Date().toISOString(),
    type,
    amount: Number(amount.toFixed(2)),
    memo: els.transactionMemo.value.trim() || type,
    balance: student.balance
  });

  els.transactionAmount.value = "";
  els.transactionMemo.value = "";
  saveDatabase();
  render();
  els.accountStudent.value = student.id;
  renderStatementPreview();
}

function statementCsv(student) {
  const rows = [
    ["Student", student.name],
    ["Currency", student.currency],
    ["Card Number", student.cardNumber],
    [],
    ["Date", "Type", "Memo", "Amount", "Balance"],
    ...student.transactions.map((transaction) => [
      new Date(transaction.date).toLocaleString(),
      transaction.type,
      transaction.memo,
      transaction.amount.toFixed(2),
      transaction.balance.toFixed(2)
    ])
  ];

  return rows.map((row) => row.map((cell) => {
    const text = String(cell ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }).join(",")).join("\n");
}

function downloadText(filename, contents, type = "text/plain") {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadSelectedStatement() {
  const student = selectedAccount();
  if (!student) return;

  downloadText(
    `${safeFileName(student.name)}-statement.csv`,
    statementCsv(student),
    "text/csv"
  );
}

function clearSelectedStatement() {
  const student = selectedAccount();
  if (!student) return;

  student.transactions = [{
    id: createId(),
    date: new Date().toISOString(),
    type: "opening",
    amount: 0,
    memo: "Statement reset",
    balance: student.balance
  }];
  saveDatabase();
  renderStatementPreview();
}

function exportTeacherData() {
  const teacher = activeTeacher();
  if (!teacher) return;

  downloadText(
    `${safeFileName(teacher.name)}-classbank-data.json`,
    JSON.stringify(teacher, null, 2),
    "application/json"
  );
}

function normalizeImportedTeacher(data) {
  if (!data || typeof data !== "object") {
    throw new Error("That file does not look like ClassBank teacher data.");
  }

  const teacher = data.teachers?.[0] || data;
  if (!teacher.name || !Array.isArray(teacher.students)) {
    throw new Error("That file does not include a teacher and student list.");
  }

  return {
    id: teacher.id || createId(),
    name: String(teacher.name),
    currency: teacher.currency || "USD",
    createdAt: teacher.createdAt || new Date().toISOString(),
    students: teacher.students.map(normalizeStudent)
  };
}

function importTeacherDataFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = normalizeImportedTeacher(JSON.parse(reader.result));
      const existingIndex = state.db.teachers.findIndex((teacher) => teacher.id === imported.id);

      if (existingIndex >= 0) {
        state.db.teachers[existingIndex] = imported;
      } else {
        state.db.teachers.push(imported);
      }

      state.activeTeacherId = imported.id;
      syncActiveTeacher();
      saveDatabase();
      render();
      alert(`Imported ${imported.name}.`);
    } catch (error) {
      alert(error.message || "ClassBank could not import that file.");
    } finally {
      els.importTeacherFile.value = "";
    }
  });
  reader.readAsText(file);
}

function setScannerStatus(text, isError = false) {
  els.scannerStatus.textContent = text;
  els.scannerStatus.style.background = isError ? "rgba(164, 50, 50, 0.16)" : "";
  els.scannerStatus.style.color = isError ? "#7b2525" : "";
}

function showScanResult(student) {
  els.scanResult.innerHTML = `
    <strong>${student.name}</strong>
    Card ${formatCardNumber(student.cardNumber)}<br>
    PIN ${student.pin} · CVC ${student.cvc} · ${student.currency}
  `;
}

function handleQrValue(value) {
  let payload;
  try {
    payload = JSON.parse(value);
  } catch {
    setScannerStatus("Unknown QR", true);
    els.scanResult.textContent = value;
    return;
  }

  const student = state.students.find((item) => item.id === payload.id);
  if (!student) {
    setScannerStatus("Not found", true);
    els.scanResult.textContent = "This QR code was not found in the current student list.";
    return;
  }

  setScannerStatus("Scanned");
  showScanResult(student);
}

async function scanFrame() {
  if (!state.detector || !state.stream) return;

  try {
    const codes = await state.detector.detect(els.cameraPreview);
    if (codes.length > 0) {
      handleQrValue(codes[0].rawValue);
    }
  } catch {
    setScannerStatus("Scanning unavailable", true);
  }

  state.scanTimer = requestAnimationFrame(scanFrame);
}

async function startScanner() {
  if (!("BarcodeDetector" in window)) {
    setScannerStatus("No QR support", true);
    els.scanResult.textContent = "This browser cannot scan QR codes directly. Use Chrome or Edge on localhost.";
    return;
  }

  const formats = await BarcodeDetector.getSupportedFormats();
  if (!formats.includes("qr_code")) {
    setScannerStatus("No QR support", true);
    return;
  }

  try {
    state.detector = new BarcodeDetector({ formats: ["qr_code"] });
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    els.cameraPreview.srcObject = state.stream;
    await els.cameraPreview.play();
    els.cameraEmpty.hidden = true;
    els.startScanner.disabled = true;
    els.stopScanner.disabled = false;
    setScannerStatus("Scanning");
    scanFrame();
  } catch {
    setScannerStatus("Camera blocked", true);
    els.scanResult.textContent = "Allow camera access in the browser to scan a student's QR code.";
  }
}

function stopScanner() {
  if (state.scanTimer) cancelAnimationFrame(state.scanTimer);
  state.scanTimer = null;

  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }
  state.stream = null;
  els.cameraPreview.srcObject = null;
  els.cameraEmpty.hidden = false;
  els.startScanner.disabled = false;
  els.stopScanner.disabled = true;
  setScannerStatus("Ready");
}

function handleAppClick(event) {
  if (event.target.closest("#generateCards")) {
    generateCards();
    return;
  }

  if (event.target.closest("#clearAll")) {
    state.students = [];
    els.studentNames.value = "";
    saveDatabase();
    render();
    return;
  }

  if (event.target.closest("#printCards")) {
    window.print();
    return;
  }

  if (event.target.closest("#downloadSvgSheet")) {
    downloadSvgSheet();
    return;
  }

  if (event.target.closest("#downloadSvgCards")) {
    downloadAllStudentSvgs();
    return;
  }

  if (event.target.closest("#createTeacher")) {
    createOrSwitchTeacher();
    return;
  }

  if (event.target.closest("#exportTeacherData")) {
    exportTeacherData();
    return;
  }

  if (event.target.closest("#importTeacherData")) {
    els.importTeacherFile.click();
    return;
  }

  if (event.target.closest("#applyTransaction")) {
    applyTransaction();
    return;
  }

  if (event.target.closest("#clearStatement")) {
    clearSelectedStatement();
    return;
  }

  if (event.target.closest("#downloadStatement")) {
    downloadSelectedStatement();
    return;
  }

  if (event.target.closest("#startScanner")) {
    startScanner();
    return;
  }

  if (event.target.closest("#stopScanner")) {
    stopScanner();
    return;
  }

  const card = event.target.closest(".student-card");
  if (!card) return;

  if (event.target.closest(".copy-card")) {
    copyDetails(card.dataset.id);
  }

  if (event.target.closest(".download-svg-card")) {
    downloadStudentSvg(card.dataset.id);
  }

  if (event.target.closest(".remove-card")) {
    removeStudent(card.dataset.id);
  }
}

function initClassBank() {
  collectElements();

  if (!els.generateCards || !els.cardsGrid) {
    window.setTimeout(initClassBank, 60);
    return;
  }

  appRoot.addEventListener("click", handleAppClick);
  els.teacherSelect.addEventListener("change", (event) => {
    state.activeTeacherId = event.target.value;
    syncActiveTeacher();
    saveDatabase();
    render();
  });
  els.accountStudent.addEventListener("change", renderStatementPreview);
  els.importTeacherFile.addEventListener("change", (event) => {
    importTeacherDataFile(event.target.files?.[0]);
  });
  els.currencySelect.addEventListener("change", (event) => {
    state.currency = event.target.value;
    state.students.forEach((student) => {
      student.currency = state.currency;
    });
    saveDatabase();
    render();
  });
  window.addEventListener("beforeunload", stopScanner);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    els.installApp.hidden = false;
  });

  els.installApp.addEventListener("click", async () => {
    if (!state.deferredInstallPrompt) return;

    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    els.installApp.hidden = true;
  });

  if ("serviceWorker" in navigator && ["http:", "https:"].includes(location.protocol)) {
    navigator.serviceWorker.register("service-worker.js");
  }

  try {
    loadDatabase();
    syncActiveTeacher();
    render();
  } catch (error) {
    console.error(error);
    els.cardsGrid.innerHTML = `
      <div class="empty-state">
        ClassBank could not start: ${escapeXml(error.message || "Unknown browser error")}
      </div>
    `;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initClassBank);
} else {
  initClassBank();
}

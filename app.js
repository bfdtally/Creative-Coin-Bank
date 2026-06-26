const STORAGE_KEY = "piggy-bank-state-v1";
const CLOUD_STORAGE_KEY = "piggy-bank-cloud-v1";
const SUPABASE_URL = "https://uivypttuhigwiyvgsuuv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5FUAhDgS1Sd60IIUP3nMIw_vz3L6gtR";

const starterState = {
  teacher: "Ms. Sunny",
  selectedId: "mila",
  view: "banks",
  students: [
    {
      id: "mila",
      name: "Mila",
      balance: 18,
      entries: [
        entry("earn", 10, "Payday"),
        entry("earn", 5, "Kind Choice"),
        entry("earn", 3, "Reading Time")
      ]
    },
    {
      id: "jay",
      name: "Jay",
      balance: 11,
      entries: [entry("earn", 10, "Payday"), entry("earn", 1, "Helping Friend")]
    },
    {
      id: "nora",
      name: "Nora",
      balance: 7,
      entries: [entry("earn", 10, "Payday"), entry("spend", 3, "Store Buy")]
    }
  ]
};

let state = loadState();
let chosenAmount = 1;
let scannerStream = null;
let scannerLoop = 0;
let cloud = loadCloudSettings();
let cloudSaveTimer = 0;

const dom = {
  teacherName: document.querySelector("#teacherName"),
  studentForm: document.querySelector("#studentForm"),
  studentName: document.querySelector("#studentName"),
  cloudForm: document.querySelector("#cloudForm"),
  classCode: document.querySelector("#classCode"),
  classPin: document.querySelector("#classPin"),
  cloudStatus: document.querySelector("#cloudStatus"),
  syncNow: document.querySelector("#syncNow"),
  studentsGrid: document.querySelector("#studentsGrid"),
  classSummary: document.querySelector("#classSummary"),
  template: document.querySelector("#studentCardTemplate"),
  emptyState: document.querySelector("#emptyState"),
  studentDetail: document.querySelector("#studentDetail"),
  detailName: document.querySelector("#detailName"),
  detailBalance: document.querySelector("#detailBalance"),
  detailJar: document.querySelector("#detailJar"),
  amountButtons: document.querySelectorAll("[data-amount]"),
  customAmount: document.querySelector("#customAmount"),
  reason: document.querySelector("#reason"),
  moneyForm: document.querySelector("#moneyForm"),
  statementList: document.querySelector("#statementList"),
  scanCode: document.querySelector("#scanCode"),
  scannerModal: document.querySelector("#scannerModal"),
  scannerVideo: document.querySelector("#scannerVideo"),
  scannerStatus: document.querySelector("#scannerStatus"),
  closeScanner: document.querySelector("#closeScanner"),
  deleteStudent: document.querySelector("#deleteStudent"),
  resetStudent: document.querySelector("#resetStudent"),
  printOne: document.querySelector("#printOne"),
  printCards: document.querySelector("#printCards"),
  downloadDogTag: document.querySelector("#downloadDogTag"),
  downloadSvg: document.querySelector("#downloadSvg"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  viewButtons: document.querySelectorAll("[data-view]"),
  classActions: document.querySelectorAll("[data-class-action]")
};

function entry(type, amount, reason) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    type,
    amount,
    reason,
    at: new Date().toISOString()
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(starterState);
  try {
    return { ...structuredClone(starterState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(starterState);
  }
}

function loadCloudSettings() {
  const saved = localStorage.getItem(CLOUD_STORAGE_KEY);
  if (!saved) return { classCode: "", pinHash: "", connected: false };
  try {
    return { classCode: "", pinHash: "", connected: false, ...JSON.parse(saved) };
  } catch {
    return { classCode: "", pinHash: "", connected: false };
  }
}

function saveCloudSettings() {
  localStorage.setItem(CLOUD_STORAGE_KEY, JSON.stringify(cloud));
}

function selectStudentFromUrl() {
  const id = new URLSearchParams(location.search).get("student");
  if (id && state.students.some((student) => student.id === id)) {
    state.selectedId = id;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleCloudSave();
}

function selectedStudent() {
  return state.students.find((student) => student.id === state.selectedId) || null;
}

function selectStudentById(id) {
  const student = state.students.find((item) => item.id === id);
  if (!student) return false;
  state.selectedId = student.id;
  render();
  return true;
}

function render() {
  dom.teacherName.value = state.teacher;
  dom.classCode.value = cloud.classCode || "";
  dom.studentsGrid.classList.toggle("story-view", state.view === "story");
  renderSummary();
  renderStudents();
  renderDetail();
  renderCloudStatus();
  saveState();
}

function renderCloudStatus(message) {
  if (!cloudConfigured()) {
    dom.cloudStatus.textContent = "Cloud setup needed";
    dom.cloudStatus.className = "offline";
    return;
  }
  if (message) {
    dom.cloudStatus.textContent = message;
    return;
  }
  dom.cloudStatus.textContent = cloud.connected && cloud.classCode
    ? `Connected: ${cloud.classCode}`
    : "Not connected";
  dom.cloudStatus.className = cloud.connected ? "online" : "offline";
}

function renderSummary() {
  const total = state.students.reduce((sum, student) => sum + student.balance, 0);
  const saverWord = state.students.length === 1 ? "saver" : "savers";
  dom.classSummary.textContent = `${state.students.length} ${saverWord}, ${total} Creative Coins saved`;
}

function renderStudents() {
  dom.studentsGrid.replaceChildren();
  state.students.forEach((student) => {
    const card = dom.template.content.firstElementChild.cloneNode(true);
    const button = card.querySelector(".student-button");
    button.classList.toggle("active", student.id === state.selectedId);
    button.dataset.id = student.id;
    card.querySelector(".student-name").textContent = student.name;
    card.querySelector(".student-balance").textContent = student.balance;
    card.querySelector(".coin-dots").replaceChildren(...coinDots(student.balance));
    if (state.view === "story") {
      const last = student.entries[0];
      card.querySelector(".student-balance").textContent = last
        ? `${last.type === "earn" ? "+" : "-"}${last.amount} ${last.reason}`
        : "No Creative Coins yet";
    }
    dom.studentsGrid.append(card);
  });
}

function coinDots(balance) {
  const count = Math.min(8, Math.max(1, Math.ceil(balance / 5)));
  return Array.from({ length: count }, () => document.createElement("i"));
}

function renderDetail() {
  const student = selectedStudent();
  dom.emptyState.hidden = Boolean(student);
  dom.studentDetail.hidden = !student;
  if (!student) return;

  dom.detailName.textContent = student.name;
  dom.detailBalance.textContent = student.balance;
  renderJar(student.balance);
  dom.statementList.replaceChildren(...student.entries.slice(0, 20).map(statementItem));
}

function renderJar(balance) {
  dom.detailJar.querySelectorAll(".jar-coin").forEach((coin) => coin.remove());
  const count = Math.min(7, Math.max(1, Math.floor(balance)));
  const spots = [
    [26, 67],
    [43, 75],
    [62, 80],
    [82, 78],
    [101, 70],
    [48, 58],
    [72, 62]
  ];
  spots.slice(0, count).forEach(([left, top]) => {
    const coin = document.createElement("span");
    coin.className = "jar-coin";
    coin.style.left = `${left}px`;
    coin.style.top = `${top}px`;
    dom.detailJar.append(coin);
  });
}

function statementItem(item) {
  const li = document.createElement("li");
  const sign = item.type === "earn" ? "+" : "-";
  const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(item.at));
  li.innerHTML = `
    <strong class="${item.type === "earn" ? "plus" : "minus"}">${sign}${item.amount}</strong>
    <span>${escapeHtml(item.reason)}</span>
    <time>${date}</time>
  `;
  return li;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function addStudent(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const student = {
    id: trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36),
    name: trimmed,
    balance: 0,
    entries: []
  };
  state.students.push(student);
  state.selectedId = student.id;
}

function addTransaction(student, type, amount, reason) {
  const safeAmount = Math.max(1, Math.floor(Number(amount) || 1));
  if (type === "spend" && student.balance - safeAmount < 0) return false;
  student.balance += type === "earn" ? safeAmount : -safeAmount;
  student.entries.unshift(entry(type, safeAmount, reason));
  return true;
}

function createCardSvg(student) {
  const qr = qrSvg(studentQrValue(student), 258, 82, 80);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220" viewBox="0 0 360 220">
  <rect width="360" height="220" rx="18" fill="#fffaf0"/>
  <rect x="10" y="10" width="340" height="200" rx="14" fill="#ffffff" stroke="#263238" stroke-width="4"/>
  <circle cx="82" cy="102" r="46" fill="#f7a8b8" stroke="#263238" stroke-width="4"/>
  <circle cx="68" cy="92" r="4" fill="#263238"/>
  <circle cx="96" cy="92" r="4" fill="#263238"/>
  <ellipse cx="82" cy="112" rx="16" ry="11" fill="#f08096"/>
  <text x="28" y="38" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#66737a">PIGGY BANK</text>
  <text x="140" y="94" font-family="Arial, sans-serif" font-size="32" font-weight="900" fill="#263238">${escapeXml(student.name)}</text>
  <text x="140" y="132" font-family="Arial, sans-serif" font-size="20" font-weight="800" fill="#35a875">${student.balance} Creative Coins</text>
  <rect x="252" y="76" width="92" height="92" rx="8" fill="#ffffff" stroke="#263238" stroke-width="3"/>
  ${qr}
  <text x="28" y="188" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#263238">${escapeXml(state.teacher)}</text>
</svg>`;
}

function placeSvg(svg, x, y) {
  return svg.replace("<svg ", `<svg x="${x}" y="${y}" `);
}

function createCardSheetSvg(students) {
  const cardWidth = 360;
  const cardHeight = 220;
  const margin = 24;
  const gap = 18;
  const columns = 2;
  const rows = Math.max(1, Math.ceil(students.length / columns));
  const width = margin * 2 + columns * cardWidth + (columns - 1) * gap;
  const height = margin * 2 + rows * cardHeight + (rows - 1) * gap;
  const cards = students.map((student, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + column * (cardWidth + gap);
    const y = margin + row * (cardHeight + gap);
    return placeSvg(createCardSvg(student), x, y);
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
${cards}
</svg>`;
}

function firstName(name) {
  return name.trim().split(/\s+/)[0] || name;
}

function fileSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "student";
}

function studentQrValue(student) {
  if (location.protocol === "http:" || location.protocol === "https:") {
    const url = new URL(location.href);
    url.searchParams.set("student", student.id);
    return url.toString();
  }
  return `PIGGYBANK|${student.id}|${student.name}`;
}

function dogTagShape(fill = "none", stroke = "#111111") {
  return `<path d="M54 4H156C179 4 198 23 198 46V314C198 337 179 356 156 356H54C31 356 12 337 12 314V46C12 23 31 4 54 4Z" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`;
}

function dogTagNameLines(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1 || name.length <= 13) return [name.trim()];
  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

function dogTagNameSvg(name, x, y, maxWidth, fontSize = 27, lineHeight = 30) {
  const lines = dogTagNameLines(name);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  return lines.map((line, index) => {
    const textLength = line.length > 13 ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : "";
    return `<text x="${x}" y="${startY + index * lineHeight}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="900" fill="#111111"${textLength}>${escapeXml(line)}</text>`;
  }).join("");
}

async function createDogTagFrontSvg(student) {
  const logo = await logoDataUrl();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2.1in" height="3.6in" viewBox="0 0 210 360">
  <defs>
    <clipPath id="tagClip">${dogTagShape("#ffffff", "none")}</clipPath>
  </defs>
  ${dogTagShape("#ffffff", "#111111")}
  <circle cx="105" cy="36" r="13" fill="#ffffff" stroke="#111111" stroke-width="4"/>
  <image href="${logo}" x="24" y="76" width="162" height="184" preserveAspectRatio="xMidYMid meet" clip-path="url(#tagClip)"/>
  ${dogTagNameSvg(student.name, 105, 300, 160, 18, 22)}
</svg>`;
}

function createDogTagBackSvg(student) {
  const qr = qrSvg(studentQrValue(student), 53, 160, 104);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2.1in" height="3.6in" viewBox="0 0 210 360">
  ${dogTagShape("#ffffff", "#111111")}
  <circle cx="105" cy="36" r="13" fill="#ffffff" stroke="#111111" stroke-width="4"/>
  ${dogTagNameSvg(student.name, 105, 95, 160)}
  <text x="105" y="132" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#111111">Piggy Bank</text>
  <rect x="43" y="150" width="124" height="124" rx="8" fill="#ffffff" stroke="#111111" stroke-width="3"/>
  ${qr}
</svg>`;
}

async function logoDataUrl() {
  const response = await fetch("assets/creative-coin-logo.png");
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function downloadDogTags(student) {
  const slug = fileSlug(student.name);
  download(`${slug}-dog-tag-front.svg`, await createDogTagFrontSvg(student), "image/svg+xml");
  setTimeout(() => {
    download(`${slug}-dog-tag-back.svg`, createDogTagBackSvg(student), "image/svg+xml");
  }, 200);
}

async function createDogTagSheetSvg(students) {
  const tagWidth = 210;
  const tagHeight = 360;
  const labelHeight = 26;
  const margin = 24;
  const pairGap = 18;
  const studentGap = 30;
  const rowGap = 24;
  const pairsPerRow = 2;
  const pairWidth = tagWidth * 2 + pairGap;
  const pairHeight = labelHeight + tagHeight;
  const rows = Math.max(1, Math.ceil(students.length / pairsPerRow));
  const width = margin * 2 + pairsPerRow * pairWidth + (pairsPerRow - 1) * studentGap;
  const height = margin * 2 + rows * pairHeight + (rows - 1) * rowGap;
  const pairs = await Promise.all(students.map(async (student, index) => {
    const column = index % pairsPerRow;
    const row = Math.floor(index / pairsPerRow);
    const x = margin + column * (pairWidth + studentGap);
    const y = margin + row * (pairHeight + rowGap);
    const label = `<text x="${x + pairWidth / 2}" y="${y + 18}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#111111">${escapeXml(student.name)}</text>`;
    const front = placeSvg(await createDogTagFrontSvg(student), x, y + labelHeight);
    const back = placeSvg(createDogTagBackSvg(student), x + tagWidth + pairGap, y + labelHeight);
    return `${label}\n${front}\n${back}`;
  }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
${pairs.join("\n")}
</svg>`;
}

function studentIdFromQr(value) {
  try {
    const url = new URL(value);
    return url.searchParams.get("student") || "";
  } catch {
    const parts = value.split("|");
    return parts[0] === "PIGGYBANK" ? parts[1] : "";
  }
}

async function startScanner() {
  dom.scannerModal.hidden = false;
  dom.scannerStatus.textContent = "Point the camera at a Piggy Bank QR code.";

  if (!("BarcodeDetector" in window)) {
    dom.scannerStatus.textContent = "This browser does not support QR camera scanning yet. Try Chrome or Edge on the Render site.";
    return;
  }

  const formats = await BarcodeDetector.getSupportedFormats();
  if (!formats.includes("qr_code")) {
    dom.scannerStatus.textContent = "This camera scanner cannot read QR codes on this browser.";
    return;
  }

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    dom.scannerVideo.srcObject = scannerStream;
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    scanFrame(detector);
  } catch {
    dom.scannerStatus.textContent = "Camera permission is needed to scan dog tags.";
  }
}

async function scanFrame(detector) {
  if (dom.scannerModal.hidden || !scannerStream) return;
  try {
    const codes = await detector.detect(dom.scannerVideo);
    if (codes.length) {
      const id = studentIdFromQr(codes[0].rawValue);
      if (selectStudentById(id)) {
        dom.scannerStatus.textContent = "Student found.";
        stopScanner();
        return;
      }
      dom.scannerStatus.textContent = "QR code found, but that student is not in this class list.";
    }
  } catch {
    dom.scannerStatus.textContent = "Hold the QR code steady in the camera view.";
  }
  scannerLoop = requestAnimationFrame(() => scanFrame(detector));
}

function stopScanner() {
  cancelAnimationFrame(scannerLoop);
  scannerLoop = 0;
  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
  }
  dom.scannerVideo.srcObject = null;
  dom.scannerModal.hidden = true;
}

function qrSvg(value, x, y, size) {
  const matrix = createQrMatrix(value);
  const quiet = 4;
  const cells = matrix.length + quiet * 2;
  const scale = size / cells;
  const rects = [];
  matrix.forEach((row, rowIndex) => {
    row.forEach((dark, colIndex) => {
      if (!dark) return;
      rects.push(`<rect x="${round(x + (colIndex + quiet) * scale)}" y="${round(y + (rowIndex + quiet) * scale)}" width="${round(scale + 0.02)}" height="${round(scale + 0.02)}"/>`);
    });
  });
  return `<g fill="#111111">${rects.join("")}</g>`;
}

function round(number) {
  return Math.round(number * 100) / 100;
}

function createQrMatrix(value) {
  const version = 4;
  const size = 17 + version * 4;
  const dataCapacity = 80;
  const ecLength = 20;
  const bytes = new TextEncoder().encode(value);
  if (bytes.length > 78) {
    return createQrMatrix(`PIGGYBANK|${state.selectedId || "student"}`);
  }

  const bits = [0, 1, 0, 0, ...byteBits(bytes.length), ...Array.from(bytes).flatMap(byteBits)];
  bits.push(...Array(Math.min(4, dataCapacity * 8 - bits.length)).fill(0));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let index = 0; index < bits.length; index += 8) data.push(bitsToByte(bits.slice(index, index + 8)));
  for (let pad = 0; data.length < dataCapacity; pad += 1) data.push(pad % 2 ? 0x11 : 0xec);

  const codewords = data.concat(reedSolomon(data, ecLength));
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  addFinder(modules, reserved, 0, 0);
  addFinder(modules, reserved, size - 7, 0);
  addFinder(modules, reserved, 0, size - 7);
  addAlignment(modules, reserved, 26, 26);
  addTiming(modules, reserved);
  modules[4 * version + 9][8] = true;
  reserved[4 * version + 9][8] = true;
  reserveFormat(reserved);
  placeData(modules, reserved, codewords);
  addFormat(modules, reserved, 1, 0);

  return modules;
}

function byteBits(value) {
  return Array.from({ length: 8 }, (_, index) => (value >> (7 - index)) & 1);
}

function bitsToByte(bits) {
  return bits.reduce((byte, bit) => (byte << 1) | bit, 0);
}

function addFinder(modules, reserved, x, y) {
  for (let row = -1; row <= 7; row += 1) {
    for (let col = -1; col <= 7; col += 1) {
      const xx = x + col;
      const yy = y + row;
      if (!modules[yy] || modules[yy][xx] === undefined) continue;
      const dark = col >= 0 && col <= 6 && row >= 0 && row <= 6 && (col === 0 || col === 6 || row === 0 || row === 6 || (col >= 2 && col <= 4 && row >= 2 && row <= 4));
      modules[yy][xx] = dark;
      reserved[yy][xx] = true;
    }
  }
}

function addAlignment(modules, reserved, centerX, centerY) {
  for (let row = -2; row <= 2; row += 1) {
    for (let col = -2; col <= 2; col += 1) {
      const dark = Math.max(Math.abs(row), Math.abs(col)) !== 1;
      modules[centerY + row][centerX + col] = dark;
      reserved[centerY + row][centerX + col] = true;
    }
  }
}

function addTiming(modules, reserved) {
  for (let index = 8; index < modules.length - 8; index += 1) {
    const dark = index % 2 === 0;
    modules[6][index] = dark;
    modules[index][6] = dark;
    reserved[6][index] = true;
    reserved[index][6] = true;
  }
}

function reserveFormat(reserved) {
  const size = reserved.length;
  for (let index = 0; index < 9; index += 1) {
    reserved[8][index] = true;
    reserved[index][8] = true;
    reserved[8][size - 1 - index] = true;
    reserved[size - 1 - index][8] = true;
  }
}

function placeData(modules, reserved, codewords) {
  const bits = codewords.flatMap(byteBits);
  let bitIndex = 0;
  let upward = true;
  for (let right = modules.length - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < modules.length; vertical += 1) {
      const row = upward ? modules.length - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const col = right - offset;
        if (reserved[row][col]) continue;
        const bit = bits[bitIndex] || 0;
        modules[row][col] = Boolean(bit) !== ((row + col) % 2 === 0);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

function addFormat(modules, reserved, ecLevel, mask) {
  const size = modules.length;
  const format = formatBits((ecLevel << 3) | mask);
  const set = (row, col, index) => {
    modules[row][col] = Boolean((format >> index) & 1);
    reserved[row][col] = true;
  };

  for (let index = 0; index <= 5; index += 1) set(8, index, index);
  set(8, 7, 6);
  set(8, 8, 7);
  set(7, 8, 8);
  for (let index = 9; index < 15; index += 1) set(14 - index, 8, index);
  for (let index = 0; index < 8; index += 1) set(size - 1 - index, 8, index);
  for (let index = 8; index < 15; index += 1) set(8, size - 15 + index, index);
}

function formatBits(value) {
  let data = value << 10;
  const generator = 0x537;
  for (let shift = 14; shift >= 10; shift -= 1) {
    if ((data >> shift) & 1) data ^= generator << (shift - 10);
  }
  return ((value << 10) | data) ^ 0x5412;
}

function reedSolomon(data, degree) {
  const generator = rsGenerator(degree);
  const result = Array(degree).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ result.shift();
    result.push(0);
    generator.forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor);
    });
  });
  return result;
}

function rsGenerator(degree) {
  let result = [1];
  for (let index = 0; index < degree; index += 1) {
    const next = Array(result.length + 1).fill(0);
    result.forEach((coefficient, coefficientIndex) => {
      next[coefficientIndex] ^= coefficient;
      next[coefficientIndex + 1] ^= gfMultiply(coefficient, gfPow(index));
    });
    result = next;
  }
  return result.slice(1);
}

function gfPow(power) {
  let value = 1;
  for (let index = 0; index < power; index += 1) value = gfMultiply(value, 2);
  return value;
}

function gfMultiply(left, right) {
  let result = 0;
  for (let index = 0; index < 8; index += 1) {
    if (right & 1) result ^= left;
    const carry = left & 0x80;
    left = (left << 1) & 0xff;
    if (carry) left ^= 0x1d;
    right >>= 1;
  }
  return result;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;"
  })[char]);
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function cloudConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function normalizeClassCode(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-|-$/g, "");
}

async function hashPin(classCode, pin) {
  const payload = `${classCode}:${pin}`;
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function exportCloudState() {
  return {
    teacher: state.teacher,
    selectedId: state.selectedId,
    view: state.view,
    students: state.students
  };
}

async function supabaseRpc(functionName, payload) {
  const base = SUPABASE_URL.replace(/\/$/, "");
  const response = await fetch(`${base}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Cloud request failed: ${response.status}`);
  return response.json();
}

async function connectCloud(event) {
  event.preventDefault();
  if (!cloudConfigured()) {
    renderCloudStatus("Add Supabase URL/key");
    return;
  }

  const classCode = normalizeClassCode(dom.classCode.value);
  const pin = dom.classPin.value.trim();
  if (!classCode || pin.length < 4) {
    renderCloudStatus("Class code + 4 digit PIN");
    return;
  }

  renderCloudStatus("Connecting...");
  const pinHash = await hashPin(classCode, pin);
  try {
    const result = await supabaseRpc("pb_load_class", {
      p_class_code: classCode,
      p_pin_hash: pinHash
    });

    if (result.status === "bad_pin") {
      renderCloudStatus("Wrong PIN");
      return;
    }

    cloud = { classCode, pinHash, connected: true };
    saveCloudSettings();

    if (result.status === "found" && result.state) {
      state = { ...structuredClone(starterState), ...result.state };
      state.selectedId = state.students.some((student) => student.id === state.selectedId)
        ? state.selectedId
        : state.students[0]?.id || "";
      render();
      renderCloudStatus("Loaded from cloud");
      return;
    }

    await saveCloudNow("Created cloud class");
    render();
  } catch {
    renderCloudStatus("Cloud unavailable");
  }
}

function scheduleCloudSave() {
  if (!cloudConfigured() || !cloud.connected || !cloud.classCode || !cloud.pinHash) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => saveCloudNow(), 900);
}

async function saveCloudNow(successMessage = "Synced") {
  if (!cloudConfigured()) {
    renderCloudStatus("Add Supabase URL/key");
    return;
  }
  if (!cloud.connected || !cloud.classCode || !cloud.pinHash) {
    renderCloudStatus("Connect first");
    return;
  }

  renderCloudStatus("Syncing...");
  try {
    const result = await supabaseRpc("pb_save_class", {
      p_class_code: cloud.classCode,
      p_pin_hash: cloud.pinHash,
      p_state: exportCloudState()
    });
    renderCloudStatus(result.status === "saved" ? successMessage : "Cloud error");
  } catch {
    renderCloudStatus("Cloud unavailable");
  }
}

function printCards(students) {
  document.querySelector("#printSheet")?.remove();
  const sheet = document.createElement("main");
  sheet.id = "printSheet";
  sheet.style.gridTemplateColumns = "repeat(2, 360px)";
  sheet.style.gap = "18px";
  sheet.style.padding = "24px";
  sheet.innerHTML = students.map(createCardSvg).join("");
  document.body.append(sheet);
  document.body.classList.add("printing-cards");
  window.print();
  document.body.classList.remove("printing-cards");
}

dom.teacherName.addEventListener("input", () => {
  state.teacher = dom.teacherName.value;
  saveState();
});

dom.cloudForm.addEventListener("submit", (event) => {
  connectCloud(event);
});

dom.syncNow.addEventListener("click", () => {
  saveCloudNow();
});

dom.scanCode.addEventListener("click", () => {
  startScanner();
});

dom.closeScanner.addEventListener("click", () => {
  stopScanner();
});

dom.studentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addStudent(dom.studentName.value);
  dom.studentName.value = "";
  render();
});

dom.studentsGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".student-button");
  if (!button) return;
  state.selectedId = button.dataset.id;
  render();
});

dom.amountButtons.forEach((button) => {
  button.addEventListener("click", () => {
    chosenAmount = Number(button.dataset.amount);
    dom.customAmount.value = "";
    dom.amountButtons.forEach((item) => item.classList.toggle("active", item === button));
  });
});

dom.customAmount.addEventListener("input", () => {
  chosenAmount = Number(dom.customAmount.value) || 1;
  dom.amountButtons.forEach((button) => button.classList.remove("active"));
});

dom.moneyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  const student = selectedStudent();
  if (!student || !submitter) return;
  addTransaction(student, submitter.value, chosenAmount, dom.reason.value);
  render();
});

dom.deleteStudent.addEventListener("click", () => {
  const student = selectedStudent();
  if (!student) return;
  state.students = state.students.filter((item) => item.id !== student.id);
  state.selectedId = state.students[0]?.id || "";
  render();
});

dom.resetStudent.addEventListener("click", () => {
  const student = selectedStudent();
  if (!student) return;
  student.balance = 0;
  student.entries.unshift(entry("spend", 0, "Fresh Start"));
  render();
});

dom.printOne.addEventListener("click", () => {
  const student = selectedStudent();
  if (student) printCards([student]);
});

dom.printCards.addEventListener("click", () => {
  printCards(state.students);
});

dom.downloadSvg.addEventListener("click", () => {
  if (!state.students.length) return;
  download("piggy-bank-card-sheet.svg", createCardSheetSvg(state.students), "image/svg+xml");
});

dom.downloadDogTag.addEventListener("click", async () => {
  if (!state.students.length) return;
  download("piggy-bank-dog-tag-sheet.svg", await createDogTagSheetSvg(state.students), "image/svg+xml");
});

dom.exportData.addEventListener("click", () => {
  download("piggy-bank-data.json", JSON.stringify(state, null, 2), "application/json");
});

dom.importData.addEventListener("change", async () => {
  const file = dom.importData.files[0];
  if (!file) return;
  const text = await file.text();
  const imported = JSON.parse(text);
  if (Array.isArray(imported.students)) {
    state = imported;
    render();
  }
  dom.importData.value = "";
});

dom.viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    dom.viewButtons.forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

dom.classActions.forEach((button) => {
  button.addEventListener("click", () => {
    const student = selectedStudent();
    if (!student) return;
    const action = button.dataset.classAction;
    const presets = {
      bonus: [5, "Happy Helper"],
      payday: [10, "Payday"],
      cleanup: [2, "Clean Up"]
    };
    const [amount, reason] = presets[action];
    addTransaction(student, "earn", amount, reason);
    render();
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

selectStudentFromUrl();
dom.amountButtons[0].classList.add("active");
dom.viewButtons.forEach((item) => item.classList.toggle("active", item.dataset.view === state.view));
render();

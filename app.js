const productDB = {
  "4710114128036": {
    id: "4710114128036",
    name: "保濕修護化妝水 200ml",
    price: 299,
    ingredients: "玻尿酸、神經醯胺、甘油",
    rating: 4.6,
    skin: "乾性 / 混合偏乾",
  },
  "4710409091025": {
    id: "4710409091025",
    name: "控油淨痘潔面乳 120ml",
    price: 259,
    ingredients: "水楊酸、茶樹精油、菸鹼醯胺",
    rating: 4.3,
    skin: "油性 / 混合偏油",
  },
  "4901301334561": {
    id: "4901301334561",
    name: "敏感肌舒緩乳霜 50g",
    price: 389,
    ingredients: "積雪草、維他命B5、角鯊烷",
    rating: 4.8,
    skin: "敏感肌 / 乾性",
  },
  "8809647390248": {
    id: "8809647390248",
    name: "亮白精華液 30ml",
    price: 459,
    ingredients: "傳明酸、維他命C衍生物、熊果素",
    rating: 4.4,
    skin: "一般肌 / 暗沉肌",
  },
};

const state = {
  scannedProducts: [],
  selectedIds: new Set(),
  stream: null,
  scanLoopId: null,
  zxingReader: null,
};

const startScanBtn = document.getElementById("start-scan-btn");
const stopScanBtn = document.getElementById("stop-scan-btn");
const cameraPreview = document.getElementById("camera-preview");
const barcodeInput = document.getElementById("barcode-input");
const addBarcodeBtn = document.getElementById("add-barcode-btn");
const selectorRow = document.getElementById("selector-row");
const compareGrid = document.getElementById("compare-grid");
const scanStatus = document.getElementById("scan-status");

function setScanStatus(message, type = "") {
  if (!scanStatus) return;
  scanStatus.textContent = message;
  scanStatus.className = `scan-status ${type}`.trim();
}

function getProductByBarcode(barcode) {
  if (productDB[barcode]) return productDB[barcode];

  // Allow demo with unknown barcodes.
  const suffix = barcode.slice(-4).padStart(4, "0");
  return {
    id: barcode,
    name: `自訂商品 #${suffix}`,
    price: 199 + Number(suffix) % 300,
    ingredients: "待補充",
    rating: 3.8 + ((Number(suffix) % 12) / 10),
    skin: "請於實品頁補充",
  };
}

function addProduct(barcode) {
  if (!barcode) return;
  // Normalize barcode text: ZXing may return non-digit wrapper chars.
  // Watsons demo DB expects numeric EAN/UPC-like codes.
  let clean = barcode.trim();
  const digitsOnly = clean.replace(/[^\d]/g, "");
  if (digitsOnly) clean = digitsOnly;
  if (!clean) return;

  const exists = state.scannedProducts.some((p) => p.id === clean);
  if (exists) return;

  const product = getProductByBarcode(clean);
  state.scannedProducts.push(product);
  state.selectedIds.add(product.id);
  render();
}

function renderSelectors() {
  if (!state.scannedProducts.length) {
    selectorRow.innerHTML = "<p class='hint'>尚未加入商品，先掃描一個條碼吧。</p>";
    return;
  }

  selectorRow.innerHTML = state.scannedProducts
    .map(
      (product) => `
      <label class="pick-card">
        <h3>${product.name}</h3>
        <p>條碼：${product.id}</p>
        <div class="pick-toggle">
          <input type="checkbox" data-id="${product.id}" ${state.selectedIds.has(product.id) ? "checked" : ""} />
          <span>加入比較</span>
        </div>
      </label>`
    )
    .join("");
}

function renderCompareGrid() {
  const selected = state.scannedProducts.filter((p) => state.selectedIds.has(p.id));
  if (!selected.length) {
    compareGrid.innerHTML = "<p class='hint'>請至少勾選一個商品。</p>";
    return;
  }

  compareGrid.innerHTML = selected
    .map(
      (p) => `
      <article class="compare-card">
        <h4>${p.name}</h4>
        <p class="kv"><span>價格</span><br />NT$${p.price}</p>
        <p class="kv"><span>成分</span><br />${p.ingredients}</p>
        <p class="kv"><span>評價</span><br />${p.rating.toFixed(1)} / 5</p>
        <p class="kv"><span>適合膚質</span><br />${p.skin}</p>
      </article>`
    )
    .join("");
}

function render() {
  renderSelectors();
  renderCompareGrid();
}

selectorRow.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const id = target.dataset.id;
  if (!id) return;
  if (target.checked) state.selectedIds.add(id);
  else state.selectedIds.delete(id);
  renderCompareGrid();
});

addBarcodeBtn.addEventListener("click", () => {
  addProduct(barcodeInput.value);
  barcodeInput.value = "";
  barcodeInput.focus();
});

barcodeInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  addProduct(barcodeInput.value);
  barcodeInput.value = "";
});

async function startScan() {
  try {
    if (!window.isSecureContext) {
      setScanStatus("目前不是 HTTPS 網址，手機瀏覽器會封鎖相機。", "error");
      return;
    }

    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      setScanStatus("此瀏覽器不支援相機存取，請改用手動輸入。", "error");
      return;
    }

    cameraPreview.style.display = "block";
    startScanBtn.disabled = true;
    stopScanBtn.disabled = false;
    setScanStatus("正在啟動相機...", "");

    if ("BarcodeDetector" in window) {
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      cameraPreview.srcObject = state.stream;
      await cameraPreview.play();
      runScanLoop();
      setScanStatus("掃描中（BarcodeDetector）", "ok");
      return;
    }

    if (window.ZXing && window.ZXing.BrowserMultiFormatReader) {
      state.zxingReader = new window.ZXing.BrowserMultiFormatReader();
      await state.zxingReader.decodeFromVideoDevice(
        null,
        cameraPreview,
        (result, error) => {
          if (result) {
            const text =
              (typeof result.getText === "function" ? result.getText() : undefined) ??
              result.text ??
              "";
            if (text) addProduct(text);
          }
          if (error && !(error instanceof window.ZXing.NotFoundException)) {
            // Ignore most frame-level decode errors; continue scanning.
          }
        }
      );
      setScanStatus("掃描中（ZXing 相容模式）", "ok");
      return;
    }

    setScanStatus("目前裝置不支援條碼掃描，請改用手動輸入。", "error");
    stopScan();
  } catch (error) {
    const reason = error && error.name ? `（${error.name}）` : "";
    setScanStatus(`無法啟用相機${reason}，請檢查權限。`, "error");
    stopScan();
  }
}

async function runScanLoop() {
  const detector = new BarcodeDetector({
    formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"],
  });

  const tick = async () => {
    if (!state.stream) return;
    try {
      const barcodes = await detector.detect(cameraPreview);
      if (barcodes.length > 0 && barcodes[0].rawValue) {
        addProduct(barcodes[0].rawValue);
      }
    } catch (_) {
      // Ignore transient frame detection errors.
    }
    state.scanLoopId = requestAnimationFrame(tick);
  };
  tick();
}

function stopScan() {
  if (state.scanLoopId) cancelAnimationFrame(state.scanLoopId);
  state.scanLoopId = null;
  if (state.zxingReader) {
    state.zxingReader.reset();
    state.zxingReader = null;
  }
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }
  state.stream = null;
  cameraPreview.pause();
  cameraPreview.srcObject = null;
  cameraPreview.style.display = "none";
  startScanBtn.disabled = false;
  stopScanBtn.disabled = true;
  if (!scanStatus.classList.contains("error")) {
    setScanStatus("掃描已停止");
  }
}

startScanBtn.addEventListener("click", startScan);
stopScanBtn.addEventListener("click", stopScan);

render();

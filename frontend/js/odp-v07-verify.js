(function () {
  "use strict";
  const copy = {
    en: { title: "Verify a passport", subtitle: "ODP 0.7 · Polygon", home: "Home", legacy: "Other verification tools", intro: "Enter a passport ID or odp:// locator to read its registration. No wallet, password or recovery phrase is needed.", label: "Passport ID", button: "Check registration", scope: "Files and individual edition items are not checked here yet.", checking: "Reading the registry…", invalid: "Enter a passport ID in the format ODP-YYYY-MM-000000000.", error: "The registration could not be read. Check the ID and connection, then try again.", registered: "Registration found on the ODP 0.7 registry", revoked: "This passport has been withdrawn.", active: "This passport is not withdrawn.", printed: "Confirmed for print", deadline: "Withdrawal deadline", issuer: "Profile", author: "Author name declared by issuer", object: "Object", block: "Finalized block", files: "Files: not checked", item: "Individual edition item: not checked", detail: "Registration records what the issuer submitted. It does not establish the identity of the issuer or the authenticity of the object.", switch: "Change language to Russian" },
    ru: { title: "Проверить паспорт", subtitle: "ODP 0.7 · Polygon", home: "Главная", legacy: "Другие инструменты проверки", intro: "Введите номер паспорта или адрес odp://, чтобы прочитать запись в реестре. Кошелёк, пароль и секретная фраза не нужны.", label: "Номер паспорта", button: "Проверить запись", scope: "Файлы и отдельные экземпляры тиража здесь пока не проверяются.", checking: "Читаем реестр…", invalid: "Введите номер в формате ODP-ГГГГ-ММ-000000000.", error: "Не удалось прочитать запись. Проверьте номер и подключение и попробуйте снова.", registered: "Запись найдена в реестре ODP 0.7", revoked: "Этот паспорт отозван.", active: "Этот паспорт не отозван.", printed: "Подтверждён для печати", deadline: "Срок отзыва", issuer: "Профиль", author: "Имя автора по заявлению издателя", object: "Объект", block: "Финализированный блок", files: "Файлы: не проверены", item: "Экземпляр тиража: не проверен", detail: "Реестр хранит сведения, внесённые издателем. Запись не подтверждает личность издателя или подлинность объекта.", switch: "Switch language to English" },
  };
  Object.assign(copy.en, { unitLabel: "Unit index, if known (starts at 0)", scope: "File integrity and possession of an edition item are not checked here yet.", editionOpen: "Edition opened", editionClosed: "Edition not opened", editionCount: "Edition size", editionUnavailable: "Edition state could not be read", unitActive: "First proof of access to the unit key is recorded; the buyer is not recorded", unitInactive: "Unit activation not recorded", unitInvalid: "Enter a unit index from 0 to 1048575." });
  Object.assign(copy.ru, { unitLabel: "Индекс экземпляра, если известен (с 0)", scope: "Целостность файлов и владение экземпляром тиража здесь пока не проверяются.", editionOpen: "Тираж открыт", editionClosed: "Тираж не открыт", editionCount: "Размер тиража", editionUnavailable: "Не удалось прочитать состояние тиража", unitActive: "Записано первое подтверждение доступа к ключу экземпляра; покупатель не указан", unitInactive: "Активация экземпляра не записана", unitInvalid: "Введите индекс экземпляра от 0 до 1048575." });
  Object.assign(copy.en, { bundleLabel: "Or select an .odpass file", scope: "Checking a file is local. A network connection is needed to confirm registration.", bundleChecking: "Checking the file…", bundleInvalid: "This file could not be checked. It may be invalid, incomplete, too large or unsupported by this browser.", localMatched: "Archive files match their manifest. The passport schema and deployment details match.", chainUnconfirmed: "Registration is not confirmed. Check the connection or the file and try again.", chainConfirmed: "The passport content and mint receipt match the ODP 0.7 registry.", editionUnverified: "The edition address list and individual item are not verified.", filesVerified: "Archive files and passport hashes match the registry." });
  Object.assign(copy.ru, { bundleLabel: "Или выберите файл .odpass", scope: "Файл проверяется локально. Для подтверждения записи нужен интернет.", bundleChecking: "Проверяем файл…", bundleInvalid: "Не удалось проверить файл. Он может быть повреждён, неполон, слишком велик или не поддерживается этим браузером.", localMatched: "Файлы архива соответствуют манифесту. Схема паспорта и конфигурация поколения проверены.", chainUnconfirmed: "Регистрация не подтверждена. Проверьте подключение или файл и попробуйте снова.", chainConfirmed: "Содержимое паспорта и квитанция выпуска соответствуют реестру ODP 0.7.", editionUnverified: "Список адресов тиража и отдельный экземпляр не проверены.", filesVerified: "Файлы архива и хеши паспорта соответствуют реестру." });
  copy.en.editionUnverified = "The edition address list matches its committed root. The individual item is not verified.";
  copy.ru.editionUnverified = "Список адресов тиража соответствует зафиксированному корню. Отдельный экземпляр не проверен.";
  Object.assign(copy.en,{remaining:"Withdrawal time remaining at this block",hoursShort:"h",minutesShort:"min",recent:"Recently issued",recentDetail:"The issuer may still withdraw this passport until"});
  Object.assign(copy.ru,{remaining:"Осталось на отзыв на момент этого блока",hoursShort:"ч",minutesShort:"мин",recent:"Недавно выпущен",recentDetail:"Издатель может отозвать этот паспорт до"});
  Object.assign(copy.en,{activationBlock:"Activation block",activationBlockUnavailable:"Activation event block could not be confirmed"});
  Object.assign(copy.ru,{activationBlock:"Блок активации",activationBlockUnavailable:"Не удалось подтвердить блок события активации"});
  Object.assign(copy.en, { scan: "Scan passport QR code", closeScan: "Close camera", scanUnavailable: "The QR scanner could not start. Enter the passport ID or select an .odpass file.", scanInvalid: "This QR code does not contain a supported passport ID." });
  Object.assign(copy.ru, { scan: "Сканировать QR-код паспорта", closeScan: "Закрыть камеру", scanUnavailable: "Не удалось запустить сканер. Введите номер паспорта или выберите файл .odpass.", scanInvalid: "В этом QR-коде нет номера паспорта поддерживаемого формата." });
  Object.assign(copy.en, {profileTitle:"Verify a profile",profileLabel:"Profile ID",profileButton:"Check profile",profileInvalid:"Enter a C, B, P or M profile ID in the format B-123-456-789-012.",profileFound:"Profile found in the ODP 0.7 registry",profileWallet:"Registered wallet",profileDate:"Registered at",profileDetail:"Registration does not establish the identity of the wallet holder."});
  Object.assign(copy.ru, {profileTitle:"Проверить профиль",profileLabel:"Номер профиля",profileButton:"Проверить профиль",profileInvalid:"Введите номер C, B, P или M в формате B-123-456-789-012.",profileFound:"Профиль найден в реестре ODP 0.7",profileWallet:"Зарегистрированный кошелёк",profileDate:"Дата регистрации",profileDetail:"Регистрация не подтверждает личность владельца кошелька."});
  const form = document.getElementById("lookup"), field = document.getElementById("passport-id"), unit = document.getElementById("unit-index");
  const result = document.getElementById("result"), submit = document.getElementById("submit"), language = document.getElementById("language"), bundleFile = document.getElementById("bundle-file");
  let locale;
  try { locale = localStorage.getItem("odp_locale"); } catch (_) {}
  if (locale !== "en" && locale !== "ru") locale = (navigator.language || "").toLowerCase().startsWith("ru") ? "ru" : "en";
  let state = null, busy = false;
  const text = key => copy[locale][key];
  const profileForm = document.getElementById("profile-lookup"), profileField = document.getElementById("profile-id"), profileResult = document.getElementById("profile-result");
  let profileState = null, profileBusy = false;
  profileField.addEventListener("input", () => { profileState = null; renderProfile(); });
  function renderProfile() {
    profileResult.replaceChildren();
    if (!profileState) return;
    const add = value => { const p = document.createElement("p"); p.textContent = value; profileResult.appendChild(p); };
    if (profileState.key) { add(text(profileState.key)); return; }
    const profile = profileState.record.profile;
    add(text("profileFound"));
    add(profile.creatorId);
    add(text("profileWallet") + ": " + profile.wallet);
    add(text("profileDate") + ": " + new Date(Number(profile.timestamp.toString()) * 1000).toLocaleString(locale === "ru" ? "ru-RU" : "en-US"));
    add(text("block") + ": " + profileState.record.blockNumber);
    add(text("profileDetail"));
  }
  profileForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (profileBusy) return;
    const id = profileField.value.trim().toUpperCase();
    if (!/^[CBPM]-(?:[0-9]{3}-){3}[0-9]{3}$/.test(id)) { profileState = {key:"profileInvalid"}; renderProfile(); return; }
    profileBusy = true;
    profileField.disabled = true;
    profileForm.querySelector("button").disabled = true;
    profileState = {key:"checking"}; renderProfile();
    try {
      if (!window.ethers || !window.ODPV07Reader) throw new Error("Reader unavailable");
      const response = await fetch("backend/config/odp-0.7/ObjectDigitalPassport.json");
      if (!response.ok) throw new Error("ABI unavailable");
      const abi = await response.json();
      let record;
      for (const endpoint of ["https://polygon.drpc.org", "https://polygon-bor-rpc.publicnode.com"]) {
        try {
          const provider = new ethers.providers.JsonRpcProvider({url:endpoint,timeout:10000}, {name:"polygon",chainId:137});
          const client = await ODPV07Reader.open(provider, abi, ethers);
          record = await client.readProfileById(id);
          break;
        } catch (_) {}
      }
      if (!record) throw new Error("Profile unavailable");
      profileState = {record};
    } catch (_) { profileState = {key:"error"}; }
    finally { profileBusy = false; profileField.disabled = false; profileForm.querySelector("button").disabled = false; renderProfile(); }
  });
  function passportId(value) {
    const match=/^(?:odp:\/\/)?(ODP-[0-9]{4}-(?:0[1-9]|1[0-2])-[0-9]{9})$/i.exec(String(value||'').trim());
    return match ? match[1].toUpperCase() : null;
  }
  function scannedPassportId(value) {
    const direct = passportId(value);
    if (direct) return direct;
    try {
      const url = new URL(value);
      if (url.origin !== "https://object-digital-passport.github.io" || url.username || url.password || url.hash) return null;
      if (!["/", "/verify.html", "/verify-07.html"].includes(url.pathname)) return null;
      const entries = [...url.searchParams];
      return entries.length === 1 && ["odp", "id"].includes(entries[0][0]) ? passportId(entries[0][1]) : null;
    } catch (_) { return null; }
  }

  const scanButton = document.getElementById("scan-qr");
  const scanStatus = document.getElementById("scan-status");
  const dialog = document.getElementById("qr-dialog");
  const video = document.getElementById("qr-video");
  let scanSession, scanMessage;
  async function loadQrDecoder() {
    if (typeof window.jsQR === "function") return;
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
    script.integrity = "sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx";
    script.crossOrigin = "anonymous";
    let timeout;
    try {
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        timeout = setTimeout(() => reject(new Error("QR decoder timed out")), 15000);
        document.head.appendChild(script);
      });
      if (typeof window.jsQR !== "function") throw new Error("QR decoder unavailable");
    } finally { clearTimeout(timeout); script.remove(); }
  }
  function stopScan() {
    if (!scanSession) return;
    cancelAnimationFrame(scanSession.frame);
    scanSession.stream?.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    scanSession = null;
  }
  dialog.addEventListener("close", () => { if (!dialog.open) stopScan(); });
  window.addEventListener("pagehide", stopScan);
  scanButton.addEventListener("click", async () => {
    if (busy || dialog.open) return;
    scanMessage = null;
    scanStatus.textContent = "";
    const session = {};
    scanSession = session;
    try {
      dialog.showModal();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (scanSession !== session || !dialog.open) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      session.stream = stream;
      video.srcObject = stream;
      await video.play();
      await loadQrDecoder();
      if (scanSession !== session || !dialog.open) return;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas unavailable");
      function frame() {
        if (scanSession !== session || !dialog.open) return;
        if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = window.jsQR(pixels.data, canvas.width, canvas.height);
          if (code?.data) {
            const id = scannedPassportId(code.data);
            stopScan();
            dialog.close();
            if (id) {
              field.value = id;
              unit.value = "";
              form.requestSubmit();
            } else {
              scanMessage = "scanInvalid";
              scanStatus.textContent = text(scanMessage);
            }
            return;
          }
        }
        session.frame = requestAnimationFrame(frame);
      }
      session.frame = requestAnimationFrame(frame);
    } catch (_) {
      if (scanSession !== session) return;
      stopScan();
      if (dialog.open) dialog.close();
      scanMessage = "scanUnavailable";
      scanStatus.textContent = text(scanMessage);
    }
  });
  function append(tag, value) { const el = document.createElement(tag); el.textContent = value; result.appendChild(el); }
  function render() {
    scanStatus.textContent = scanMessage ? text(scanMessage) : "";
    renderProfile();
    document.documentElement.lang = locale;
    document.querySelectorAll("[data-copy]").forEach(el => { el.textContent = text(el.dataset.copy); });
    language.textContent = locale === "ru" ? "EN" : "RU";
    language.setAttribute("aria-label", text("switch"));
    result.replaceChildren();
    if (!state) return;
    if (state.kind === "bundleOffline") { append("p", text("localMatched")); append("p", text("chainUnconfirmed")); append("p", text("detail")); return; }
    if (state.kind !== "record") { append("p", text(state.kind)); return; }
    const r = state.record, date = value => new Date(Number(value.toString()) * 1000).toLocaleString(locale === "ru" ? "ru-RU" : "en-US");
    append("h2", text("registered"));
    append("p", r.classification.revoked ? text("revoked") : text("active"));
    append("p", text("object") + ": " + r.header.title);
    append("p", text("author") + ": " + r.header.authorName);
    append("p", text("issuer") + ": " + r.header.creatorId);
    append("p", text("deadline") + ": " + date(r.release.revocationDeadline));
    const snapshotTime=Number(r.blockTimestamp), deadline=Number(r.release.revocationDeadline.toString());
    const remaining=deadline-snapshotTime;
    if(Number.isSafeInteger(snapshotTime)&&Number.isSafeInteger(deadline)&&remaining>0&&!r.classification.revoked&&Number(r.release.printFinalizedAt.toString())===0){
      const totalMinutes=Math.ceil(remaining/60);
      append("p",text("remaining")+": "+Math.floor(totalMinutes/60)+' '+text("hoursShort")+' '+(totalMinutes%60)+' '+text("minutesShort"));
      if(Number(r.classification.editionModel)!==1){append("p",text("recent"));append("p",text("recentDetail")+' '+date(r.release.revocationDeadline));}
    }
    if (Number(r.release.printFinalizedAt.toString()) > 0) append("p", text("printed") + ": " + date(r.release.printFinalizedAt));
    append("p", text("block") + ": " + r.blockNumber);
    append("p", text(state.bundleVerified ? "filesVerified" : "files"));
    if (state.bundleVerified) append("p", text("chainConfirmed"));
    if (Number(r.classification.editionModel) !== 1) {
      if (state.edition) {
        append("p", state.edition.edition.open ? text("editionOpen") : text("editionClosed"));
        if (state.edition.edition.open) append("p", text("editionCount") + ": " + state.edition.edition.unitCount);
        if (state.edition.activation) { const time=Number(state.edition.activation.timestamp.toString()); append("p", time > 0 ? text("unitActive")+" · #"+state.edition.unitIndex+" · "+date(time) : text("unitInactive")); if(time>0)append("p",state.activationBlock ? text("activationBlock")+": "+state.activationBlock : text("activationBlockUnavailable")); }
      } else append("p", text("editionUnavailable"));
      append("p", text("item"));
      if (state.editionAddressListVerified) append("p", text("editionUnverified"));
    }
    append("p", text("detail"));
  }
  language.addEventListener("click", () => { locale = locale === "en" ? "ru" : "en"; try { localStorage.setItem("odp_locale", locale); } catch (_) {} render(); });
  for (const input of [field, unit]) input.addEventListener("input", () => { state = null; render(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    const id = passportId(field.value);
    if (!id) { state = { kind: "invalid" }; render(); return; }
    const unitValue = unit.value.trim();
    if (unitValue && (!/^(0|[1-9][0-9]*)$/.test(unitValue) || Number(unitValue) > 1048575)) { state = { kind: "unitInvalid" }; render(); return; }
    busy = true; submit.disabled = true; bundleFile.disabled = true; field.disabled = true; unit.disabled = true; state = { kind: "checking" }; render();
    try {
      if (!window.ethers || !window.ODPV07Reader) throw new Error("Reader unavailable");
      const response = await fetch("backend/config/odp-0.7/ObjectDigitalPassport.json");
      if (!response.ok) throw new Error("ABI unavailable");
      const abi = await response.json();
      let record, edition, activationBlock, error;
      for (const endpoint of ["https://polygon.drpc.org", "https://polygon-bor-rpc.publicnode.com"]) {
        try {
          const provider = new ethers.providers.JsonRpcProvider({url:endpoint,timeout:10000}, { name: "polygon", chainId: 137 });
          const client = await ODPV07Reader.open(provider, abi, ethers);
          record = await client.readPassport(id);
          if ((Number(record.media.anchorTypesMask) & 4096) !== 0 && [2, 3].includes(Number(record.classification.editionModel))) {
            try {
              const editionResponse = await fetch("backend/config/odp-0.7/ODPEditionUnits.json");
              if (!editionResponse.ok) throw new Error("Edition ABI unavailable");
              const editionAbi=await editionResponse.json();
              edition = await client.readEdition(id, editionAbi, unitValue ? Number(unitValue) : null);
              record = edition.passport;
              if(edition.activation && Number(edition.activation.timestamp.toString())>0 && typeof client.readActivationBlock==='function') {
                state={kind:'record',record,edition};render();
                let timer; try {
                  const found=await Promise.race([client.readActivationBlock(id,editionAbi,Number(unitValue)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Activation event timeout')),12000);})]);
                  if(found && found.timestamp===edition.activation.timestamp.toString() && found.unitAddress===String(edition.activation.unitAddress).toLowerCase())activationBlock=found.blockNumber;
                } catch (_) {} finally { clearTimeout(timer); }
              }
            } catch (_) { edition = null; }
          }
          break;
        } catch (err) { error = err; }
      }
      if (!record) throw error || new Error("Registry unavailable");
      state = { kind: "record", record, edition, activationBlock };
    } catch (_) { state = { kind: "error" }; }
    finally { busy = false; submit.disabled = false; bundleFile.disabled = false; field.disabled = false; unit.disabled = false; render(); }
  });
  bundleFile.addEventListener("change", async () => {
    const file = bundleFile.files && bundleFile.files[0];
    if (!file || busy) return;
    busy = true; submit.disabled = true; bundleFile.disabled = true; state = { kind: "bundleChecking" }; render();
    try {
      if (file.size > 104857600 || !window.ODPV07Zip || !window.ODPV07Bundle) throw new Error("File unavailable");
      const entries = await ODPV07Zip.extract(new Uint8Array(await file.arrayBuffer()));
      const generationResponse = await fetch("backend/config/odp-0.7/generation.json");
      if (!generationResponse.ok) throw new Error("Generation unavailable");
      const generation = await generationResponse.json();
      await ODPV07Bundle.inspectEntries(entries, generation);
      state = { kind: "bundleOffline" }; render();
      try {
        if (!window.ethers || !window.ODPV07Reader) throw new Error("Reader unavailable");
        const response = await fetch("backend/config/odp-0.7/ObjectDigitalPassport.json");
        if (!response.ok) throw new Error("ABI unavailable");
        const abi = await response.json();
        const editionResponse = await fetch("backend/config/odp-0.7/ODPEditionUnits.json");
        if (!editionResponse.ok) throw new Error("Edition ABI unavailable");
        const editionAbi = await editionResponse.json();
        for (const endpoint of ["https://polygon.drpc.org", "https://polygon-bor-rpc.publicnode.com"]) {
          try {
            const provider = new ethers.providers.JsonRpcProvider({url:endpoint,timeout:10000}, { name: "polygon", chainId: 137 });
            const client = await ODPV07Reader.open(provider, abi, ethers);
            const verified = await ODPV07Bundle.verifyEntries(entries, generation, client, ethers, editionAbi);
            state = { kind: "record", record: verified.record, edition: verified.edition, bundleVerified: true, editionAddressListVerified: verified.editionAddressList === "verified" }; break;
          } catch (_) {}
        }
      } catch (_) {}
    } catch (_) { state = { kind: "bundleInvalid" }; }
    finally { busy = false; submit.disabled = false; bundleFile.disabled = false; bundleFile.value = ""; render(); }
  });
  const query = new URLSearchParams(location.search), id = query.getAll('id').length===1 ? passportId(query.get('id')) : null;
  if (id) field.value = id;
  render();
})();

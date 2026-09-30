import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAD6TG4APHn14_r2vxg5UDYRU0bSoMr8Jg",
  appId: "1:33407658172:web:a602df84e77fbd725108b9",
  messagingSenderId: "33407658172",
  projectId: "gestao-territorios",
  authDomain: "gestao-territorios.firebaseapp.com",
  storageBucket: "gestao-territorios.firebasestorage.app"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
let db;
try {
  db = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch {
  db = getFirestore(firebaseApp);
}

setPersistence(auth, browserLocalPersistence).catch(() => {});

const appElement = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const toastElement = document.querySelector("#toast");
const networkBanner = document.querySelector("#network-banner");

const state = {
  user: null,
  congregationId: null,
  congregation: null,
  territories: [],
  activeCongregationTab: "create",
  stopTerritories: null,
  installPrompt: null,
  toastTimer: null,
  webMcpLifecycle: null
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firebaseError(error, fallback) {
  const code = error?.code ? String(error.code).replace("auth/", "") : "";
  return code ? `Erro: ${code}` : fallback;
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  toastElement.textContent = message;
  toastElement.hidden = false;
  state.toastTimer = setTimeout(() => {
    toastElement.hidden = true;
  }, 3600);
}

function setOnlineState() {
  networkBanner.hidden = navigator.onLine;
}

window.addEventListener("online", () => {
  setOnlineState();
  showToast("Conexão restabelecida.");
});
window.addEventListener("offline", setOnlineState);
setOnlineState();

function spinnerLabel(label) {
  return `<span class="spinner small" aria-hidden="true"></span><span>${escapeHtml(label)}</span>`;
}

function renderLoading(label = "Carregando...") {
  appElement.innerHTML = `<section class="loading-screen"><div><span class="spinner" aria-hidden="true"></span><p>${escapeHtml(label)}</p></div></section>`;
}

function installButton() {
  return `<button class="btn btn-tonal install-button" type="button" ${state.installPrompt ? "" : "hidden"}>Instalar aplicativo</button>`;
}

function bindInstallButtons() {
  document.querySelectorAll(".install-button").forEach((button) => {
    button.hidden = !state.installPrompt;
    button.addEventListener("click", installApp);
  });
}

async function installApp() {
  if (!state.installPrompt) return;
  const prompt = state.installPrompt;
  state.installPrompt = null;
  await prompt.prompt();
  await prompt.userChoice.catch(() => null);
  document.querySelectorAll(".install-button").forEach((button) => { button.hidden = true; });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.installPrompt = event;
  document.querySelectorAll(".install-button").forEach((button) => { button.hidden = false; });
});

window.addEventListener("appinstalled", () => {
  state.installPrompt = null;
  showToast("Aplicativo instalado.");
});

function renderLogin(error = "") {
  state.stopTerritories?.();
  state.stopTerritories = null;
  appElement.innerHTML = `
    <section class="page-shell">
      <header class="top-app-bar"><h1>Login</h1></header>
      <div class="content auth-content">
        <form id="login-form" class="form-stack" novalidate>
          <div class="field">
            <label for="email">E-mail</label>
            <input id="email" name="email" type="email" inputmode="email" autocomplete="email" required>
          </div>
          <div class="field">
            <label for="password">Senha</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
          </div>
          <div id="login-error" class="error-box" ${error ? "" : "hidden"}>${escapeHtml(error)}</div>
          <div class="button-row">
            <button id="login-button" class="btn btn-filled" type="submit">Entrar</button>
            <button id="create-account-button" class="btn btn-outlined" type="button">Criar conta</button>
          </div>
        </form>
        <div class="install-area">${installButton()}</div>
      </div>
    </section>`;

  const form = document.querySelector("#login-form");
  const createButton = document.querySelector("#create-account-button");
  form.addEventListener("submit", (event) => authenticate(event, false));
  createButton.addEventListener("click", (event) => authenticate(event, true));
  bindInstallButtons();
}

async function authenticate(event, createAccount) {
  event.preventDefault();
  const form = document.querySelector("#login-form");
  const errorElement = document.querySelector("#login-error");
  const loginButton = document.querySelector("#login-button");
  const createButton = document.querySelector("#create-account-button");
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value.trim();

  if (!email || !password) {
    errorElement.textContent = "Preencha e-mail e senha.";
    errorElement.hidden = false;
    return;
  }

  errorElement.hidden = true;
  loginButton.disabled = true;
  createButton.disabled = true;
  const original = createAccount ? createButton.innerHTML : loginButton.innerHTML;
  const activeButton = createAccount ? createButton : loginButton;
  activeButton.innerHTML = spinnerLabel(createAccount ? "Criando..." : "Entrando...");

  try {
    if (createAccount) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    renderLoading(createAccount ? "Conta criada. Carregando..." : "Entrando...");
  } catch (error) {
    errorElement.textContent = firebaseError(error, "Falha ao autenticar.");
    errorElement.hidden = false;
    activeButton.innerHTML = original;
    loginButton.disabled = false;
    createButton.disabled = false;
  }
}

async function loadHome() {
  if (!state.user) return renderLogin();
  renderLoading();
  try {
    const userDoc = await getDoc(doc(db, "usuarios", state.user.uid));
    const congregationId = userDoc.data()?.congregacaoId;
    state.congregationId = typeof congregationId === "string" && congregationId.trim() ? congregationId : null;
    if (!state.congregationId) {
      renderCongregation();
      return;
    }
    await loadTerritoriesPage();
  } catch (error) {
    renderRecoverableError("Não foi possível carregar seus dados.", loadHome, error);
  }
}

function renderRecoverableError(message, retry, error) {
  appElement.innerHTML = `
    <section class="page-shell">
      <header class="top-app-bar"><h1>Gestão de Territórios</h1></header>
      <div class="content empty-state">
        <div>
          <p>${escapeHtml(message)}</p>
          <p class="helper-text">${escapeHtml(firebaseError(error, "Verifique a conexão e tente novamente."))}</p>
          <button id="retry-button" class="btn btn-filled" type="button">Tentar novamente</button>
        </div>
      </div>
    </section>`;
  document.querySelector("#retry-button").addEventListener("click", retry);
}

function renderCongregation(error = "") {
  const creating = state.activeCongregationTab === "create";
  appElement.innerHTML = `
    <section class="page-shell">
      <header class="top-app-bar"><h1>Congregação</h1></header>
      <div class="tabs" role="tablist" aria-label="Congregação">
        <button id="tab-create" class="tab" role="tab" aria-selected="${creating}">Criar</button>
        <button id="tab-join" class="tab" role="tab" aria-selected="${!creating}">Entrar com código</button>
      </div>
      <div class="content">
        <div id="congregation-error" class="error-box" ${error ? "" : "hidden"}>${escapeHtml(error)}</div>
        ${creating ? `
          <form id="create-congregation-form" class="form-stack" novalidate>
            <div class="field">
              <label for="congregation-name">Nome da congregação</label>
              <input id="congregation-name" name="name" autocomplete="organization" required>
            </div>
            <div class="button-row">
              <button class="btn btn-filled" type="submit">Criar e gerar código</button>
            </div>
            <p class="helper-text">Depois que criar, compartilhe o CÓDIGO com quem vai entrar.</p>
          </form>` : `
          <form id="join-congregation-form" class="form-stack" novalidate>
            <div class="field">
              <label for="congregation-code">Código da congregação (ex: ABC1D2E)</label>
              <input id="congregation-code" name="code" autocapitalize="characters" spellcheck="false" required>
            </div>
            <div class="button-row">
              <button class="btn btn-filled" type="submit">Entrar</button>
            </div>
          </form>`}
        <div class="install-area">${installButton()}</div>
      </div>
    </section>`;

  document.querySelector("#tab-create").addEventListener("click", () => {
    state.activeCongregationTab = "create";
    renderCongregation();
  });
  document.querySelector("#tab-join").addEventListener("click", () => {
    state.activeCongregationTab = "join";
    renderCongregation();
  });
  document.querySelector("#create-congregation-form")?.addEventListener("submit", createCongregation);
  document.querySelector("#join-congregation-form")?.addEventListener("submit", joinCongregation);
  bindInstallButtons();
}

function generateCode(name) {
  const clean = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const prefix = clean.length >= 3 ? clean.slice(0, 3) : clean.padEnd(3, "X");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  const suffix = [...bytes].map((value) => chars[value % chars.length]).join("");
  return `${prefix}${suffix}`;
}

async function linkUserToCongregation(congregationId) {
  if (!state.user) throw new Error("Usuário não logado");
  await setDoc(doc(db, "usuarios", state.user.uid), {
    congregacaoId: congregationId,
    email: state.user.email,
    atualizadoEm: serverTimestamp()
  }, { merge: true });
  state.congregationId = congregationId;
}

async function createCongregation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.elements.name.value.trim();
  const errorElement = document.querySelector("#congregation-error");
  if (!name) {
    errorElement.textContent = "Digite o nome da congregação.";
    errorElement.hidden = false;
    return;
  }

  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  button.innerHTML = spinnerLabel("Criando...");
  try {
    const congregationRef = doc(collection(db, "congregacoes"));
    await setDoc(congregationRef, {
      nome: name,
      codigo: generateCode(name),
      criadaPor: state.user.uid,
      criadaEm: serverTimestamp()
    });
    await linkUserToCongregation(congregationRef.id);
    await loadTerritoriesPage();
  } catch (error) {
    renderCongregation(firebaseError(error, "Não foi possível criar. Tente novamente."));
  }
}

async function joinCongregation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const code = form.elements.code.value.trim().toUpperCase();
  const errorElement = document.querySelector("#congregation-error");
  if (!code) {
    errorElement.textContent = "Digite o código da congregação.";
    errorElement.hidden = false;
    return;
  }

  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  button.innerHTML = spinnerLabel("Entrando...");
  try {
    const match = await getDocs(query(collection(db, "congregacoes"), where("codigo", "==", code), limit(1)));
    if (match.empty) {
      renderCongregation("Código não encontrado.");
      return;
    }
    await linkUserToCongregation(match.docs[0].id);
    await loadTerritoriesPage();
  } catch (error) {
    renderCongregation(firebaseError(error, "Não foi possível entrar. Tente novamente."));
  }
}

async function loadTerritoriesPage() {
  if (!state.congregationId) return renderCongregation();
  renderLoading("Carregando congregação...");
  try {
    const congregationDoc = await getDoc(doc(db, "congregacoes", state.congregationId));
    state.congregation = congregationDoc.exists() ? congregationDoc.data() : {};
    subscribeTerritories();
  } catch (error) {
    renderRecoverableError("Não foi possível carregar a congregação.", loadTerritoriesPage, error);
  }
}

function subscribeTerritories() {
  state.stopTerritories?.();
  const territoriesQuery = query(
    collection(db, "territorios"),
    where("congregacaoId", "==", state.congregationId),
    orderBy("iniciadoEm", "desc")
  );
  state.stopTerritories = onSnapshot(territoriesQuery, (snapshot) => {
    state.territories = snapshot.docs.map((item) => ({ id: item.id, ref: item.ref, data: item.data() }));
    renderTerritories();
    registerWebMcpTools();
  }, (error) => {
    renderRecoverableError("Não foi possível carregar os territórios.", subscribeTerritories, error);
  });
}

function formatTimestamp(value) {
  if (!value) return "-";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const two = (number) => String(number).padStart(2, "0");
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

function renderTerritories() {
  const congregationName = state.congregation?.nome?.toString().trim() || "Sua congregação";
  const congregationCode = state.congregation?.codigo?.toString().trim() || "";
  const cards = state.territories.map(({ id, data }) => territoryCard(id, data)).join("");

  appElement.innerHTML = `
    <section class="page-shell">
      <header class="top-app-bar"><h1>Territórios</h1></header>
      <div class="content">
        ${congregationCode ? `
          <section class="congregation-card" aria-label="Código da congregação">
            <div class="congregation-card__text">
              <p class="congregation-name">${escapeHtml(congregationName)}</p>
              <p class="congregation-code">CÓDIGO: <span id="display-code">${escapeHtml(congregationCode)}</span></p>
              <p class="congregation-help">Compartilhe este código com quem vai entrar.</p>
            </div>
            <button id="copy-code" class="btn btn-tonal" type="button" aria-label="Copiar código">▣ Copiar</button>
          </section>` : ""}
        <section id="territory-list" class="territory-list" aria-label="Lista de territórios">
          ${state.territories.length ? cards : `<div class="empty-state"><p>Nenhum território cadastrado</p></div>`}
        </section>
      </div>
      <button id="add-territory" class="fab" type="button" aria-label="Adicionar território">＋</button>
    </section>`;

  document.querySelector("#copy-code")?.addEventListener("click", copyCongregationCode);
  document.querySelector("#add-territory").addEventListener("click", () => openTerritoryDialog());
  document.querySelectorAll("[data-open-maps]").forEach((button) => {
    button.addEventListener("click", () => openMaps(button.dataset.openMaps));
  });
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleTerritoryAction(button.dataset.action, button.dataset.id));
  });
}

function territoryCard(id, data) {
  const name = data.nome?.toString() || "Território";
  const mapsUrl = data.mapsUrl?.toString() || "";
  const finished = data.finalizado === true;
  const partial = data.parcial === true;
  const finishedBy = data.finalizadoPor?.toString() || "";
  const restartedBy = data.reiniciadoPor?.toString() || "";
  const progressStreet = data.progressoRua?.toString() || "";
  const progressNumber = data.progressoNumero?.toString() || "";
  const progressBy = data.progressoPor?.toString() || "";

  return `
    <article class="territory-card ${finished ? "finished" : "pending"}">
      <div class="territory-card__header">
        <div class="territory-title-wrap">
          <h2 class="territory-title">${escapeHtml(name)}</h2>
          ${partial && !finished ? `<span class="partial-pill">PARCIAL</span>` : ""}
        </div>
        <details class="menu">
          <summary class="icon-btn" aria-label="Mais opções">⋮</summary>
          <div class="menu-panel">
            <button type="button" data-action="edit" data-id="${escapeHtml(id)}">Editar</button>
            <button type="button" data-action="progress" data-id="${escapeHtml(id)}">Registrar progresso (rua/nº)</button>
            <button type="button" data-action="clear-progress" data-id="${escapeHtml(id)}" ${partial ? "" : "disabled"}>Remover progresso</button>
            <button type="button" data-action="finish" data-id="${escapeHtml(id)}" ${finished ? "disabled" : ""}>Finalizar</button>
            <button type="button" data-action="restart" data-id="${escapeHtml(id)}">Reiniciar</button>
          </div>
        </details>
      </div>
      <div class="territory-meta">
        <div>Iniciado: ${escapeHtml(formatTimestamp(data.iniciadoEm))}</div>
        <div>Finalizado: ${escapeHtml(formatTimestamp(data.finalizadoEm))}${finishedBy ? ` (por ${escapeHtml(finishedBy)})` : ""}</div>
        <div>Reiniciado: ${escapeHtml(formatTimestamp(data.reiniciadoEm))}${restartedBy ? ` (por ${escapeHtml(restartedBy)})` : ""}</div>
        ${partial && (progressStreet.trim() || progressNumber.trim()) ? `
          <div class="progress-block">
            <div class="progress-until">Até: ${escapeHtml(progressStreet)}, ${escapeHtml(progressNumber)}</div>
            <div class="progress-by">Registrado por: ${escapeHtml(progressBy || "-")} • ${escapeHtml(formatTimestamp(data.progressoEm))}</div>
          </div>` : ""}
      </div>
      ${mapsUrl ? `
        <div class="maps-row">
          <span class="maps-link" title="${escapeHtml(mapsUrl)}">${escapeHtml(mapsUrl)}</span>
          <button class="icon-btn" type="button" data-open-maps="${escapeHtml(mapsUrl)}" aria-label="Abrir no Maps" title="Abrir no Maps">⌖</button>
        </div>` : ""}
    </article>`;
}

function findTerritory(id) {
  return state.territories.find((territory) => territory.id === id);
}

async function handleTerritoryAction(action, id) {
  const territory = findTerritory(id);
  if (!territory) return;
  document.querySelectorAll("details.menu[open]").forEach((menu) => menu.removeAttribute("open"));
  try {
    if (action === "edit") openTerritoryDialog(territory);
    if (action === "progress") openProgressDialog(territory);
    if (action === "clear-progress") await clearTerritoryProgress(territory);
    if (action === "finish") await finishTerritory(territory);
    if (action === "restart") openRestartDialog(territory);
  } catch (error) {
    showToast(firebaseError(error, "Não foi possível concluir a ação."));
  }
}

async function copyCongregationCode() {
  const code = state.congregation?.codigo?.toString() || "";
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = code;
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
  showToast(`Código copiado: ${code}`);
}

function openMaps(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid");
    const link = document.createElement("a");
    link.href = parsed.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  } catch {
    showToast("Não foi possível abrir o link.");
  }
}

function openDialog({ title, help = "", fields = "", confirmLabel = "Salvar", danger = false, onSubmit }) {
  modalRoot.innerHTML = `
    <dialog class="app-dialog">
      <form class="dialog-form" novalidate>
        <h2 class="dialog-title">${escapeHtml(title)}</h2>
        ${help ? `<p class="dialog-help">${escapeHtml(help)}</p>` : ""}
        ${fields}
        <div class="dialog-error error-box" hidden></div>
        <div class="dialog-actions">
          <button class="btn cancel-dialog" type="button">Cancelar</button>
          <button class="btn ${danger ? "btn-danger" : "btn-filled"} confirm-dialog" type="submit">${escapeHtml(confirmLabel)}</button>
        </div>
      </form>
    </dialog>`;
  const dialog = modalRoot.querySelector("dialog");
  const form = dialog.querySelector("form");
  const errorElement = dialog.querySelector(".dialog-error");
  const confirmButton = dialog.querySelector(".confirm-dialog");

  const close = () => {
    dialog.close();
    modalRoot.innerHTML = "";
  };
  dialog.querySelector(".cancel-dialog").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorElement.hidden = true;
    confirmButton.disabled = true;
    const original = confirmButton.innerHTML;
    confirmButton.innerHTML = spinnerLabel("Salvando...");
    try {
      await onSubmit(new FormData(form), (message) => {
        errorElement.textContent = message;
        errorElement.hidden = false;
      });
    } catch (error) {
      errorElement.textContent = firebaseError(error, "Não foi possível salvar.");
      errorElement.hidden = false;
    } finally {
      if (modalRoot.contains(dialog)) {
        confirmButton.disabled = false;
        confirmButton.innerHTML = original;
      }
    }
  });
  dialog.showModal();
  dialog.querySelector("input")?.focus();
  return { dialog, close };
}

function openTerritoryDialog(territory = null) {
  const data = territory?.data || {};
  let controls;
  controls = openDialog({
    title: territory ? "Editar território" : "Adicionar território",
    fields: `
      <div class="field">
        <label for="territory-name">Nome do território</label>
        <input id="territory-name" name="name" value="${escapeHtml(data.nome || "")}" required>
      </div>
      <div class="field">
        <label for="territory-maps">Link do Google Maps (opcional)</label>
        <input id="territory-maps" name="mapsUrl" type="url" inputmode="url" value="${escapeHtml(data.mapsUrl || "")}">
      </div>`,
    onSubmit: async (formData, setError) => {
      const name = formData.get("name").trim();
      const mapsUrl = formData.get("mapsUrl").trim();
      if (!name) return setError("Digite o nome do território.");
      if (mapsUrl && !/^https?:\/\//i.test(mapsUrl)) return setError("Cole um link válido (http/https).");
      await saveTerritory({ id: territory?.id, name, mapsUrl });
      controls.close();
    }
  });
}

async function saveTerritory({ id = null, name, mapsUrl = "" }) {
  if (!state.user) throw new Error("Usuário não logado.");
  if (!state.congregationId) throw new Error("Usuário sem congregação.");
  const email = state.user.email || "sem_email";

  if (!id) {
    await addDoc(collection(db, "territorios"), {
      congregacaoId: state.congregationId,
      nome: name,
      mapsUrl,
      finalizado: false,
      parcial: false,
      progressoRua: null,
      progressoNumero: null,
      progressoEm: null,
      progressoPor: null,
      criadoPor: email,
      criadoEm: serverTimestamp(),
      iniciadoEm: serverTimestamp(),
      finalizadoEm: null,
      finalizadoPor: null,
      reiniciadoEm: null,
      reiniciadoPor: null,
      ultimaAtualizacaoEm: serverTimestamp(),
      ultimaAtualizacaoPor: email
    });
  } else {
    await updateDoc(doc(db, "territorios", id), {
      nome: name,
      mapsUrl,
      ultimaAtualizacaoEm: serverTimestamp(),
      ultimaAtualizacaoPor: email
    });
  }
}

function openProgressDialog(territory) {
  let controls;
  controls = openDialog({
    title: "Registrar progresso",
    help: "Informe até onde foi trabalhado para outro irmão continuar.",
    fields: `
      <div class="field">
        <label for="progress-street">Rua</label>
        <input id="progress-street" name="street" value="${escapeHtml(territory.data.progressoRua || "")}" required>
      </div>
      <div class="field">
        <label for="progress-number">Número</label>
        <input id="progress-number" name="number" value="${escapeHtml(territory.data.progressoNumero || "")}" required>
      </div>`,
    onSubmit: async (formData, setError) => {
      const street = formData.get("street").trim();
      const number = formData.get("number").trim();
      if (!street || !number) return setError("Preencha a rua e o número.");
      await registerTerritoryProgress({ id: territory.id, street, number });
      controls.close();
      showToast("Progresso registrado!");
    }
  });
}

async function registerTerritoryProgress({ id, street, number }) {
  const email = state.user?.email || "sem_email";
  await updateDoc(doc(db, "territorios", id), {
    parcial: true,
    progressoRua: street,
    progressoNumero: number,
    progressoEm: serverTimestamp(),
    progressoPor: email,
    ultimaAtualizacaoEm: serverTimestamp(),
    ultimaAtualizacaoPor: email
  });
}

async function clearTerritoryProgress(territory) {
  const email = state.user?.email || "sem_email";
  try {
    await updateDoc(territory.ref, {
      parcial: false,
      progressoRua: null,
      progressoNumero: null,
      progressoEm: null,
      progressoPor: null,
      ultimaAtualizacaoEm: serverTimestamp(),
      ultimaAtualizacaoPor: email
    });
    showToast("Progresso removido.");
  } catch (error) {
    showToast(firebaseError(error, "Não foi possível remover o progresso."));
  }
}

async function finishTerritory(territory) {
  const email = state.user?.email || "sem_email";
  await updateDoc(territory.ref, {
    finalizado: true,
    finalizadoEm: serverTimestamp(),
    finalizadoPor: email,
    parcial: false,
    progressoRua: null,
    progressoNumero: null,
    progressoEm: null,
    progressoPor: null,
    ultimaAtualizacaoEm: serverTimestamp(),
    ultimaAtualizacaoPor: email
  });
}

function openRestartDialog(territory) {
  let controls;
  controls = openDialog({
    title: "Reiniciar território",
    help: "Você tem certeza que deseja reiniciar esse território?",
    fields: "",
    confirmLabel: "Sim, reiniciar",
    onSubmit: async () => {
      await restartTerritory(territory);
      controls.close();
    }
  });
}

async function restartTerritory(territory) {
  const email = state.user?.email || "sem_email";
  await updateDoc(territory.ref, {
    finalizado: false,
    iniciadoEm: serverTimestamp(),
    finalizadoEm: null,
    finalizadoPor: null,
    reiniciadoEm: serverTimestamp(),
    reiniciadoPor: email,
    parcial: false,
    progressoRua: null,
    progressoNumero: null,
    progressoEm: null,
    progressoPor: null,
    ultimaAtualizacaoEm: serverTimestamp(),
    ultimaAtualizacaoPor: email
  });
}

function registerWebMcpTools() {
  state.webMcpLifecycle?.abort();
  state.webMcpLifecycle = null;
  const context = document.modelContext;
  if (!context?.registerTool || !state.user || !state.congregationId) return;

  const lifecycle = new AbortController();
  state.webMcpLifecycle = lifecycle;
  const register = (tool) => Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});

  register({
    name: "list_territories",
    title: "Listar territórios",
    description: "Lista os territórios da congregação atual e o estado de cada um.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async () => ({
      congregation: state.congregation?.nome || "",
      territories: state.territories.map(({ id, data }) => ({
        id,
        name: data.nome || "Território",
        finished: data.finalizado === true,
        partial: data.parcial === true,
        progressStreet: data.progressoRua || null,
        progressNumber: data.progressoNumero || null
      }))
    })
  });

  register({
    name: "create_territory",
    title: "Adicionar território",
    description: "Cria um território na congregação atual, com um link opcional do Google Maps.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1 },
        mapsUrl: { type: "string" }
      },
      required: ["name"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input) => {
      const name = String(input?.name || "").trim();
      const mapsUrl = String(input?.mapsUrl || "").trim();
      if (!name) throw new Error("Nome do território é obrigatório.");
      if (mapsUrl && !/^https?:\/\//i.test(mapsUrl)) throw new Error("O link deve começar com http:// ou https://.");
      await saveTerritory({ name, mapsUrl });
      return { created: true, name };
    }
  });

  register({
    name: "register_territory_progress",
    title: "Registrar progresso",
    description: "Registra a rua e o número até onde um território foi trabalhado.",
    inputSchema: {
      type: "object",
      properties: {
        territoryId: { type: "string", minLength: 1 },
        street: { type: "string", minLength: 1 },
        number: { type: "string", minLength: 1 }
      },
      required: ["territoryId", "street", "number"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input) => {
      const territory = findTerritory(String(input?.territoryId || ""));
      if (!territory) throw new Error("Território não encontrado.");
      const street = String(input?.street || "").trim();
      const number = String(input?.number || "").trim();
      if (!street || !number) throw new Error("Rua e número são obrigatórios.");
      await registerTerritoryProgress({ id: territory.id, street, number });
      return { updated: true, territoryId: territory.id, street, number };
    }
  });

  register({
    name: "finish_territory",
    title: "Finalizar território",
    description: "Marca um território como finalizado e limpa qualquer progresso parcial.",
    inputSchema: {
      type: "object",
      properties: { territoryId: { type: "string", minLength: 1 } },
      required: ["territoryId"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input) => {
      const territory = findTerritory(String(input?.territoryId || ""));
      if (!territory) throw new Error("Território não encontrado.");
      await finishTerritory(territory);
      return { finished: true, territoryId: territory.id };
    }
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (!user) {
    state.congregationId = null;
    state.congregation = null;
    state.territories = [];
    renderLogin();
    return;
  }
  await loadHome();
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
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

const PUSH_API_URL = "https://gestao-territorios-notificacoes.lazarowww86.workers.dev";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
auth.languageCode = "pt-BR";
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
  userProfile: null,
  userRole: "usuario",
  congregationId: null,
  congregation: null,
  congregationCode: "",
  territories: [],
  schedules: [],
  notices: [],
  activeMainTab: "territories",
  activeCongregationTab: "create",
  stopTerritories: null,
  stopSchedules: null,
  stopNotices: null,
  stopUserProfile: null,
  installPrompt: null,
  toastTimer: null,
  oneSignal: null,
  notificationStatus: "checking",
  notificationBusy: false,
  notificationError: "",
  webMcpLifecycle: null
};

let oneSignalReadyPromise = null;

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function waitForPushSubscription(OneSignal) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const subscription = OneSignal.User?.PushSubscription;
    if (subscription?.id && subscription.optedIn) return subscription.id;
    await wait(750);
  }
  throw new Error("O OneSignal não concluiu o cadastro deste aparelho. Feche o aplicativo, abra novamente e tente mais uma vez.");
}

async function syncOneSignalCongregationTag(OneSignal) {
  const congregationId = String(state.congregationId || "").trim();
  if (!congregationId) {
    throw new Error("Sua conta ainda não está vinculada a uma congregação.");
  }

  if (typeof OneSignal.User?.addTag !== "function") {
    throw new Error("O OneSignal não disponibilizou o cadastro da congregação.");
  }

  await OneSignal.User.addTag("congregacao_id", congregationId);

  if (typeof OneSignal.User.getTags !== "function") return;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const tags = await OneSignal.User.getTags();
    if (String(tags?.congregacao_id || "") === congregationId) return;
    await wait(500);
  }

  throw new Error("O OneSignal não confirmou a congregação deste aparelho. Tente novamente.");
}

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

const USER_ROLES = {
  PRINCIPAL_ADMIN: "adm_principal",
  ADMIN: "admin",
  USER: "usuario"
};

function normalizeUserRole(value) {
  if (value === USER_ROLES.PRINCIPAL_ADMIN) return USER_ROLES.PRINCIPAL_ADMIN;
  if (value === USER_ROLES.ADMIN) return USER_ROLES.ADMIN;
  return USER_ROLES.USER;
}

function userRoleLabel(role = state.userRole) {
  if (role === USER_ROLES.PRINCIPAL_ADMIN) return "Administrador principal";
  if (role === USER_ROLES.ADMIN) return "Administrador";
  return "Usuário";
}

function isAdministrator() {
  return state.userRole === USER_ROLES.PRINCIPAL_ADMIN || state.userRole === USER_ROLES.ADMIN;
}

function isPrincipalAdministrator() {
  return state.userRole === USER_ROLES.PRINCIPAL_ADMIN;
}

function congregationCreatorUid(congregation = state.congregation) {
  return congregation?.criadaPor?.toString()
    || congregation?.criadaPorUid?.toString()
    || "";
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  toastElement.textContent = message;
  toastElement.hidden = false;
  state.toastTimer = setTimeout(() => {
    toastElement.hidden = true;
  }, 3600);
}

function initializeOneSignal() {
  if (state.oneSignal) return Promise.resolve(state.oneSignal);
  if (oneSignalReadyPromise) return oneSignalReadyPromise;

  const sdkReady = window.__oneSignalReady;
  if (!sdkReady || typeof sdkReady.then !== "function") {
    state.notificationError = "A configuração do OneSignal não foi carregada. Atualize a página.";
    return Promise.resolve(null);
  }

  const timeout = new Promise((resolve) => {
    window.setTimeout(() => resolve(null), 20000);
  });

  oneSignalReadyPromise = Promise.race([sdkReady, timeout])
    .then((OneSignal) => {
      if (!OneSignal) {
        const initError = window.__oneSignalInitError;
        state.notificationError = initError?.message
          || "O OneSignal demorou para carregar. Atualize a página e tente novamente.";
        return null;
      }
      state.oneSignal = OneSignal;
      return OneSignal;
    })
    .catch((error) => {
      console.error("Falha ao aguardar o OneSignal", error);
      state.notificationError = error?.message || "O serviço de notificações não iniciou.";
      return null;
    });

  return oneSignalReadyPromise;
}

async function pushApi(path, body = {}) {
  if (!state.user) throw new Error("Faça login novamente.");
  const idToken = await state.user.getIdToken();
  const response = await fetch(`${PUSH_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível configurar as notificações.");
  return data;
}

async function syncPushIdentity({ requestPermission = false, showMessages = false } = {}) {
  if (!state.user || !state.congregationId || state.notificationBusy) return;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    state.notificationStatus = "unsupported";
    renderMainView();
    return;
  }

  state.notificationBusy = true;
  state.notificationError = "";
  if (requestPermission) renderMainView();
  try {
    const OneSignal = await initializeOneSignal();
    if (!OneSignal) {
      throw new Error(state.notificationError || "O serviço de notificações não carregou.");
    }

    if (requestPermission && !OneSignal.Notifications.permission) {
      await OneSignal.Notifications.requestPermission();
    }

    if (!OneSignal.Notifications.permission) {
      state.notificationStatus = Notification.permission === "denied" ? "blocked" : "disabled";
      if (showMessages && state.notificationStatus === "blocked") {
        showToast("As notificações estão bloqueadas nas permissões deste site.");
      }
      return;
    }

    await OneSignal.login(state.user.uid);
    if (OneSignal.User?.PushSubscription
      && !OneSignal.User.PushSubscription.optedIn
      && typeof OneSignal.User.PushSubscription.optIn === "function") {
      await OneSignal.User.PushSubscription.optIn();
    }

    await waitForPushSubscription(OneSignal);
    await syncOneSignalCongregationTag(OneSignal);
    state.notificationStatus = "enabled";
    state.notificationError = "";
    if (showMessages) showToast("Notificações ativadas para esta congregação.");
  } catch (error) {
    console.error("Falha ao sincronizar notificações", error);
    state.notificationStatus = Notification.permission === "denied" ? "blocked" : "error";
    state.notificationError = error?.message || "Não foi possível ativar as notificações.";
    if (showMessages) showToast(error?.message || "Não foi possível ativar as notificações.");
  } finally {
    state.notificationBusy = false;
    if (state.user && state.congregationId) renderMainView();
  }
}

async function disconnectPushIdentity() {
  try {
    const OneSignal = state.oneSignal || await initializeOneSignal();
    if (OneSignal && typeof OneSignal.logout === "function") await OneSignal.logout();
  } catch (error) {
    console.warn("Não foi possível encerrar a identificação do OneSignal", error);
  }
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
  state.stopSchedules?.();
  state.stopSchedules = null;
  state.stopNotices?.();
  state.stopNotices = null;
  appElement.innerHTML = `
    <section class="page-shell">
      <header class="top-app-bar"><h1>Login</h1></header>
      <div class="content auth-content">
        <form id="login-form" class="form-stack" novalidate>
          <div class="field">
            <label for="email">E-mail</label>
            <input id="email" name="email" type="email" inputmode="email" autocomplete="email" required>
            <p class="field-help">Use um e-mail verdadeiro e acessível para conseguir redefinir sua senha.</p>
          </div>
          <div class="field">
            <label for="password">Senha</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
          </div>
          <div id="login-error" class="error-box" ${error ? "" : "hidden"}>${escapeHtml(error)}</div>
          <div id="login-message" class="success-box" hidden></div>
          <div class="button-row">
            <button id="login-button" class="btn btn-filled" type="submit">Entrar</button>
            <button id="create-account-button" class="btn btn-outlined" type="button">Criar conta</button>
          </div>
          <button id="forgot-password-button" class="btn password-reset-button" type="button">Esqueci minha senha</button>
        </form>
        <div class="install-area">${installButton()}</div>
      </div>
    </section>`;

  const form = document.querySelector("#login-form");
  const createButton = document.querySelector("#create-account-button");
  const forgotPasswordButton = document.querySelector("#forgot-password-button");
  form.addEventListener("submit", (event) => authenticate(event, false));
  createButton.addEventListener("click", (event) => authenticate(event, true));
  forgotPasswordButton.addEventListener("click", resetPassword);
  bindInstallButtons();
}

function passwordResetError(error) {
  const code = error?.code ? String(error.code) : "";
  if (code === "auth/invalid-email") return "Digite um e-mail válido.";
  if (code === "auth/too-many-requests") return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (code === "auth/network-request-failed") return "Não foi possível conectar. Verifique sua internet e tente novamente.";
  return "Não foi possível enviar o e-mail de redefinição. Tente novamente.";
}

async function resetPassword() {
  const form = document.querySelector("#login-form");
  const emailInput = form?.elements.email;
  const email = emailInput?.value.trim() || "";
  const errorElement = document.querySelector("#login-error");
  const messageElement = document.querySelector("#login-message");
  const button = document.querySelector("#forgot-password-button");

  errorElement.hidden = true;
  messageElement.hidden = true;

  if (!email) {
    errorElement.textContent = "Digite seu e-mail no campo acima para redefinir a senha.";
    errorElement.hidden = false;
    emailInput?.focus();
    return;
  }

  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = spinnerLabel("Enviando...");

  try {
    await sendPasswordResetEmail(auth, email);
    messageElement.textContent = "Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Verifique também a caixa de spam.";
    messageElement.hidden = false;
  } catch (error) {
    errorElement.textContent = passwordResetError(error);
    errorElement.hidden = false;
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function authenticate(event, createAccount) {
  event.preventDefault();
  const form = document.querySelector("#login-form");
  const errorElement = document.querySelector("#login-error");
  const messageElement = document.querySelector("#login-message");
  const loginButton = document.querySelector("#login-button");
  const createButton = document.querySelector("#create-account-button");
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value.trim();

  errorElement.hidden = true;
  messageElement.hidden = true;

  if (!email || !password) {
    errorElement.textContent = "Preencha e-mail e senha.";
    errorElement.hidden = false;
    return;
  }

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
    state.userProfile = userDoc.exists() ? userDoc.data() : {};
    state.userRole = normalizeUserRole(state.userProfile.tipoUsuario);
    const congregationId = state.userProfile.congregacaoId;
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

async function congregationCodeKey(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) return "";
  const data = new TextEncoder().encode(normalizedCode);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function linkUserToCongregation(congregationId, role = USER_ROLES.USER, congregationCode = "", invitationCode = "", invitationLinkKey = "") {
  if (!state.user) throw new Error("Usuário não logado");
  const normalizedRole = normalizeUserRole(role);
  const codeLink = normalizedRole === USER_ROLES.USER
    ? invitationLinkKey || await congregationCodeKey(invitationCode) || state.userProfile?.codigoVinculo || null
    : state.userProfile?.codigoVinculo || null;
  const payload = {
    congregacaoId: congregationId,
    email: state.user.email,
    tipoUsuario: normalizedRole,
    codigoCongregacao: normalizedRole === USER_ROLES.USER ? null : congregationCode || null,
    codigoVinculo: codeLink,
    atualizadoEm: serverTimestamp()
  };
  await setDoc(doc(db, "usuarios", state.user.uid), payload, { merge: true });
  state.congregationId = congregationId;
  state.userProfile = { ...(state.userProfile || {}), ...payload };
  state.userRole = normalizedRole;
  state.congregationCode = normalizedRole === USER_ROLES.USER ? "" : congregationCode;
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
    const code = generateCode(name);
    const codeKey = await congregationCodeKey(code);
    await setDoc(congregationRef, {
      nome: name,
      criadaPor: state.user.uid,
      criadaEm: serverTimestamp()
    });
    await setDoc(doc(db, "codigosCongregacao", codeKey), {
      congregacaoId: congregationRef.id,
      codigoHash: codeKey,
      criadoPor: state.user.uid,
      criadoEm: serverTimestamp()
    });
    await linkUserToCongregation(congregationRef.id, USER_ROLES.PRINCIPAL_ADMIN, code);
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
    let congregationId = "";
    let invitationLinkKey = "";
    const codeKey = await congregationCodeKey(code);
    let codeDoc = await getDoc(doc(db, "codigosCongregacao", codeKey));
    if (codeDoc.exists()) {
      congregationId = codeDoc.data().congregacaoId?.toString() || "";
      invitationLinkKey = codeKey;
    } else {
      // Compatibilidade com uma versão intermediária que usava o código como ID.
      codeDoc = await getDoc(doc(db, "codigosCongregacao", code));
      if (codeDoc.exists()) {
        congregationId = codeDoc.data().congregacaoId?.toString() || "";
        invitationLinkKey = code;
      }
    }

    if (!congregationId) {
      // Compatibilidade com congregações antigas que ainda guardam o código
      // diretamente no documento da congregação (ex.: NOVAV3X).
      const legacyMatch = await getDocs(query(collection(db, "congregacoes"), where("codigo", "==", code), limit(1)));
      if (!legacyMatch.empty) {
        congregationId = legacyMatch.docs[0].id;
        invitationLinkKey = code;
      }
    }

    if (!congregationId) {
      renderCongregation("Código não encontrado.");
      return;
    }
    await linkUserToCongregation(congregationId, USER_ROLES.USER, "", code, invitationLinkKey);
    await loadTerritoriesPage();
  } catch (error) {
    renderCongregation(firebaseError(error, "Não foi possível entrar. Tente novamente."));
  }
}

async function loadTerritoriesPage() {
  if (!state.congregationId) return renderCongregation();
  renderLoading("Carregando congregação...");
  try {
    const congregationRef = doc(db, "congregacoes", state.congregationId);
    const congregationDoc = await getDoc(congregationRef);
    state.congregation = congregationDoc.exists() ? congregationDoc.data() : {};
    await loadUserAccess(congregationRef);
    subscribeTerritories();
    subscribeSchedules();
    subscribeNotices();
    subscribeUserProfileAccess();
    syncPushIdentity().catch((error) => {
      console.warn("Não foi possível sincronizar as notificações", error);
    });
  } catch (error) {
    renderRecoverableError("Não foi possível carregar a congregação.", loadTerritoriesPage, error);
  }
}

function subscribeUserProfileAccess() {
  state.stopUserProfile?.();
  if (!state.user) return;

  state.stopUserProfile = onSnapshot(doc(db, "usuarios", state.user.uid), async (snapshot) => {
    if (!snapshot.exists()) return;
    const profile = snapshot.data();
    const profileCongregationId = profile.congregacaoId?.toString() || "";

    if (profileCongregationId && profileCongregationId !== state.congregationId) {
      state.userProfile = profile;
      state.congregationId = profileCongregationId;
      await loadTerritoriesPage();
      return;
    }

    const creator = congregationCreatorUid() === state.user.uid;
    const nextRole = creator ? USER_ROLES.PRINCIPAL_ADMIN : normalizeUserRole(profile.tipoUsuario);
    const nextCode = nextRole === USER_ROLES.USER
      ? ""
      : profile.codigoCongregacao?.toString().trim().toUpperCase() || "";
    const accessChanged = nextRole !== state.userRole || nextCode !== state.congregationCode;

    state.userProfile = profile;
    state.userRole = nextRole;
    state.congregationCode = nextCode;

    if (accessChanged) {
      renderMainView();
      showToast(`Seu acesso foi atualizado: ${userRoleLabel(nextRole)}.`);
    }
  }, (error) => {
    showToast(firebaseError(error, "Não foi possível atualizar seu perfil de acesso."));
  });
}

async function loadUserAccess(congregationRef) {
  if (!state.user || !state.congregationId) return;
  const creator = congregationCreatorUid() === state.user.uid;
  const storedRole = normalizeUserRole(state.userProfile?.tipoUsuario);
  const role = creator ? USER_ROLES.PRINCIPAL_ADMIN : storedRole;
  const legacyCode = state.congregation?.codigo?.toString().trim().toUpperCase() || "";
  const profileCode = state.userProfile?.codigoCongregacao?.toString().trim().toUpperCase() || "";
  const code = profileCode || (role !== USER_ROLES.USER ? legacyCode : "");

  state.userRole = role;
  state.congregationCode = role === USER_ROLES.USER ? "" : code;

  const profileNeedsUpdate = state.userProfile?.tipoUsuario !== role
    || (role !== USER_ROLES.USER && code && profileCode !== code);
  if (profileNeedsUpdate) {
    const profileUpdate = {
      tipoUsuario: role,
      codigoCongregacao: role === USER_ROLES.USER ? null : code || null,
      atualizadoEm: serverTimestamp()
    };
    await setDoc(doc(db, "usuarios", state.user.uid), profileUpdate, { merge: true });
    state.userProfile = { ...(state.userProfile || {}), ...profileUpdate };
  }

  if (creator && legacyCode) {
    const codeKey = await congregationCodeKey(legacyCode);
    await setDoc(doc(db, "codigosCongregacao", codeKey), {
      congregacaoId: state.congregationId,
      codigoHash: codeKey,
      criadoPor: state.user.uid,
      criadoEm: state.congregation.criadaEm || serverTimestamp()
    }, { merge: true });
    await updateDoc(congregationRef, {
      criadaPor: state.user.uid,
      codigo: deleteField(),
      codigoMigradoEm: serverTimestamp(),
      codigoMigradoPor: state.user.email || "sem_email"
    });
    delete state.congregation.codigo;
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
    renderMainView();
    registerWebMcpTools();
  }, (error) => {
    renderRecoverableError("Não foi possível carregar os territórios.", subscribeTerritories, error);
  });
}

function subscribeSchedules() {
  state.stopSchedules?.();
  const schedulesQuery = query(
    collection(db, "programacoes"),
    where("congregacaoId", "==", state.congregationId)
  );
  state.stopSchedules = onSnapshot(schedulesQuery, (snapshot) => {
    state.schedules = snapshot.docs
      .map((item) => ({ id: item.id, ref: item.ref, data: item.data() }))
      .sort((a, b) => String(a.data.data || "").localeCompare(String(b.data.data || "")));
    renderMainView();
  }, (error) => {
    showToast(firebaseError(error, "Não foi possível carregar a programação."));
  });
}

function timestampMilliseconds(value) {
  if (!value) return 0;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function subscribeNotices() {
  state.stopNotices?.();
  const noticesQuery = query(
    collection(db, "avisos"),
    where("congregacaoId", "==", state.congregationId)
  );
  state.stopNotices = onSnapshot(noticesQuery, (snapshot) => {
    state.notices = snapshot.docs
      .map((item) => ({ id: item.id, ref: item.ref, data: item.data() }))
      .sort((a, b) => timestampMilliseconds(b.data.publicadoEm) - timestampMilliseconds(a.data.publicadoEm));
    renderMainView();
  }, (error) => {
    showToast(firebaseError(error, "Não foi possível carregar os avisos."));
  });
}

function formatTimestamp(value) {
  if (!value) return "-";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const two = (number) => String(number).padStart(2, "0");
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

function daysSince(value) {
  if (!value) return null;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const startDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today - startDay) / 86400000));
}

function territoryCompletionStatus(data) {
  const lastCompletion = data.ultimaFinalizacaoEm || data.finalizadoEm;
  const completedDays = daysSince(lastCompletion);
  if (completedDays !== null) {
    if (completedDays === 0) return "Última conclusão: hoje";
    if (completedDays === 1) return "Última conclusão: há 1 dia";
    return `Última conclusão: há ${completedDays} dias`;
  }
  if (data.reiniciadoEm) return "Última conclusão: histórico anterior indisponível";
  const openDays = daysSince(data.criadoEm || data.iniciadoEm);
  if (openDays === 0) return "Sem conclusão: iniciado hoje";
  if (openDays === 1) return "Sem conclusão há 1 dia";
  if (openDays !== null) return `Sem conclusão há ${openDays} dias`;
  return "Sem registro de conclusão";
}

function todayDateKey() {
  const now = new Date();
  const two = (number) => String(number).padStart(2, "0");
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

function formatScheduleDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return String(value || "-");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function isWeekendScheduleDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const [year, month, day] = value.split("-").map(Number);
  const weekDay = new Date(year, month - 1, day, 12).getDay();
  return weekDay === 0 || weekDay === 6;
}

function upcomingSchedules() {
  const today = todayDateKey();
  return state.schedules.filter((schedule) => String(schedule.data.data || "") >= today);
}

function renderMainTabs(active) {
  return `
    <nav class="tabs main-tabs" aria-label="Áreas do aplicativo">
      <button class="tab main-tab" type="button" data-main-tab="territories" aria-selected="${active === "territories"}">Territórios</button>
      <button class="tab main-tab" type="button" data-main-tab="schedules" aria-selected="${active === "schedules"}">Programação</button>
    </nav>`;
}

function bindMainTabs() {
  document.querySelectorAll("[data-main-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeMainTab = button.dataset.mainTab;
      renderMainView();
    });
  });
}

function renderMainView() {
  if (state.activeMainTab === "schedules") {
    renderSchedules();
    return;
  }
  renderTerritories();
}

function scheduleTerritories(schedule) {
  const savedTerritories = Array.isArray(schedule.data.territorios) ? schedule.data.territorios : [];
  const ids = Array.isArray(schedule.data.territorioIds) ? schedule.data.territorioIds : [];
  return ids.map((id) => {
    const current = findTerritory(id);
    const saved = savedTerritories.find((territory) => territory?.id === id) || {};
    return {
      id,
      name: current?.data?.nome?.toString() || saved.nome?.toString() || "Território",
      mapsUrl: current?.data?.mapsUrl?.toString() || saved.mapsUrl?.toString() || ""
    };
  });
}

function nextScheduleBanner() {
  const next = upcomingSchedules()[0];
  if (!next) return "";
  const territories = scheduleTerritories(next);
  const isToday = next.data.data === todayDateKey();
  const departureLocation = isWeekendScheduleDate(next.data.data)
    ? next.data.localSaida?.toString().trim() || ""
    : "";
  return `
    <section class="next-schedule ${isToday ? "today" : ""}" aria-label="Próxima programação">
      <div class="next-schedule__heading">
        <div>
          <p class="eyebrow">${isToday ? "PROGRAMAÇÃO DE HOJE" : "PRÓXIMA PROGRAMAÇÃO"}</p>
          <h2>${escapeHtml(formatScheduleDate(next.data.data))}</h2>
        </div>
        ${isToday ? `<span class="today-pill">HOJE</span>` : ""}
      </div>
      <div class="scheduled-territory-chips">
        ${territories.map((territory) => `<span>${escapeHtml(territory.name)}</span>`).join("")}
      </div>
      ${departureLocation ? `
        <div class="departure-location">
          <span class="departure-location__icon" aria-hidden="true">⌂</span>
          <div><strong>Saída de campo</strong><p>${escapeHtml(departureLocation)}</p></div>
        </div>` : ""}
      <div class="schedule-audit">Programado por: ${escapeHtml(next.data.programadoPor || "-")}</div>
      <button id="view-schedules" class="btn btn-outlined" type="button">Ver programação</button>
    </section>`;
}

function notificationControl() {
  if (state.notificationStatus === "enabled") {
    return `
      <div class="notification-control enabled" role="status">
        <span class="notification-control__icon" aria-hidden="true">✓</span>
        <div>
          <strong>Notificações ativadas</strong>
          <p>Este aparelho receberá os novos avisos da sua congregação.</p>
        </div>
      </div>`;
  }

  if (state.notificationStatus === "unsupported") {
    return `
      <div class="notification-control unavailable" role="status">
        <div>
          <strong>Notificações indisponíveis</strong>
          <p>Este navegador não oferece notificações para o aplicativo.</p>
        </div>
      </div>`;
  }

  if (state.notificationStatus === "blocked") {
    return `
      <div class="notification-control unavailable" role="status">
        <div>
          <strong>Notificações bloqueadas</strong>
          <p>Libere as notificações nas permissões deste site e abra o aplicativo novamente.</p>
        </div>
      </div>`;
  }

  const loading = state.notificationBusy || state.notificationStatus === "checking";
  const message = state.notificationStatus === "error"
    ? state.notificationError || "Não foi possível conectar. Você pode tentar novamente."
    : "Ative uma vez neste aparelho para receber novos avisos mesmo com o aplicativo fechado.";
  return `
    <div class="notification-control">
      <div>
        <strong>Receba os avisos no celular</strong>
        <p>${escapeHtml(message)}</p>
      </div>
      <button id="enable-notifications" class="btn btn-tonal" type="button" ${loading ? "disabled" : ""}>
        ${loading ? spinnerLabel("Verificando...") : "Ativar notificações"}
      </button>
    </div>`;
}

function noticesPanel() {
  const administrator = isAdministrator();
  return `
    <section class="notices-panel" aria-labelledby="notices-title">
      <div class="notices-heading">
        <div>
          <p class="eyebrow">INFORMAÇÕES IMPORTANTES</p>
          <h2 id="notices-title">Avisos da congregação</h2>
        </div>
        ${administrator ? `<button id="add-notice" class="btn btn-outlined" type="button">Novo aviso</button>` : ""}
      </div>
      ${notificationControl()}
      <div class="notice-list">
        ${state.notices.length ? state.notices.map((notice) => `
          <article class="notice-card">
            <p>${escapeHtml(notice.data.texto || "")}</p>
            <div class="notice-footer">
              <span>Publicado por: ${escapeHtml(notice.data.publicadoPor || "-")} • ${escapeHtml(formatTimestamp(notice.data.publicadoEm))}</span>
              ${administrator ? `<button class="notice-remove" type="button" data-notice-action="remove" data-id="${escapeHtml(notice.id)}">Excluir</button>` : ""}
            </div>
          </article>`).join("") : `<p class="notice-empty">Nenhum aviso publicado.</p>`}
      </div>
    </section>`;
}

function renderTerritories() {
  const congregationName = state.congregation?.nome?.toString().trim() || "Sua congregação";
  const congregationCode = isAdministrator() ? state.congregationCode : "";
  const cards = state.territories.map(({ id, data }) => territoryCard(id, data)).join("");

  appElement.innerHTML = `
    <section class="page-shell">
      <header class="top-app-bar"><h1>Territórios</h1></header>
      ${renderMainTabs("territories")}
      <div class="content">
        <section class="congregation-card" aria-label="Dados da congregação">
            <div class="congregation-card__text">
              <div class="congregation-title-row">
                <p class="congregation-name">${escapeHtml(congregationName)}</p>
                <span class="role-badge ${escapeHtml(state.userRole)}">${escapeHtml(userRoleLabel())}</span>
              </div>
              ${isAdministrator() ? `
                <p class="congregation-code">CÓDIGO: <span id="display-code">${escapeHtml(congregationCode || "Indisponível")}</span></p>
                <p class="congregation-help">Somente administradores podem visualizar e compartilhar este código.</p>` : `
                <p class="congregation-help">Sua conta está vinculada a esta congregação.</p>`}
            </div>
            <div class="congregation-actions">
              ${congregationCode ? `<button id="copy-code" class="btn btn-tonal" type="button" aria-label="Copiar código">▣ Copiar</button>` : ""}
              ${isPrincipalAdministrator() ? `<button id="manage-users" class="btn btn-outlined" type="button">Administrar usuários</button>` : ""}
            </div>
          </section>
        ${noticesPanel()}
        ${nextScheduleBanner()}
        <section id="territory-list" class="territory-list" aria-label="Lista de territórios">
          ${state.territories.length ? cards : `<div class="empty-state"><p>Nenhum território cadastrado</p></div>`}
        </section>
      </div>
      ${isAdministrator() ? `<button id="add-territory" class="fab" type="button" aria-label="Adicionar território">＋</button>` : ""}
    </section>`;

  document.querySelector("#copy-code")?.addEventListener("click", copyCongregationCode);
  document.querySelector("#manage-users")?.addEventListener("click", openUserManagementDialog);
  document.querySelector("#view-schedules")?.addEventListener("click", () => {
    state.activeMainTab = "schedules";
    renderMainView();
  });
  document.querySelector("#add-notice")?.addEventListener("click", () => requestNoticePermission(openNoticeDialog));
  document.querySelector("#enable-notifications")?.addEventListener("click", () => {
    syncPushIdentity({ requestPermission: true, showMessages: true });
  });
  document.querySelectorAll("[data-notice-action]").forEach((button) => {
    button.addEventListener("click", () => handleNoticeAction(button.dataset.noticeAction, button.dataset.id));
  });
  document.querySelector("#add-territory")?.addEventListener("click", () => openTerritoryDialog());
  bindMainTabs();
  document.querySelectorAll("[data-open-maps]").forEach((button) => {
    button.addEventListener("click", () => openMaps(button.dataset.openMaps));
  });
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleTerritoryAction(button.dataset.action, button.dataset.id));
  });
}

function renderSchedules() {
  const today = todayDateKey();
  const upcoming = state.schedules.filter((schedule) => String(schedule.data.data || "") >= today);
  const previous = state.schedules
    .filter((schedule) => String(schedule.data.data || "") < today)
    .sort((a, b) => String(b.data.data || "").localeCompare(String(a.data.data || "")));

  appElement.innerHTML = `
    <section class="page-shell">
      <header class="top-app-bar"><h1>Programação</h1></header>
      ${renderMainTabs("schedules")}
      <div class="content schedule-content">
        <section class="schedule-section" aria-labelledby="upcoming-schedules-title">
          <div class="section-heading">
            <div>
              <p class="eyebrow">SERVIÇO DE CAMPO</p>
              <h2 id="upcoming-schedules-title">Territórios programados</h2>
            </div>
          </div>
          <div class="schedule-list">
            ${upcoming.length
              ? upcoming.map((schedule) => scheduleCard(schedule)).join("")
              : `<div class="schedule-empty"><p>Nenhum território programado.</p><p>Quando houver uma programação, todos da congregação verão aqui.</p></div>`}
          </div>
        </section>
        ${previous.length ? `
          <details class="previous-schedules">
            <summary>Programações anteriores (${previous.length})</summary>
            <div class="schedule-list">
              ${previous.map((schedule) => scheduleCard(schedule, true)).join("")}
            </div>
          </details>` : ""}
      </div>
      ${isAdministrator() ? `<button id="add-schedule" class="fab" type="button" aria-label="Programar territórios" title="Programar territórios">＋</button>` : ""}
    </section>`;

  bindMainTabs();
  document.querySelector("#add-schedule")?.addEventListener("click", () => {
    if (!state.territories.length) {
      showToast("Cadastre pelo menos um território antes de programar.");
      return;
    }
    requestSchedulePermission(() => openScheduleDialog());
  });
  document.querySelectorAll("[data-schedule-action]").forEach((button) => {
    button.addEventListener("click", () => handleScheduleAction(button.dataset.scheduleAction, button.dataset.id));
  });
  document.querySelectorAll("[data-open-maps]").forEach((button) => {
    button.addEventListener("click", () => openMaps(button.dataset.openMaps));
  });
}

function scheduleCard(schedule, previous = false) {
  const territories = scheduleTerritories(schedule);
  const isToday = schedule.data.data === todayDateKey();
  const programmedBy = schedule.data.programadoPor?.toString() || "-";
  const departureLocation = isWeekendScheduleDate(schedule.data.data)
    ? schedule.data.localSaida?.toString().trim() || ""
    : "";
  return `
    <article class="schedule-card ${isToday ? "today" : ""} ${previous ? "previous" : ""}">
      <div class="schedule-card__header">
        <div>
          <div class="schedule-date-row">
            <h3>${escapeHtml(formatScheduleDate(schedule.data.data))}</h3>
            ${isToday ? `<span class="today-pill">HOJE</span>` : ""}
          </div>
          <p>${territories.length} ${territories.length === 1 ? "território" : "territórios"}</p>
        </div>
        ${isAdministrator() ? `<details class="menu">
          <summary class="icon-btn" aria-label="Mais opções">⋮</summary>
          <div class="menu-panel">
            <button type="button" data-schedule-action="edit" data-id="${escapeHtml(schedule.id)}">Editar programação</button>
            <button type="button" data-schedule-action="remove" data-id="${escapeHtml(schedule.id)}">Excluir programação</button>
          </div>
        </details>` : ""}
      </div>
      <div class="scheduled-territories">
        ${territories.map((territory) => `
          <div class="scheduled-territory">
            <span>${escapeHtml(territory.name)}</span>
            ${territory.mapsUrl ? `<button class="icon-btn" type="button" data-open-maps="${escapeHtml(territory.mapsUrl)}" aria-label="Abrir ${escapeHtml(territory.name)} no Maps" title="Abrir no Maps">⌖</button>` : ""}
          </div>`).join("")}
      </div>
      ${departureLocation ? `
        <div class="departure-location compact">
          <span class="departure-location__icon" aria-hidden="true">⌂</span>
          <div><strong>Saída de campo</strong><p>${escapeHtml(departureLocation)}</p></div>
        </div>` : ""}
      <div class="schedule-audit">Programado por: ${escapeHtml(programmedBy)} • ${escapeHtml(formatTimestamp(schedule.data.programadoEm))}</div>
    </article>`;
}

function findSchedule(id) {
  return state.schedules.find((schedule) => schedule.id === id);
}

function handleScheduleAction(action, id) {
  if (!isAdministrator()) return showToast("Somente administradores podem alterar a programação.");
  const schedule = findSchedule(id);
  if (!schedule) return;
  document.querySelectorAll("details.menu[open]").forEach((menu) => menu.removeAttribute("open"));
  if (action === "edit") requestSchedulePermission(() => openScheduleDialog(schedule));
  if (action === "remove") requestSchedulePermission(() => openRemoveScheduleDialog(schedule));
}

function requestSchedulePermission(onConfirmed) {
  let controls;
  controls = openDialog({
    title: "Programar territórios",
    help: "Você foi designado para essa função?",
    fields: "",
    cancelLabel: "Não",
    confirmLabel: "Sim",
    onSubmit: async () => {
      controls.close();
      onConfirmed();
    }
  });
}

function openScheduleDialog(schedule = null) {
  const selected = new Set(Array.isArray(schedule?.data?.territorioIds) ? schedule.data.territorioIds : []);
  const date = schedule?.data?.data || todayDateKey();
  const departureLocation = schedule?.data?.localSaida?.toString() || "";
  const weekend = isWeekendScheduleDate(date);
  let controls;
  controls = openDialog({
    title: schedule ? "Editar programação" : "Nova programação",
    help: "Escolha a data e os territórios que serão trabalhados.",
    fields: `
      <div class="field">
        <label for="schedule-date">Data</label>
        <input id="schedule-date" name="date" type="date" value="${escapeHtml(date)}" required>
      </div>
      <div id="weekend-departure-field" class="field weekend-departure-field" ${weekend ? "" : "hidden"}>
        <label for="departure-location">Local da saída de campo</label>
        <input id="departure-location" name="departureLocation" maxlength="120" value="${escapeHtml(departureLocation)}" placeholder="Ex.: Casa do irmão José" ${weekend ? "required" : ""}>
        <small class="field-help">Disponível somente para programações de sábado ou domingo.</small>
      </div>
      <fieldset class="territory-picker">
        <legend>Territórios</legend>
        <div class="territory-choice-list">
          ${state.territories.map((territory) => `
            <label class="territory-choice">
              <input type="checkbox" name="territoryIds" value="${escapeHtml(territory.id)}" ${selected.has(territory.id) ? "checked" : ""}>
              <span>
                <strong>${escapeHtml(territory.data.nome || "Território")}</strong>
                <small>${territory.data.finalizado === true ? "Finalizado" : territory.data.parcial === true ? "Parcial" : "Em andamento"}</small>
              </span>
            </label>`).join("")}
        </div>
      </fieldset>`,
    confirmLabel: "Salvar programação",
    onSubmit: async (formData, setError) => {
      const selectedDate = String(formData.get("date") || "").trim();
      const territoryIds = formData.getAll("territoryIds").map(String);
      const selectedDepartureLocation = String(formData.get("departureLocation") || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return setError("Escolha uma data válida.");
      const selectedWeekend = isWeekendScheduleDate(selectedDate);
      if (selectedWeekend && !selectedDepartureLocation) return setError("Informe de qual casa será a saída de campo.");
      if (!territoryIds.length) return setError("Escolha pelo menos um território.");
      await saveSchedule({
        schedule,
        date: selectedDate,
        territoryIds,
        departureLocation: selectedWeekend ? selectedDepartureLocation : ""
      });
      controls.close();
      showToast("Programação salva e compartilhada com a congregação.");
    }
  });

  const dateInput = controls.dialog.querySelector("#schedule-date");
  const departureField = controls.dialog.querySelector("#weekend-departure-field");
  const departureInput = controls.dialog.querySelector("#departure-location");
  const syncDepartureField = () => {
    const showDeparture = isWeekendScheduleDate(dateInput.value);
    departureField.hidden = !showDeparture;
    departureInput.required = showDeparture;
    if (!showDeparture) departureInput.value = "";
  };
  dateInput.addEventListener("change", syncDepartureField);
  dateInput.addEventListener("input", syncDepartureField);
  syncDepartureField();
}

async function saveSchedule({ schedule = null, date, territoryIds, departureLocation = "" }) {
  if (!state.user || !state.congregationId) throw new Error("Usuário sem congregação.");
  if (!isAdministrator()) throw new Error("Somente administradores podem salvar programações.");
  const email = state.user.email || "sem_email";
  const targetId = `${state.congregationId}_${date}`;
  const targetRef = doc(db, "programacoes", targetId);
  const existingTarget = findSchedule(targetId);
  const original = schedule?.data || existingTarget?.data || {};
  const territories = territoryIds.map((id) => {
    const territory = findTerritory(id);
    return {
      id,
      nome: territory?.data?.nome?.toString() || "Território",
      mapsUrl: territory?.data?.mapsUrl?.toString() || ""
    };
  });
  const payload = {
    congregacaoId: state.congregationId,
    data: date,
    territorioIds: territoryIds,
    territorios: territories,
    localSaida: isWeekendScheduleDate(date) ? departureLocation : null,
    programadoPor: email,
    programadoEm: serverTimestamp(),
    ultimaAtualizacaoPor: email,
    ultimaAtualizacaoEm: serverTimestamp(),
    criadoPor: original.criadoPor || email,
    criadoEm: original.criadoEm || serverTimestamp()
  };
  await setDoc(targetRef, payload, { merge: true });
  if (schedule && schedule.id !== targetId) await deleteDoc(schedule.ref);
}

function openRemoveScheduleDialog(schedule) {
  let controls;
  controls = openDialog({
    title: "Excluir programação",
    help: `Excluir a programação de ${formatScheduleDate(schedule.data.data)}?`,
    fields: "",
    cancelLabel: "Cancelar",
    confirmLabel: "Excluir",
    danger: true,
    onSubmit: async () => {
      await deleteDoc(schedule.ref);
      controls.close();
      showToast("Programação excluída.");
    }
  });
}

function findNotice(id) {
  return state.notices.find((notice) => notice.id === id);
}

function requestNoticePermission(onConfirmed) {
  let controls;
  controls = openDialog({
    title: "Publicar aviso",
    help: "Você foi designado pela comissão de serviço ou pelos anciãos para essa função?",
    fields: "",
    cancelLabel: "Não",
    confirmLabel: "Sim",
    onSubmit: async () => {
      controls.close();
      onConfirmed();
    }
  });
}

function openNoticeDialog() {
  let controls;
  controls = openDialog({
    title: "Novo aviso",
    help: "O aviso será compartilhado com todos os usuários desta congregação.",
    fields: `
      <div class="field">
        <label for="notice-text">Aviso</label>
        <textarea id="notice-text" name="text" rows="5" maxlength="600" required></textarea>
        <small class="field-help">Máximo de 600 caracteres.</small>
      </div>`,
    confirmLabel: "Publicar aviso",
    onSubmit: async (formData, setError) => {
      const text = String(formData.get("text") || "").trim();
      if (!text) return setError("Digite o aviso.");
      const result = await saveNotice(text);
      controls.close();
      showToast(result.notificationSent
        ? "Aviso publicado e notificação enviada."
        : "Aviso publicado, mas a notificação do celular não pôde ser enviada.");
    }
  });
}

async function saveNotice(text) {
  if (!state.user || !state.congregationId) throw new Error("Usuário sem congregação.");
  if (!isAdministrator()) throw new Error("Somente administradores podem publicar avisos.");
  const noticeRef = await addDoc(collection(db, "avisos"), {
    congregacaoId: state.congregationId,
    texto: text,
    publicadoEm: serverTimestamp(),
    publicadoPor: state.user.email || "sem_email"
  });
  try {
    const result = await pushApi("/notify", { noticeId: noticeRef.id });
    return { notificationSent: true, recipients: result.recipients ?? null };
  } catch (error) {
    console.error("O aviso foi salvo, mas o push falhou", error);
    return { notificationSent: false, error };
  }
}

function handleNoticeAction(action, id) {
  if (!isAdministrator()) return showToast("Somente administradores podem excluir avisos.");
  const notice = findNotice(id);
  if (!notice || action !== "remove") return;
  requestNoticePermission(() => openRemoveNoticeDialog(notice));
}

function openRemoveNoticeDialog(notice) {
  let controls;
  controls = openDialog({
    title: "Excluir aviso",
    help: "Este aviso deixará de aparecer para todos os usuários da congregação.",
    fields: "",
    cancelLabel: "Cancelar",
    confirmLabel: "Excluir",
    danger: true,
    onSubmit: async () => {
      await deleteDoc(notice.ref);
      controls.close();
      showToast("Aviso excluído.");
    }
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
  const observation = data.observacao?.toString().trim() || "";
  const observationBy = data.observacaoAtualizadaPor?.toString() || "";
  const completionStatus = territoryCompletionStatus(data);

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
            ${isAdministrator() ? `<button type="button" data-action="edit" data-id="${escapeHtml(id)}">Editar</button>` : ""}
            <button type="button" data-action="observation" data-id="${escapeHtml(id)}">${observation ? "Editar observação" : "Adicionar observação"}</button>
            <button type="button" data-action="progress" data-id="${escapeHtml(id)}">Registrar progresso (rua/nº)</button>
            <button type="button" data-action="clear-progress" data-id="${escapeHtml(id)}" ${partial ? "" : "disabled"}>Remover progresso</button>
            <button type="button" data-action="finish" data-id="${escapeHtml(id)}" ${finished ? "disabled" : ""}>Finalizar</button>
            <button type="button" data-action="restart" data-id="${escapeHtml(id)}">Reiniciar</button>
          </div>
        </details>
      </div>
      <div class="territory-meta">
        <div class="completion-age">${escapeHtml(completionStatus)}</div>
        <div>Iniciado: ${escapeHtml(formatTimestamp(data.iniciadoEm))}</div>
        <div>Finalizado: ${escapeHtml(formatTimestamp(data.finalizadoEm))}${finishedBy ? ` (por ${escapeHtml(finishedBy)})` : ""}</div>
        <div>Reiniciado: ${escapeHtml(formatTimestamp(data.reiniciadoEm))}${restartedBy ? ` (por ${escapeHtml(restartedBy)})` : ""}</div>
        ${partial && (progressStreet.trim() || progressNumber.trim()) ? `
          <div class="progress-block">
            <div class="progress-until">Até: ${escapeHtml(progressStreet)}, ${escapeHtml(progressNumber)}</div>
            <div class="progress-by">Registrado por: ${escapeHtml(progressBy || "-")} • ${escapeHtml(formatTimestamp(data.progressoEm))}</div>
          </div>` : ""}
      </div>
      ${observation ? `
        <div class="territory-observation">
          <strong>Observação</strong>
          <p>${escapeHtml(observation)}</p>
          <small>Atualizada por: ${escapeHtml(observationBy || "-")} • ${escapeHtml(formatTimestamp(data.observacaoAtualizadaEm))}</small>
        </div>` : ""}
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
    if (action === "edit") {
      if (!isAdministrator()) return showToast("Somente administradores podem editar territórios.");
      openTerritoryDialog(territory);
    }
    if (action === "observation") openObservationDialog(territory);
    if (action === "progress") openProgressDialog(territory);
    if (action === "clear-progress") await clearTerritoryProgress(territory);
    if (action === "finish") await finishTerritory(territory);
    if (action === "restart") openRestartDialog(territory);
  } catch (error) {
    showToast(firebaseError(error, "Não foi possível concluir a ação."));
  }
}

async function copyCongregationCode() {
  if (!isAdministrator()) return showToast("Somente administradores podem visualizar o código.");
  const code = state.congregationCode;
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

async function openUserManagementDialog() {
  if (!isPrincipalAdministrator()) {
    showToast("Somente o administrador principal pode administrar usuários.");
    return;
  }

  modalRoot.innerHTML = `
    <dialog class="app-dialog members-dialog">
      <div class="dialog-form">
        <div class="members-dialog__header">
          <div>
            <h2 class="dialog-title">Administrar usuários</h2>
            <p class="dialog-help">Escolha quem terá acesso às funções administrativas desta congregação.</p>
          </div>
          <button class="icon-btn close-members-dialog" type="button" aria-label="Fechar">×</button>
        </div>
        <div class="members-summary">
          <span>Código da congregação</span>
          <strong>${escapeHtml(state.congregationCode || "Indisponível")}</strong>
        </div>
        <div class="members-error error-box" hidden></div>
        <div class="members-list" aria-live="polite">
          <div class="members-loading"><span class="spinner small" aria-hidden="true"></span> Carregando usuários...</div>
        </div>
      </div>
    </dialog>`;

  const dialog = modalRoot.querySelector("dialog");
  const listElement = dialog.querySelector(".members-list");
  const errorElement = dialog.querySelector(".members-error");
  const close = () => {
    dialog.close();
    modalRoot.innerHTML = "";
  };
  dialog.querySelector(".close-members-dialog").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.showModal();

  let members = [];
  const loadMembers = async () => {
    errorElement.hidden = true;
    listElement.innerHTML = `<div class="members-loading"><span class="spinner small" aria-hidden="true"></span> Carregando usuários...</div>`;
    try {
      const snapshot = await getDocs(query(
        collection(db, "usuarios"),
        where("congregacaoId", "==", state.congregationId)
      ));
      members = snapshot.docs.map((item) => {
        const data = item.data();
        const role = item.id === congregationCreatorUid()
          ? USER_ROLES.PRINCIPAL_ADMIN
          : normalizeUserRole(data.tipoUsuario);
        return { id: item.id, ref: item.ref, data, role };
      }).sort((a, b) => {
        const order = { adm_principal: 0, admin: 1, usuario: 2 };
        return (order[a.role] - order[b.role])
          || String(a.data.email || "").localeCompare(String(b.data.email || ""));
      });

      listElement.innerHTML = members.length ? members.map((member) => {
        const isSelf = member.id === state.user.uid;
        const canChange = !isSelf && member.role !== USER_ROLES.PRINCIPAL_ADMIN;
        const nextRole = member.role === USER_ROLES.ADMIN ? USER_ROLES.USER : USER_ROLES.ADMIN;
        return `
          <article class="member-row">
            <div class="member-row__info">
              <strong>${escapeHtml(member.data.email || "Usuário sem e-mail")}${isSelf ? " (você)" : ""}</strong>
              <span class="role-badge ${escapeHtml(member.role)}">${escapeHtml(userRoleLabel(member.role))}</span>
            </div>
            ${canChange ? `
              <button class="btn ${nextRole === USER_ROLES.ADMIN ? "btn-tonal" : "btn-outlined"}" type="button" data-member-id="${escapeHtml(member.id)}" data-member-role="${escapeHtml(nextRole)}">
                ${nextRole === USER_ROLES.ADMIN ? "Tornar administrador" : "Tornar usuário"}
              </button>` : ""}
          </article>`;
      }).join("") : `<p class="notice-empty">Nenhum usuário vinculado.</p>`;
    } catch (error) {
      listElement.innerHTML = "";
      errorElement.textContent = firebaseError(error, "Não foi possível carregar os usuários.");
      errorElement.hidden = false;
    }
  };

  listElement.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-member-id]");
    if (!button || button.disabled) return;
    const member = members.find((item) => item.id === button.dataset.memberId);
    const nextRole = normalizeUserRole(button.dataset.memberRole);
    if (!member || member.role === USER_ROLES.PRINCIPAL_ADMIN || member.id === state.user.uid) return;
    if (nextRole === USER_ROLES.ADMIN && !state.congregationCode) {
      errorElement.textContent = "O código da congregação ainda não está disponível para autorizar este administrador.";
      errorElement.hidden = false;
      return;
    }

    button.disabled = true;
    button.innerHTML = spinnerLabel("Atualizando...");
    try {
      await updateDoc(member.ref, {
        tipoUsuario: nextRole,
        codigoCongregacao: nextRole === USER_ROLES.ADMIN ? state.congregationCode : null,
        funcaoAtualizadaPor: state.user.email || "sem_email",
        funcaoAtualizadaEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
      showToast(nextRole === USER_ROLES.ADMIN ? "Administrador autorizado." : "Acesso administrativo removido.");
      await loadMembers();
    } catch (error) {
      errorElement.textContent = firebaseError(error, "Não foi possível alterar a função do usuário.");
      errorElement.hidden = false;
      button.disabled = false;
    }
  });

  await loadMembers();
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

function openDialog({ title, help = "", fields = "", cancelLabel = "Cancelar", confirmLabel = "Salvar", danger = false, onSubmit }) {
  modalRoot.innerHTML = `
    <dialog class="app-dialog">
      <form class="dialog-form" novalidate>
        <h2 class="dialog-title">${escapeHtml(title)}</h2>
        ${help ? `<p class="dialog-help">${escapeHtml(help)}</p>` : ""}
        ${fields}
        <div class="dialog-error error-box" hidden></div>
        <div class="dialog-actions">
          <button class="btn cancel-dialog" type="button">${escapeHtml(cancelLabel)}</button>
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
  dialog.querySelector("input, textarea")?.focus();
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
  if (!isAdministrator()) throw new Error("Somente administradores podem cadastrar ou editar territórios.");
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
      ultimaFinalizacaoEm: null,
      ultimaFinalizacaoPor: null,
      observacao: null,
      observacaoAtualizadaEm: null,
      observacaoAtualizadaPor: null,
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

function openObservationDialog(territory) {
  let controls;
  controls = openDialog({
    title: "Observação do território",
    help: "Registre uma informação útil sobre acesso, retorno ou alguma particularidade deste território.",
    fields: `
      <div class="field">
        <label for="territory-observation">Observação (opcional)</label>
        <textarea id="territory-observation" name="observation" rows="5" maxlength="600">${escapeHtml(territory.data.observacao || "")}</textarea>
        <small class="field-help">Para remover a observação atual, apague o texto e salve.</small>
      </div>`,
    confirmLabel: "Salvar observação",
    onSubmit: async (formData) => {
      const observation = String(formData.get("observation") || "").trim();
      await saveTerritoryObservation(territory, observation);
      controls.close();
      showToast(observation ? "Observação salva." : "Observação removida.");
    }
  });
}

async function saveTerritoryObservation(territory, observation) {
  const email = state.user?.email || "sem_email";
  await updateDoc(territory.ref, {
    observacao: observation || null,
    observacaoAtualizadaEm: observation ? serverTimestamp() : null,
    observacaoAtualizadaPor: observation ? email : null,
    ultimaAtualizacaoEm: serverTimestamp(),
    ultimaAtualizacaoPor: email
  });
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
    ultimaFinalizacaoEm: serverTimestamp(),
    ultimaFinalizacaoPor: email,
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
        progressNumber: data.progressoNumero || null,
        observation: data.observacao || null,
        lastCompletion: formatTimestamp(data.ultimaFinalizacaoEm || data.finalizadoEm)
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
    navigator.serviceWorker.register("./sw.js?v=14").catch(() => {});
  });
}

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (!user) {
    disconnectPushIdentity();
    state.stopUserProfile?.();
    state.stopUserProfile = null;
    state.userProfile = null;
    state.userRole = USER_ROLES.USER;
    state.congregationId = null;
    state.congregation = null;
    state.congregationCode = "";
    state.territories = [];
    state.schedules = [];
    state.notices = [];
    state.notificationStatus = "checking";
    state.notificationBusy = false;
    state.notificationError = "";
    renderLogin();
    return;
  }
  await loadHome();
});

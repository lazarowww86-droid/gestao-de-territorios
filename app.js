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
  writeBatch,
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
const THEME_STORAGE_KEY = "gestao-territorios-theme";

// Coordenadas obtidas dos links já cadastrados. Os links continuam sendo a
// fonte oficial para abrir o Google Maps; esta tabela serve somente para
// posicionar os marcadores no mapa geral, sem alterar nenhum dado do Firestore.
const TERRITORY_MAP_COORDINATES = new Map([
  ["https://maps.app.goo.gl/U5kcgveaSfZyHvL16", [-23.446066, -46.406097]],
  ["https://maps.app.goo.gl/m2RFSspov3NvR2kp6", [-23.4449457, -46.4052718]],
  ["https://maps.app.goo.gl/PUZkAbk4eEG4yPfo6", [-23.4456754, -46.402264]],
  ["https://maps.app.goo.gl/iEDJtNf462MiJ4aB7", [-23.4453947, -46.4050471]],
  ["https://maps.app.goo.gl/mVfL3ZAHvaeudjbp6", [-23.4459513, -46.4036941]],
  ["https://maps.app.goo.gl/teGwQUVpduUcUA7w8", [-23.4503972, -46.4054552]],
  ["https://maps.app.goo.gl/ShFc3FTppaLmYHV47", [-23.4463498, -46.4058418]],
  ["https://maps.app.goo.gl/HjjPaaBxGHgMeyWJ9", [-23.4467813, -46.4074109]],
  ["https://maps.app.goo.gl/Xn5twcMPXacE89Qp9", [-23.4396156, -46.410963]],
  ["https://maps.app.goo.gl/hxr7KNV8gEHP6hmc9", [-23.4428637, -46.4111784]],
  ["https://maps.app.goo.gl/CrC9VZv6WWxxjDSg8", [-23.4420528, -46.4107806]],
  ["https://maps.app.goo.gl/3U977q7o3dhkddM56", [-23.4416724, -46.410785]],
  ["https://maps.app.goo.gl/X1VWrf7L3G9Rszgf9", [-23.4460795, -46.4067329]],
  ["https://maps.app.goo.gl/xR9HSiYQ5owr3ANH8", [-23.4429388, -46.4117423]],
  ["https://maps.app.goo.gl/pXP5mzZekrLeWkRh9", [-23.4428289, -46.4105514]],
  ["https://maps.app.goo.gl/XqNGeCVayjYTbzE69", [-23.4419344, -46.4107739]],
  ["https://maps.app.goo.gl/6Kf6zTKQejUUwGj18", [-23.442734, -46.4099423]],
  ["https://maps.app.goo.gl/1wXK8RrYyCefvm1q7", [-23.4427546, -46.4093175]],
  ["https://maps.app.goo.gl/BUwj3ZnjLsxdSJZC7", [-23.4426633, -46.4080081]],
  ["https://maps.app.goo.gl/Q77eTUg4DxJmE6kx5", [-23.4429388, -46.4117423]],
  ["https://maps.app.goo.gl/Z6ebWGMkgrHg13od6", [-23.4426913, -46.4085947]],
  ["https://maps.app.goo.gl/5yELp6cVLJ3nb78F8", [-23.448738, -46.4042115]],
  ["https://maps.app.goo.gl/zrEy6jaik1w9F86bA", [-23.4498277, -46.4044668]],
  ["https://maps.app.goo.gl/KS4FxW7eu9ioPLDF9", [-23.4502513, -46.4042614]],
  ["https://maps.app.goo.gl/1oAfbD4u1m7B5872A", [-23.4498509, -46.4024523]],
  ["https://maps.app.goo.gl/ZNzoqtZs63pG3mPa8", [-23.4487916, -46.4039427]],
  ["https://maps.app.goo.gl/oK6HgnHEsahdnTU58", [-23.448738, -46.4042115]],
  ["https://maps.app.goo.gl/tgdgHXh9EebTVfk7A", [-23.4478421, -46.4044968]],
  ["https://maps.app.goo.gl/HsStTpvF4cgdPcwQ7", [-23.4486318, -46.4063432]],
  ["https://maps.app.goo.gl/Mc9SjioSYAEstfF78", [-23.4463226, -46.407134]],
  ["https://maps.app.goo.gl/njLi6k4CbVdHFR9e7", [-23.446066, -46.406097]],
  ["https://maps.app.goo.gl/rFZVPwyBHws9WL9H8", [-23.4473813, -46.4058429]],
  ["https://maps.app.goo.gl/2jt6vndhLp576hpC9", [-23.4471578, -46.40542]],
  ["https://maps.app.goo.gl/RnktByY3p9M3fiyBA", [-23.4468371, -46.4049829]],
  ["https://maps.app.goo.gl/b8QykWeJAchsN7NA9", [-23.4477945, -46.4044013]],
  ["https://maps.app.goo.gl/P9PZqAiaeuzcKSeT8", [-23.445471, -46.4048729]],
  ["https://maps.app.goo.gl/vw2BYjvsG9pY7C68A", [-23.4475498, -46.403765]],
  ["https://maps.app.goo.gl/CcecWbccbztR4SXN6", [-23.4481766, -46.402547]],
  ["https://maps.app.goo.gl/rxQrayHWoKgkF9by6", [-23.4472034, -46.4033295]],
  ["https://maps.app.goo.gl/hFY8chX8qMpLSMPVA", [-23.4465869, -46.4031915]],
  ["https://maps.app.goo.gl/NYv9aNxaPRk8QWrw6", [-23.4450966, -46.4038233]],
  ["https://maps.app.goo.gl/x9VdrgiaMM2LRm97A", [-23.445269, -46.4043269]],
  ["https://maps.app.goo.gl/fFyTojrvGEQmtQdP7", [-23.4462028, -46.4035039]],
  ["https://maps.app.goo.gl/zzersbdDvwkLwosC8", [-23.4465623, -46.4030152]],
  ["https://maps.app.goo.gl/WijfWiuFDXgXAVJQA", [-23.4458288, -46.4024951]],
  ["https://maps.app.goo.gl/qi9tjvMtHAFt342dA", [-23.4422842, -46.4021693]],
  ["https://maps.app.goo.gl/hEkPvxGbQzsfeSgS8", [-23.4437745, -46.4015749]],
  ["https://maps.app.goo.gl/7BKEAh8jaBVepeEK7", [-23.4431664, -46.4014363]],
  ["https://maps.app.goo.gl/kk8gwUxr6Mgfi9h86", [-23.4432776, -46.4026754]],
  ["https://maps.app.goo.gl/yHjq5n9w3bsmgHi6A", [-23.4431837, -46.4040756]],
  ["https://maps.app.goo.gl/xRNp8kJ98r68fJKG8", [-23.4428947, -46.4036503]],
  ["https://maps.app.goo.gl/THoDQ2ApXngnViwb7", [-23.442659, -46.4031063]],
  ["https://maps.app.goo.gl/2EiabvqsxaHDsrm2A", [-23.4426683, -46.4030461]],
  ["https://maps.app.goo.gl/ketjc8nuUpmWCSx9A", [-23.4420015, -46.4022859]],
  ["https://maps.app.goo.gl/AXmjYjK8wDyJEnSq5", [-23.4427961, -46.4038954]],
  ["https://maps.app.goo.gl/1mVe38ArnafUNatEA", [-23.4430762, -46.4043535]],
  ["https://maps.app.goo.gl/duQmuckADWoiLJoW8", [-23.4432133, -46.4048699]],
  ["https://maps.app.goo.gl/N2mugyUB8vf1uSeK8", [-23.4432834, -46.4053551]],
  ["https://maps.app.goo.gl/VbfquxRERuezWBhh7", [-23.4436285, -46.4058322]],
  ["https://maps.app.goo.gl/41yyQumZYKZi7Rcw6", [-23.4438363, -46.4066241]],
  ["https://maps.app.goo.gl/cDMYF36fDDhcRE8YA", [-23.4441601, -46.4074056]],
  ["https://maps.app.goo.gl/CNVt9oS9HRJhok569", [-23.4441048, -46.4057442]],
  ["https://maps.app.goo.gl/2HSYRRRaW5ebUudS8", [-23.4445021, -46.4054494]],
  ["https://maps.app.goo.gl/tDiKqqGGD3HuxJQJ6", [-23.4446755, -46.4074081]],
  ["https://maps.app.goo.gl/YGLYWM26zs2bjCB3A", [-23.4451809, -46.4074601]],
  ["https://maps.app.goo.gl/PAAZ5ujfwBhXT4Qy6", [-23.4455356, -46.4069207]],
  ["https://maps.app.goo.gl/XQL45AycmWVjw8jp8", [-23.445507, -46.4053413]],
  ["https://maps.app.goo.gl/Er9ytwq2tSqMkp8HA", [-23.4442171, -46.4079821]],
  ["https://maps.app.goo.gl/2V3kyDPvyHMGmT43A", [-23.4461285, -46.4079957]],
  ["https://maps.app.goo.gl/gx2Jp5KPK2xtK9JF8", [-23.4481065, -46.4078228]],
  ["https://maps.app.goo.gl/xFBhGShGK8ctNRyE6", [-23.4494431, -46.4075944]]
]);

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

function readStoredAppearanceTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return ["system", "light", "dark"].includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

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
  noticeLikes: new Map(),
  noticeLikeStops: new Map(),
  noticeLikeBusy: new Set(),
  territorySearch: "",
  territoryFilter: "all",
  activeMainTab: "home",
  appearanceTheme: readStoredAppearanceTheme(),
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
  mapCoordinateAttempts: new Set(),
  webMcpLifecycle: null
};

let oneSignalReadyPromise = null;
let territoryMapInstance = null;
const darkThemeMedia = window.matchMedia("(prefers-color-scheme: dark)");

function resolvedAppearanceTheme(preference = state.appearanceTheme) {
  if (preference === "system") return darkThemeMedia.matches ? "dark" : "light";
  return preference === "dark" ? "dark" : "light";
}

function updateThemeColor() {
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = resolvedAppearanceTheme() === "dark" ? "#211c27" : "#6750a4";
}

function updateAppearanceControls() {
  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeOption === state.appearanceTheme));
  });
}

function applyAppearanceTheme(preference, { persist = true, announce = false } = {}) {
  const normalized = ["system", "light", "dark"].includes(preference) ? preference : "system";
  state.appearanceTheme = normalized;
  document.documentElement.dataset.theme = normalized;
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch {
      // O tema continua aplicado nesta sessão mesmo se o armazenamento estiver indisponível.
    }
  }
  updateThemeColor();
  updateAppearanceControls();
  if (announce) {
    const labels = { system: "Automático", light: "Claro", dark: "Escuro" };
    showToast(`Aparência alterada para ${labels[normalized]}.`);
  }
}

darkThemeMedia.addEventListener?.("change", () => {
  if (state.appearanceTheme === "system") updateThemeColor();
});
applyAppearanceTheme(state.appearanceTheme, { persist: false });

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
  clearNoticeLikeSubscriptions();
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
            <p class="field-help"><strong>Primeiro acesso:</strong> para criar sua conta, use uma senha com pelo menos 6 números, sem letras ou símbolos.</p>
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
    void backfillTerritoryCoordinates();
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

function clearNoticeLikeSubscriptions() {
  state.noticeLikeStops.forEach((stop) => stop());
  state.noticeLikeStops.clear();
  state.noticeLikes.clear();
  state.noticeLikeBusy.clear();
}

function syncNoticeLikeSubscriptions() {
  const activeNoticeIds = new Set(state.notices.map((notice) => notice.id));

  state.noticeLikeStops.forEach((stop, noticeId) => {
    if (activeNoticeIds.has(noticeId)) return;
    stop();
    state.noticeLikeStops.delete(noticeId);
    state.noticeLikes.delete(noticeId);
    state.noticeLikeBusy.delete(noticeId);
  });

  state.notices.forEach((notice) => {
    if (state.noticeLikeStops.has(notice.id)) return;

    const likesRef = collection(db, "avisos", notice.id, "curtidas");
    const stop = onSnapshot(likesRef, (snapshot) => {
      const next = {
        total: snapshot.size,
        liked: snapshot.docs.some((item) => item.id === state.user?.uid),
        loaded: true
      };
      const previous = state.noticeLikes.get(notice.id);
      state.noticeLikes.set(notice.id, next);
      if (!previous || previous.total !== next.total || previous.liked !== next.liked || !previous.loaded) {
        renderMainView();
      }
    }, (error) => {
      console.warn("Não foi possível carregar as curtidas do aviso", error);
      state.noticeLikes.set(notice.id, { total: 0, liked: false, loaded: false, error: true });
      renderMainView();
    });

    state.noticeLikeStops.set(notice.id, stop);
  });
}

function subscribeNotices() {
  state.stopNotices?.();
  clearNoticeLikeSubscriptions();
  const noticesQuery = query(
    collection(db, "avisos"),
    where("congregacaoId", "==", state.congregationId)
  );
  state.stopNotices = onSnapshot(noticesQuery, (snapshot) => {
    state.notices = snapshot.docs
      .map((item) => ({ id: item.id, ref: item.ref, data: item.data() }))
      .sort((a, b) => timestampMilliseconds(b.data.publicadoEm) - timestampMilliseconds(a.data.publicadoEm));
    syncNoticeLikeSubscriptions();
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

function nextScheduleForTerritory(id) {
  return upcomingSchedules().find((schedule) => {
    const ids = Array.isArray(schedule.data.territorioIds) ? schedule.data.territorioIds : [];
    const savedTerritories = Array.isArray(schedule.data.territorios) ? schedule.data.territorios : [];
    return ids.includes(id) || savedTerritories.some((territory) => territory?.id === id);
  }) || null;
}

function territoryStatusKey(data) {
  if (data.finalizado === true) return "finished";
  if (data.parcial === true) return "partial";
  return "in-progress";
}

function renderMainTabs(active) {
  return `
    <nav class="main-navigation" aria-label="Navegação principal">
      <button class="main-nav-item" type="button" data-main-tab="home" aria-current="${active === "home" ? "page" : "false"}">
        <span class="main-nav-icon" aria-hidden="true">⌂</span><span>Início</span>
      </button>
      <button class="main-nav-item" type="button" data-main-tab="territories" aria-current="${active === "territories" ? "page" : "false"}">
        <span class="main-nav-icon" aria-hidden="true">▦</span><span>Territórios</span>
      </button>
      <button class="main-nav-item" type="button" data-main-tab="schedules" aria-current="${active === "schedules" ? "page" : "false"}">
        <span class="main-nav-icon" aria-hidden="true">◫</span><span>Programação</span>
      </button>
      <button class="main-nav-item" type="button" data-main-tab="map" aria-current="${active === "map" ? "page" : "false"}">
        <span class="main-nav-icon" aria-hidden="true">⌖</span><span>Mapa</span>
      </button>
      <button class="main-nav-item" type="button" data-main-tab="menu" aria-current="${active === "menu" ? "page" : "false"}">
        <span class="main-nav-icon" aria-hidden="true">☰</span><span>Menu</span>
      </button>
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
  if (territoryMapInstance) {
    territoryMapInstance.remove();
    territoryMapInstance = null;
  }
  if (state.activeMainTab === "home") {
    renderHome();
    return;
  }
  if (state.activeMainTab === "schedules") {
    renderSchedules();
    return;
  }
  if (state.activeMainTab === "map") {
    renderMapView();
    return;
  }
  if (state.activeMainTab === "menu") {
    renderAppMenu();
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
      mapsUrl: current?.data?.mapsUrl?.toString() || saved.mapsUrl?.toString() || "",
      departureLocation: saved.localSaida?.toString().trim() || "",
      departureTime: saved.horarioSaida?.toString().trim() || "",
      finished: current?.data?.finalizado === true,
      partial: current?.data?.parcial === true,
      manageable: Boolean(current)
    };
  });
}

function normalizedMapsUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return `${url.origin}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return String(value || "").trim().split(/[?#]/)[0].replace(/\/$/, "");
  }
}

function isGoogleMapsUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return false;
    if (host === "maps.app.goo.gl" || host === "goo.gl") return true;
    return /^(?:(?:www|maps)\.)?google\.(?:com|com\.br)$/.test(host)
      && (url.pathname === "/maps" || url.pathname.startsWith("/maps/"));
  } catch {
    return false;
  }
}

function decodedMapText(value) {
  let result = String(value || "");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decoded = decodeURIComponent(result);
      if (decoded === result) break;
      result = decoded;
    } catch {
      break;
    }
  }
  return result;
}

function validCoordinatePair(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

function extractCoordinatesFromMapText(value) {
  const text = decodedMapText(value);
  const patterns = [
    /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/i,
    /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/i,
    /(?:[?&](?:query|q|ll|center|destination|daddr)=)(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const pair = match && validCoordinatePair(match[1], match[2]);
    if (pair) return pair;
  }
  return null;
}

function territoryCoordinates(dataOrUrl) {
  const data = dataOrUrl && typeof dataOrUrl === "object" ? dataOrUrl : null;
  if (data) {
    const saved = data.mapLatitude !== null && data.mapLatitude !== undefined
      && data.mapLongitude !== null && data.mapLongitude !== undefined
      ? validCoordinatePair(data.mapLatitude, data.mapLongitude)
      : null;
    if (saved) return saved;
  }
  const mapsUrl = data ? data.mapsUrl : dataOrUrl;
  const direct = extractCoordinatesFromMapText(mapsUrl);
  if (direct) return direct;
  return TERRITORY_MAP_COORDINATES.get(normalizedMapsUrl(mapsUrl)) || null;
}

async function resolveTerritoryMapUrl(mapsUrl) {
  const normalized = String(mapsUrl || "").trim();
  if (!normalized) return null;
  if (!isGoogleMapsUrl(normalized)) {
    throw new Error("Cole um link válido do Google Maps.");
  }

  const known = territoryCoordinates(normalized);
  if (known) return { latitude: known[0], longitude: known[1] };
  if (!state.user) throw new Error("Faça login novamente para localizar o território no mapa.");

  const idToken = await state.user.getIdToken();
  const response = await fetch(`${PUSH_API_URL}/resolve-map`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ mapsUrl: normalized })
  });
  const result = await response.json().catch(() => ({}));
  const pair = validCoordinatePair(result.latitude, result.longitude);
  if (!response.ok || !pair) {
    throw new Error(result.error || "Não foi possível reconhecer a posição desse link do Google Maps. Gere um novo link de compartilhamento e tente novamente.");
  }
  return { latitude: pair[0], longitude: pair[1] };
}

async function backfillTerritoryCoordinates() {
  if (!state.user || !state.congregationId || !isAdministrator()) return;
  const pending = state.territories.filter(({ id, data }) => {
    if (!data.mapsUrl || state.mapCoordinateAttempts.has(id)) return false;
    return !validCoordinatePair(data.mapLatitude, data.mapLongitude);
  });
  pending.forEach(({ id }) => state.mapCoordinateAttempts.add(id));

  for (const territory of pending) {
    try {
      const local = territoryCoordinates(territory.data);
      const located = local
        ? { latitude: local[0], longitude: local[1] }
        : await resolveTerritoryMapUrl(territory.data.mapsUrl);
      if (!located) continue;
      await updateDoc(territory.ref, {
        mapLatitude: located.latitude,
        mapLongitude: located.longitude,
        mapaLocalizadoEm: serverTimestamp(),
        mapaLocalizadoPor: state.user.email || "sem_email"
      });
    } catch (error) {
      console.warn(`Não foi possível localizar o território ${territory.id}.`, error);
    }
  }
}

function territoryStatusLabel(data) {
  if (data.finalizado === true) return "Finalizado";
  if (data.parcial === true) return "Parcial";
  return "Em andamento";
}

function distanceBetweenCoordinatesKm(origin, destination) {
  const toRadians = (value) => value * (Math.PI / 180);
  const [originLatitude, originLongitude] = origin;
  const [destinationLatitude, destinationLongitude] = destination;
  const latitudeDistance = toRadians(destinationLatitude - originLatitude);
  const longitudeDistance = toRadians(destinationLongitude - originLongitude);
  const originLatitudeRadians = toRadians(originLatitude);
  const destinationLatitudeRadians = toRadians(destinationLatitude);
  const haversine = Math.sin(latitudeDistance / 2) ** 2
    + Math.cos(originLatitudeRadians) * Math.cos(destinationLatitudeRadians)
    * Math.sin(longitudeDistance / 2) ** 2;
  const clampedHaversine = Math.min(1, Math.max(0, haversine));
  return 6371 * 2 * Math.atan2(Math.sqrt(clampedHaversine), Math.sqrt(1 - clampedHaversine));
}

function formatTerritoryDistance(distanceKm) {
  if (distanceKm < 1) return `${Math.max(1, Math.round(distanceKm * 1000))} m`;
  return `${distanceKm.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function nearbyTerritories(referenceId, maximum = 5) {
  const reference = findTerritory(referenceId);
  const referenceCoordinates = reference && territoryCoordinates(reference.data);
  if (!reference || !referenceCoordinates) return null;

  return state.territories
    .filter((territory) => territory.id !== referenceId && territory.data.finalizado !== true)
    .map((territory) => {
      const coordinates = territoryCoordinates(territory.data);
      if (!coordinates) return null;
      return {
        territory,
        distanceKm: distanceBetweenCoordinatesKm(referenceCoordinates, coordinates)
      };
    })
    .filter(Boolean)
    .sort((first, second) => first.distanceKm - second.distanceKm
      || String(first.territory.data.nome || "").localeCompare(
        String(second.territory.data.nome || ""),
        "pt-BR",
        { numeric: true, sensitivity: "base" }
      ))
    .slice(0, maximum);
}

function openNearbyTerritoriesDialog(referenceId, { afterFinish = false } = {}) {
  const reference = findTerritory(referenceId);
  if (!reference) return showToast("Território não encontrado.");

  const referenceName = reference.data.nome?.toString() || "Território";
  const nearby = nearbyTerritories(referenceId);
  if (nearby === null) {
    showToast(`${afterFinish ? "Território finalizado. " : ""}Não foi possível calcular os mais próximos porque este território não possui uma posição reconhecida.`);
    return;
  }

  modalRoot.innerHTML = `
    <dialog class="app-dialog nearby-territories-dialog">
      <div class="dialog-form">
        <h2 class="dialog-title">Territórios mais próximos</h2>
        <p class="dialog-help">${afterFinish ? `${escapeHtml(referenceName)} foi finalizado. ` : ""}Veja até cinco territórios disponíveis mais próximos de <strong>${escapeHtml(referenceName)}</strong>.</p>
        <div class="nearby-territory-list">
          ${nearby.length ? nearby.map(({ territory, distanceKm }) => {
            const name = territory.data.nome?.toString() || "Território";
            const mapsUrl = territory.data.mapsUrl?.toString() || "";
            return `
              <div class="nearby-territory-row">
                <div class="nearby-territory-info">
                  <strong>${escapeHtml(name)}</strong>
                  <small>${escapeHtml(formatTerritoryDistance(distanceKm))} • ${escapeHtml(territoryStatusLabel(territory.data))}</small>
                </div>
                <div class="nearby-territory-actions">
                  ${mapsUrl ? `<button class="icon-btn" type="button" data-open-maps="${escapeHtml(mapsUrl)}" aria-label="Abrir ${escapeHtml(name)} no Maps" title="Abrir no Maps"><span class="map-icon" aria-hidden="true">🗺️</span></button>` : ""}
                  <button class="btn btn-outlined" type="button" data-manage-nearby-territory="${escapeHtml(territory.id)}">Gerenciar</button>
                </div>
              </div>`;
          }).join("") : `<div class="nearby-territory-empty">Nenhum outro território disponível com posição reconhecida.</div>`}
        </div>
        <p class="nearby-territory-note">A distância é aproximada e calculada pelos pontos dos links do Google Maps.</p>
        <div class="dialog-actions">
          <button class="btn btn-tonal close-nearby-territories" type="button">Fechar</button>
        </div>
      </div>
    </dialog>`;

  const dialog = modalRoot.querySelector("dialog");
  const close = () => {
    dialog.close();
    modalRoot.innerHTML = "";
  };

  dialog.querySelector(".close-nearby-territories").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.querySelectorAll("[data-open-maps]").forEach((button) => {
    button.addEventListener("click", () => openMaps(button.dataset.openMaps));
  });
  dialog.querySelectorAll("[data-manage-nearby-territory]").forEach((button) => {
    button.addEventListener("click", () => {
      const territoryId = button.dataset.manageNearbyTerritory;
      close();
      openScheduledTerritoryManagement(territoryId);
    });
  });
  dialog.showModal();
}

function renderMapView() {
  const total = state.territories.length;
  const completed = state.territories.filter((territory) => territory.data.finalizado === true).length;
  const partial = state.territories.filter((territory) => territory.data.parcial === true && territory.data.finalizado !== true).length;
  const inProgress = Math.max(total - completed - partial, 0);
  const coverage = total ? Math.round((completed / total) * 100) : 0;
  const positioned = state.territories.filter((territory) => territoryCoordinates(territory.data)).length;

  appElement.innerHTML = `
    <section class="page-shell">
      <header class="top-app-bar"><h1>Mapa geral</h1></header>
      <div class="content map-content">
        <section class="coverage-card" aria-labelledby="coverage-title">
          <div class="coverage-card__heading">
            <div><p class="eyebrow">COBERTURA DA CONGREGAÇÃO</p><h2 id="coverage-title">${coverage}% concluído</h2></div>
            <strong>${completed}/${total}</strong>
          </div>
          <div class="coverage-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${coverage}"><span style="width:${coverage}%"></span></div>
          <div class="map-summary">
            <span class="finished">${completed} finalizados</span>
            <span class="partial">${partial} parciais</span>
            <span class="pending">${inProgress} em andamento</span>
          </div>
        </section>
        <section class="map-panel" aria-labelledby="territory-map-title">
          <div class="section-heading"><div><p class="eyebrow">VISÃO GERAL</p><h2 id="territory-map-title">Territórios no mapa</h2></div></div>
          <div class="map-legend" aria-label="Legenda do mapa">
            <span><i class="finished"></i> Finalizado</span><span><i class="partial"></i> Parcial</span><span><i class="pending"></i> Em andamento</span>
          </div>
          <div id="territory-map" class="territory-map" aria-label="Mapa dos territórios"></div>
          <p id="map-load-message" class="map-load-message" hidden></p>
          ${positioned < total ? `<p class="map-note">${total - positioned} ${total - positioned === 1 ? "território permanece" : "territórios permanecem"} disponível na lista abaixo porque o link atual não informa uma posição no mapa.</p>` : ""}
        </section>
        <section class="map-territory-list" aria-label="Todos os territórios">
          ${state.territories.map(({ data }) => {
            const name = data.nome?.toString() || "Território";
            const mapsUrl = data.mapsUrl?.toString() || "";
            return `<div class="map-territory-row"><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(territoryStatusLabel(data))}</small></span>${mapsUrl ? `<button class="btn btn-outlined" type="button" data-open-maps="${escapeHtml(mapsUrl)}">Abrir mapa</button>` : ""}</div>`;
          }).join("") || `<div class="empty-state"><p>Nenhum território cadastrado.</p></div>`}
        </section>
      </div>
      ${renderMainTabs("map")}
    </section>`;

  bindMainTabs();
  document.querySelectorAll("[data-open-maps]").forEach((button) => {
    button.addEventListener("click", () => openMaps(button.dataset.openMaps));
  });
  initializeTerritoryMap();
}

function initializeTerritoryMap() {
  const mapElement = document.querySelector("#territory-map");
  const message = document.querySelector("#map-load-message");
  const Leaflet = window.L;
  if (!mapElement || !Leaflet) {
    if (mapElement) mapElement.hidden = true;
    if (message) {
      message.hidden = false;
      message.textContent = "O mapa não carregou. Os botões abaixo continuam abrindo todos os territórios normalmente.";
    }
    return;
  }

  const mapped = state.territories
    .map((territory) => ({ territory, coordinates: territoryCoordinates(territory.data) }))
    .filter((item) => item.coordinates);
  if (!mapped.length) {
    mapElement.hidden = true;
    if (message) {
      message.hidden = false;
      message.textContent = "Ainda não há links com posição disponível para montar o mapa geral.";
    }
    return;
  }

  territoryMapInstance = Leaflet.map(mapElement, { scrollWheelZoom: false });
  Leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(territoryMapInstance);

  const colors = { finished: "#2e7d32", partial: "#b26a00", "in-progress": "#b3261e" };
  const bounds = [];
  mapped.forEach(({ territory, coordinates }) => {
    const name = territory.data.nome?.toString() || "Território";
    const status = territoryStatusKey(territory.data);
    const mapsUrl = territory.data.mapsUrl?.toString() || "";
    const marker = Leaflet.circleMarker(coordinates, {
      radius: 8,
      color: "#ffffff",
      weight: 2,
      fillColor: colors[status],
      fillOpacity: 0.95
    }).addTo(territoryMapInstance);
    marker.bindTooltip(name, { direction: "top", offset: [0, -7] });
    marker.bindPopup(`<strong>${escapeHtml(name)}</strong><br><span>${escapeHtml(territoryStatusLabel(territory.data))}</span>${mapsUrl ? `<br><a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener">Abrir no Google Maps</a>` : ""}`);
    bounds.push(coordinates);
  });
  territoryMapInstance.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
  window.setTimeout(() => territoryMapInstance?.invalidateSize(), 0);
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
      <div class="scheduled-territories next-schedule-territories">
        ${territories.map((territory) => `
          <div class="scheduled-territory">
            <div class="scheduled-territory__info">
              <span>${escapeHtml(territory.name)}</span>
              ${territory.manageable ? `<small class="scheduled-territory__status ${territory.finished ? "finished" : territory.partial ? "partial" : "pending"}">${territory.finished ? "Finalizado" : territory.partial ? "Parcial" : "Em andamento"}</small>` : ""}
              ${territory.departureLocation || territory.departureTime ? `<small class="scheduled-territory__departure"><strong>Saída:</strong> ${escapeHtml(territory.departureLocation || "Local não informado")}${territory.departureTime ? ` • ${escapeHtml(territory.departureTime)}` : ""}</small>` : ""}
            </div>
            <div class="scheduled-territory__actions">
              ${territory.mapsUrl ? `<button class="icon-btn" type="button" data-open-maps="${escapeHtml(territory.mapsUrl)}" aria-label="Abrir ${escapeHtml(territory.name)} no Maps" title="Abrir no Maps"><span class="map-icon" aria-hidden="true">🗺️</span></button>` : ""}
              ${territory.manageable ? `<button class="btn btn-tonal scheduled-territory__nearby" type="button" data-nearby-territory="${escapeHtml(territory.id)}">Próximos</button>` : ""}
              ${territory.manageable ? `<button class="btn btn-outlined scheduled-territory__manage" type="button" data-manage-territory="${escapeHtml(territory.id)}">Gerenciar</button>` : ""}
            </div>
          </div>`).join("")}
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
            <p>${formatNoticeText(notice.data.texto || "")}</p>
            ${noticeLikeControl(notice.id)}
            <div class="notice-footer">
              <span>Publicado por: ${escapeHtml(notice.data.publicadoPor || "-")} • ${escapeHtml(formatTimestamp(notice.data.publicadoEm))}</span>
              ${administrator ? `<button class="notice-remove" type="button" data-notice-action="remove" data-id="${escapeHtml(notice.id)}">Excluir</button>` : ""}
            </div>
          </article>`).join("") : `<p class="notice-empty">Nenhum aviso publicado.</p>`}
      </div>
    </section>`;
}

function formatNoticeText(value) {
  return escapeHtml(value).replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
}

function bindNoticePanelActions() {
  document.querySelector("#add-notice")?.addEventListener("click", () => requestNoticePermission(openNoticeDialog));
  document.querySelector("#enable-notifications")?.addEventListener("click", () => {
    syncPushIdentity({ requestPermission: true, showMessages: true });
  });
  document.querySelectorAll("[data-notice-action]").forEach((button) => {
    button.addEventListener("click", () => handleNoticeAction(button.dataset.noticeAction, button.dataset.id));
  });
  document.querySelectorAll("[data-notice-like]").forEach((button) => {
    button.addEventListener("click", () => likeNotice(button.dataset.noticeLike));
  });
}

function bindScheduledTerritoryButtons() {
  document.querySelectorAll("[data-open-maps]").forEach((button) => {
    button.addEventListener("click", () => openMaps(button.dataset.openMaps));
  });
  document.querySelectorAll("[data-manage-territory]").forEach((button) => {
    button.addEventListener("click", () => openScheduledTerritoryManagement(button.dataset.manageTerritory));
  });
  document.querySelectorAll("[data-nearby-territory]").forEach((button) => {
    button.addEventListener("click", () => openNearbyTerritoriesDialog(button.dataset.nearbyTerritory));
  });
}

function switchMainView(destination) {
  state.activeMainTab = destination;
  renderMainView();
}

function renderHome() {
  const congregationName = state.congregation?.nome?.toString().trim() || "Sua congregação";
  const finished = state.territories.filter((territory) => territory.data.finalizado === true).length;
  const active = Math.max(state.territories.length - finished, 0);

  appElement.innerHTML = `
    <section class="page-shell">
      <header class="top-app-bar"><h1>Início</h1></header>
      <div class="content home-content">
        <section class="home-welcome" aria-label="Resumo da congregação">
          <div>
            <p class="eyebrow">GESTÃO DE TERRITÓRIOS</p>
            <h2>${escapeHtml(congregationName)}</h2>
            <p>${escapeHtml(userRoleLabel())} • ${state.user?.email ? escapeHtml(state.user.email) : "Conta conectada"}</p>
          </div>
          <span class="home-role-icon" aria-hidden="true">⌂</span>
        </section>

        <section class="home-shortcuts" aria-label="Acessos rápidos">
          <button type="button" data-main-destination="territories"><span aria-hidden="true">▦</span><strong>Territórios</strong><small>${active} disponíveis</small></button>
          <button type="button" data-main-destination="schedules"><span aria-hidden="true">◫</span><strong>Programação</strong><small>Ver datas e saídas</small></button>
          <button type="button" data-main-destination="map"><span aria-hidden="true">⌖</span><strong>Mapa geral</strong><small>${state.territories.length} pontos cadastrados</small></button>
          <button type="button" data-main-destination="menu"><span aria-hidden="true">☰</span><strong>Menu</strong><small>Congregação e ajustes</small></button>
        </section>

        ${nextScheduleBanner() || `
          <section class="home-empty-schedule">
            <div><p class="eyebrow">PROGRAMAÇÃO</p><h2>Nenhuma programação futura</h2><p>Quando uma programação for criada, ela aparecerá aqui para todos.</p></div>
            <button class="btn btn-outlined" type="button" data-main-destination="schedules">Ver programação</button>
          </section>`}

        ${noticesPanel()}
      </div>
      ${renderMainTabs("home")}
    </section>`;

  bindMainTabs();
  document.querySelectorAll("[data-main-destination]").forEach((button) => {
    button.addEventListener("click", () => switchMainView(button.dataset.mainDestination));
  });
  document.querySelector("#view-schedules")?.addEventListener("click", () => switchMainView("schedules"));
  bindNoticePanelActions();
  bindScheduledTerritoryButtons();
}

function renderAppMenu() {
  const congregationName = state.congregation?.nome?.toString().trim() || "Sua congregação";
  const congregationCode = isAdministrator() ? state.congregationCode : "";

  appElement.innerHTML = `
    <section class="page-shell">
      <header class="top-app-bar"><h1>Menu</h1></header>
      <div class="content app-menu-content">
        <section class="congregation-card" aria-label="Dados da congregação">
          <div class="congregation-card__text">
            <p class="eyebrow">CONGREGAÇÃO ATUAL</p>
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
            ${congregationCode ? `<button id="copy-code" class="btn btn-tonal" type="button" aria-label="Copiar código">▣ Copiar código</button>` : ""}
            ${isPrincipalAdministrator() ? `<button id="manage-users" class="btn btn-outlined" type="button">Administrar usuários</button>` : ""}
          </div>
        </section>

        <section class="menu-section" aria-labelledby="notifications-menu-title">
          <div class="menu-section__heading"><span aria-hidden="true">🔔</span><div><p class="eyebrow">COMUNICAÇÃO</p><h2 id="notifications-menu-title">Notificações</h2></div></div>
          ${notificationControl()}
        </section>

        <section class="menu-section" aria-labelledby="appearance-menu-title">
          <div class="menu-section__heading"><span aria-hidden="true">◐</span><div><p class="eyebrow">VISUAL</p><h2 id="appearance-menu-title">Aparência</h2></div></div>
          <div class="theme-options" role="group" aria-label="Escolher aparência do aplicativo">
            <button type="button" data-theme-option="system" aria-pressed="${state.appearanceTheme === "system"}">
              <span class="theme-option__icon" aria-hidden="true">◐</span><strong>Automático</strong><small>Acompanha o aparelho</small>
            </button>
            <button type="button" data-theme-option="light" aria-pressed="${state.appearanceTheme === "light"}">
              <span class="theme-option__icon" aria-hidden="true">☀</span><strong>Claro</strong><small>Fundo claro</small>
            </button>
            <button type="button" data-theme-option="dark" aria-pressed="${state.appearanceTheme === "dark"}">
              <span class="theme-option__icon" aria-hidden="true">☾</span><strong>Escuro</strong><small>Fundo escuro</small>
            </button>
          </div>
          <p class="menu-help">A escolha fica salva somente neste aparelho.</p>
        </section>

        <section class="menu-section" aria-labelledby="application-menu-title">
          <div class="menu-section__heading"><span aria-hidden="true">▣</span><div><p class="eyebrow">APLICATIVO</p><h2 id="application-menu-title">Instalação e conta</h2></div></div>
          <div class="account-summary">
            <strong>${escapeHtml(state.user?.email || "Conta conectada")}</strong>
            <span>${escapeHtml(userRoleLabel())}</span>
          </div>
          <div class="install-area">${installButton()}</div>
          <p class="menu-help">A instalação mantém o aplicativo disponível na tela inicial. Seus dados continuam sincronizados com a congregação.</p>
        </section>

        <section class="menu-section menu-version" aria-label="Versão do aplicativo">
          <span>Gestão de Territórios</span><strong>Versão 26.4</strong>
        </section>
      </div>
      ${renderMainTabs("menu")}
    </section>`;

  bindMainTabs();
  document.querySelector("#copy-code")?.addEventListener("click", copyCongregationCode);
  document.querySelector("#manage-users")?.addEventListener("click", openUserManagementDialog);
  document.querySelector("#enable-notifications")?.addEventListener("click", () => {
    syncPushIdentity({ requestPermission: true, showMessages: true });
  });
  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    button.addEventListener("click", () => {
      applyAppearanceTheme(button.dataset.themeOption, { announce: true });
    });
  });
  bindInstallButtons();
}

function noticeLikeControl(noticeId) {
  const likes = state.noticeLikes.get(noticeId) || { total: 0, liked: false, loaded: false };
  const busy = state.noticeLikeBusy.has(noticeId);
  const disabled = !likes.loaded || likes.liked || busy;
  const buttonLabel = busy ? "Registrando..." : likes.liked ? "Curtido" : likes.loaded ? "Curtir" : "Carregando...";
  const countLabel = likes.loaded
    ? `${likes.total} ${likes.total === 1 ? "curtida" : "curtidas"}`
    : "Curtidas indisponíveis";

  return `
    <div class="notice-reactions">
      <button
        class="notice-like ${likes.liked ? "liked" : ""}"
        type="button"
        data-notice-like="${escapeHtml(noticeId)}"
        aria-pressed="${likes.liked ? "true" : "false"}"
        ${disabled ? "disabled" : ""}
      ><span aria-hidden="true">👍</span> ${escapeHtml(buttonLabel)}</button>
      <span class="notice-like-count" aria-live="polite">${escapeHtml(countLabel)}</span>
    </div>`;
}

function renderTerritories() {
  const cards = state.territories.map(({ id, data }) => territoryCard(id, data)).join("");
  const filterCounts = state.territories.reduce((counts, territory) => {
    counts[territoryStatusKey(territory.data)] += 1;
    return counts;
  }, { "in-progress": 0, partial: 0, finished: 0 });

  appElement.innerHTML = `
    <section class="page-shell">
      <header class="top-app-bar"><h1>Territórios</h1></header>
      <div class="content territory-content">
        <section class="page-introduction">
          <div><p class="eyebrow">QUADRAS DA CONGREGAÇÃO</p><h2>Encontre e gerencie um território</h2></div>
          <span>${state.territories.length} ${state.territories.length === 1 ? "território" : "territórios"}</span>
        </section>
        ${state.territories.length ? `
          <section class="territory-search" aria-label="Pesquisar território">
            <label for="territory-search-input">Pesquisar território</label>
            <input
              id="territory-search-input"
              type="search"
              inputmode="search"
              autocomplete="off"
              placeholder="Digite o nome ou número da quadra"
              value="${escapeHtml(state.territorySearch)}"
            >
            <div class="territory-filters" aria-label="Filtrar territórios por status">
              <button type="button" data-territory-filter="all" aria-pressed="${state.territoryFilter === "all"}">Todos <span>${state.territories.length}</span></button>
              <button type="button" data-territory-filter="in-progress" aria-pressed="${state.territoryFilter === "in-progress"}">Em andamento <span>${filterCounts["in-progress"]}</span></button>
              <button type="button" data-territory-filter="partial" aria-pressed="${state.territoryFilter === "partial"}">Parciais <span>${filterCounts.partial}</span></button>
              <button type="button" data-territory-filter="finished" aria-pressed="${state.territoryFilter === "finished"}">Finalizados <span>${filterCounts.finished}</span></button>
            </div>
            <p id="territory-search-summary" class="territory-search__summary" aria-live="polite"></p>
          </section>` : ""}
        <section id="territory-list" class="territory-list" aria-label="Lista de territórios">
          ${state.territories.length ? cards : `<div class="empty-state"><p>Nenhum território cadastrado</p></div>`}
          <div id="territory-search-empty" class="empty-state" hidden><p>Nenhum território encontrado.</p></div>
        </section>
      </div>
      ${isAdministrator() ? `<button id="add-territory" class="fab" type="button" aria-label="Adicionar território">＋</button>` : ""}
      ${renderMainTabs("territories")}
    </section>`;

  document.querySelector("#add-territory")?.addEventListener("click", () => openTerritoryDialog());
  document.querySelector("#territory-search-input")?.addEventListener("input", (event) => {
    applyTerritorySearch(event.currentTarget.value);
  });
  document.querySelectorAll("[data-territory-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.territoryFilter = button.dataset.territoryFilter;
      document.querySelectorAll("[data-territory-filter]").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      applyTerritorySearch(state.territorySearch);
    });
  });
  bindMainTabs();
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleTerritoryAction(button.dataset.action, button.dataset.id));
  });
  bindScheduledTerritoryButtons();
  applyTerritorySearch(state.territorySearch);
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
      ${renderMainTabs("schedules")}
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
  document.querySelectorAll("[data-manage-scheduled-territory]").forEach((button) => {
    button.addEventListener("click", () => openScheduledTerritoryManagement(button.dataset.manageScheduledTerritory));
  });
  document.querySelectorAll("[data-nearby-territory]").forEach((button) => {
    button.addEventListener("click", () => openNearbyTerritoriesDialog(button.dataset.nearbyTerritory));
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
            <div class="scheduled-territory__info">
              <span>${escapeHtml(territory.name)}</span>
              ${territory.manageable ? `<small class="scheduled-territory__status ${territory.finished ? "finished" : territory.partial ? "partial" : "pending"}">${territory.finished ? "Finalizado" : territory.partial ? "Parcial" : "Em andamento"}</small>` : ""}
              ${territory.departureLocation || territory.departureTime ? `<small class="scheduled-territory__departure"><strong>Saída:</strong> ${escapeHtml(territory.departureLocation || "Local não informado")}${territory.departureTime ? ` • ${escapeHtml(territory.departureTime)}` : ""}</small>` : ""}
            </div>
            <div class="scheduled-territory__actions">
              ${territory.mapsUrl ? `<button class="icon-btn" type="button" data-open-maps="${escapeHtml(territory.mapsUrl)}" aria-label="Abrir ${escapeHtml(territory.name)} no Maps" title="Abrir no Maps"><span class="map-icon" aria-hidden="true">🗺️</span></button>` : ""}
              ${territory.manageable && !previous ? `<button class="btn btn-tonal scheduled-territory__nearby" type="button" data-nearby-territory="${escapeHtml(territory.id)}">Próximos</button>` : ""}
              ${territory.manageable ? `<button class="btn btn-outlined scheduled-territory__manage" type="button" data-manage-scheduled-territory="${escapeHtml(territory.id)}">Gerenciar</button>` : ""}
            </div>
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

function openScheduledTerritoryManagement(id) {
  const territory = findTerritory(id);
  if (!territory) return showToast("Território não encontrado.");

  const name = territory.data.nome?.toString() || "Território";
  const finished = territory.data.finalizado === true;
  const partial = territory.data.parcial === true;
  const observation = territory.data.observacao?.toString().trim() || "";

  modalRoot.innerHTML = `
    <dialog class="app-dialog territory-management-dialog">
      <div class="dialog-form">
        <h2 class="dialog-title">${escapeHtml(name)}</h2>
        <p class="dialog-help">Escolha o que deseja atualizar neste território.</p>
        <div class="territory-management-actions">
          ${isAdministrator() ? `<button class="btn btn-outlined" type="button" data-scheduled-territory-action="edit">Editar território</button>` : ""}
          <button class="btn btn-outlined" type="button" data-scheduled-territory-action="observation">${observation ? "Editar observação" : "Adicionar observação"}</button>
          <button class="btn btn-outlined" type="button" data-scheduled-territory-action="progress">Registrar progresso</button>
          <button class="btn btn-outlined" type="button" data-scheduled-territory-action="clear-progress" ${partial ? "" : "disabled"}>Remover progresso</button>
          <button class="btn btn-outlined" type="button" data-scheduled-territory-action="finish" ${finished ? "disabled" : ""}>Finalizar território</button>
          <button class="btn btn-outlined" type="button" data-scheduled-territory-action="restart">Reiniciar território</button>
          <button class="btn btn-tonal" type="button" data-scheduled-territory-action="nearby">Ver territórios mais próximos</button>
          ${isAdministrator() ? `<button class="btn btn-danger territory-delete-action" type="button" data-scheduled-territory-action="remove">Excluir território</button>` : ""}
        </div>
        <div class="dialog-actions">
          <button class="btn btn-tonal close-territory-management" type="button">Fechar</button>
        </div>
      </div>
    </dialog>`;

  const dialog = modalRoot.querySelector("dialog");
  const close = () => {
    dialog.close();
    modalRoot.innerHTML = "";
  };

  dialog.querySelector(".close-territory-management").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.querySelectorAll("[data-scheduled-territory-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.scheduledTerritoryAction;
      close();
      await handleTerritoryAction(action, id);
    });
  });
  dialog.showModal();
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
  const savedTerritories = Array.isArray(schedule?.data?.territorios) ? schedule.data.territorios : [];
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
          ${state.territories.map((territory) => {
            const saved = savedTerritories.find((item) => item?.id === territory.id) || {};
            const checked = selected.has(territory.id);
            return `
              <div class="territory-choice-card" data-territory-assignment>
                <label class="territory-choice">
                  <input type="checkbox" name="territoryIds" value="${escapeHtml(territory.id)}" ${checked ? "checked" : ""}>
                  <span>
                    <strong>${escapeHtml(territory.data.nome || "Território")}</strong>
                    <small>${territory.data.finalizado === true ? "Finalizado" : territory.data.parcial === true ? "Parcial" : "Em andamento"}</small>
                  </span>
                </label>
                <div class="territory-assignment-fields" ${checked ? "" : "hidden"}>
                  <div class="field">
                    <label for="territory-location-${escapeHtml(territory.id)}">Local da saída</label>
                    <input id="territory-location-${escapeHtml(territory.id)}" name="territoryLocation__${escapeHtml(territory.id)}" maxlength="120" value="${escapeHtml(saved.localSaida || "")}" placeholder="Ex.: Salão do Reino">
                  </div>
                  <div class="field territory-time-field">
                    <label for="territory-time-${escapeHtml(territory.id)}">Horário</label>
                    <input id="territory-time-${escapeHtml(territory.id)}" name="territoryTime__${escapeHtml(territory.id)}" type="time" value="${escapeHtml(saved.horarioSaida || "")}">
                  </div>
                </div>
              </div>`;
          }).join("")}
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
      const territoryDepartures = {};
      for (const id of territoryIds) {
        const location = String(formData.get(`territoryLocation__${id}`) || "").trim();
        const time = String(formData.get(`territoryTime__${id}`) || "").trim();
        if ((location && !time) || (!location && time)) {
          const territory = findTerritory(id);
          return setError(`Informe o local e o horário da saída de ${territory?.data?.nome || "cada território"}.`);
        }
        if (location && time) territoryDepartures[id] = { location, time };
      }
      await saveSchedule({
        schedule,
        date: selectedDate,
        territoryIds,
        departureLocation: selectedWeekend ? selectedDepartureLocation : "",
        territoryDepartures
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
  controls.dialog.querySelectorAll("[data-territory-assignment]").forEach((card) => {
    const checkbox = card.querySelector('input[name="territoryIds"]');
    const assignmentFields = card.querySelector(".territory-assignment-fields");
    const syncAssignmentFields = () => {
      assignmentFields.hidden = !checkbox.checked;
    };
    checkbox.addEventListener("change", syncAssignmentFields);
    syncAssignmentFields();
  });
  syncDepartureField();
}

async function saveSchedule({ schedule = null, date, territoryIds, departureLocation = "", territoryDepartures = {} }) {
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
      mapsUrl: territory?.data?.mapsUrl?.toString() || "",
      localSaida: territoryDepartures[id]?.location || "",
      horarioSaida: territoryDepartures[id]?.time || ""
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

async function likeNotice(id) {
  if (!state.user || !state.congregationId) return showToast("Entre novamente para curtir o aviso.");
  if (!findNotice(id)) return showToast("Aviso não encontrado.");

  const likes = state.noticeLikes.get(id);
  if (!likes?.loaded || likes.liked || state.noticeLikeBusy.has(id)) return;

  state.noticeLikeBusy.add(id);
  renderMainView();
  try {
    await setDoc(doc(db, "avisos", id, "curtidas", state.user.uid), {
      congregacaoId: state.congregationId,
      curtidoEm: serverTimestamp()
    });
    showToast("Curtida registrada.");
  } catch (error) {
    showToast(firebaseError(error, "Não foi possível registrar a curtida."));
  } finally {
    state.noticeLikeBusy.delete(id);
    renderMainView();
  }
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
  const statusKey = territoryStatusKey(data);
  const nextSchedule = nextScheduleForTerritory(id);
  const nextScheduleTerritory = nextSchedule
    ? scheduleTerritories(nextSchedule).find((territory) => territory.id === id)
    : null;

  return `
    <article class="territory-card ${finished ? "finished" : "pending"}" data-territory-search="${escapeHtml(normalizeTerritorySearch(name))}" data-territory-status="${statusKey}">
      <div class="territory-card__header">
        <div class="territory-title-wrap">
          <h2 class="territory-title">${escapeHtml(name)}</h2>
          ${partial && !finished ? `<span class="partial-pill">PARCIAL</span>` : ""}
        </div>
        <button class="btn btn-outlined territory-card__manage" type="button" data-manage-territory="${escapeHtml(id)}">Gerenciar</button>
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
      ${nextSchedule ? `
        <div class="territory-next-schedule">
          <span aria-hidden="true">📅</span>
          <span><strong>Programado:</strong> ${escapeHtml(formatScheduleDate(nextSchedule.data.data))}${nextSchedule.data.data === todayDateKey() ? " — Hoje" : ""}${nextScheduleTerritory?.departureLocation || nextScheduleTerritory?.departureTime ? `<small><strong>Saída:</strong> ${escapeHtml(nextScheduleTerritory.departureLocation || "Local não informado")}${nextScheduleTerritory.departureTime ? ` • ${escapeHtml(nextScheduleTerritory.departureTime)}` : ""}</small>` : ""}</span>
        </div>` : ""}
      ${observation ? `
        <div class="territory-observation">
          <strong>Observação</strong>
          <p>${escapeHtml(observation)}</p>
          <small>Atualizada por: ${escapeHtml(observationBy || "-")} • ${escapeHtml(formatTimestamp(data.observacaoAtualizadaEm))}</small>
        </div>` : ""}
      ${mapsUrl ? `
        <div class="maps-row">
          <span class="maps-link" title="${escapeHtml(mapsUrl)}">${escapeHtml(mapsUrl)}</span>
          <button class="icon-btn" type="button" data-open-maps="${escapeHtml(mapsUrl)}" aria-label="Abrir no Maps" title="Abrir no Maps"><span class="map-icon" aria-hidden="true">🗺️</span></button>
        </div>` : ""}
    </article>`;
}

function normalizeTerritorySearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function applyTerritorySearch(value) {
  state.territorySearch = String(value || "");
  const query = normalizeTerritorySearch(state.territorySearch);
  const filter = state.territoryFilter || "all";
  const cards = Array.from(document.querySelectorAll("#territory-list [data-territory-search]"));
  const empty = document.querySelector("#territory-search-empty");
  const summary = document.querySelector("#territory-search-summary");
  let visible = 0;

  cards.forEach((card) => {
    const matchesSearch = !query || card.dataset.territorySearch.includes(query);
    const matchesStatus = filter === "all" || card.dataset.territoryStatus === filter;
    const matches = matchesSearch && matchesStatus;
    card.hidden = !matches;
    if (matches) visible += 1;
  });

  if (empty) empty.hidden = visible > 0 || cards.length === 0;
  if (summary) {
    summary.textContent = query || filter !== "all"
      ? `${visible} ${visible === 1 ? "território encontrado" : "territórios encontrados"}`
      : `${cards.length} ${cards.length === 1 ? "território cadastrado" : "territórios cadastrados"}`;
  }
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
    if (action === "nearby") openNearbyTerritoriesDialog(territory.id);
    if (action === "remove") {
      if (!isAdministrator()) return showToast("Somente administradores podem excluir territórios.");
      openRemoveTerritoryDialog(territory);
    }
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
        <input id="territory-maps" name="mapsUrl" type="url" inputmode="url" maxlength="2048" autocomplete="off" value="${escapeHtml(data.mapsUrl || "")}" placeholder="Cole o link compartilhado pelo Google Maps">
        <small class="field-help">O ponto da quadra será reconhecido automaticamente e aparecerá no Mapa geral.</small>
      </div>`,
    onSubmit: async (formData, setError) => {
      const name = formData.get("name").trim();
      const mapsUrl = formData.get("mapsUrl").trim();
      if (!name) return setError("Digite o nome do território.");
      if (mapsUrl && !isGoogleMapsUrl(mapsUrl)) return setError("Cole um link válido do Google Maps.");
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
  const currentTerritory = id ? findTerritory(id) : null;
  const currentCoordinates = currentTerritory
    && normalizedMapsUrl(currentTerritory.data.mapsUrl) === normalizedMapsUrl(mapsUrl)
    ? territoryCoordinates(currentTerritory.data)
    : null;
  const mapLocation = mapsUrl
    ? (currentCoordinates
      ? { latitude: currentCoordinates[0], longitude: currentCoordinates[1] }
      : await resolveTerritoryMapUrl(mapsUrl))
    : null;
  const mapFields = {
    mapLatitude: mapLocation?.latitude ?? null,
    mapLongitude: mapLocation?.longitude ?? null,
    mapaLocalizadoEm: mapLocation ? serverTimestamp() : null,
    mapaLocalizadoPor: mapLocation ? email : null
  };

  if (!id) {
    await addDoc(collection(db, "territorios"), {
      congregacaoId: state.congregationId,
      nome: name,
      mapsUrl,
      ...mapFields,
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
      ...mapFields,
      ultimaAtualizacaoEm: serverTimestamp(),
      ultimaAtualizacaoPor: email
    });
  }
}

function openRemoveTerritoryDialog(territory) {
  if (!isAdministrator()) return showToast("Somente administradores podem excluir territórios.");

  const name = territory.data.nome?.toString() || "Território";
  let controls;
  controls = openDialog({
    title: "Excluir território",
    help: name,
    fields: `
      <div class="territory-delete-warning" role="alert">
        <strong>Você tem certeza que vai excluir esse território?</strong>
        <span>Esta ação é permanente e não poderá ser desfeita.</span>
      </div>`,
    cancelLabel: "Cancelar",
    confirmLabel: "Excluir território",
    danger: true,
    onSubmit: async () => {
      await deleteTerritoryAndScheduleReferences(territory);
      controls.close();
      showToast(`${name} foi excluído.`);
    }
  });
}

async function deleteTerritoryAndScheduleReferences(territory) {
  if (!state.user || !state.congregationId) throw new Error("Usuário sem congregação.");
  if (!isAdministrator()) throw new Error("Somente administradores podem excluir territórios.");

  const territoryId = String(territory.id);
  const email = state.user.email || "sem_email";
  const batch = writeBatch(db);

  state.schedules.forEach((schedule) => {
    const ids = Array.isArray(schedule.data.territorioIds)
      ? schedule.data.territorioIds.map(String)
      : [];
    const savedTerritories = Array.isArray(schedule.data.territorios)
      ? schedule.data.territorios
      : [];
    const referencesTerritory = ids.includes(territoryId)
      || savedTerritories.some((item) => String(item?.id || "") === territoryId);

    if (!referencesTerritory) return;

    const remainingIds = ids.filter((id) => id !== territoryId);
    const remainingTerritories = savedTerritories.filter((item) => String(item?.id || "") !== territoryId);
    const normalizedRemainingIds = remainingIds.length
      ? remainingIds
      : remainingTerritories.map((item) => String(item?.id || "")).filter(Boolean);

    if (!normalizedRemainingIds.length && !remainingTerritories.length) {
      batch.delete(schedule.ref);
      return;
    }

    batch.update(schedule.ref, {
      territorioIds: normalizedRemainingIds,
      territorios: remainingTerritories,
      ultimaAtualizacaoPor: email,
      ultimaAtualizacaoEm: serverTimestamp()
    });
  });

  batch.delete(territory.ref || doc(db, "territorios", territoryId));
  await batch.commit();
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
  openNearbyTerritoriesDialog(territory.id, { afterFinish: true });
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
      if (mapsUrl && !isGoogleMapsUrl(mapsUrl)) throw new Error("Informe um link válido do Google Maps.");
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
    navigator.serviceWorker.register("./sw.js?v=26.4.1").catch(() => {});
  });
}

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  state.mapCoordinateAttempts.clear();
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

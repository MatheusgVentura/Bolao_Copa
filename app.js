const ENTRY_VALUE = 100;
const PREDICTION_DEADLINE_MS = 1 * 60 * 1000;
const AUTO_RESULTS_REFRESH_MS = 5 * 60 * 1000;
const SPECIAL_BONUS_DEADLINE = new Date("2026-06-10T23:59:59-03:00");
const PARTICIPANT_PHOTOS = ["Aquino", "Danão", "Davi", "João", "Julianno", "Marcelo", "Matheus", "Pedro", "Rizza", "Vicius"];

const participantForm = document.querySelector("#participantForm");
const matchForm = document.querySelector("#matchForm");
const predictionForm = document.querySelector("#predictionForm");
const resultForm = document.querySelector("#resultForm");
const specialResultForm = document.querySelector("#specialResultForm");
const adminBonusForm = document.querySelector("#adminBonusForm");
const adminManualPointsForm = document.querySelector("#adminManualPointsForm");
const adminPredictForm = document.querySelector("#adminPredictForm");
const refreshButton = document.querySelector("#refreshButton");
const importMatchesButton = document.querySelector("#importMatchesButton");
const adminLoginButton = document.querySelector("#adminLoginButton");
const adminLogoutButton = document.querySelector("#adminLogoutButton");
const clearResultButton = document.querySelector("#clearResultButton");
const disableBonusPointsButton = document.querySelector("#disableBonusPointsButton");
const clearSpecialResultButton = document.querySelector("#clearSpecialResultButton");

const totalParticipants = document.querySelector("#totalParticipants");
const totalMatches = document.querySelector("#totalMatches");
const totalPrize = document.querySelector("#totalPrize");
const connectionStatus = document.querySelector("#connectionStatus");
const participantSelect = document.querySelector("#participantSelect");
const predictionStageSelect = document.querySelector("#predictionStageSelect");
const matchSelect = document.querySelector("#matchSelect");
const resultStageSelect = document.querySelector("#resultStageSelect");
const resultMatchSelect = document.querySelector("#resultMatchSelect");
const rankingTable = document.querySelector("#rankingTable");
const rankingEmpty = document.querySelector("#rankingEmpty");
const adminStageSelect = document.querySelector("#adminStageSelect");
const adminMatchSelect = document.querySelector("#adminMatchSelect");
const releasePredictionsButton = document.querySelector("#releasePredictionsButton");
const releasePredictionsMessage = document.querySelector("#releasePredictionsMessage");
const adminPredictionsTable = document.querySelector("#adminPredictionsTable");
const adminEmpty = document.querySelector("#adminEmpty");
const predictionLogTable = document.querySelector("#predictionLogTable");
const predictionLogEmpty = document.querySelector("#predictionLogEmpty");
const predictionLogDaySelect = document.querySelector("#predictionLogDaySelect");
const predictionLogMatchSelect = document.querySelector("#predictionLogMatchSelect");
const adminBonusTable = document.querySelector("#adminBonusTable");
const adminBonusEmpty = document.querySelector("#adminBonusEmpty");
const adminBonusParticipantSelect = document.querySelector("#adminBonusParticipantSelect");
const adminBonusMessage = document.querySelector("#adminBonusMessage");
const adminManualPointsParticipantSelect = document.querySelector("#adminManualPointsParticipantSelect");
const adminManualPointsInput = document.querySelector("#adminManualPointsInput");
const adminManualPointsMessage = document.querySelector("#adminManualPointsMessage");
const adminPredictParticipantSelect = document.querySelector("#adminPredictParticipantSelect");
const adminPredictStageSelect = document.querySelector("#adminPredictStageSelect");
const adminPredictMatchSelect = document.querySelector("#adminPredictMatchSelect");
const adminPredictHomeScore = document.querySelector("#adminPredictHomeScore");
const adminPredictAwayScore = document.querySelector("#adminPredictAwayScore");
const adminPredictMessage = document.querySelector("#adminPredictMessage");
const adminTabButtons = [...document.querySelectorAll("[data-admin-tab]")];
const adminTabPanels = [...document.querySelectorAll("[data-admin-panel]")];
const publicBonusPanel = document.querySelector("#publicBonusPanel");
const publicBonusTable = document.querySelector("#publicBonusTable");
const publicBonusEmpty = document.querySelector("#publicBonusEmpty");
const groupTabs = document.querySelector("#groupTabs");
const teamSearchInput = document.querySelector("#teamSearchInput");
const matchesList = document.querySelector("#matchesList");
const matchesEmpty = document.querySelector("#matchesEmpty");
const selectedMatchSummary = document.querySelector("#selectedMatchSummary");
const predictionHomeScore = document.querySelector("#predictionHomeScore");
const predictionAwayScore = document.querySelector("#predictionAwayScore");
const loadingBar = document.querySelector("#loadingBar");
const toastContainer = document.querySelector("#toastContainer");
const installAppButton = document.querySelector("#installAppButton");
const themeToggleButton = document.querySelector("#themeToggleButton");

let supabaseClient = null;
let appConfig = null;
let participants = [];
let matches = [];
let predictions = [];
let predictionLogs = [];
let specialResults = null;
let selectedDay = "all";
let teamSearchQuery = "";
let selectedAdminDay = "all";
let selectedAdminMatch = "";
let selectedAdminPredictDay = "all";
let selectedAdminPredictMatch = "";
let selectedLogDay = "";
let selectedLogMatch = "all";
let isAdmin = sessionStorage.getItem("bolao-admin") === "true";
let activeAdminTab = sessionStorage.getItem("bolao-admin-tab") || "review";
let nextKickoffTimer = null;
let countdownIntervalId = null;
let predictionDeadlineIntervalId = null;
let resultSyncInProgress = false;
let preferredParticipantId = localStorage.getItem("bolao-participant-id") || "";
let hasLoadedMatchesOnce = false;
let deferredInstallPrompt = null;
const NOTIFIED_MATCHES_KEY = "bolao-notified-matches";
const TOAST_DURATION_MS = 8000;

function money(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getParticipantPhoto(name) {
  const normalizedName = normalizeText(name);
  const match = PARTICIPANT_PHOTOS.find((file) => normalizedName.includes(normalizeText(file)));
  return match ? `Fotos/${encodeURIComponent(match)}.jpg` : null;
}

function setStatus(message, type = "") {
  connectionStatus.textContent = message;
  connectionStatus.className = `status ${type}`.trim();
}

function setFormsEnabled(enabled) {
  document.querySelectorAll("input, select, button").forEach((element) => {
    element.disabled = !enabled;
  });
}

function applyAdminMode() {
  document.body.classList.toggle("is-admin", isAdmin);
  adminLoginButton.classList.toggle("hidden", isAdmin);
  adminLogoutButton.classList.toggle("hidden", !isAdmin);
  renderMatches();
}

function requireAdmin() {
  if (isAdmin) return true;

  window.alert("Essa acao e apenas para admin.");
  return false;
}

function getConfig() {
  const config = window.SUPABASE_CONFIG;
  if (!config || !config.url || !config.anonKey) return null;
  if (config.url.includes("COLE_A_URL") || config.anonKey.includes("COLE_A_CHAVE")) return null;
  return config;
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value ?? "";
  return element.innerHTML;
}

function gameResult(home, away) {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

function pointsFor(prediction, match) {
  const validManualPoints = [0, 1, 3];
  if (
    prediction.reviewed &&
    prediction.manual_points !== null &&
    prediction.manual_points !== undefined &&
    validManualPoints.includes(Number(prediction.manual_points))
  ) {
    return Number(prediction.manual_points);
  }

  return automaticPointsFor(prediction, match);
}

function automaticPointsFor(prediction, match) {
  if (match.home_score === null || match.away_score === null) return 0;

  const exact =
    prediction.home_score === match.home_score &&
    prediction.away_score === match.away_score;

  if (exact) return 3;

  const predictionResult = gameResult(prediction.home_score, prediction.away_score);
  const officialResult = gameResult(match.home_score, match.away_score);

  if (predictionResult === officialResult) return 1;
  return 0;
}

function activateAdminTab(tabName, focusTab = false) {
  const validTab = adminTabButtons.some((button) => button.dataset.adminTab === tabName)
    ? tabName
    : "review";

  activeAdminTab = validTab;
  sessionStorage.setItem("bolao-admin-tab", validTab);

  adminTabButtons.forEach((button) => {
    const isActive = button.dataset.adminTab === validTab;
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
    if (isActive && focusTab) button.focus();
  });

  adminTabPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminPanel !== validTab);
  });
}

function hasMatchStarted(match) {
  if (!match?.kickoff_at) return false;

  const kickoff = new Date(match.kickoff_at).getTime();
  return !Number.isNaN(kickoff) && Date.now() >= kickoff;
}

function arePredictionsReleased(match) {
  return Boolean(match?.predictions_released) || hasMatchStarted(match);
}

function canShowMatchPredictions(match) {
  return isAdmin || hasOfficialResult(match) || arePredictionsReleased(match);
}

function canShowMatchPoints(match) {
  return isAdmin || hasOfficialResult(match);
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sameText(a, b) {
  return Boolean(normalizeText(a)) && normalizeText(a) === normalizeText(b);
}

function isSpecialBonusOpen() {
  return Date.now() <= SPECIAL_BONUS_DEADLINE.getTime();
}

function canShowSpecialBonusPicks() {
  return isAdmin || !isSpecialBonusOpen() || specialResults?.bonus_active;
}

function specialBonusDeadlineText() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(SPECIAL_BONUS_DEADLINE);
}

function participantNameExists(name) {
  const normalizedName = normalizeText(name);
  return participants.some((participant) => normalizeText(participant.name) === normalizedName);
}

function specialBonusFor(participant) {
  if (!specialResults?.bonus_active) return 0;

  const officialFinalists = [
    specialResults.finalist_one,
    specialResults.finalist_two
  ].filter(Boolean);
  const participantFinalists = [
    participant?.finalist_one_pick,
    participant?.finalist_two_pick
  ].filter(Boolean);

  const matchedOfficialFinalists = new Set();
  participantFinalists.forEach((pick) => {
    const officialIndex = officialFinalists.findIndex((official, index) =>
      !matchedOfficialFinalists.has(index) && sameText(pick, official)
    );

    if (officialIndex >= 0) {
      matchedOfficialFinalists.add(officialIndex);
    }
  });

  const finalistPoints = matchedOfficialFinalists.size * 3;
  const championPoints = sameText(participant?.champion_pick, specialResults.champion) ? 5 : 0;
  const topScorerPoints = sameText(participant?.top_scorer_pick, specialResults.top_scorer) ? 5 : 0;

  return finalistPoints + championPoints + topScorerPoints;
}

function hasSpecialBonusPicks(participant) {
  return [
    participant?.champion_pick,
    participant?.top_scorer_pick,
    participant?.finalist_one_pick,
    participant?.finalist_two_pick
  ].some(Boolean);
}

function participantsWithSpecialBonus() {
  return participants.filter(hasSpecialBonusPicks);
}

const MIN_PREDICTIONS_FOR_ACCURACY = 3;

function isExactPrediction(prediction, match) {
  return prediction.home_score === match.home_score && prediction.away_score === match.away_score;
}

function finishedPredictionsForParticipant(participant) {
  return predictions
    .filter((prediction) => prediction.participant_id === participant.id)
    .map((prediction) => ({ prediction, match: matches.find((item) => item.id === prediction.match_id) }))
    .filter(({ match }) => match && hasOfficialResult(match))
    .sort((a, b) => {
      const aTime = a.match.kickoff_at ? new Date(a.match.kickoff_at).getTime() : new Date(a.prediction.created_at).getTime();
      const bTime = b.match.kickoff_at ? new Date(b.match.kickoff_at).getTime() : new Date(b.prediction.created_at).getTime();
      return aTime - bTime;
    });
}

function participantHighlightStats(participant) {
  const finished = finishedPredictionsForParticipant(participant);
  let exactCount = 0;
  let hitCount = 0;
  let bestStreak = 0;
  let runningStreak = 0;

  finished.forEach(({ prediction, match }) => {
    if (isExactPrediction(prediction, match)) exactCount += 1;

    if (pointsFor(prediction, match) > 0) {
      hitCount += 1;
      runningStreak += 1;
      bestStreak = Math.max(bestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
  });

  const totalFinished = finished.length;

  return {
    participant,
    exactCount,
    totalFinished,
    accuracy: totalFinished ? (hitCount / totalFinished) * 100 : null,
    currentStreak: runningStreak,
    bestStreak
  };
}

function calculateHighlights() {
  return participants.map(participantHighlightStats);
}

function topHighlights(stats, { value, minSamples = 0, secondary } = {}) {
  return stats
    .filter((item) => item.totalFinished >= minSamples)
    .filter((item) => value(item) !== null && value(item) !== undefined)
    .sort((a, b) => {
      const diff = value(b) - value(a);
      if (diff !== 0) return diff;
      if (secondary) {
        const secondaryDiff = secondary(b) - secondary(a);
        if (secondaryDiff !== 0) return secondaryDiff;
      }
      return a.participant.name.localeCompare(b.participant.name);
    })
    .slice(0, 3);
}

function podiumStepMarkup(rank, item, valueLabel) {
  const participant = item.participant;
  const name = escapeHtml(participant.name);
  const initial = escapeHtml(participant.name.trim()[0]?.toUpperCase() || "?");
  const photoSrc = getParticipantPhoto(participant.name);
  const avatarImg = photoSrc
    ? `<img src="${photoSrc}" alt="" aria-hidden="true" onerror="this.parentElement.classList.add('no-photo')">`
    : "";

  return `
    <div class="podium-step" data-place="${rank}">
      <div class="rank-avatar ${photoSrc ? "" : "no-photo"}" data-initial="${initial}">${avatarImg}</div>
      <span class="podium-name">${name}</span>
      <div class="podium-bar" aria-hidden="true">${rank}</div>
      <span class="podium-value">${valueLabel}</span>
    </div>
  `;
}

function renderPodium(containerId, emptyId, items, valueLabelFn) {
  const container = document.querySelector(`#${containerId}`);
  const empty = document.querySelector(`#${emptyId}`);

  container.innerHTML = items.map((item, index) => podiumStepMarkup(index + 1, item, valueLabelFn(item))).join("");
  container.style.display = items.length ? "flex" : "none";
  empty.style.display = items.length ? "none" : "block";
}

function renderHighlights() {
  const stats = calculateHighlights();

  renderPodium(
    "podiumExact",
    "podiumExactEmpty",
    topHighlights(stats, { value: (item) => item.exactCount, secondary: (item) => item.totalFinished }),
    (item) => `${item.exactCount} cravada${item.exactCount === 1 ? "" : "s"}`
  );

  renderPodium(
    "podiumStreak",
    "podiumStreakEmpty",
    topHighlights(stats, { value: (item) => item.currentStreak, secondary: (item) => item.bestStreak }),
    (item) => `${item.currentStreak} ${item.currentStreak === 1 ? "jogo" : "jogos"}`
  );

  renderPodium(
    "podiumAccuracy",
    "podiumAccuracyEmpty",
    topHighlights(stats, { value: (item) => item.accuracy, minSamples: MIN_PREDICTIONS_FOR_ACCURACY }),
    (item) => `${item.accuracy.toFixed(0)}%`
  );
}

function matchPointsForParticipant(participant) {
  return predictions
    .filter((prediction) => prediction.participant_id === participant.id)
    .reduce((total, prediction) => {
      const match = matches.find((item) => item.id === prediction.match_id);
      return total + (match ? pointsFor(prediction, match) : 0);
    }, 0);
}

function fillAdminBonusForm(participantId) {
  const participant = participants.find((item) => item.id === participantId);

  document.querySelector("#adminChampionPick").value = participant?.champion_pick || "";
  document.querySelector("#adminTopScorerPick").value = participant?.top_scorer_pick || "";
  document.querySelector("#adminFinalistOnePick").value = participant?.finalist_one_pick || "";
  document.querySelector("#adminFinalistTwoPick").value = participant?.finalist_two_pick || "";
}

function fillAdminManualPointsForm(participantId) {
  const participant = participants.find((item) => item.id === participantId);
  adminManualPointsInput.value = participant?.manual_bonus_points ?? 0;
}

function fillAdminPredictForm(participantId, matchId) {
  const existingPrediction = predictions.find(
    (prediction) => prediction.participant_id === participantId && prediction.match_id === matchId
  );
  adminPredictHomeScore.value = existingPrediction ? existingPrediction.home_score : "";
  adminPredictAwayScore.value = existingPrediction ? existingPrediction.away_score : "";
}

function fillSpecialResultForm() {
  document.querySelector("#officialTopScorer").value = specialResults?.top_scorer || "";
  document.querySelector("#officialFinalistOne").value = specialResults?.finalist_one || "";
  document.querySelector("#officialFinalistTwo").value = specialResults?.finalist_two || "";
  document.querySelector("#officialChampion").value = specialResults?.champion || "";
  document.querySelector("#officialBonusActive").checked = Boolean(specialResults?.bonus_active);
}

function participantScore(participant) {
  const matchPoints = matchPointsForParticipant(participant);
  const bonusPoints = specialBonusFor(participant);
  const manualPoints = Number(participant.manual_bonus_points) || 0;

  return {
    matchPoints,
    bonusPoints,
    manualPoints,
    total: matchPoints + bonusPoints + manualPoints
  };
}

function calculateRanking() {
  return participants
    .map((participant) => {
      const score = participantScore(participant);

      return { ...participant, ...score };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

function stageLabel(stage) {
  return stage || "Sem fase";
}

function matchDayKey(match) {
  if (!match?.kickoff_at) return "sem-data";

  const date = new Date(match.kickoff_at);
  if (Number.isNaN(date.getTime())) return "sem-data";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayLabel(key) {
  if (!key || key === "sem-data") return "Sem data";

  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function orderedMatchDays() {
  const days = [...new Set(matches.map(matchDayKey))];

  return days.sort((a, b) => {
    if (a === "sem-data") return 1;
    if (b === "sem-data") return -1;
    return a.localeCompare(b);
  });
}

function defaultMatchDay(days) {
  if (!days.length) return "";

  const todayKey = matchDayKey({ kickoff_at: new Date().toISOString() });
  if (days.includes(todayKey)) return todayKey;

  const datedDays = days.filter((day) => day !== "sem-data");
  const nextDay = datedDays.find((day) => day > todayKey);
  if (nextDay) return nextDay;

  const previousDay = [...datedDays].reverse().find((day) => day < todayKey);
  return previousDay || days[0];
}

function option(label, value) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  return item;
}

function formatMatchDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatLogDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function predictionDeadlineStatus(log) {
  const match = matches.find((item) => item.id === log.match_id);
  const deadlineValue = log.deadline_at || (match?.kickoff_at
    ? new Date(new Date(match.kickoff_at).getTime() - PREDICTION_DEADLINE_MS).toISOString()
    : null);
  if (!deadlineValue || !log.occurred_at) {
    return { label: "Sem limite", className: "neutral" };
  }

  const actionTime = new Date(log.occurred_at).getTime();
  const deadline = new Date(deadlineValue).getTime();
  if (Number.isNaN(actionTime) || Number.isNaN(deadline)) {
    return { label: "Sem limite", className: "neutral" };
  }

  return actionTime <= deadline
    ? { label: "No prazo", className: "ok" }
    : { label: "Apos o limite", className: "late" };
}

function predictionLogDayKey(log) {
  const match = matches.find((item) => item.id === log.match_id);
  if (match) return matchDayKey(match);
  if (!log.deadline_at) return "sem-data";

  const deadline = new Date(log.deadline_at).getTime();
  if (Number.isNaN(deadline)) return "sem-data";

  return matchDayKey({
    kickoff_at: new Date(deadline + PREDICTION_DEADLINE_MS).toISOString()
  });
}

function canPredictMatch(match) {
  if (isAdmin || !match?.kickoff_at) return true;

  const kickoff = new Date(match.kickoff_at).getTime();
  if (Number.isNaN(kickoff)) return true;

  return Date.now() <= kickoff - PREDICTION_DEADLINE_MS;
}

function predictionDeadlineText(match) {
  if (!match?.kickoff_at) return "Sem horario definido";

  const deadline = new Date(new Date(match.kickoff_at).getTime() - PREDICTION_DEADLINE_MS);
  if (Number.isNaN(deadline.getTime())) return "Sem horario definido";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(deadline);
}

function hasOfficialResult(match) {
  return match?.home_score !== null && match?.away_score !== null;
}

function getNotifiedMatchIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_MATCHES_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveNotifiedMatchIds(notifiedIds, currentMatches) {
  const validIds = new Set(currentMatches.map((match) => match.id));
  localStorage.setItem(
    NOTIFIED_MATCHES_KEY,
    JSON.stringify([...notifiedIds].filter((id) => validIds.has(id)))
  );
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <span>${message}</span>
    <button type="button" aria-label="Fechar aviso">&times;</button>
  `;

  const dismiss = () => {
    toast.classList.add("leaving");
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 220);
  };

  toast.querySelector("button").addEventListener("click", dismiss);
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(dismiss, TOAST_DURATION_MS);
}

function notifyNewlyFinishedMatches(previousMatches, currentMatches) {
  const notifiedIds = getNotifiedMatchIds();
  let didNotify = false;

  currentMatches.forEach((match) => {
    if (!hasOfficialResult(match) || notifiedIds.has(match.id)) return;

    const previousMatch = previousMatches.find((item) => item.id === match.id);
    if (!previousMatch || hasOfficialResult(previousMatch)) return;

    showToast(
      `Resultado final: <strong>${escapeHtml(match.home_team)} ${match.home_score} x ${match.away_score} ${escapeHtml(match.away_team)}</strong>. Confira seus pontos.`
    );
    notifiedIds.add(match.id);
    didNotify = true;
  });

  if (didNotify) saveNotifiedMatchIds(notifiedIds, currentMatches);
}

function parseOpenFootballDate(date, time) {
  if (!date) return null;
  if (!time) return new Date(`${date}T12:00:00Z`).toISOString();

  const match = String(time).match(/^(\d{1,2}):(\d{2})\s+UTC([+-]\d{1,2})$/);
  if (!match) return new Date(`${date}T12:00:00Z`).toISOString();

  const [, hour, minute, offset] = match;
  const sign = offset.startsWith("-") ? "-" : "+";
  const offsetHour = offset.replace(/[+-]/, "").padStart(2, "0");
  const normalizedOffset = `${sign}${offsetHour}:00`;
  return new Date(`${date}T${hour.padStart(2, "0")}:${minute}:00${normalizedOffset}`).toISOString();
}

function renderSelects() {
  const selectedParticipant = participantSelect.value || preferredParticipantId;
  const selectedAdminBonusParticipant = adminBonusParticipantSelect.value;
  const selectedAdminManualPointsParticipant = adminManualPointsParticipantSelect.value;
  const selectedAdminPredictParticipant = adminPredictParticipantSelect.value;
  const selectedPredictionDay = predictionStageSelect.value;
  const selectedMatch = matchSelect.value;
  const selectedResultDay = resultStageSelect.value;
  const selectedResultMatch = resultMatchSelect.value;
  const selectedAdminDayValue = adminStageSelect.value || selectedAdminDay;
  const selectedAdminMatchValue = adminMatchSelect.value || selectedAdminMatch;
  const selectedAdminPredictDayValue = adminPredictStageSelect.value || selectedAdminPredictDay;
  const selectedAdminPredictMatchValue = adminPredictMatchSelect.value || selectedAdminPredictMatch;
  const selectedLogDayValue = predictionLogDaySelect.value || selectedLogDay;
  const selectedLogMatchValue = predictionLogMatchSelect.value || selectedLogMatch;

  participantSelect.innerHTML = "";
  participantSelect.appendChild(option("Escolha o participante", ""));
  adminBonusParticipantSelect.innerHTML = "";
  adminBonusParticipantSelect.appendChild(option("Escolha o participante", ""));
  adminManualPointsParticipantSelect.innerHTML = "";
  adminManualPointsParticipantSelect.appendChild(option("Escolha o participante", ""));
  adminPredictParticipantSelect.innerHTML = "";
  adminPredictParticipantSelect.appendChild(option("Escolha o participante", ""));
  participants.forEach((participant) => {
    participantSelect.appendChild(option(participant.name, participant.id));
    adminBonusParticipantSelect.appendChild(option(participant.name, participant.id));
    adminManualPointsParticipantSelect.appendChild(option(participant.name, participant.id));
    adminPredictParticipantSelect.appendChild(option(participant.name, participant.id));
  });
  participantSelect.value = participants.some((participant) => participant.id === selectedParticipant)
    ? selectedParticipant
    : "";
  preferredParticipantId = participantSelect.value;
  if (preferredParticipantId) {
    localStorage.setItem("bolao-participant-id", preferredParticipantId);
  } else {
    localStorage.removeItem("bolao-participant-id");
  }
  adminBonusParticipantSelect.value = participants.some((participant) => participant.id === selectedAdminBonusParticipant)
    ? selectedAdminBonusParticipant
    : "";
  adminManualPointsParticipantSelect.value = participants.some((participant) => participant.id === selectedAdminManualPointsParticipant)
    ? selectedAdminManualPointsParticipant
    : "";
  adminPredictParticipantSelect.value = participants.some((participant) => participant.id === selectedAdminPredictParticipant)
    ? selectedAdminPredictParticipant
    : "";
  fillAdminBonusForm(adminBonusParticipantSelect.value);
  fillAdminManualPointsForm(adminManualPointsParticipantSelect.value);

  const matchDays = orderedMatchDays();
  const dayOptions = matchDays.map((day) => ({ label: dayLabel(day), value: day }));
  const fallbackDay = defaultMatchDay(matchDays);

  [
    { element: predictionStageSelect, value: selectedPredictionDay || fallbackDay },
    { element: resultStageSelect, value: selectedResultDay || fallbackDay },
    { element: adminStageSelect, value: selectedAdminDayValue || fallbackDay },
    { element: adminPredictStageSelect, value: selectedAdminPredictDayValue || fallbackDay },
    { element: predictionLogDaySelect, value: selectedLogDayValue || fallbackDay }
  ].forEach(({ element, value }) => {
    element.innerHTML = "";
    dayOptions.forEach((day) => {
      element.appendChild(option(day.label, day.value));
    });
    element.value = dayOptions.some((day) => day.value === value) ? value : fallbackDay;
  });

  selectedAdminDay = adminStageSelect.value;
  selectedAdminPredictDay = adminPredictStageSelect.value;
  selectedLogDay = predictionLogDaySelect.value;

  const adminMatches = matches.filter((match) => matchDayKey(match) === selectedAdminDay);
  adminMatchSelect.innerHTML = "";
  adminMatches.forEach((match) => {
    const date = formatMatchDate(match.kickoff_at);
    const label = `${match.home_team} x ${match.away_team} - ${match.stage}${date ? ` - ${date}` : ""}`;
    adminMatchSelect.appendChild(option(label, match.id));
  });
  selectedAdminMatch = adminMatches.some((match) => match.id === selectedAdminMatchValue)
    ? selectedAdminMatchValue
    : adminMatches[0]?.id || "";
  adminMatchSelect.value = selectedAdminMatch;

  const adminPredictMatches = matches.filter((match) => matchDayKey(match) === selectedAdminPredictDay);
  adminPredictMatchSelect.innerHTML = "";
  adminPredictMatches.forEach((match) => {
    const date = formatMatchDate(match.kickoff_at);
    const label = `${match.home_team} x ${match.away_team} - ${match.stage}${date ? ` - ${date}` : ""}`;
    adminPredictMatchSelect.appendChild(option(label, match.id));
  });
  selectedAdminPredictMatch = adminPredictMatches.some((match) => match.id === selectedAdminPredictMatchValue)
    ? selectedAdminPredictMatchValue
    : adminPredictMatches[0]?.id || "";
  adminPredictMatchSelect.value = selectedAdminPredictMatch;
  fillAdminPredictForm(adminPredictParticipantSelect.value, adminPredictMatchSelect.value);

  const logMatches = new Map();
  predictionLogs
    .filter((log) => predictionLogDayKey(log) === selectedLogDay)
    .forEach((log) => {
      logMatches.set(log.match_id, log.match_label || "Jogo removido");
    });
  predictionLogMatchSelect.innerHTML = "";
  predictionLogMatchSelect.appendChild(option("Todos os jogos", "all"));
  [...logMatches.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([matchId, label]) => {
      predictionLogMatchSelect.appendChild(option(label, matchId));
    });
  selectedLogMatch = selectedLogMatchValue === "all" || logMatches.has(selectedLogMatchValue)
    ? selectedLogMatchValue
    : "all";
  predictionLogMatchSelect.value = selectedLogMatch;

  [
    { element: matchSelect, value: selectedMatch, day: predictionStageSelect.value },
    { element: resultMatchSelect, value: selectedResultMatch, day: resultStageSelect.value }
  ].forEach(({ element, value, day }) => {
    element.innerHTML = "";
    element.appendChild(option("Escolha o jogo", ""));
    const visibleMatches = matches.filter((match) => matchDayKey(match) === day);

    visibleMatches.forEach((match) => {
      const date = formatMatchDate(match.kickoff_at);
      const locked = element === matchSelect && !canPredictMatch(match);
      const hasPrediction = element === matchSelect && selectedParticipant && (isAdmin || canShowMatchPredictions(match))
        ? predictions.some((p) => p.participant_id === selectedParticipant && p.match_id === match.id)
        : false;
      const label = `${hasPrediction ? "✓ " : ""}${match.home_team} x ${match.away_team} - ${match.stage}${date ? ` - ${date}` : ""}${locked ? " - palpites encerrados" : ""}`;
      const item = option(label, match.id);
      item.disabled = locked;
      element.appendChild(item);
    });
    element.value = visibleMatches.some((match) => match.id === value && (element !== matchSelect || canPredictMatch(match))) ? value : "";
  });

  updatePredictionContext();
}

function syncQuickScoreHighlight() {
  const home = predictionHomeScore.value;
  const away = predictionAwayScore.value;
  document.querySelectorAll(".quick-score-btn").forEach((btn) => {
    btn.classList.toggle(
      "active",
      home !== "" && away !== "" && btn.dataset.home === home && btn.dataset.away === away
    );
  });
}

function updatePredictionContext() {
  const match = matches.find((item) => item.id === matchSelect.value);
  const quickScores = document.querySelector("#quickScores");
  const deadlineBadge = document.querySelector("#predictionDeadlineBadge");
  const predictionMessage = document.querySelector("#predictionMessage");

  window.clearInterval(predictionDeadlineIntervalId);
  predictionDeadlineIntervalId = null;

  if (!match) {
    selectedMatchSummary.innerHTML = "<span>Selecione um jogo para informar o placar.</span>";
    selectedMatchSummary.className = "selected-match";
    predictionHomeScore.setAttribute("aria-label", "Gols da selecao A no palpite");
    predictionAwayScore.setAttribute("aria-label", "Gols da selecao B no palpite");
    quickScores.classList.add("hidden");
    deadlineBadge.classList.add("hidden");
    predictionMessage.className = "hint";
    predictionMessage.textContent = "";
    return;
  }

  predictionHomeScore.setAttribute("aria-label", `Gols de ${match.home_team} no palpite`);
  predictionAwayScore.setAttribute("aria-label", `Gols de ${match.away_team} no palpite`);
  quickScores.classList.remove("hidden");
  predictionMessage.className = "hint";
  predictionMessage.textContent = "";

  const participantId = participantSelect.value;
  const existing = participantId
    ? predictions.find((p) => p.participant_id === participantId && p.match_id === match.id)
    : null;
  const scoreVisible = canShowMatchPredictions(match);

  if (existing && scoreVisible) {
    selectedMatchSummary.innerHTML = `<span class="existing-label">Palpite salvo</span><strong class="existing-score">${escapeHtml(match.home_team)} ${existing.home_score} × ${existing.away_score} ${escapeHtml(match.away_team)}</strong>`;
    selectedMatchSummary.className = "selected-match has-prediction";
  } else if (existing) {
    selectedMatchSummary.innerHTML = `<span class="existing-label">Palpite salvo</span><span>${escapeHtml(match.home_team)} x ${escapeHtml(match.away_team)}</span>`;
    selectedMatchSummary.className = "selected-match has-prediction";
  } else {
    selectedMatchSummary.innerHTML = `<span>${escapeHtml(match.home_team)} x ${escapeHtml(match.away_team)}</span>`;
    selectedMatchSummary.className = "selected-match";
  }

  syncQuickScoreHighlight();

  if (!match.kickoff_at) {
    deadlineBadge.classList.add("hidden");
    return;
  }

  deadlineBadge.classList.remove("hidden");
  const deadline = new Date(match.kickoff_at).getTime() - PREDICTION_DEADLINE_MS;

  function tickDeadline() {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      deadlineBadge.textContent = "Palpites encerrados para este jogo.";
      deadlineBadge.className = "deadline-badge deadline-closed";
      window.clearInterval(predictionDeadlineIntervalId);
      predictionDeadlineIntervalId = null;
      return;
    }
    const totalSecs = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    let text;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      text = `Fecha em ${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      text = `Fecha em ${hours}h ${String(minutes).padStart(2, "0")}min`;
    } else if (minutes > 0) {
      text = `Fecha em ${minutes}min ${String(seconds).padStart(2, "0")}seg`;
    } else {
      text = `Fecha em ${seconds}seg`;
    }
    deadlineBadge.textContent = text;
    deadlineBadge.className = remaining < 3600000 ? "deadline-badge deadline-urgent" : "deadline-badge";
  }

  tickDeadline();
  predictionDeadlineIntervalId = window.setInterval(tickDeadline, 1000);
}

function renderRanking() {
  rankingTable.innerHTML = "";

  calculateRanking().forEach((participant, index) => {
    const participantName = escapeHtml(participant.name);
    const initial = escapeHtml(participant.name.trim()[0]?.toUpperCase() || "?");
    const photoSrc = getParticipantPhoto(participant.name);
    const avatarImg = photoSrc
      ? `<img src="${photoSrc}" alt="" aria-hidden="true" onerror="this.parentElement.classList.add('no-photo')">`
      : "";
    const row = document.createElement("article");
    row.className = "ranking-item";
    row.dataset.rank = index + 1;
    row.setAttribute("aria-label", `${participant.name}, posicao ${index + 1}, ${participant.total} pontos`);
    row.innerHTML = `
      <span class="rank-position" aria-label="Posicao ${index + 1}">${index + 1}</span>
      <div class="rank-avatar ${photoSrc ? "" : "no-photo"}" data-initial="${initial}">${avatarImg}</div>
      <div class="rank-main">
        <strong>${participantName}</strong>
        <small>${participant.matchPoints} pontos - ${participant.bonusPoints + participant.manualPoints} bonus</small>
      </div>
      <strong class="rank-score">${participant.total}</strong>
      <span class="badge ${participant.paid ? "paid" : "pending"}">${participant.paid ? "Pago" : "Pendente"}</span>
      <button class="danger admin-action" type="button" data-remove-participant="${participant.id}" aria-label="Remover participante ${participantName}">Remover</button>
    `;
    if (participant.id === preferredParticipantId) {
      row.classList.add("is-me");
    }
    rankingTable.appendChild(row);
  });

  rankingEmpty.style.display = participants.length ? "none" : "block";
}

function renderMatches() {
  matchesList.innerHTML = "";
  groupTabs.innerHTML = "";

  const days = orderedMatchDays();
  const isSearching = Boolean(teamSearchQuery);

  if (!days.length) {
    selectedDay = "";
  } else if (!selectedDay || selectedDay === "all" || !days.includes(selectedDay)) {
    selectedDay = defaultMatchDay(days);
  }

  groupTabs.style.display = isSearching ? "none" : "";

  if (!isSearching) {
    days.map((day) => {
      const dayMatches = matches.filter((match) => matchDayKey(match) === day);
      const hasOpenMatch = dayMatches.some((match) => !hasMatchStarted(match) && canPredictMatch(match));
      return { label: dayLabel(day), value: day, hasOpenMatch };
    }).forEach((tab) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = tab.value === selectedDay ? "active" : "";
      button.dataset.day = tab.value;
      button.setAttribute("aria-pressed", tab.value === selectedDay ? "true" : "false");
      button.innerHTML = tab.hasOpenMatch
        ? `${escapeHtml(tab.label)}<span class="open-dot" aria-hidden="true"></span>`
        : escapeHtml(tab.label);
      if (tab.hasOpenMatch) {
        button.setAttribute("aria-label", `${tab.label} - tem jogo aberto para palpitar`);
      }
      groupTabs.appendChild(button);
    });
  }

  const visibleMatches = isSearching
    ? matches
      .filter((match) =>
        normalizeText(match.home_team).includes(teamSearchQuery) ||
        normalizeText(match.away_team).includes(teamSearchQuery)
      )
      .sort((a, b) => new Date(b.kickoff_at || 0) - new Date(a.kickoff_at || 0))
    : matches.filter((match) => matchDayKey(match) === selectedDay);

  visibleMatches.forEach((match) => {
    const matchLabel = `${match.home_team} x ${match.away_team}`;
    const escapedMatchLabel = escapeHtml(matchLabel);
    const escapedMatchLabelForAttribute = escapeHtml(matchLabel);
    const matchPredictions = predictions.filter((prediction) => prediction.match_id === match.id);
    const result =
      match.home_score === null || match.away_score === null
        ? "Resultado aberto"
        : `${match.home_score} x ${match.away_score}`;
    const details = [match.stage, formatMatchDate(match.kickoff_at), match.venue]
      .filter(Boolean)
      .join(" - ");

    const predictionStatus = canPredictMatch(match)
      ? `Palpites ate ${predictionDeadlineText(match)}`
      : `Palpites encerrados em ${predictionDeadlineText(match)}`;

    const canShowPredictions = canShowMatchPredictions(match);
    const canShowPoints = canShowMatchPoints(match);
    const sortedPredictions = canShowPoints
      ? [...matchPredictions].sort((a, b) => pointsFor(b, match) - pointsFor(a, match))
      : matchPredictions;
    const predictionsContent = sortedPredictions.length
      ? sortedPredictions.map((prediction) => {
        const participant = participants.find((item) => item.id === prediction.participant_id);
        const participantName = participant?.name || "Participante removido";
        const escapedParticipantName = escapeHtml(participantName);
        const points = pointsFor(prediction, match);
        const rowClass = !canShowPoints ? "" : points > 0 ? "hit" : "miss";
        return `
            <div class="${rowClass}">
              <span>${escapedParticipantName}</span>
              <strong>${canShowPredictions ? `${prediction.home_score} x ${prediction.away_score}` : "* x *"}</strong>
              <em>${canShowPoints ? `${points} pts` : "-- pts"}</em>
              <button class="danger mini-action admin-action" type="button" data-remove-prediction="${prediction.id}" aria-label="Remover palpite de ${escapedParticipantName} em ${escapedMatchLabelForAttribute}">Remover</button>
            </div>
          `;
      }).join("")
      : "<p>Nenhum palpite nesse jogo ainda.</p>";

    const card = document.createElement("article");
    card.className = "match-card";
    card.setAttribute("aria-label", `${matchLabel}. ${predictionStatus}`);
    card.innerHTML = `
      <div class="match-top">
        <div>
          <strong>${escapedMatchLabel}</strong>
          <span>${escapeHtml(details)}</span>
          <span>${escapeHtml(predictionStatus)}</span>
        </div>
        <div class="match-result ${match.home_score === null || match.away_score === null ? "open" : "finished"}">
          <small>${match.home_score === null || match.away_score === null ? "Aberto" : "Final"}</small>
          <strong>${result}</strong>
        </div>
        <button class="danger admin-action" type="button" data-remove-match="${match.id}" aria-label="Remover jogo ${escapedMatchLabelForAttribute}">Remover</button>
      </div>
      <div class="mini-table" aria-label="Palpites de ${escapedMatchLabelForAttribute}">
        ${predictionsContent}
      </div>
    `;
    matchesList.appendChild(card);
  });

  matchesEmpty.style.display = matches.length ? "none" : "block";
  if (matches.length && !visibleMatches.length) {
    matchesEmpty.style.display = "block";
    if (isSearching) {
      matchesEmpty.querySelector("strong").textContent = "Nenhum jogo encontrado para esse time.";
      matchesEmpty.querySelector("span").textContent = "Verifique o nome e tente novamente.";
    } else {
      matchesEmpty.querySelector("strong").textContent = "Nenhum jogo nesse filtro.";
      matchesEmpty.querySelector("span").textContent = "Escolha outro dia.";
    }
  } else {
    matchesEmpty.querySelector("strong").textContent = "Nenhum jogo cadastrado.";
    matchesEmpty.querySelector("span").textContent = "Cadastre os jogos para o pessoal palpitar.";
  }
}

function finalistPicksText(participant) {
  return [participant.finalist_one_pick, participant.finalist_two_pick]
    .filter(Boolean)
    .join(" x ");
}

function renderPublicBonusPanel() {
  publicBonusTable.innerHTML = "";
  publicBonusPanel.hidden = !canShowSpecialBonusPicks();

  if (publicBonusPanel.hidden) return;

  const participantsWithBonus = participantsWithSpecialBonus();

  participantsWithBonus.forEach((participant) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(participant.name)}</td>
      <td>${escapeHtml(participant.top_scorer_pick || "-")}</td>
      <td>${escapeHtml(finalistPicksText(participant) || "-")}</td>
      <td>${escapeHtml(participant.champion_pick || "-")}</td>
    `;

    publicBonusTable.appendChild(row);
  });

  publicBonusEmpty.style.display = participantsWithBonus.length ? "none" : "block";
}

function renderAdminPanel() {
  adminPredictionsTable.innerHTML = "";
  adminBonusTable.innerHTML = "";
  predictionLogTable.innerHTML = "";

  const selectedMatch = matches.find((match) => match.id === selectedAdminMatch);
  const matchStarted = hasMatchStarted(selectedMatch);
  const predictionsReleased = arePredictionsReleased(selectedMatch);
  releasePredictionsButton.disabled = !selectedMatch || matchStarted;
  releasePredictionsButton.textContent = matchStarted
    ? "Palpites liberados automaticamente"
    : predictionsReleased
    ? "Ocultar palpites do geral"
    : "Liberar palpites para geral";
  releasePredictionsMessage.textContent = selectedMatch
    ? matchStarted
      ? "O horario do jogo comecou e os palpites foram liberados automaticamente."
      : predictionsReleased
      ? "Palpites liberados para todos nesse jogo."
      : "Palpites ainda ocultos para os participantes."
    : "Escolha um jogo para liberar os palpites.";

  const visiblePredictions = predictions
    .map((prediction) => {
      const match = matches.find((item) => item.id === prediction.match_id);
      const participant = participants.find((item) => item.id === prediction.participant_id);
      return { prediction, match, participant };
    })
    .filter(({ match }) => match)
    .filter(({ match }) => matchDayKey(match) === selectedAdminDay)
    .filter(({ match }) => match.id === selectedAdminMatch);

  visiblePredictions.forEach(({ prediction, match, participant }) => {
    const participantName = participant?.name || "Participante removido";
    const escapedParticipantName = escapeHtml(participantName);
    const matchLabel = `${match.home_team} x ${match.away_team}`;
    const escapedMatchLabel = escapeHtml(matchLabel);
    const autoPoints = automaticPointsFor(prediction, match);
    const finalPoints = pointsFor(prediction, match);
    const result =
      match.home_score === null || match.away_score === null
        ? "Aberto"
        : `${match.home_score} x ${match.away_score}`;
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapedParticipantName}</td>
      <td>${escapedMatchLabel}</td>
      <td>${prediction.home_score} x ${prediction.away_score}</td>
      <td>${formatLogDate(prediction.created_at)}</td>
      <td>${result}</td>
      <td>${autoPoints}</td>
      <td>
        <select class="points-select" data-points-prediction="${prediction.id}" aria-label="Pontos finais de ${escapedParticipantName} no jogo ${escapedMatchLabel}">
          ${[0, 1, 3].map((points) => `
            <option value="${points}" ${finalPoints === points ? "selected" : ""}>${points}</option>
          `).join("")}
        </select>
      </td>
      <td>
        <label class="checkbox compact-check">
          <input type="checkbox" data-reviewed-prediction="${prediction.id}" aria-label="Marcar palpite de ${escapedParticipantName} como conferido" ${prediction.reviewed ? "checked" : ""} />
          <span>OK</span>
        </label>
      </td>
    `;

    adminPredictionsTable.appendChild(row);
  });

  adminEmpty.style.display = visiblePredictions.length ? "none" : "block";

  const visiblePredictionLogs = predictionLogs
    .filter((log) => predictionLogDayKey(log) === selectedLogDay)
    .filter((log) => selectedLogMatch === "all" || log.match_id === selectedLogMatch);

  visiblePredictionLogs.forEach((log) => {
    const deadlineStatus = predictionDeadlineStatus(log);
    const actionLabels = {
      insert: "Envio",
      update: "Alteracao",
      delete: "Exclusao"
    };
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(log.participant_name || "Participante removido")}</td>
      <td>${escapeHtml(log.match_label || "Jogo removido")}</td>
      <td>${log.home_score} x ${log.away_score}</td>
      <td><span class="audit-action audit-action-${log.action}">${actionLabels[log.action] || escapeHtml(log.action)}</span></td>
      <td>${formatLogDate(log.occurred_at)}</td>
      <td><span class="deadline-status deadline-status-${deadlineStatus.className}">${deadlineStatus.label}</span></td>
    `;

    predictionLogTable.appendChild(row);
  });

  predictionLogEmpty.style.display = visiblePredictionLogs.length ? "none" : "block";

  const participantsWithBonus = participantsWithSpecialBonus();

  participantsWithBonus.forEach((participant) => {
    const row = document.createElement("tr");
    const finalists = finalistPicksText(participant);
    const participantName = escapeHtml(participant.name);

    row.innerHTML = `
      <td>${participantName}</td>
      <td>${escapeHtml(participant.top_scorer_pick || "-")}</td>
      <td>${escapeHtml(finalists || "-")}</td>
      <td>${escapeHtml(participant.champion_pick || "-")}</td>
      <td>${specialBonusFor(participant)}</td>
      <td>
        <button class="danger compact-save" type="button" data-clear-bonus-picks="${participant.id}" aria-label="Apagar palpite de bonus de ${participantName}">
          Apagar palpite
        </button>
      </td>
    `;

    adminBonusTable.appendChild(row);
  });

  adminBonusEmpty.style.display = participantsWithBonus.length ? "none" : "block";
}

function showLoadingBar() {
  loadingBar.className = "active";
}

function hideLoadingBar() {
  loadingBar.className = "done";
  setTimeout(() => { loadingBar.className = ""; }, 600);
}

function getNextMatch() {
  const now = Date.now();
  return matches
    .filter((m) => m.kickoff_at && new Date(m.kickoff_at).getTime() > now)
    .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))[0] || null;
}

function renderCountdownBanner() {
  const banner = document.querySelector("#nextMatchBanner");
  const match = getNextMatch();

  if (!match) {
    banner.classList.add("hidden");
    window.clearInterval(countdownIntervalId);
    countdownIntervalId = null;
    return;
  }

  banner.classList.remove("hidden");
  document.querySelector("#nextMatchTeams").textContent = `${match.home_team} x ${match.away_team}`;
  const detail = [match.stage, formatMatchDate(match.kickoff_at)].filter(Boolean).join(" · ");
  document.querySelector("#nextMatchDetail").textContent = detail;

  function tick() {
    const remaining = new Date(match.kickoff_at).getTime() - Date.now();
    if (remaining <= 0) {
      window.clearInterval(countdownIntervalId);
      countdownIntervalId = null;
      renderCountdownBanner();
      return;
    }
    const totalSecs = Math.floor(remaining / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    document.querySelector("#cdDays").textContent = String(days).padStart(2, "0");
    document.querySelector("#cdHours").textContent = String(hours).padStart(2, "0");
    document.querySelector("#cdMinutes").textContent = String(minutes).padStart(2, "0");
    document.querySelector("#cdSeconds").textContent = String(seconds).padStart(2, "0");
  }

  tick();
  window.clearInterval(countdownIntervalId);
  countdownIntervalId = window.setInterval(tick, 1000);
}

function scheduleNextKickoffRender() {
  window.clearTimeout(nextKickoffTimer);

  const now = Date.now();
  const nextKickoff = matches
    .map((match) => new Date(match.kickoff_at).getTime())
    .filter((kickoff) => !Number.isNaN(kickoff) && kickoff > now)
    .sort((a, b) => a - b)[0];

  if (!nextKickoff) return;

  const maximumTimeout = 2_147_483_647;
  const delay = Math.min(nextKickoff - now + 100, maximumTimeout);
  nextKickoffTimer = window.setTimeout(render, delay);
}

function render() {
  const paidCount = participants.filter((participant) => participant.paid).length;
  totalParticipants.textContent = participants.length;
  totalMatches.textContent = matches.length;
  totalPrize.textContent = money(paidCount * ENTRY_VALUE);
  renderSelects();
  renderRanking();
  renderMatches();
  renderHighlights();
  renderPublicBonusPanel();
  renderAdminPanel();
  fillSpecialResultForm();
  renderCountdownBanner();
  scheduleNextKickoffRender();
}

async function loadAll() {
  showLoadingBar();
  try {
  const specialResultsResult = await supabaseClient
    .from("special_results")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (specialResultsResult.error) throw specialResultsResult.error;

  specialResults = specialResultsResult.data || null;

  const participantColumns = canShowSpecialBonusPicks()
    ? "*"
    : "id,name,paid,manual_bonus_points,created_at";
  const logRequest = isAdmin
    ? supabaseClient.from("prediction_logs").select("*").order("occurred_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });
  const [participantsResult, matchesResult, predictionsResult, logsResult] = await Promise.all([
    supabaseClient.from("participants").select(participantColumns).order("created_at", { ascending: true }),
    supabaseClient.from("matches").select("*").order("kickoff_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }),
    supabaseClient.from("predictions").select("*").order("created_at", { ascending: true }),
    logRequest
  ]);

  const error =
    participantsResult.error ||
    matchesResult.error ||
    predictionsResult.error;
  if (error) throw error;

  const previousMatches = matches;

  participants = participantsResult.data || [];
  matches = matchesResult.data || [];
  predictions = predictionsResult.data || [];
  predictionLogs = logsResult.error ? [] : logsResult.data || [];

  if (hasLoadedMatchesOnce) notifyNewlyFinishedMatches(previousMatches, matches);
  hasLoadedMatchesOnce = true;

  render();
  } finally {
    hideLoadingBar();
  }
}

function normalizeOfficialMatches(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload.matches || payload.fixtures || payload.games || [];

  return list
    .map((item, index) => {
      const homeTeam =
        item.home_team ||
        item.team1 ||
        item.homeTeam?.name ||
        item.home?.name ||
        item.teams?.home?.name ||
        item.home;
      const awayTeam =
        item.away_team ||
        item.team2 ||
        item.awayTeam?.name ||
        item.away?.name ||
        item.teams?.away?.name ||
        item.away;
      const stage =
        item.stage ||
        item.group ||
        item.group ||
        item.round ||
        item.round_name ||
        item.competitionStage?.name ||
        "Copa do Mundo";
      const kickoffAt =
        item.kickoff_at ||
        item.utcDate ||
        item.date ||
        item.datetime ||
        item.kickoff ||
        item.fixture?.date ||
        null;
      const venue = item.venue?.name || item.venue || item.ground || item.stadium || "";
      const parsedKickoff = item.date && item.time ? parseOpenFootballDate(item.date, item.time) : kickoffAt;
      if (!homeTeam || !awayTeam) return null;

      const normalizedKickoff = parsedKickoff ? new Date(parsedKickoff).toISOString() : null;
      const sourceId = String(
        item.source_id ||
          item.id ||
          item.fixture?.id ||
          `${homeTeam}-${awayTeam}-${normalizedKickoff || index}`
      );

      const normalized = {
        source_id: sourceId,
        stage: String(stage).slice(0, 30),
        home_team: String(homeTeam).slice(0, 40),
        away_team: String(awayTeam).slice(0, 40),
        kickoff_at: normalizedKickoff,
        venue: venue ? String(venue).slice(0, 80) : null
      };

      const homeScore = item.home_score ?? item.score1 ?? item.score?.ft?.[0] ?? item.goals?.home;
      const awayScore = item.away_score ?? item.score2 ?? item.score?.ft?.[1] ?? item.goals?.away;

      if (Number.isInteger(Number(homeScore)) && Number.isInteger(Number(awayScore))) {
        normalized.home_score = Number(homeScore);
        normalized.away_score = Number(awayScore);
      }

      return normalized;
    })
    .filter(Boolean);
}

async function syncOfficialResults() {
  if (resultSyncInProgress || !appConfig?.officialMatchesUrl || !supabaseClient) return;

  resultSyncInProgress = true;

  try {
    const response = await fetch(appConfig.officialMatchesUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const officialResults = normalizeOfficialMatches(await response.json())
      .filter((match) => Number.isInteger(match.home_score) && Number.isInteger(match.away_score))
      .map((officialMatch) => {
        const savedMatch = matches.find((match) =>
          match.source_id === officialMatch.source_id ||
          (sameText(match.home_team, officialMatch.home_team) &&
            sameText(match.away_team, officialMatch.away_team) &&
            match.kickoff_at && officialMatch.kickoff_at &&
            new Date(match.kickoff_at).getTime() === new Date(officialMatch.kickoff_at).getTime())
        );

        return savedMatch ? { savedMatch, officialMatch } : null;
      })
      .filter(Boolean)
      .filter(({ savedMatch, officialMatch }) =>
        savedMatch.home_score !== officialMatch.home_score ||
        savedMatch.away_score !== officialMatch.away_score
      );

    if (!officialResults.length) return;

    await Promise.all(officialResults.map(({ savedMatch, officialMatch }) =>
      supabaseClient
        .from("matches")
        .update({
          home_score: officialMatch.home_score,
          away_score: officialMatch.away_score
        })
        .eq("id", savedMatch.id)
        .throwOnError()
    ));

    await loadAll();
  } catch (error) {
    console.error("Erro ao atualizar resultados automaticamente.", error);
  } finally {
    resultSyncInProgress = false;
  }
}

async function importOfficialMatches() {
  if (!requireAdmin()) return;

  const message = document.querySelector("#importMessage");
  const url = appConfig?.officialMatchesUrl;

  if (!url) {
    message.textContent = "Coloque a URL dos jogos em supabase-config.js.";
    return;
  }

  message.textContent = "Importando jogos...";
  importMatchesButton.disabled = true;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const officialMatches = normalizeOfficialMatches(await response.json());
    if (!officialMatches.length) {
      message.textContent = "Nao encontrei jogos nessa URL.";
      return;
    }

    await supabaseClient
      .from("matches")
      .upsert(officialMatches, { onConflict: "source_id" })
      .throwOnError();

    message.textContent = `${officialMatches.length} jogos importados.`;
    await loadAll();
  } catch (error) {
    message.textContent = "Erro ao importar. Confira a URL ou CORS da API.";
    console.error(error);
  } finally {
    importMatchesButton.disabled = false;
  }
}

function numberValue(selector) {
  return Number(document.querySelector(selector).value);
}

participantForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#participantMessage");
  const name = document.querySelector("#participantName").value.trim();
  const paid = document.querySelector("#participantPaid").checked;

  if (!name) {
    message.textContent = "Informe o nome do participante.";
    return;
  }

  if (participantNameExists(name)) {
    message.textContent = "Ja existe um participante com esse nome.";
    return;
  }

  if (!paid) {
    message.textContent = "Confirme o pagamento para entrar no bolao.";
    return;
  }

  try {
    const { data: createdParticipant } = await supabaseClient
      .from("participants")
      .insert({ name, paid })
      .select("id")
      .single()
      .throwOnError();
    preferredParticipantId = createdParticipant.id;
    localStorage.setItem("bolao-participant-id", preferredParticipantId);
    participantForm.reset();
    message.textContent = "Participante adicionado. Agora escolha o jogo e salve seu palpite.";
    await loadAll();
    predictionForm.scrollIntoView({ behavior: "smooth", block: "start" });
    matchSelect.focus({ preventScroll: true });
  } catch (error) {
    message.textContent = error?.code === "23505"
      ? "Ja existe um participante com esse nome."
      : "Erro ao adicionar participante.";
    console.error(error);
  }
});

matchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireAdmin()) return;
  const message = document.querySelector("#matchMessage");
  const stage = document.querySelector("#stage").value.trim();
  const kickoffAt = document.querySelector("#kickoffAt").value;
  const homeTeam = document.querySelector("#homeTeam").value.trim();
  const awayTeam = document.querySelector("#awayTeam").value.trim();

  try {
    const payload = {
      stage,
      home_team: homeTeam,
      away_team: awayTeam,
      kickoff_at: kickoffAt ? new Date(kickoffAt).toISOString() : null
    };

    await supabaseClient
      .from("matches")
      .insert(payload)
      .throwOnError();
    matchForm.reset();
    message.textContent = "Jogo adicionado.";
    await loadAll();
  } catch (error) {
    message.textContent = "Erro ao adicionar jogo.";
    console.error(error);
  }
});

predictionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#predictionMessage");
  const selectedMatch = matches.find((match) => match.id === matchSelect.value);

  if (!selectedMatch) {
    message.textContent = "Escolha um jogo para salvar o palpite.";
    return;
  }

  if (!canPredictMatch(selectedMatch)) {
    message.textContent = "Palpites desse jogo encerram 1 minuto antes da partida.";
    return;
  }

  const existingPrediction = predictions.find(
    (prediction) =>
      prediction.participant_id === participantSelect.value &&
      prediction.match_id === matchSelect.value
  );

  if (existingPrediction && !isAdmin) {
    message.textContent = "Esse palpite ja foi salvo e nao pode ser alterado.";
    return;
  }

  try {
    const participantId = participantSelect.value;
    const predictionDay = predictionStageSelect.value;
    const payload = {
        participant_id: participantId,
        match_id: matchSelect.value,
        home_score: numberValue("#predictionHomeScore"),
        away_score: numberValue("#predictionAwayScore")
      };

    if (existingPrediction && isAdmin) {
      await supabaseClient
        .from("predictions")
        .update(payload)
        .eq("id", existingPrediction.id)
        .throwOnError();
    } else {
      await supabaseClient.from("predictions").insert(payload).throwOnError();
    }

    const savedHome = payload.home_score;
    const savedAway = payload.away_score;
    predictionForm.reset();
    preferredParticipantId = participantId;
    localStorage.setItem("bolao-participant-id", preferredParticipantId);
    participantSelect.value = participantId;
    predictionStageSelect.value = predictionDay;
    message.innerHTML = `✓ Palpite salvo: <strong>${escapeHtml(selectedMatch.home_team)} ${savedHome} × ${savedAway} ${escapeHtml(selectedMatch.away_team)}</strong>`;
    message.className = "hint prediction-confirm";
    await loadAll();
  } catch (error) {
    message.textContent = "Erro ao salvar palpite.";
    console.error(error);
  }
});

resultForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireAdmin()) return;
  const message = document.querySelector("#resultMessage");

  try {
    await supabaseClient
      .from("matches")
      .update({
        home_score: numberValue("#resultHomeScore"),
        away_score: numberValue("#resultAwayScore")
      })
      .eq("id", resultMatchSelect.value)
      .throwOnError();
    resultForm.reset();
    message.textContent = "Resultado salvo.";
    await loadAll();
  } catch (error) {
    message.textContent = "Erro ao salvar resultado.";
    console.error(error);
  }
});

clearResultButton.addEventListener("click", async () => {
  if (!requireAdmin()) return;

  const message = document.querySelector("#resultMessage");

  if (!resultMatchSelect.value) {
    message.textContent = "Escolha um jogo para remover o resultado.";
    return;
  }

  if (!window.confirm("Remover o resultado oficial desse jogo?")) return;

  try {
    await supabaseClient
      .from("matches")
      .update({
        home_score: null,
        away_score: null
      })
      .eq("id", resultMatchSelect.value)
      .throwOnError();
    resultForm.reset();
    message.textContent = "Resultado removido.";
    await loadAll();
  } catch (error) {
    message.textContent = "Erro ao remover resultado.";
    console.error(error);
  }
});

specialResultForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireAdmin()) return;

  const message = document.querySelector("#specialResultMessage");

  try {
    await supabaseClient
      .from("special_results")
      .update({
        top_scorer: document.querySelector("#officialTopScorer").value.trim() || null,
        finalist_one: document.querySelector("#officialFinalistOne").value.trim() || null,
        finalist_two: document.querySelector("#officialFinalistTwo").value.trim() || null,
        champion: document.querySelector("#officialChampion").value.trim() || null,
        bonus_active: document.querySelector("#officialBonusActive").checked,
        updated_at: new Date().toISOString()
      })
      .eq("id", true)
      .throwOnError();

    message.textContent = "Bonus oficiais salvos.";
    await loadAll();
  } catch (error) {
    message.textContent = "Erro ao salvar bonus oficiais.";
    console.error(error);
  }
});

clearSpecialResultButton.addEventListener("click", async () => {
  if (!requireAdmin()) return;
  if (!window.confirm("Remover os resultados oficiais dos bonus?")) return;

  const message = document.querySelector("#specialResultMessage");

  try {
    await supabaseClient
      .from("special_results")
      .update({
        top_scorer: null,
        finalist_one: null,
        finalist_two: null,
        champion: null,
        bonus_active: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", true)
      .throwOnError();

    message.textContent = "Bonus oficiais removidos.";
    await loadAll();
  } catch (error) {
    message.textContent = "Erro ao remover bonus oficiais.";
    console.error(error);
  }
});

disableBonusPointsButton.addEventListener("click", async () => {
  if (!requireAdmin()) return;

  const message = document.querySelector("#specialResultMessage");

  try {
    await supabaseClient
      .from("special_results")
      .update({
        top_scorer: document.querySelector("#officialTopScorer").value.trim() || specialResults?.top_scorer || null,
        finalist_one: document.querySelector("#officialFinalistOne").value.trim() || specialResults?.finalist_one || null,
        finalist_two: document.querySelector("#officialFinalistTwo").value.trim() || specialResults?.finalist_two || null,
        champion: document.querySelector("#officialChampion").value.trim() || specialResults?.champion || null,
        bonus_active: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", true)
      .throwOnError();

    message.textContent = "Pontos de bonus removidos. Os palpites continuam salvos.";
    await loadAll();
  } catch (error) {
    message.textContent = "Erro ao remover pontos de bonus.";
    console.error(error);
  }
});

adminBonusParticipantSelect.addEventListener("change", () => {
  fillAdminBonusForm(adminBonusParticipantSelect.value);
  adminBonusMessage.textContent = "";
});

adminManualPointsParticipantSelect.addEventListener("change", () => {
  fillAdminManualPointsForm(adminManualPointsParticipantSelect.value);
  adminManualPointsMessage.textContent = "";
});

adminTabButtons.forEach((button, index) => {
  button.addEventListener("click", () => activateAdminTab(button.dataset.adminTab));
  button.addEventListener("keydown", (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + adminTabButtons.length) % adminTabButtons.length;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % adminTabButtons.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = adminTabButtons.length - 1;
    activateAdminTab(adminTabButtons[nextIndex].dataset.adminTab, true);
  });
});

activateAdminTab(activeAdminTab);

adminManualPointsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireAdmin()) return;

  const participantId = adminManualPointsParticipantSelect.value;
  const manualPoints = Number(adminManualPointsInput.value);

  if (!participantId) {
    adminManualPointsMessage.textContent = "Escolha o participante.";
    return;
  }

  if (!Number.isInteger(manualPoints) || manualPoints < 0 || manualPoints > 200) {
    adminManualPointsMessage.textContent = "Informe um valor inteiro entre 0 e 200.";
    return;
  }

  try {
    await supabaseClient
      .from("participants")
      .update({ manual_bonus_points: manualPoints })
      .eq("id", participantId)
      .throwOnError();

    adminManualPointsMessage.textContent = "Pontos manuais salvos.";
    await loadAll();
  } catch (error) {
    adminManualPointsMessage.textContent = "Erro ao salvar os pontos manuais.";
    console.error(error);
  }
});

adminPredictForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireAdmin()) return;

  const participantId = adminPredictParticipantSelect.value;
  const matchId = adminPredictMatchSelect.value;

  if (!participantId || !matchId) {
    adminPredictMessage.textContent = "Escolha o participante e o jogo.";
    return;
  }

  const existingPrediction = predictions.find(
    (prediction) => prediction.participant_id === participantId && prediction.match_id === matchId
  );

  const payload = {
    participant_id: participantId,
    match_id: matchId,
    home_score: numberValue("#adminPredictHomeScore"),
    away_score: numberValue("#adminPredictAwayScore")
  };

  try {
    if (existingPrediction) {
      await supabaseClient
        .from("predictions")
        .update(payload)
        .eq("id", existingPrediction.id)
        .throwOnError();
    } else {
      await supabaseClient.from("predictions").insert(payload).throwOnError();
    }

    adminPredictMessage.textContent = "Palpite salvo.";
    await loadAll();
  } catch (error) {
    adminPredictMessage.textContent = "Erro ao salvar palpite.";
    console.error(error);
  }
});

adminBonusForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireAdmin()) return;

  if (!adminBonusParticipantSelect.value) {
    adminBonusMessage.textContent = "Escolha o participante para salvar o bonus.";
    return;
  }

  try {
    await supabaseClient
      .from("participants")
      .update({
        champion_pick: document.querySelector("#adminChampionPick").value.trim() || null,
        top_scorer_pick: document.querySelector("#adminTopScorerPick").value.trim() || null,
        finalist_one_pick: document.querySelector("#adminFinalistOnePick").value.trim() || null,
        finalist_two_pick: document.querySelector("#adminFinalistTwoPick").value.trim() || null
      })
      .eq("id", adminBonusParticipantSelect.value)
      .throwOnError();

    adminBonusMessage.textContent = "Bonus do participante salvo.";
    await loadAll();
  } catch (error) {
    adminBonusMessage.textContent = "Erro ao salvar bonus do participante.";
    console.error(error);
  }
});

matchesList.addEventListener("click", async (event) => {
  const predictionButton = event.target.closest("[data-remove-prediction]");
  if (predictionButton) {
    if (!requireAdmin()) return;
    if (!window.confirm("Remover esse palpite?")) return;

    try {
      await supabaseClient
        .from("predictions")
        .delete()
        .eq("id", predictionButton.dataset.removePrediction)
        .throwOnError();
      await loadAll();
    } catch (error) {
      setStatus("Erro ao remover palpite. Rode o SQL atualizado no Supabase para liberar delete.", "error");
      window.alert("Nao consegui remover o palpite. Rode o supabase-schema.sql atualizado no Supabase e tente de novo.");
      console.error(error);
    }
    return;
  }

  const matchButton = event.target.closest("[data-remove-match]");
  if (!matchButton) return;
  if (!requireAdmin()) return;
  if (!window.confirm("Remover esse jogo e os palpites dele?")) return;

  try {
    await supabaseClient.from("matches").delete().eq("id", matchButton.dataset.removeMatch).throwOnError();
    await loadAll();
  } catch (error) {
    setStatus("Erro ao remover jogo.", "error");
    console.error(error);
  }
});

rankingTable.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-participant]");
  if (!button) return;
  if (!requireAdmin()) return;
  if (!window.confirm("Remover esse participante e todos os palpites dele?")) return;

  try {
    await supabaseClient
      .from("participants")
      .delete()
      .eq("id", button.dataset.removeParticipant)
      .throwOnError();
    await loadAll();
  } catch (error) {
    setStatus("Erro ao remover participante. Rode o SQL atualizado no Supabase para liberar delete.", "error");
    window.alert("Nao consegui remover o participante. Rode o supabase-schema.sql atualizado no Supabase e tente de novo.");
    console.error(error);
  }
});

groupTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-day]");
  if (!button) return;

  selectedDay = button.dataset.day;
  renderMatches();
});

teamSearchInput.addEventListener("input", (event) => {
  teamSearchQuery = normalizeText(event.target.value);
  renderMatches();
});

refreshButton.addEventListener("click", () => {
  loadAll().catch((error) => {
    setStatus("Erro ao atualizar.", "error");
    console.error(error);
  });
});

importMatchesButton.addEventListener("click", importOfficialMatches);

predictionStageSelect.addEventListener("change", () => {
  matchSelect.value = "";
  renderSelects();
});

resultStageSelect.addEventListener("change", () => {
  resultMatchSelect.value = "";
  renderSelects();
});

adminStageSelect.addEventListener("change", () => {
  selectedAdminDay = adminStageSelect.value;
  selectedAdminMatch = "";
  renderSelects();
  renderAdminPanel();
});

participantSelect.addEventListener("change", () => {
  preferredParticipantId = participantSelect.value;
  if (preferredParticipantId) {
    localStorage.setItem("bolao-participant-id", preferredParticipantId);
  } else {
    localStorage.removeItem("bolao-participant-id");
  }
  renderRanking();
  renderSelects();
});

matchSelect.addEventListener("change", updatePredictionContext);

document.querySelector("#quickScores").addEventListener("click", (event) => {
  const btn = event.target.closest(".quick-score-btn");
  if (!btn) return;
  predictionHomeScore.value = btn.dataset.home;
  predictionAwayScore.value = btn.dataset.away;
  syncQuickScoreHighlight();
});

predictionHomeScore.addEventListener("input", syncQuickScoreHighlight);
predictionAwayScore.addEventListener("input", syncQuickScoreHighlight);

adminMatchSelect.addEventListener("change", () => {
  selectedAdminMatch = adminMatchSelect.value;
  renderAdminPanel();
});

adminPredictStageSelect.addEventListener("change", () => {
  selectedAdminPredictDay = adminPredictStageSelect.value;
  selectedAdminPredictMatch = "";
  renderSelects();
});

adminPredictMatchSelect.addEventListener("change", () => {
  selectedAdminPredictMatch = adminPredictMatchSelect.value;
  fillAdminPredictForm(adminPredictParticipantSelect.value, adminPredictMatchSelect.value);
  adminPredictMessage.textContent = "";
});

adminPredictParticipantSelect.addEventListener("change", () => {
  fillAdminPredictForm(adminPredictParticipantSelect.value, adminPredictMatchSelect.value);
  adminPredictMessage.textContent = "";
});

predictionLogDaySelect.addEventListener("change", () => {
  selectedLogDay = predictionLogDaySelect.value;
  selectedLogMatch = "all";
  renderSelects();
  renderAdminPanel();
});

predictionLogMatchSelect.addEventListener("change", () => {
  selectedLogMatch = predictionLogMatchSelect.value;
  renderAdminPanel();
});

releasePredictionsButton.addEventListener("click", async () => {
  if (!requireAdmin()) return;

  const selectedMatch = matches.find((match) => match.id === selectedAdminMatch);
  if (!selectedMatch) {
    releasePredictionsMessage.textContent = "Escolha um jogo para liberar os palpites.";
    return;
  }

  if (hasMatchStarted(selectedMatch)) {
    releasePredictionsMessage.textContent = "Os palpites ja foram liberados automaticamente pelo horario do jogo.";
    renderAdminPanel();
    return;
  }

  const nextValue = !arePredictionsReleased(selectedMatch);
  releasePredictionsButton.disabled = true;

  try {
    await supabaseClient
      .from("matches")
      .update({ predictions_released: nextValue })
      .eq("id", selectedMatch.id)
      .throwOnError();
    releasePredictionsMessage.textContent = nextValue
      ? "Palpites liberados para todos."
      : "Palpites ocultos novamente.";
    await loadAll();
  } catch (error) {
    releasePredictionsMessage.textContent = "Erro ao alterar liberacao. Rode o SQL atualizado no Supabase.";
    console.error(error);
  } finally {
    releasePredictionsButton.disabled = false;
  }
});

adminPredictionsTable.addEventListener("change", async (event) => {
  if (!requireAdmin()) return;

  const pointsSelect = event.target.closest("[data-points-prediction]");
  const reviewedInput = event.target.closest("[data-reviewed-prediction]");
  const predictionId = pointsSelect?.dataset.pointsPrediction || reviewedInput?.dataset.reviewedPrediction;
  if (!predictionId) return;

  const row = event.target.closest("tr");
  const rowPointsSelect = row.querySelector("[data-points-prediction]");
  const rowReviewedInput = row.querySelector("[data-reviewed-prediction]");

  try {
    await supabaseClient
      .from("predictions")
      .update({
        manual_points: Number(rowPointsSelect.value),
        reviewed: rowReviewedInput.checked
      })
      .eq("id", predictionId)
      .throwOnError();
    await loadAll();
  } catch (error) {
    setStatus("Erro ao revisar palpite.", "error");
    console.error(error);
  }
});

adminBonusTable.addEventListener("click", async (event) => {
  if (!requireAdmin()) return;

  const clearPicksButton = event.target.closest("[data-clear-bonus-picks]");
  if (!clearPicksButton) return;
  if (!window.confirm("Remover os palpites de bonus desse participante?")) return;

  try {
    await supabaseClient
      .from("participants")
      .update({
        champion_pick: null,
        top_scorer_pick: null,
        finalist_one_pick: null,
        finalist_two_pick: null
      })
      .eq("id", clearPicksButton.dataset.clearBonusPicks)
      .throwOnError();
    await loadAll();
  } catch (error) {
    setStatus("Erro ao remover palpites de bonus.", "error");
    console.error(error);
  }
});

adminLoginButton.addEventListener("click", async () => {
  const password = window.prompt("Senha do admin");
  if (password !== appConfig?.adminPassword) {
    window.alert("Senha incorreta.");
    return;
  }

  isAdmin = true;
  sessionStorage.setItem("bolao-admin", "true");
  applyAdminMode();
  await loadAll();
});

adminLogoutButton.addEventListener("click", async () => {
  isAdmin = false;
  sessionStorage.removeItem("bolao-admin");
  applyAdminMode();
  await loadAll();
});

function subscribeToChanges() {
  ["participants", "matches", "predictions", "prediction_logs", "special_results"].forEach((table) => {
    supabaseClient
      .channel(`${table}-realtime`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => loadAll())
      .subscribe();
  });
}

async function start() {
  setFormsEnabled(false);
  applyAdminMode();
  const config = getConfig();

  if (!config) {
    setStatus("Configure o arquivo supabase-config.js para conectar ao Supabase.", "error");
    return;
  }

  appConfig = config;
  if (!appConfig.adminPassword || appConfig.adminPassword === "troque-essa-senha") {
    setStatus("Defina uma senha admin em supabase-config.js antes de publicar.", "error");
  }
  supabaseClient = supabase.createClient(config.url, config.anonKey);

  try {
    await loadAll();
    subscribeToChanges();
    await syncOfficialResults();
    window.setInterval(syncOfficialResults, AUTO_RESULTS_REFRESH_MS);
    setFormsEnabled(true);
    setStatus("Tabela conectada. Resultados e ranking atualizam automaticamente.", "ok");
  } catch (error) {
    setStatus("Nao consegui conectar. Rode o SQL atualizado no Supabase.", "error");
    console.error(error);
  }
}

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}

function updateInstallButtonVisibility() {
  if (isStandaloneDisplay()) {
    installAppButton.classList.add("hidden");
    return;
  }

  installAppButton.classList.toggle("hidden", !deferredInstallPrompt && !isIosDevice());
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButtonVisibility();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateInstallButtonVisibility();
  showToast("App instalado! Agora ele fica na sua tela inicial.");
});

installAppButton.addEventListener("click", async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    updateInstallButtonVisibility();
    return;
  }

  if (isIosDevice()) {
    window.alert('No iPhone: toque no botao de compartilhar (o quadrado com a seta para cima) e depois em "Adicionar a Tela de Inicio".');
  }
});

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("bolao-theme", theme);
  themeToggleButton.textContent = theme === "dark" ? "Modo claro" : "Modo escuro";
  themeToggleButton.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
}

themeToggleButton.addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  applyTheme(isDark ? "light" : "dark");
});

applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.error("Erro ao registrar service worker.", error);
    });
  });
}

updateInstallButtonVisibility();
start();

const ENTRY_VALUE = 100;

// Tab management
let currentTab = "palpite";
const TAB_SECTIONS = {
  palpite:   ["#palpiteWrapper"],
  ranking:   [".layout-wide"],
  chave:     ["#bracketSection"],
  destaques: ["#highlightsPanel", "#publicBonusPanel"],
};

function showTab(tabId) {
  if (!TAB_SECTIONS[tabId]) return;
  currentTab = tabId;

  // Body class drives .grid (admin forms) visibility via CSS — no hidden attribute needed
  document.body.classList.toggle("tab-palpite", tabId === "palpite");

  // Hide all tab-controlled sections (bracket handled separately in renderBracket)
  ["#palpiteWrapper", ".layout-wide", "#highlightsPanel", "#publicBonusPanel"].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.hidden = true;
  });
  document.querySelector("#bracketSection")?.setAttribute("hidden", "");

  // Show sections for active tab
  TAB_SECTIONS[tabId].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.hidden = false;
  });

  // Re-run renderBracket so it can decide visibility based on currentTab
  if (tabId === "chave") renderBracket();

  // Update nav highlight
  document.querySelectorAll(".quick-nav a[data-tab]").forEach((a) => {
    a.classList.toggle("quick-nav-primary", a.dataset.tab === tabId);
  });
}
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
const predictionHomeTeamName = document.querySelector("#predictionHomeTeamName");
const predictionAwayTeamName = document.querySelector("#predictionAwayTeamName");
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
let lastAdminPredictKey = null;
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
// Placar digitado no simulador ao vivo, por jogo. Guardado fora do DOM para
// sobreviver aos re-renders disparados por realtime/sync.
const simScores = new Map();
let matchesRenderPending = false;
const NOTIFIED_MATCHES_KEY = "bolao-notified-matches";
const TOAST_DURATION_MS = 8000;

// Bracket structure for the 2026 World Cup knockout stage.
// source_ids match the official match numbers (J74, J75, ...).
// Groups define which pairs of matches feed into the next round.
const BRACKET_COLS = [
  {
    id: "r32-left", label: "Segundas de final", flipped: false, outermost: true,
    groups: [["J74", "J77"], ["J73", "J75"], ["J83", "J84"], ["J81", "J82"]],
  },
  {
    id: "r16-left", label: "Oitavas de final", flipped: false,
    groups: [["J89", "J90"], ["J93", "J94"]],
  },
  {
    id: "qf-left", label: "Quartas de final", flipped: false,
    groups: [["J97", "J98"]],
  },
  {
    id: "sf-left", label: "Semifinal", flipped: false,
    groups: [["J101"]],
  },
  {
    id: "final", label: "Final", isCenter: true,
    groups: [["J104"]],
  },
  {
    id: "sf-right", label: "Semifinal", flipped: true,
    groups: [["J102"]],
  },
  {
    id: "qf-right", label: "Quartas de final", flipped: true,
    groups: [["J99", "J100"]],
  },
  {
    id: "r16-right", label: "Oitavas de final", flipped: true,
    groups: [["J91", "J92"], ["J95", "J96"]],
  },
  {
    id: "r32-right", label: "Segundas de final", flipped: true, outermost: true,
    groups: [["J76", "J78"], ["J79", "J80"], ["J86", "J88"], ["J85", "J87"]],
  },
];
const BRACKET_THIRD_PLACE = "J103";

function money(value) {
  // Sem centavos: os valores sao sempre multiplos de R$100 e "R$ 1.000,00"
  // estoura a largura do card de premio no hero.
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Nome da selecao (normalizado: minusculo, sem acento) -> codigo do flagcdn.
// Cobre os nomes em ingles da fonte oficial (openfootball) e variantes em
// portugues usadas em jogos cadastrados manualmente.
const TEAM_FLAG_CODES = {
  // CONMEBOL
  "argentina": "ar", "brazil": "br", "brasil": "br", "bolivia": "bo",
  "chile": "cl", "colombia": "co", "ecuador": "ec", "equador": "ec",
  "paraguay": "py", "paraguai": "py", "peru": "pe",
  "uruguay": "uy", "uruguai": "uy", "venezuela": "ve",
  // CONCACAF
  "canada": "ca", "mexico": "mx", "usa": "us", "united states": "us",
  "estados unidos": "us", "costa rica": "cr", "curacao": "cw", "haiti": "ht",
  "honduras": "hn", "jamaica": "jm", "panama": "pa", "el salvador": "sv",
  "guatemala": "gt", "trinidad and tobago": "tt", "suriname": "sr",
  // UEFA
  "albania": "al", "austria": "at", "belgium": "be", "belgica": "be",
  "bosnia & herzegovina": "ba", "bosnia and herzegovina": "ba", "bosnia": "ba",
  "bosnia e herzegovina": "ba", "croatia": "hr", "croacia": "hr",
  "czech republic": "cz", "czechia": "cz", "republica tcheca": "cz", "tchequia": "cz",
  "denmark": "dk", "dinamarca": "dk", "england": "gb-eng", "inglaterra": "gb-eng",
  "finland": "fi", "finlandia": "fi", "france": "fr", "franca": "fr",
  "georgia": "ge", "germany": "de", "alemanha": "de", "greece": "gr", "grecia": "gr",
  "hungary": "hu", "hungria": "hu", "iceland": "is", "islandia": "is",
  "italy": "it", "italia": "it", "kosovo": "xk", "moldova": "md", "montenegro": "me",
  "netherlands": "nl", "holanda": "nl", "paises baixos": "nl",
  "north macedonia": "mk", "macedonia do norte": "mk",
  "northern ireland": "gb-nir", "irlanda do norte": "gb-nir",
  "norway": "no", "noruega": "no", "poland": "pl", "polonia": "pl", "portugal": "pt",
  "republic of ireland": "ie", "ireland": "ie", "irlanda": "ie",
  "romania": "ro", "romenia": "ro", "russia": "ru",
  "scotland": "gb-sct", "escocia": "gb-sct", "serbia": "rs", "servia": "rs",
  "slovakia": "sk", "eslovaquia": "sk", "slovenia": "si", "eslovenia": "si",
  "spain": "es", "espanha": "es", "sweden": "se", "suecia": "se",
  "switzerland": "ch", "suica": "ch", "turkey": "tr", "turkiye": "tr", "turquia": "tr",
  "ukraine": "ua", "ucrania": "ua", "wales": "gb-wls", "pais de gales": "gb-wls",
  "belarus": "by", "israel": "il", "bulgaria": "bg", "estonia": "ee",
  "latvia": "lv", "lithuania": "lt", "luxembourg": "lu", "cyprus": "cy", "malta": "mt",
  // CAF
  "algeria": "dz", "argelia": "dz", "cape verde": "cv", "cabo verde": "cv",
  "cameroon": "cm", "camaroes": "cm", "dr congo": "cd", "congo dr": "cd", "rd congo": "cd",
  "egypt": "eg", "egito": "eg", "ghana": "gh", "gana": "gh",
  "ivory coast": "ci", "cote d'ivoire": "ci", "costa do marfim": "ci",
  "morocco": "ma", "marrocos": "ma", "nigeria": "ng", "senegal": "sn",
  "south africa": "za", "africa do sul": "za", "tunisia": "tn",
  "mali": "ml", "burkina faso": "bf",
  // AFC
  "australia": "au", "iran": "ir", "ira": "ir", "japan": "jp", "japao": "jp",
  "jordan": "jo", "jordania": "jo", "south korea": "kr", "korea republic": "kr",
  "coreia do sul": "kr", "qatar": "qa", "catar": "qa",
  "saudi arabia": "sa", "arabia saudita": "sa", "uzbekistan": "uz", "uzbequistao": "uz",
  "iraq": "iq", "iraque": "iq", "uae": "ae", "united arab emirates": "ae",
  "emirados arabes unidos": "ae", "bahrain": "bh", "barein": "bh",
  "china": "cn", "china pr": "cn", "indonesia": "id",
  // OFC
  "new zealand": "nz", "nova zelandia": "nz", "new caledonia": "nc"
};

function teamFlagHtml(teamName, className = "team-flag") {
  if (isPlaceholderTeam(teamName)) return "";
  const code = TEAM_FLAG_CODES[normalizeText(teamName)];
  if (!code) return "";
  return `<img class="${className}" src="https://flagcdn.com/w40/${code}.png" srcset="https://flagcdn.com/w80/${code}.png 2x" alt="" aria-hidden="true" loading="lazy" onerror="this.remove()">`;
}

function teamWithFlag(teamName, className) {
  const flag = teamFlagHtml(teamName, className);
  return `${flag}${flag ? " " : ""}${escapeHtml(teamName)}`;
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

function dailyDuelDayKey(days) {
  if (!days.length) return "";

  const todayKey = matchDayKey({ kickoff_at: new Date().toISOString() });
  if (days.includes(todayKey)) return todayKey;

  const datedDays = days.filter((day) => day !== "sem-data");
  const previousDay = [...datedDays].reverse().find((day) => day < todayKey);
  if (previousDay) return previousDay;

  const nextDay = datedDays.find((day) => day > todayKey);
  return nextDay || days[0];
}

function calculateDailyDuelStats(dayKey) {
  return participants.map((participant) => {
    const dayResults = predictions
      .filter((prediction) => prediction.participant_id === participant.id)
      .map((prediction) => ({ prediction, match: matches.find((item) => item.id === prediction.match_id) }))
      .filter(({ match }) => match && matchDayKey(match) === dayKey && hasOfficialResult(match));

    const dayPoints = dayResults.reduce((total, { prediction, match }) => total + pointsFor(prediction, match), 0);

    return { participant, dayPoints, totalFinished: dayResults.length };
  });
}

function renderDailyDuel() {
  const dayKey = dailyDuelDayKey(orderedMatchDays());
  const subtitle = document.querySelector("#dailyDuelSub");
  if (subtitle) {
    subtitle.textContent = dayKey
      ? `Quem mais pontuou nos jogos de ${dayLabel(dayKey)}.`
      : "Quem mais pontuou no dia.";
  }

  const stats = dayKey ? calculateDailyDuelStats(dayKey) : [];

  renderPodium(
    "podiumDailyDuel",
    "podiumDailyDuelEmpty",
    topHighlights(stats, { value: (item) => item.dayPoints, minSamples: 1 }),
    (item) => `${item.dayPoints} pt${item.dayPoints === 1 ? "" : "s"}`
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

function fillAdminPredictForm(participantId, matchId, { force = false } = {}) {
  const key = `${participantId}::${matchId}`;
  const editingScore =
    document.activeElement === adminPredictHomeScore ||
    document.activeElement === adminPredictAwayScore;
  // Nao sobrescrever o que o admin esta digitando: quando o render automatico
  // (realtime/sync) roda sem mudar participante+jogo, ou quando um campo de
  // placar esta em foco, preserva os valores atuais. So preenche em troca real
  // de selecao (force) ou quando a combinacao participante+jogo muda.
  if (!force && (key === lastAdminPredictKey || editingScore)) {
    lastAdminPredictKey = key;
    return;
  }
  lastAdminPredictKey = key;
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

function deduplicateMatchData(rawMatches, rawPredictions) {
  const groups = new Map();
  for (const match of rawMatches) {
    const key = [
      normalizeText(match.home_team || ""),
      normalizeText(match.away_team || ""),
      match.kickoff_at || match.id
    ].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  }

  const keptMatches = [];
  const idRemap = new Map();

  for (const group of groups.values()) {
    if (group.length === 1) { keptMatches.push(group[0]); continue; }

    // Keep the record with the shortest source_id (numeric beats fallback),
    // tiebreak by preferring the one that has an official result.
    const primary = [...group].sort((a, b) => {
      const lenDiff = (a.source_id || "").length - (b.source_id || "").length;
      if (lenDiff !== 0) return lenDiff;
      return (hasOfficialResult(b) ? 1 : 0) - (hasOfficialResult(a) ? 1 : 0);
    })[0];

    keptMatches.push(primary);
    for (const dup of group) {
      if (dup.id !== primary.id) idRemap.set(dup.id, primary.id);
    }
  }

  // Remap predictions that point to removed duplicates, then deduplicate them.
  const predSeen = new Set();
  const keptPredictions = rawPredictions
    .map((p) => idRemap.has(p.match_id) ? { ...p, match_id: idRemap.get(p.match_id) } : p)
    .filter((p) => {
      const key = `${p.participant_id}|${p.match_id}`;
      if (predSeen.has(key)) return false;
      predSeen.add(key);
      return true;
    });

  return { matches: keptMatches, predictions: keptPredictions };
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
  updateKnockoutAdminFields();
}

let lastReflectedResultMatchId = null;

function updateKnockoutAdminFields() {
  const match = matches.find((m) => m.id === resultMatchSelect.value);
  const fields = document.querySelector("#knockoutAdminFields");
  const winnerRow = document.querySelector("#knockoutWinnerRow");
  const isKnockoutCheck = document.querySelector("#isKnockoutCheck");
  const winnerSelect = document.querySelector("#knockoutWinnerSelect");
  const lockRow = document.querySelector("#resultLockRow");
  const lockCheck = document.querySelector("#resultLockCheck");

  // Visibilidade sempre acompanha a existencia de um jogo selecionado.
  if (lockRow) lockRow.classList.toggle("hidden", !match);
  if (fields) fields.classList.toggle("hidden", !match);
  if (!fields || !match) {
    lastReflectedResultMatchId = match ? match.id : null;
    return;
  }

  // So sincroniza os campos interativos com o banco quando o jogo selecionado muda.
  // Em re-renders (loadAll disparado por realtime/sync) preservamos edicoes em andamento
  // para nao desmarcar o checkbox/campos antes do admin salvar.
  if (match.id === lastReflectedResultMatchId) return;
  lastReflectedResultMatchId = match.id;

  if (lockCheck) lockCheck.checked = Boolean(match.result_locked);

  if (isKnockoutCheck) isKnockoutCheck.checked = Boolean(match.is_knockout);

  if (winnerRow) winnerRow.classList.toggle("hidden", !match.is_knockout);

  if (winnerSelect) {
    winnerSelect.innerHTML = `<option value="">Ainda nao definido</option>`;
    winnerSelect.appendChild(option(match.home_team, match.home_team));
    winnerSelect.appendChild(option(match.away_team, match.away_team));
    winnerSelect.value = match.knockout_winner || "";
  }
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
    predictionHomeTeamName.textContent = "Selecao A";
    predictionAwayTeamName.textContent = "Selecao B";
    quickScores.classList.add("hidden");
    deadlineBadge.classList.add("hidden");
    predictionMessage.className = "hint";
    predictionMessage.textContent = "";
    return;
  }

  predictionHomeScore.setAttribute("aria-label", `Gols de ${match.home_team} no palpite`);
  predictionAwayScore.setAttribute("aria-label", `Gols de ${match.away_team} no palpite`);
  predictionHomeTeamName.innerHTML = teamWithFlag(match.home_team, "team-flag form-flag");
  predictionAwayTeamName.innerHTML = teamWithFlag(match.away_team, "team-flag form-flag");
  quickScores.classList.remove("hidden");
  predictionMessage.className = "hint";
  predictionMessage.textContent = "";

  const participantId = participantSelect.value;
  const existing = participantId
    ? predictions.find((p) => p.participant_id === participantId && p.match_id === match.id)
    : null;
  const scoreVisible = canShowMatchPredictions(match);

  if (existing && scoreVisible) {
    selectedMatchSummary.innerHTML = `<span class="existing-label">Palpite salvo</span><strong class="existing-score">${teamWithFlag(match.home_team)} ${existing.home_score} × ${existing.away_score} ${teamWithFlag(match.away_team)}</strong>`;
    selectedMatchSummary.className = "selected-match has-prediction";
  } else if (existing) {
    selectedMatchSummary.innerHTML = `<span class="existing-label">Palpite salvo</span><span>${teamWithFlag(match.home_team)} x ${teamWithFlag(match.away_team)}</span>`;
    selectedMatchSummary.className = "selected-match has-prediction";
  } else {
    selectedMatchSummary.innerHTML = `<span>${teamWithFlag(match.home_team)} x ${teamWithFlag(match.away_team)}</span>`;
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

function renderDayMatchesPreview() {
  const list = document.querySelector("#dayMatchesList");
  const empty = document.querySelector("#dayMatchesEmpty");
  if (!list) return;

  const dayKey = predictionStageSelect?.value;
  const dayMatches = dayKey ? matches.filter((m) => matchDayKey(m) === dayKey) : [];

  if (!dayMatches.length) {
    list.innerHTML = "";
    if (empty) {
      empty.textContent = dayKey ? "Nenhum jogo neste dia." : "Selecione um dia para ver os jogos.";
      empty.hidden = false;
    }
    return;
  }

  if (empty) empty.hidden = true;

  const selectedMatchId = matchSelect?.value;

  list.innerHTML = dayMatches.map((match) => {
    const isSelected = match.id === selectedMatchId;
    const finished = hasOfficialResult(match);
    const live = !finished && hasMatchStarted(match);
    const canPredict = canPredictMatch(match);

    const time = match.kickoff_at
      ? new Date(match.kickoff_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
      : "";

    const statusClass = finished ? "finished" : live ? "live" : "open";
    const statusLabel = finished ? "Final" : live ? "Em andamento" : "Aberto";
    const resultText = finished ? `${match.home_score} × ${match.away_score}` : live ? "· · ·" : "–";
    const meta = [time, match.stage, match.venue].filter(Boolean).join(" · ");

    return `<button type="button" class="match-card dmp-match-btn${isSelected ? " dmp-selected" : ""}" data-dmp-match="${match.id}">
      <div class="match-top">
        <div>
          <strong>${teamWithFlag(match.home_team)} × ${teamWithFlag(match.away_team)}</strong>
          <span>${escapeHtml(meta)}</span>
        </div>
        <div class="match-result ${statusClass}">
          <small>${statusLabel}</small>
          <strong>${resultText}</strong>
        </div>
      </div>
    </button>`;
  }).join("");

  list.querySelectorAll("[data-dmp-match]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const matchId = btn.dataset.dmpMatch;
      const matchObj = matches.find((m) => m.id === matchId);
      if (!canPredictMatch(matchObj)) return;
      matchSelect.value = matchId;
      updatePredictionContext();
      renderDayMatchesPreview();
    });
  });
}

function renderRanking() {
  // A caixa do ranking tem scroll proprio (max-height + overflow). Limpar o
  // innerHTML zera o scrollTop, entao toda atualizacao em tempo real jogava o
  // usuario de volta pro topo da lista. Salvamos e restauramos a posicao.
  const previousScrollTop = rankingTable.scrollTop;
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
        <small>${participant.matchPoints} pts · ${participant.bonusPoints + participant.manualPoints} bonus</small>
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
  rankingTable.scrollTop = previousScrollTop;
}

function buildConsensusHtml(match, matchPredictions) {
  const total = matchPredictions.length;
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  const scoreCounts = new Map();

  matchPredictions.forEach((prediction) => {
    const result = gameResult(prediction.home_score, prediction.away_score);
    if (result === "home") homeWins += 1;
    else if (result === "away") awayWins += 1;
    else draws += 1;

    const scoreKey = `${prediction.home_score} × ${prediction.away_score}`;
    scoreCounts.set(scoreKey, (scoreCounts.get(scoreKey) || 0) + 1);
  });

  const [topScore, topCount] = [...scoreCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const percent = (value) => Math.round((value / total) * 100);
  const segments = [
    { className: "consensus-home", value: homeWins, label: match.home_team },
    { className: "consensus-draw", value: draws, label: "Empate" },
    { className: "consensus-away", value: awayWins, label: match.away_team }
  ];

  const bar = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => `<span class="${segment.className}" style="flex-grow:${segment.value}"></span>`)
    .join("");
  const legend = segments
    .map((segment) => `<span class="consensus-item"><i class="consensus-dot ${segment.className}" aria-hidden="true"></i>${escapeHtml(segment.label)} <strong>${percent(segment.value)}%</strong></span>`)
    .join("");

  return `
    <div class="match-consensus" aria-label="Resumo dos palpites">
      <div class="consensus-head">
        <span class="consensus-title">Palpite da galera</span>
        <span class="consensus-top">Mais apostado <strong>${escapeHtml(topScore)}</strong> · ${topCount}×</span>
      </div>
      <div class="consensus-bar" aria-hidden="true">${bar}</div>
      <div class="consensus-legend">${legend}</div>
    </div>
  `;
}

function buildSimulatorHtml(match) {
  const sim = simScores.get(match.id) || {};

  return `
    <div class="match-simulator" data-simulator="${match.id}">
      <div class="sim-header">
        <span class="sim-title">Simulador ao vivo</span>
        <span class="sim-sub">Digite o placar do jogo e veja como fica o ranking.</span>
      </div>
      <div class="sim-score">
        <div class="sim-team">
          <span class="sim-team-name">${teamWithFlag(match.home_team, "team-flag form-flag")}</span>
          <input type="number" min="0" max="30" inputmode="numeric" class="sim-input" data-sim-home value="${sim.home ?? ""}" aria-label="Gols de ${escapeHtml(match.home_team)} na simulacao">
        </div>
        <span class="sim-x" aria-hidden="true">×</span>
        <div class="sim-team">
          <span class="sim-team-name">${teamWithFlag(match.away_team, "team-flag form-flag")}</span>
          <input type="number" min="0" max="30" inputmode="numeric" class="sim-input" data-sim-away value="${sim.away ?? ""}" aria-label="Gols de ${escapeHtml(match.away_team)} na simulacao">
        </div>
      </div>
      <div class="sim-ranking" data-sim-result aria-live="polite"></div>
    </div>
  `;
}

function updateSimulatorResult(simulatorEl) {
  const match = matches.find((item) => item.id === simulatorEl.dataset.simulator);
  const resultEl = simulatorEl.querySelector("[data-sim-result]");
  const homeRaw = simulatorEl.querySelector("[data-sim-home]").value;
  const awayRaw = simulatorEl.querySelector("[data-sim-away]").value;
  const simHome = Number(homeRaw);
  const simAway = Number(awayRaw);

  const valid =
    match && homeRaw !== "" && awayRaw !== "" &&
    Number.isInteger(simHome) && Number.isInteger(simAway) &&
    simHome >= 0 && simAway >= 0;

  if (!valid) {
    // Nao colapsar o ranking no meio da digitacao (ex.: apagar um numero para
    // corrigir). O sobe-e-desce da altura do card faz a pagina inteira tremer.
    // So limpa quando os dois campos ficam vazios; senao mantem o resultado
    // anterior esmaecido ate o placar voltar a ser valido.
    if (homeRaw === "" && awayRaw === "") {
      resultEl.innerHTML = "";
      resultEl.classList.remove("sim-stale");
    } else {
      resultEl.classList.add("sim-stale");
    }
    return;
  }
  resultEl.classList.remove("sim-stale");

  const currentRanking = calculateRanking();
  const currentPosition = new Map(currentRanking.map((participant, index) => [participant.id, index + 1]));
  const simulatedMatch = { ...match, home_score: simHome, away_score: simAway };

  const projected = currentRanking
    .map((participant) => {
      const prediction = predictions.find(
        (item) => item.participant_id === participant.id && item.match_id === match.id
      );
      const delta = prediction
        ? automaticPointsFor(prediction, simulatedMatch) - pointsFor(prediction, match)
        : 0;
      return { ...participant, delta, projectedTotal: participant.total + delta };
    })
    .sort((a, b) => b.projectedTotal - a.projectedTotal || a.name.localeCompare(b.name));

  const rows = projected.map((participant, index) => {
    const movement = currentPosition.get(participant.id) - (index + 1);
    const movementHtml = movement > 0
      ? `<span class="sim-move up">▲${movement}</span>`
      : movement < 0
      ? `<span class="sim-move down">▼${Math.abs(movement)}</span>`
      : `<span class="sim-move">–</span>`;
    const deltaLabel = participant.delta > 0
      ? `+${participant.delta}`
      : participant.delta < 0
      ? `${participant.delta}`
      : "";

    return `
      <div class="sim-row${participant.id === preferredParticipantId ? " is-me" : ""}">
        <span class="sim-pos">${index + 1}º</span>
        <span class="sim-name">${escapeHtml(participant.name)}</span>
        <span class="sim-delta${deltaLabel ? "" : " sim-delta-empty"}">${deltaLabel}</span>
        <strong>${participant.projectedTotal}</strong>
        ${movementHtml}
      </div>
    `;
  }).join("");

  resultEl.innerHTML = `<div class="sim-ranking-title">Ranking projetado</div>${rows}`;
}

function renderMatches() {
  // Nao reconstruir a lista enquanto o usuario digita no simulador: o rebuild
  // (disparado por realtime/sync) destruiria o input focado no meio da
  // digitacao — perde o foco, fecha o teclado no celular e a pagina treme.
  // O focusout do simulador aplica o render que ficou pendente.
  const active = document.activeElement;
  if (active && active.classList?.contains("sim-input") && matchesList.contains(active)) {
    matchesRenderPending = true;
    return;
  }
  matchesRenderPending = false;

  matchesList.innerHTML = "";
  // O rebuild zera o scroll horizontal da barra de dias, fazendo ela pular
  // de volta pro comeco a cada realtime/sync — preservamos a posicao.
  const groupTabsScroll = groupTabs.scrollLeft;
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
    groupTabs.scrollLeft = groupTabsScroll;
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
    const escapedMatchLabelForAttribute = escapeHtml(matchLabel);
    const matchPredictions = predictions.filter((prediction) => prediction.match_id === match.id);
    const matchLiveState = hasOfficialResult(match)
      ? "finished"
      : hasMatchStarted(match)
      ? "live"
      : "open";
    const result =
      matchLiveState === "finished"
        ? `${match.home_score} x ${match.away_score}`
        : matchLiveState === "live"
        ? "Aguardando resultado"
        : "Resultado aberto";
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

    const consensusHtml = canShowPredictions && matchPredictions.length >= 2
      ? buildConsensusHtml(match, matchPredictions)
      : "";
    const simulatorHtml = matchLiveState === "live" && canShowPredictions && matchPredictions.length
      ? buildSimulatorHtml(match)
      : "";

    const card = document.createElement("article");
    card.className = "match-card";
    card.setAttribute("aria-label", `${matchLabel}. ${predictionStatus}`);
    card.innerHTML = `
      <div class="match-top">
        <div>
          <strong>${teamWithFlag(match.home_team)} × ${teamWithFlag(match.away_team)}</strong>
          <span>${escapeHtml(details)}</span>
          <span>${escapeHtml(predictionStatus)}</span>
        </div>
        <div class="match-result ${matchLiveState}">
          <small>${matchLiveState === "finished" ? "Final" : matchLiveState === "live" ? "Em andamento" : "Aberto"}</small>
          <strong>${result}</strong>
        </div>
        <button class="danger admin-action" type="button" data-remove-match="${match.id}" aria-label="Remover jogo ${escapedMatchLabelForAttribute}">Remover</button>
      </div>
      ${consensusHtml}
      ${simulatorHtml}
      <div class="mini-table" aria-label="Palpites de ${escapedMatchLabelForAttribute}">
        ${predictionsContent}
      </div>
    `;
    matchesList.appendChild(card);
  });

  matchesList.querySelectorAll("[data-simulator]").forEach(updateSimulatorResult);

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
  const canShow = canShowSpecialBonusPicks();
  publicBonusPanel.hidden = !canShow || currentTab !== "destaques";

  publicBonusTable.innerHTML = "";
  if (!canShow) return;

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

function findBracketMatch(sourceId) {
  let m = matches.find((match) => match.source_id === sourceId);
  if (m) return m;
  if (sourceId.startsWith("J")) {
    m = matches.find((match) => match.source_id === sourceId.slice(1));
    if (m) return m;
  }
  return matches.find((match) => match.source_id === "J" + sourceId) || null;
}

function createBracketCard(match, sourceId) {
  if (!match) {
    const card = document.createElement("div");
    card.className = "bracket-card bracket-card--tbd";
    const placeholder = document.createElement("span");
    placeholder.className = "bc-placeholder";
    placeholder.textContent = sourceId;
    card.appendChild(placeholder);
    return card;
  }

  const hasResult = hasOfficialResult(match);
  const canPredict = canPredictMatch(match);
  const homeWon = hasResult && match.home_score > match.away_score;
  const awayWon = hasResult && match.away_score > match.home_score;

  const card = document.createElement("button");
  card.type = "button";
  card.className = [
    "bracket-card",
    hasResult ? "bracket-card--finished" : "",
    canPredict ? "bracket-card--open" : "",
  ].filter(Boolean).join(" ");
  card.dataset.bracketMatch = match.id;
  card.setAttribute("aria-label", `${match.home_team} x ${match.away_team}. Clique para palpitar.`);

  const dateStr = formatMatchDate(match.kickoff_at);

  const homeTeamEl = document.createElement("span");
  homeTeamEl.className = `bc-team${homeWon ? " bc-team--winner" : ""}`;
  homeTeamEl.innerHTML = `<span class="bc-name">${teamFlagHtml(match.home_team, "team-flag bc-flag")}${escapeHtml(match.home_team)}</span>${hasResult ? `<span class="bc-score">${match.home_score}</span>` : ""}`;

  const awayTeamEl = document.createElement("span");
  awayTeamEl.className = `bc-team${awayWon ? " bc-team--winner" : ""}`;
  awayTeamEl.innerHTML = `<span class="bc-name">${teamFlagHtml(match.away_team, "team-flag bc-flag")}${escapeHtml(match.away_team)}</span>${hasResult ? `<span class="bc-score">${match.away_score}</span>` : ""}`;

  if (dateStr) {
    const dateEl = document.createElement("span");
    dateEl.className = "bc-date";
    dateEl.textContent = dateStr;
    card.appendChild(dateEl);
  }
  card.appendChild(homeTeamEl);
  card.appendChild(awayTeamEl);

  if (canPredict) {
    const ctaEl = document.createElement("span");
    ctaEl.className = "bc-badge";
    ctaEl.textContent = "Palpitar ›";
    card.appendChild(ctaEl);
  }

  return card;
}

function getBracketPodiumData() {
  const finalMatch = findBracketMatch("J104");
  const thirdMatch = findBracketMatch("J103");
  let first = null, second = null, third = null;

  if (finalMatch && hasOfficialResult(finalMatch)) {
    if (finalMatch.home_score > finalMatch.away_score) {
      first = finalMatch.home_team;
      second = finalMatch.away_team;
    } else if (finalMatch.away_score > finalMatch.home_score) {
      first = finalMatch.away_team;
      second = finalMatch.home_team;
    }
  }

  if (specialResults?.champion) first = specialResults.champion;

  if (first && !second && finalMatch) {
    if (sameText(first, finalMatch.home_team)) second = finalMatch.away_team;
    else if (sameText(first, finalMatch.away_team)) second = finalMatch.home_team;
  }

  if (thirdMatch && hasOfficialResult(thirdMatch)) {
    if (thirdMatch.home_score > thirdMatch.away_score) third = thirdMatch.home_team;
    else if (thirdMatch.away_score > thirdMatch.home_score) third = thirdMatch.away_team;
  }

  return { first, second, third };
}

function renderBracketPodium() {
  const { first, second, third } = getBracketPodiumData();
  const el = document.createElement("div");
  el.className = "bracket-final-podium";

  const title = document.createElement("div");
  title.className = "fp-title";
  title.textContent = "Classificação";
  el.appendChild(title);

  [
    { medal: "🥇", team: first },
    { medal: "🥈", team: second },
    { medal: "🥉", team: third },
  ].forEach(({ medal, team }) => {
    const place = document.createElement("div");
    place.className = "fp-place";
    const medalEl = document.createElement("span");
    medalEl.className = "fp-medal";
    medalEl.textContent = medal;
    const teamEl = document.createElement("span");
    teamEl.className = `fp-team${team ? "" : " fp-team--pending"}`;
    teamEl.textContent = team || "Aguardando";
    place.appendChild(medalEl);
    place.appendChild(teamEl);
    el.appendChild(place);
  });

  return el;
}

function renderBracketThirdInline() {
  const thirdMatch = findBracketMatch(BRACKET_THIRD_PLACE);
  const el = document.createElement("div");
  el.className = "bracket-final-third";

  const label = document.createElement("span");
  label.className = "bracket-final-third-label";
  label.textContent = "3° Lugar";
  el.appendChild(label);

  el.appendChild(createBracketCard(thirdMatch, BRACKET_THIRD_PLACE));
  return el;
}

function renderBracket() {
  const bracketSection = document.querySelector("#bracketSection");
  const bracketTree = document.querySelector("#bracketTree");
  const verChaveLink = document.querySelector("#verChaveLink");
  if (!bracketTree) return;

  const allSourceIds = BRACKET_COLS.flatMap((col) => col.groups.flat()).concat([BRACKET_THIRD_PLACE]);
  const hasAnyBracketMatch = allSourceIds.some((sid) => Boolean(findBracketMatch(sid)));

  if (bracketSection) bracketSection.hidden = !(currentTab === "chave" && hasAnyBracketMatch);
  if (verChaveLink) verChaveLink.classList.toggle("hidden", !hasAnyBracketMatch);

  bracketTree.innerHTML = "";

  BRACKET_COLS.forEach((col) => {
    const colEl = document.createElement("div");
    colEl.className = [
      "bracket-col",
      col.flipped ? "bracket-col--flipped" : "",
      col.isCenter ? "bracket-col--final" : "",
    ].filter(Boolean).join(" ");
    colEl.dataset.round = col.id;

    const labelEl = document.createElement("div");
    labelEl.className = "bracket-col-label";
    labelEl.textContent = col.label;
    colEl.appendChild(labelEl);

    const slotsEl = document.createElement("div");
    slotsEl.className = "bracket-slots";

    col.groups.forEach((sourceIds) => {
      const isSingle = sourceIds.length === 1;
      const groupEl = document.createElement("div");
      groupEl.className = isSingle ? "bracket-group bracket-group--single" : "bracket-group";

      sourceIds.forEach((sourceId) => {
        const match = findBracketMatch(sourceId);
        const slotEl = document.createElement("div");
        slotEl.className = "bracket-slot";
        slotEl.appendChild(createBracketCard(match, sourceId));
        groupEl.appendChild(slotEl);
      });

      slotsEl.appendChild(groupEl);
    });

    colEl.appendChild(slotsEl);

    if (col.isCenter) {
      const extrasEl = document.createElement("div");
      extrasEl.className = "bracket-final-extras";
      extrasEl.appendChild(renderBracketPodium());
      extrasEl.appendChild(renderBracketThirdInline());
      colEl.appendChild(extrasEl);
    }

    bracketTree.appendChild(colEl);
  });
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
  document.querySelector("#nextMatchTeams").innerHTML = `${teamWithFlag(match.home_team)} × ${teamWithFlag(match.away_team)}`;
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
  renderDayMatchesPreview();
  renderRanking();
  renderMatches();
  renderBracket();
  renderHighlights();
  renderDailyDuel();
  renderPublicBonusPanel();
  renderAdminPanel();
  fillSpecialResultForm();
  updateKnockoutAdminFields();
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
  predictionLogs = logsResult.error ? [] : logsResult.data || [];

  const deduped = deduplicateMatchData(
    matchesResult.data || [],
    predictionsResult.data || []
  );
  matches = deduped.matches;
  predictions = deduped.predictions;

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
          item.num ||
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

      // Mata-mata pode ir pra prorrogacao: "et" e o placar final do jogo e "ft" so os 90
      // minutos, entao "et" tem prioridade. Penaltis (shootout) nao entram no placar.
      const homeScore =
        item.home_score ?? item.score1 ?? item.score?.et?.[0] ?? item.score?.ft?.[0] ?? item.goals?.home;
      const awayScore =
        item.away_score ?? item.score2 ?? item.score?.et?.[1] ?? item.score?.ft?.[1] ?? item.goals?.away;

      if (Number.isInteger(Number(homeScore)) && Number.isInteger(Number(awayScore))) {
        normalized.home_score = Number(homeScore);
        normalized.away_score = Number(awayScore);
      }

      return normalized;
    })
    .filter(Boolean);
}

async function syncMatchesFromOfficial() {
  const url = appConfig?.officialMatchesUrl;
  if (!url || !supabaseClient) return 0;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const rawOfficialMatches = normalizeOfficialMatches(await response.json());
  if (!rawOfficialMatches.length) return 0;
  const officialMatches = rawOfficialMatches.filter(
    (m, i, arr) => arr.findIndex((x) => x.source_id === m.source_id) === i
  );

  // Remove duplicates already in the DB before migrating, otherwise a migration could try to
  // assign a source_id that another duplicate row already owns (unique constraint violation).
  const { data: rawDbMatches } = await supabaseClient.from("matches").select("*").throwOnError();
  const dbMatches = await removeDuplicateMatchesFromDB(rawDbMatches || []);

  // source_ids already present in the DB — never migrate a record onto one of these.
  const existingSourceIds = new Set(dbMatches.map((m) => m.source_id));

  // Pass 1: migrate records with old fallback source_id (same teams + kickoff, different id)
  const migrations = officialMatches
    .map((om) => {
      if (existingSourceIds.has(om.source_id)) return null;
      const existing = dbMatches.find(
        (m) =>
          m.source_id !== om.source_id &&
          sameText(m.home_team, om.home_team) &&
          sameText(m.away_team, om.away_team) &&
          m.kickoff_at &&
          om.kickoff_at &&
          new Date(m.kickoff_at).getTime() === new Date(om.kickoff_at).getTime()
      );
      return existing ? { id: existing.id, source_id: om.source_id } : null;
    })
    .filter(Boolean);

  if (migrations.length) {
    await Promise.all(
      migrations.map(({ id, source_id }) =>
        supabaseClient.from("matches").update({ source_id }).eq("id", id).throwOnError()
      )
    );
    migrations.forEach(({ source_id }) => existingSourceIds.add(source_id));
  }

  // Pass 2: migrate by kickoff_at only — covers TBD → real team transitions in knockout stage.
  // Only when exactly one DB match shares that kickoff time (avoids group-stage ambiguity
  // where two matches can start simultaneously).
  const migratedIds = new Set(migrations.map((m) => m.id));
  const kickoffMigrations = officialMatches
    .map((om) => {
      if (!om.kickoff_at || existingSourceIds.has(om.source_id)) return null;
      const omTime = new Date(om.kickoff_at).getTime();
      const candidates = dbMatches.filter(
        (m) =>
          m.source_id !== om.source_id &&
          !migratedIds.has(m.id) &&
          m.kickoff_at &&
          new Date(m.kickoff_at).getTime() === omTime
      );
      return candidates.length === 1 ? { id: candidates[0].id, source_id: om.source_id } : null;
    })
    .filter(Boolean);

  if (kickoffMigrations.length) {
    await Promise.all(
      kickoffMigrations.map(({ id, source_id }) =>
        supabaseClient.from("matches").update({ source_id }).eq("id", id).throwOnError()
      )
    );
  }

  // Jogos com placar travado (result_locked) nunca tem o placar sobrescrito pela fonte
  // oficial — preservamos o valor atual do banco (inclusive null). Consultado apos as
  // migracoes de source_id acima para casar pelo source_id ja atualizado.
  const { data: lockedRows } = await supabaseClient
    .from("matches")
    .select("source_id, home_score, away_score")
    .eq("result_locked", true)
    .throwOnError();
  const lockedBySourceId = new Map(
    (lockedRows || []).filter((m) => m.source_id).map((m) => [m.source_id, m])
  );
  officialMatches.forEach((om) => {
    const locked = lockedBySourceId.get(om.source_id);
    if (locked) {
      om.home_score = locked.home_score;
      om.away_score = locked.away_score;
    }
  });

  await supabaseClient
    .from("matches")
    .upsert(officialMatches, { onConflict: "source_id" })
    .throwOnError();

  // Final safety pass: clean anything that may have slipped through after the upsert.
  const { data: dbMatchesAfter } = await supabaseClient.from("matches").select("*").throwOnError();
  await removeDuplicateMatchesFromDB(dbMatchesAfter || []);

  return officialMatches.length;
}

// A team name is a placeholder when it represents an unresolved knockout slot
// rather than a real team — e.g. "3/A/B/C/D/F", "1A", "2B", "W73", "L49", "Winner Group A".
function isPlaceholderTeam(name) {
  const n = String(name || "").trim();
  if (!n) return true;
  if (n.includes("/")) return true; // third-place permutations like "3/A/B/C/D/F"
  if (/\d/.test(n)) return true; // group positions / match refs like "1A", "W73"
  return /(winner|runner|loser|vencedor|perdedor|1st|2nd|3rd)/i.test(n);
}

function matchHasPlaceholder(match) {
  return isPlaceholderTeam(match.home_team) || isPlaceholderTeam(match.away_team);
}

async function removeDuplicateMatchesFromDB(dbMatches) {
  const groups = new Map();
  for (const match of dbMatches) {
    const key = [
      normalizeText(match.home_team || ""),
      normalizeText(match.away_team || ""),
      match.kickoff_at || match.id
    ].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  }

  const keptMatches = [];
  const toDelete = [];
  const predictionRemaps = [];

  for (const group of groups.values()) {
    if (group.length <= 1) {
      keptMatches.push(group[0]);
      continue;
    }
    const sorted = [...group].sort((a, b) => {
      const lenDiff = (a.source_id || "").length - (b.source_id || "").length;
      if (lenDiff !== 0) return lenDiff;
      return (hasOfficialResult(b) ? 1 : 0) - (hasOfficialResult(a) ? 1 : 0);
    });
    const primary = sorted[0];
    keptMatches.push(primary);
    for (const dup of sorted.slice(1)) {
      predictionRemaps.push({ from: dup.id, to: primary.id });
      toDelete.push(dup.id);
    }
  }

  // Phase B: collapse provisional placeholder fixtures (an unresolved knockout slot like
  // "Germany x 3/A/B/C/D/F") into their resolved counterpart at the same kickoff
  // ("Germany x Paraguay"), remapping any predictions onto the resolved match.
  const byKickoff = new Map();
  for (const m of keptMatches) {
    if (!m.kickoff_at) continue;
    const k = new Date(m.kickoff_at).getTime();
    if (!byKickoff.has(k)) byKickoff.set(k, []);
    byKickoff.get(k).push(m);
  }

  const removedByPlaceholder = new Set();
  for (const group of byKickoff.values()) {
    if (group.length <= 1) continue;
    const resolved = group.filter((m) => !matchHasPlaceholder(m));
    const provisional = group.filter((m) => matchHasPlaceholder(m));
    if (!provisional.length || !resolved.length) continue;

    for (const prov of provisional) {
      // One resolved match at this kickoff → unambiguous. Several (simultaneous group-stage
      // kickoffs) → require a shared real team to avoid pairing the wrong fixtures.
      const target =
        resolved.length === 1
          ? resolved[0]
          : resolved.find(
              (r) =>
                sameText(r.home_team, prov.home_team) || sameText(r.away_team, prov.away_team)
            );
      if (!target) continue;
      predictionRemaps.push({ from: prov.id, to: target.id });
      toDelete.push(prov.id);
      removedByPlaceholder.add(prov.id);
    }
  }

  const survivors = keptMatches.filter((m) => !removedByPlaceholder.has(m.id));

  if (!toDelete.length) return survivors;

  for (const { from, to } of predictionRemaps) {
    const { data: dupPreds } = await supabaseClient
      .from("predictions").select("id, participant_id").eq("match_id", from).throwOnError();
    if (!dupPreds?.length) continue;

    const { data: primaryPreds } = await supabaseClient
      .from("predictions").select("participant_id").eq("match_id", to).throwOnError();
    const hasPrimary = new Set((primaryPreds || []).map((p) => p.participant_id));

    const toUpdateIds = dupPreds.filter((p) => !hasPrimary.has(p.participant_id)).map((p) => p.id);
    const toDeleteIds = dupPreds.filter((p) => hasPrimary.has(p.participant_id)).map((p) => p.id);

    if (toUpdateIds.length) {
      await supabaseClient.from("predictions").update({ match_id: to }).in("id", toUpdateIds).throwOnError();
    }
    if (toDeleteIds.length) {
      await supabaseClient.from("predictions").delete().in("id", toDeleteIds).throwOnError();
    }
  }

  await supabaseClient.from("matches").delete().in("id", toDelete).throwOnError();

  return survivors;
}

async function syncOfficialResults() {
  if (resultSyncInProgress || !appConfig?.officialMatchesUrl || !supabaseClient) return;

  resultSyncInProgress = true;

  try {
    const count = await syncMatchesFromOfficial();
    if (count) await loadAll();
  } catch (error) {
    console.error("Erro ao atualizar resultados automaticamente.", error);
  } finally {
    resultSyncInProgress = false;
  }
}

async function importOfficialMatches() {
  if (!requireAdmin()) return;

  const message = document.querySelector("#importMessage");
  if (!appConfig?.officialMatchesUrl) {
    message.textContent = "Coloque a URL dos jogos em supabase-config.js.";
    return;
  }

  message.textContent = "Importando jogos...";
  importMatchesButton.disabled = true;

  try {
    const count = await syncMatchesFromOfficial();
    message.textContent = count ? `${count} jogos importados.` : "Nao encontrei jogos nessa URL.";
    await loadAll();
  } catch (error) {
    message.textContent = `Erro: ${error?.message || error}`;
    console.error(error);
  } finally {
    importMatchesButton.disabled = false;
  }
}

function numberValue(selector) {
  return Number(document.querySelector(selector).value);
}

participantForm?.addEventListener("submit", async (event) => {
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
    participantForm?.reset();
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
      kickoff_at: kickoffAt ? new Date(kickoffAt).toISOString() : null,
      is_knockout: Boolean(document.querySelector("#isKnockoutNew")?.checked)
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
    const isKnockoutCheck = document.querySelector("#isKnockoutCheck");
    const winnerSelect = document.querySelector("#knockoutWinnerSelect");
    const knockoutFieldsHidden = document.querySelector("#knockoutAdminFields")?.classList.contains("hidden");

    const payload = {
      home_score: numberValue("#resultHomeScore"),
      away_score: numberValue("#resultAwayScore"),
      result_locked: Boolean(document.querySelector("#resultLockCheck")?.checked)
    };

    if (!knockoutFieldsHidden) {
      payload.is_knockout = Boolean(isKnockoutCheck?.checked);
      payload.knockout_winner = (isKnockoutCheck?.checked && winnerSelect?.value) ? winnerSelect.value : null;
    }

    // O trigger do banco (protect_locked_match_result) ignora mudanca de placar
    // enquanto o jogo esta travado — destrava primeiro para o novo placar entrar.
    if (payload.result_locked) {
      await supabaseClient
        .from("matches")
        .update({ result_locked: false })
        .eq("id", resultMatchSelect.value)
        .throwOnError();
    }

    await supabaseClient
      .from("matches")
      .update(payload)
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
        away_score: null,
        // Solta a trava tambem — senao o trigger do banco preservaria o placar antigo.
        result_locked: false
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

  if (!Number.isInteger(manualPoints) || manualPoints < -200 || manualPoints > 200) {
    adminManualPointsMessage.textContent = "Informe um valor inteiro entre -200 e 200.";
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

matchesList.addEventListener("input", (event) => {
  const input = event.target.closest(".sim-input");
  if (!input) return;

  const simulatorEl = input.closest("[data-simulator]");
  simScores.set(simulatorEl.dataset.simulator, {
    home: simulatorEl.querySelector("[data-sim-home]").value,
    away: simulatorEl.querySelector("[data-sim-away]").value
  });
  updateSimulatorResult(simulatorEl);
});

matchesList.addEventListener("focusout", (event) => {
  if (!event.target.classList?.contains("sim-input")) return;

  // Espera o foco assentar: pular de um campo do simulador para o outro nao
  // deve disparar o render pendente.
  window.setTimeout(() => {
    const active = document.activeElement;
    const stillTyping = active && active.classList?.contains("sim-input") && matchesList.contains(active);
    if (matchesRenderPending && !stillTyping) renderMatches();
  }, 0);
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
  renderDayMatchesPreview();
});

resultStageSelect.addEventListener("change", () => {
  resultMatchSelect.value = "";
  renderSelects();
});

resultMatchSelect.addEventListener("change", () => {
  updateKnockoutAdminFields();
});

document.querySelector("#isKnockoutCheck")?.addEventListener("change", () => {
  const checked = document.querySelector("#isKnockoutCheck")?.checked;
  document.querySelector("#knockoutWinnerRow")?.classList.toggle("hidden", !checked);
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
  renderDayMatchesPreview();
});

matchSelect.addEventListener("change", () => {
  updatePredictionContext();
  renderDayMatchesPreview();
});

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
  fillAdminPredictForm(adminPredictParticipantSelect.value, adminPredictMatchSelect.value, { force: true });
  adminPredictMessage.textContent = "";
});

adminPredictParticipantSelect.addEventListener("change", () => {
  fillAdminPredictForm(adminPredictParticipantSelect.value, adminPredictMatchSelect.value, { force: true });
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

const ICON_MOON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const ICON_SUN  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("bolao-theme", theme);
  themeToggleButton.innerHTML = theme === "dark" ? ICON_SUN : ICON_MOON;
  themeToggleButton.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  themeToggleButton.setAttribute("aria-label", theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro");
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

// Tab nav: click switches content sections
document.querySelectorAll(".quick-nav a[data-tab]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    showTab(link.dataset.tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

// Any link pointing to the prediction form navigates to the palpite tab
document.addEventListener("click", (e) => {
  const anchor = e.target.closest('a[href="#predictionForm"], .next-match-cta');
  if (!anchor) return;
  e.preventDefault();
  showTab("palpite");
  document.querySelector("#predictionForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#bracketTree")?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-bracket-match]");
  if (!card) return;

  const matchId = card.dataset.bracketMatch;
  const match = matches.find((m) => m.id === matchId);
  if (!match) return;

  showTab("palpite");
  predictionStageSelect.value = matchDayKey(match);
  renderSelects();
  matchSelect.value = matchId;
  updatePredictionContext();
  renderDayMatchesPreview();

  document.querySelector("#predictionForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

showTab("palpite");
start();

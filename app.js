const ENTRY_VALUE = 100;
const PREDICTION_DEADLINE_MS = 60 * 60 * 1000;
const BONUS_POINT_OPTIONS = [0, 5, 10, 15];

const participantForm = document.querySelector("#participantForm");
const matchForm = document.querySelector("#matchForm");
const predictionForm = document.querySelector("#predictionForm");
const resultForm = document.querySelector("#resultForm");
const specialPredictionForm = document.querySelector("#specialPredictionForm");
const refreshButton = document.querySelector("#refreshButton");
const importMatchesButton = document.querySelector("#importMatchesButton");
const adminLoginButton = document.querySelector("#adminLoginButton");
const adminLogoutButton = document.querySelector("#adminLogoutButton");
const clearResultButton = document.querySelector("#clearResultButton");

const totalParticipants = document.querySelector("#totalParticipants");
const totalMatches = document.querySelector("#totalMatches");
const totalPrize = document.querySelector("#totalPrize");
const connectionStatus = document.querySelector("#connectionStatus");
const participantSelect = document.querySelector("#participantSelect");
const specialParticipantSelect = document.querySelector("#specialParticipantSelect");
const predictionStageSelect = document.querySelector("#predictionStageSelect");
const matchSelect = document.querySelector("#matchSelect");
const resultStageSelect = document.querySelector("#resultStageSelect");
const resultMatchSelect = document.querySelector("#resultMatchSelect");
const rankingTable = document.querySelector("#rankingTable");
const rankingEmpty = document.querySelector("#rankingEmpty");
const adminStageSelect = document.querySelector("#adminStageSelect");
const adminMatchSelect = document.querySelector("#adminMatchSelect");
const adminPredictionsTable = document.querySelector("#adminPredictionsTable");
const adminEmpty = document.querySelector("#adminEmpty");
const adminBonusTable = document.querySelector("#adminBonusTable");
const adminBonusEmpty = document.querySelector("#adminBonusEmpty");
const groupTabs = document.querySelector("#groupTabs");
const matchesList = document.querySelector("#matchesList");
const matchesEmpty = document.querySelector("#matchesEmpty");

let supabaseClient = null;
let appConfig = null;
let participants = [];
let matches = [];
let predictions = [];
let selectedDay = "all";
let selectedAdminDay = "all";
let selectedAdminMatch = "";
let isAdmin = sessionStorage.getItem("bolao-admin") === "true";

function money(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

function specialBonusFor(participant) {
  if (participant.manual_bonus_points !== null && participant.manual_bonus_points !== undefined) {
    return Number(participant.manual_bonus_points);
  }

  return 0;
}

function matchPointsForParticipant(participant) {
  return predictions
    .filter((prediction) => prediction.participant_id === participant.id)
    .reduce((total, prediction) => {
      const match = matches.find((item) => item.id === prediction.match_id);
      return total + (match ? pointsFor(prediction, match) : 0);
    }, 0);
}

function fillSpecialForm(participantId) {
  const participant = participants.find((item) => item.id === participantId);
  document.querySelector("#championPick").value = participant?.champion_pick || "";
  document.querySelector("#topScorerPick").value = participant?.top_scorer_pick || "";
  document.querySelector("#finalistOnePick").value = participant?.finalist_one_pick || "";
  document.querySelector("#finalistTwoPick").value = participant?.finalist_two_pick || "";
}

function participantScore(participant) {
  const matchPoints = matchPointsForParticipant(participant);
  const bonusPoints = specialBonusFor(participant);

  return {
    matchPoints,
    bonusPoints,
    total: matchPoints + bonusPoints
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
  const selectedParticipant = participantSelect.value;
  const selectedSpecialParticipant = specialParticipantSelect.value;
  const selectedPredictionDay = predictionStageSelect.value;
  const selectedMatch = matchSelect.value;
  const selectedResultDay = resultStageSelect.value;
  const selectedResultMatch = resultMatchSelect.value;
  const selectedAdminDayValue = adminStageSelect.value || selectedAdminDay;
  const selectedAdminMatchValue = adminMatchSelect.value || selectedAdminMatch;

  participantSelect.innerHTML = "";
  participantSelect.appendChild(option("Escolha o participante", ""));
  specialParticipantSelect.innerHTML = "";
  specialParticipantSelect.appendChild(option("Escolha o participante", ""));
  participants.forEach((participant) => {
    participantSelect.appendChild(option(participant.name, participant.id));
    specialParticipantSelect.appendChild(option(participant.name, participant.id));
  });
  participantSelect.value = participants.some((participant) => participant.id === selectedParticipant)
    ? selectedParticipant
    : "";
  specialParticipantSelect.value = participants.some((participant) => participant.id === selectedSpecialParticipant)
    ? selectedSpecialParticipant
    : "";
  fillSpecialForm(specialParticipantSelect.value);

  const dayOptions = orderedMatchDays().map((day) => ({ label: dayLabel(day), value: day }));
  const fallbackDay = dayOptions[0]?.value || "";

  [
    { element: predictionStageSelect, value: selectedPredictionDay || fallbackDay },
    { element: resultStageSelect, value: selectedResultDay || fallbackDay },
    { element: adminStageSelect, value: selectedAdminDayValue || fallbackDay }
  ].forEach(({ element, value }) => {
    element.innerHTML = "";
    dayOptions.forEach((day) => {
      element.appendChild(option(day.label, day.value));
    });
    element.value = dayOptions.some((day) => day.value === value) ? value : fallbackDay;
  });

  selectedAdminDay = adminStageSelect.value;

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
      const label = `${match.home_team} x ${match.away_team} - ${match.stage}${date ? ` - ${date}` : ""}${locked ? " - palpites encerrados" : ""}`;
      const item = option(label, match.id);
      item.disabled = locked;
      element.appendChild(item);
    });
    element.value = visibleMatches.some((match) => match.id === value && (element !== matchSelect || canPredictMatch(match))) ? value : "";
  });
}

function renderRanking() {
  rankingTable.innerHTML = "";

  calculateRanking().forEach((participant, index) => {
    const row = document.createElement("article");
    row.className = "ranking-item";
    row.innerHTML = `
      <span class="rank-position">${index + 1}</span>
      <div class="rank-main">
        <strong>${escapeHtml(participant.name)}</strong>
        <small>${participant.matchPoints} pontos · ${participant.bonusPoints} bonus</small>
      </div>
      <strong class="rank-score">${participant.total}</strong>
      <span class="badge ${participant.paid ? "paid" : "pending"}">${participant.paid ? "Pago" : "Pendente"}</span>
      <button class="danger admin-action" type="button" data-remove-participant="${participant.id}">Remover</button>
    `;
    rankingTable.appendChild(row);
  });

  rankingEmpty.style.display = participants.length ? "none" : "block";
}

function renderMatches() {
  matchesList.innerHTML = "";
  groupTabs.innerHTML = "";

  const days = orderedMatchDays();

  if (!days.length) {
    selectedDay = "";
  } else if (!selectedDay || selectedDay === "all" || !days.includes(selectedDay)) {
    selectedDay = days[0];
  }

  days.map((day) => ({ label: dayLabel(day), value: day })).forEach((tab) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = tab.value === selectedDay ? "active" : "";
    button.dataset.day = tab.value;
    button.textContent = tab.label;
    groupTabs.appendChild(button);
  });

  const visibleMatches = matches.filter((match) => matchDayKey(match) === selectedDay);

  visibleMatches.forEach((match) => {
    const matchPredictions = predictions.filter((prediction) => prediction.match_id === match.id);
    const result =
      match.home_score === null || match.away_score === null
        ? "Resultado aberto"
        : `${match.home_score} x ${match.away_score}`;
    const details = [match.stage, formatMatchDate(match.kickoff_at), match.venue]
      .filter(Boolean)
      .join(" · ");

    const predictionStatus = canPredictMatch(match)
      ? `Palpites ate ${predictionDeadlineText(match)}`
      : `Palpites encerrados em ${predictionDeadlineText(match)}`;

    const predictionsContent = matchPredictions.length
      ? matchPredictions.map((prediction) => {
        const participant = participants.find((item) => item.id === prediction.participant_id);
        const points = pointsFor(prediction, match);
        return `
            <div>
              <span>${escapeHtml(participant?.name || "Participante removido")}</span>
              <strong>${isAdmin ? `${prediction.home_score} x ${prediction.away_score}` : "* x *"}</strong>
              <em>${isAdmin ? `${points} pts` : "-- pts"}</em>
              <button class="danger mini-action admin-action" type="button" data-remove-prediction="${prediction.id}">Remover</button>
            </div>
          `;
      }).join("")
      : "<p>Nenhum palpite nesse jogo ainda.</p>";

    const card = document.createElement("article");
    card.className = "match-card";
    card.innerHTML = `
      <div class="match-top">
        <div>
          <strong>${escapeHtml(match.home_team)} x ${escapeHtml(match.away_team)}</strong>
          <span>${escapeHtml(details)}</span>
          <span>${escapeHtml(predictionStatus)}</span>
        </div>
        <div class="match-result ${match.home_score === null || match.away_score === null ? "open" : "finished"}">
          <small>${match.home_score === null || match.away_score === null ? "Aberto" : "Final"}</small>
          <strong>${result}</strong>
        </div>
        <button class="danger admin-action" type="button" data-remove-match="${match.id}">Remover</button>
      </div>
      <div class="mini-table">
        ${predictionsContent}
      </div>
    `;
    matchesList.appendChild(card);
  });

  matchesEmpty.style.display = matches.length ? "none" : "block";
  if (matches.length && !visibleMatches.length) {
    matchesEmpty.style.display = "block";
    matchesEmpty.querySelector("strong").textContent = "Nenhum jogo nesse filtro.";
    matchesEmpty.querySelector("span").textContent = "Escolha outro dia.";
  } else {
    matchesEmpty.querySelector("strong").textContent = "Nenhum jogo cadastrado.";
    matchesEmpty.querySelector("span").textContent = "Cadastre os jogos para o pessoal palpitar.";
  }
}

function finalPointsFor(prediction, match) {
  return pointsFor(prediction, match);
}

function renderAdminPanel() {
  adminPredictionsTable.innerHTML = "";
  adminBonusTable.innerHTML = "";

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
    const autoPoints = automaticPointsFor(prediction, match);
    const finalPoints = finalPointsFor(prediction, match);
    const result =
      match.home_score === null || match.away_score === null
        ? "Aberto"
        : `${match.home_score} x ${match.away_score}`;
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(participant?.name || "Participante removido")}</td>
      <td>${escapeHtml(match.home_team)} x ${escapeHtml(match.away_team)}</td>
      <td>${prediction.home_score} x ${prediction.away_score}</td>
      <td>${result}</td>
      <td>${autoPoints}</td>
      <td>
        <select class="points-select" data-points-prediction="${prediction.id}">
          ${[0, 1, 3].map((points) => `
            <option value="${points}" ${finalPoints === points ? "selected" : ""}>${points}</option>
          `).join("")}
        </select>
      </td>
      <td>
        <label class="checkbox compact-check">
          <input type="checkbox" data-reviewed-prediction="${prediction.id}" ${prediction.reviewed ? "checked" : ""} />
          <span>OK</span>
        </label>
      </td>
    `;

    adminPredictionsTable.appendChild(row);
  });

  adminEmpty.style.display = visiblePredictions.length ? "none" : "block";

  const participantsWithBonus = participants.filter((participant) =>
    [
      participant.champion_pick,
      participant.top_scorer_pick,
      participant.finalist_one_pick,
      participant.finalist_two_pick,
      participant.manual_bonus_points
    ].some(Boolean)
  );

  participantsWithBonus.forEach((participant) => {
    const row = document.createElement("tr");
    const finalists = [participant.finalist_one_pick, participant.finalist_two_pick]
      .filter(Boolean)
      .join(" x ");

    row.innerHTML = `
      <td>${escapeHtml(participant.name)}</td>
      <td>${escapeHtml(participant.top_scorer_pick || "-")}</td>
      <td>${escapeHtml(finalists || "-")}</td>
      <td>${escapeHtml(participant.champion_pick || "-")}</td>
      <td>
        <select
          class="bonus-points-select"
          data-bonus-participant="${participant.id}"
          aria-label="Pontos de bonus de ${escapeHtml(participant.name)}"
        >
          ${BONUS_POINT_OPTIONS.map((points) => `
            <option value="${points}" ${specialBonusFor(participant) === points ? "selected" : ""}>${points}</option>
          `).join("")}
        </select>
      </td>
      <td>
        <button class="primary compact-save" type="button" data-save-bonus-participant="${participant.id}">
          Salvar
        </button>
        <button class="secondary compact-save" type="button" data-clear-bonus-points="${participant.id}">
          Zerar pontos
        </button>
        <button class="danger compact-save" type="button" data-clear-bonus-picks="${participant.id}">
          Remover bonus
        </button>
      </td>
    `;

    adminBonusTable.appendChild(row);
  });

  adminBonusEmpty.style.display = participantsWithBonus.length ? "none" : "block";
}

function render() {
  const paidCount = participants.filter((participant) => participant.paid).length;
  totalParticipants.textContent = participants.length;
  totalMatches.textContent = matches.length;
  totalPrize.textContent = money(paidCount * ENTRY_VALUE);
  renderSelects();
  renderRanking();
  renderMatches();
  renderAdminPanel();
}

async function loadAll() {
  const [participantsResult, matchesResult, predictionsResult] = await Promise.all([
    supabaseClient.from("participants").select("*").order("created_at", { ascending: true }),
    supabaseClient.from("matches").select("*").order("kickoff_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }),
    supabaseClient.from("predictions").select("*").order("created_at", { ascending: true })
  ]);

  const error =
    participantsResult.error ||
    matchesResult.error ||
    predictionsResult.error;
  if (error) throw error;

  participants = participantsResult.data || [];
  matches = matchesResult.data || [];
  predictions = predictionsResult.data || [];

  render();
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
      const sourceId = String(
        item.id ||
          item.num ||
          item.match_id ||
          item.fixture?.id ||
          `${item.date || parsedKickoff || "sem-data"}-${item.round || stage}-${item.ground || venue || "sem-local"}-${index}`
      );

      if (!homeTeam || !awayTeam) return null;

      const normalized = {
        source_id: sourceId,
        stage: String(stage).slice(0, 30),
        home_team: String(homeTeam).slice(0, 40),
        away_team: String(awayTeam).slice(0, 40),
        kickoff_at: parsedKickoff ? new Date(parsedKickoff).toISOString() : null,
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

  if (!paid) {
    message.textContent = "Confirme o pagamento para entrar no bolao.";
    return;
  }

  try {
    await supabaseClient.from("participants").insert({ name, paid }).throwOnError();
    participantForm.reset();
    message.textContent = "Participante adicionado.";
    await loadAll();
  } catch (error) {
    message.textContent = "Erro ao adicionar participante.";
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
    message.textContent = "Palpites desse jogo encerram 1 hora antes da partida.";
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
    const payload = {
        participant_id: participantSelect.value,
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

    predictionForm.reset();
    message.textContent = "Palpite salvo.";
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

specialParticipantSelect.addEventListener("change", () => {
  fillSpecialForm(specialParticipantSelect.value);
});

specialPredictionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#specialPredictionMessage");
  const participant = participants.find((item) => item.id === specialParticipantSelect.value);
  const alreadyHasBonus = [
    participant?.champion_pick,
    participant?.top_scorer_pick,
    participant?.finalist_one_pick,
    participant?.finalist_two_pick
  ].some(Boolean);

  if (alreadyHasBonus && !isAdmin) {
    message.textContent = "Seus bonus ja foram salvos e nao podem ser alterados.";
    return;
  }

  try {
    await supabaseClient
      .from("participants")
      .update({
        champion_pick: document.querySelector("#championPick").value.trim() || null,
        top_scorer_pick: document.querySelector("#topScorerPick").value.trim() || null,
        finalist_one_pick: document.querySelector("#finalistOnePick").value.trim() || null,
        finalist_two_pick: document.querySelector("#finalistTwoPick").value.trim() || null
      })
      .eq("id", specialParticipantSelect.value)
      .throwOnError();
    message.textContent = "Bonus salvos.";
    await loadAll();
  } catch (error) {
    message.textContent = "Erro ao salvar bonus.";
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

adminMatchSelect.addEventListener("change", () => {
  selectedAdminMatch = adminMatchSelect.value;
  renderAdminPanel();
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

  const clearPointsButton = event.target.closest("[data-clear-bonus-points]");
  if (clearPointsButton) {
    try {
      await supabaseClient
        .from("participants")
        .update({
          manual_bonus_points: null
        })
        .eq("id", clearPointsButton.dataset.clearBonusPoints)
        .throwOnError();
      await loadAll();
    } catch (error) {
      setStatus("Erro ao zerar pontos do bonus.", "error");
      console.error(error);
    }
    return;
  }

  const clearPicksButton = event.target.closest("[data-clear-bonus-picks]");
  if (clearPicksButton) {
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
    return;
  }

  const button = event.target.closest("[data-save-bonus-participant]");
  if (!button) return;

  const row = button.closest("tr");
  const select = row.querySelector("[data-bonus-participant]");

  try {
    await supabaseClient
      .from("participants")
      .update({
        manual_bonus_points: Number(select.value || 0)
      })
      .eq("id", button.dataset.saveBonusParticipant)
      .throwOnError();
    button.textContent = "Salvo";
    await loadAll();
  } catch (error) {
    setStatus("Erro ao salvar bonus manual. Rode a migration manual_bonus_points no Supabase.", "error");
    window.alert("Nao consegui salvar o bonus. Rode o arquivo supabase-manual-bonus-migration.sql no Supabase.");
    console.error(error);
  }
});

adminLoginButton.addEventListener("click", () => {
  const password = window.prompt("Senha do admin");
  if (password !== appConfig?.adminPassword) {
    window.alert("Senha incorreta.");
    return;
  }

  isAdmin = true;
  sessionStorage.setItem("bolao-admin", "true");
  applyAdminMode();
});

adminLogoutButton.addEventListener("click", () => {
  isAdmin = false;
  sessionStorage.removeItem("bolao-admin");
  applyAdminMode();
});

function subscribeToChanges() {
  ["participants", "matches", "predictions"].forEach((table) => {
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
    setFormsEnabled(true);
    setStatus("Tabela conectada. O ranking atualiza quando os resultados entram.", "ok");
  } catch (error) {
    setStatus("Nao consegui conectar. Rode o SQL atualizado no Supabase.", "error");
    console.error(error);
  }
}

start();

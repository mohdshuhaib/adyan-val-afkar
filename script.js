const STORAGE_KEY = "adyan-val-afkar-mcq-state-v2";

const categories = {
  ideas: "ചിന്തകളും ഇസങ്ങളും",
  indian: "ഭാരതീയ മതങ്ങൾ",
};

const questions = window.quizQuestions || [];

let state = {
  order: [],
  current: 0,
  answers: {},
  filter: "all",
  submitted: false,
  sound: true,
};

const feedbackSounds = {
  success: new Audio("correct.mp3"),
  error: new Audio("wrong.mp3"),
};

Object.values(feedbackSounds).forEach((sound) => {
  sound.preload = "auto";
  sound.load();
});

const els = {
  progressText: document.querySelector("#progressText"),
  answeredText: document.querySelector("#answeredText"),
  progressFill: document.querySelector("#progressFill"),
  categoryBadge: document.querySelector("#categoryBadge"),
  questionIndex: document.querySelector("#questionIndex"),
  questionText: document.querySelector("#questionText"),
  optionsGrid: document.querySelector("#optionsGrid"),
  optionNotes: document.querySelector("#optionNotes"),
  previousQuestion: document.querySelector("#previousQuestion"),
  nextQuestion: document.querySelector("#nextQuestion"),
  submitQuiz: document.querySelector("#submitQuiz"),
  refreshQuiz: document.querySelector("#refreshQuiz"),
  resultPanel: document.querySelector("#resultPanel"),
  questionModal: document.querySelector("#questionModal"),
  openQuestionMap: document.querySelector("#openQuestionMap"),
  closeQuestionMap: document.querySelector("#closeQuestionMap"),
  questionNumberGrid: document.querySelector("#questionNumberGrid"),
  filterButtons: document.querySelectorAll(".filter-pill"),
  soundToggle: document.querySelector("#soundToggle"),
};

function shuffle(items) {
  return [...items]
    .map((item) => ({ item, sort: crypto.getRandomValues(new Uint32Array(1))[0] }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

function getFilteredQuestions() {
  const ordered = state.order.map((id) => questions.find((question) => question.id === id)).filter(Boolean);
  return state.filter === "all" ? ordered : ordered.filter((question) => question.category === state.filter);
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The quiz still works if storage is unavailable in a private or restricted browser.
  }
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    state.order = shuffle(questions.map((question) => question.id));
    saveState();
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    const validIds = new Set(questions.map((question) => question.id));
    state = {
      ...state,
      ...parsed,
      order: Array.isArray(parsed.order) ? parsed.order.filter((id) => validIds.has(id)) : [],
      answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {},
    };
    const missing = questions.map((question) => question.id).filter((id) => !state.order.includes(id));
    state.order = [...state.order, ...shuffle(missing)];
  } catch {
    state.order = shuffle(questions.map((question) => question.id));
  }
}

function playTone(type = "select") {
  if (!state.sound) return;

  if (feedbackSounds[type]) {
    const sound = feedbackSounds[type].cloneNode();
    sound.volume = 0.8;
    sound.play().catch(() => {});
    return;
  }
}

function currentQuestion() {
  const filtered = getFilteredQuestions();
  return filtered[state.current] || filtered[0];
}

function updateSubmitState() {
  const filtered = getFilteredQuestions();
  const allAnswered = filtered.length > 0 && filtered.every((question) => state.answers[question.id] !== undefined);
  els.submitQuiz.disabled = !allAnswered;
}

function renderNotes(question) {
  const selected = state.answers[question.id];
  if (selected === undefined || !Array.isArray(question.notes)) {
    els.optionNotes.hidden = true;
    els.optionNotes.innerHTML = "";
    return;
  }

  els.optionNotes.hidden = false;
  els.optionNotes.innerHTML = `
    <p class="note-title">${selected === question.answer ? "Correct answer" : "Review the options"}</p>
    <ul class="note-list">
      ${question.options
        .map((option, index) => `<li><strong>${option}:</strong> ${question.notes[index] || "No note added yet."}</li>`)
        .join("")}
    </ul>
  `;
}

function renderQuestion() {
  const filtered = getFilteredQuestions();
  if (state.current >= filtered.length) state.current = Math.max(0, filtered.length - 1);
  const question = currentQuestion();

  if (!question) {
    els.questionText.textContent = "No questions in this category yet.";
    els.optionsGrid.innerHTML = "";
    els.optionNotes.hidden = true;
    return;
  }

  const selected = state.answers[question.id];
  els.categoryBadge.textContent = question.category;
  els.questionIndex.textContent = String(state.current + 1).padStart(2, "0");
  els.questionText.textContent = question.question;
  els.optionsGrid.innerHTML = question.options
    .map((option, index) => {
      const isSelected = selected === index;
      const reveal = selected !== undefined;
      const resultClass = reveal && index === question.answer ? "is-correct" : reveal && isSelected ? "is-wrong" : "";
      return `
        <button class="option-btn ${isSelected ? "is-selected" : ""} ${resultClass}" type="button" data-option="${index}">
          ${String.fromCharCode(65 + index)}. ${option}
        </button>
      `;
    })
    .join("");

  renderNotes(question);
  renderProgress();
  updateSubmitState();
  saveState();
}

function renderProgress() {
  const filtered = getFilteredQuestions();
  const answeredCount = filtered.filter((question) => state.answers[question.id] !== undefined).length;
  const progress = filtered.length ? ((state.current + 1) / filtered.length) * 100 : 0;
  els.progressText.textContent = `Question ${Math.min(state.current + 1, filtered.length)} of ${filtered.length}`;
  els.answeredText.textContent = `${answeredCount} answered`;
  els.progressFill.style.width = `${progress}%`;
}

function renderQuestionMap() {
  const filtered = getFilteredQuestions();
  els.questionNumberGrid.innerHTML = filtered
    .map((question, index) => {
      const classes = [
        "number-btn",
        state.answers[question.id] !== undefined ? "is-answered" : "",
        index === state.current ? "is-current" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button class="${classes}" type="button" data-question="${index}">${index + 1}</button>`;
    })
    .join("");
}

function selectOption(index) {
  const question = currentQuestion();
  if (!question || state.submitted) return;
  state.answers[question.id] = index;
  playTone(index === question.answer ? "success" : "error");
  renderQuestion();
}

function submitQuiz() {
  const filtered = getFilteredQuestions();
  if (!filtered.every((question) => state.answers[question.id] !== undefined)) return;
  const correct = filtered.filter((question) => state.answers[question.id] === question.answer).length;
  state.submitted = true;
  els.resultPanel.hidden = false;
  els.resultPanel.textContent = `Result: ${correct} / ${filtered.length} correct. You can review every selected option and notes above.`;
  playTone("success");
  saveState();
}

function refreshQuiz() {
  state = {
    order: shuffle(questions.map((question) => question.id)),
    current: 0,
    answers: {},
    filter: state.filter,
    submitted: false,
    sound: state.sound,
  };
  els.resultPanel.hidden = true;
  saveState();
  playTone("select");
  renderQuestion();
}

els.optionsGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-option]");
  if (!button) return;
  selectOption(Number(button.dataset.option));
});

els.previousQuestion.addEventListener("click", () => {
  state.current = Math.max(0, state.current - 1);
  playTone("select");
  renderQuestion();
});

els.nextQuestion.addEventListener("click", () => {
  const lastIndex = getFilteredQuestions().length - 1;
  state.current = Math.min(lastIndex, state.current + 1);
  playTone("select");
  renderQuestion();
});

els.submitQuiz.addEventListener("click", submitQuiz);
els.refreshQuiz.addEventListener("click", refreshQuiz);

els.openQuestionMap.addEventListener("click", () => {
  renderQuestionMap();
  els.questionModal.showModal();
});

els.closeQuestionMap.addEventListener("click", () => els.questionModal.close());

els.questionNumberGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-question]");
  if (!button) return;
  state.current = Number(button.dataset.question);
  els.questionModal.close();
  playTone("select");
  renderQuestion();
});

els.filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    els.filterButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    state.filter = button.dataset.filter;
    state.current = 0;
    state.submitted = false;
    els.resultPanel.hidden = true;
    playTone("select");
    renderQuestion();
  });
});

els.soundToggle.addEventListener("click", () => {
  state.sound = !state.sound;
  els.soundToggle.classList.toggle("is-muted", !state.sound);
  els.soundToggle.textContent = state.sound ? "♪" : "×";
  saveState();
});

loadState();
document.querySelector(`[data-filter="${state.filter}"]`)?.classList.add("is-active");
els.filterButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.filter === state.filter));
els.soundToggle.textContent = state.sound ? "♪" : "×";
renderQuestion();
if (state.submitted) submitQuiz();

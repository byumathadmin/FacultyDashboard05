const state = {
  faculty: [],
  facultyLoaded: false,
  page: "faculty",
  selectedFloor: 1,
  darkTiles: true,
  orientation: "horizontal",
  visible: {
    name: true,
    title: true,
    email: true,
    office: true,
    hours: true,
    research: true,
    shiftBlankTitles: false,
  },
};

const grid = document.querySelector("#facultyGrid");
const loadingState = document.querySelector("#loadingState");
const currentPageLabel = document.querySelector("#currentPageLabel");
const floorNavigation = document.querySelector("#floorNavigation");
const modalBackdrop = document.querySelector("#modalBackdrop");
const modalClose = document.querySelector("#modalClose");
const websiteFrame = document.querySelector("#websiteFrame");
const iframeLoading = document.querySelector("#iframeLoading");
const modalTitle = document.querySelector("#modalTitle");
const dashboard = document.querySelector("#dashboard");
const graduateGrid = document.querySelector("#graduateGrid");
const floorList = document.querySelector("#floorList");
const floorViewer = document.querySelector("#floorViewer");

const buildingFloors = [
  { id: 1, label: "Floor 1", image: "assets/building-map-floor-1.png" },
  { id: 2, label: "Floor 2", image: "assets/building-map-floor-2.png" },
  { id: 3, label: "Floor 3", image: "assets/building-map-floor-3.png" },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanValue(value, fallback = "Not listed") {
  const cleaned = String(value ?? "").trim();
  return cleaned || fallback;
}

function getHours(person) {
  const hours = person["Office Hours"] || {};
  const entries = Array.isArray(hours.Entries) ? hours.Entries : [];

  return {
    note: String(hours["Appointment Note"] ?? "").trim(),
    entries: entries
      .map((entry) => ({
        classRoom: String(entry?.["Class/Room"] ?? "").trim(),
        day: String(entry?.Day ?? entry?.Identifier ?? "").trim(),
        time: String(entry?.Time ?? "").trim(),
      }))
      .filter((entry) => entry.classRoom || entry.day || entry.time)
      .slice(0, 8),
  };
}

function getProfileUrl(name) {
  const localFilename = window.FACULTY_PROFILES?.[name];
  return localFilename ? `Fac_Website/${localFilename}` : "about:blank";
}

function renderResearch(person) {
  if (!state.visible.research) return "";
  return `<div class="faculty-research"><strong>Research</strong><span>${escapeHtml(cleanValue(person.Research))}</span></div>`;
}

function renderCard(name, person, index) {
  const title = String(person["Job Title"] ?? "").trim();
  const email = cleanValue(person.Email);
  const office = cleanValue(person["Office Room"]);
  const hours = getHours(person);
  const image = cleanValue(person["Link to Picture"], "https://placehold.co/600x760/e5eaec/71808d?text=Faculty");
  const visible = state.visible;
  const fields = [];

  if (visible.email) fields.push(`<div class="meta-line meta-email"><span>${escapeHtml(email)}</span></div>`);
  if (visible.office) fields.push(`<div class="meta-line"><span class="meta-label">Office</span><span>${escapeHtml(office)}</span></div>`);

  const hasClassRoom = hours.entries.some((entry) => entry.classRoom);
  const hoursHeader = hasClassRoom
    ? `<div class="hours-row hours-header hours-row-three"><strong>Class/Room</strong><strong>Day</strong><strong>Time</strong></div>`
    : `<div class="hours-row hours-header"><strong>Day</strong><strong>Time</strong></div>`;
  const hoursRows = hours.entries.map(({ classRoom, day, time }) => hasClassRoom
    ? `<div class="hours-row hours-row-three"><span>${escapeHtml(classRoom)}</span><span>${escapeHtml(day)}</span><span>${escapeHtml(time)}</span></div>`
    : `<div class="hours-row"><span>${escapeHtml(day)}</span><span>${escapeHtml(time)}</span></div>`).join("");
  const hoursMarkup = visible.hours
    ? `<div class="hours-block"><div class="hours-heading"><span>Office Hours</span>${hours.note ? `<span>${escapeHtml(hours.note)}</span>` : ""}</div>${hours.entries.length ? `<div class="hours-list">${hoursHeader}${hoursRows}</div>` : ""}</div>`
    : "";
  const researchMarkup = renderResearch(person);
  const titleMarkup = visible.title
    ? title
      ? `<p class="faculty-title">${escapeHtml(title)}</p>`
      : (visible.shiftBlankTitles ? `<p class="faculty-title faculty-title-placeholder" aria-hidden="true">&nbsp;</p>` : "")
    : "";

  return `<article class="faculty-card" tabindex="0" role="button" data-index="${index}" aria-label="Open website for ${escapeHtml(name)}">
    <div class="faculty-card-inner">
      <div class="faculty-photo-column">
        <img class="portrait" src="${escapeHtml(image)}" alt="Portrait of ${escapeHtml(name)}" loading="lazy" />
        ${state.orientation === "horizontal" ? researchMarkup : ""}
      </div>
      <div class="faculty-info">
        ${visible.name ? `<h3 class="faculty-name">${escapeHtml(name)}</h3>` : ""}
        ${titleMarkup}
        ${fields.length ? `<div class="faculty-meta">${fields.join("")}</div>` : ""}
        ${hoursMarkup}
        ${state.orientation === "vertical" ? researchMarkup : ""}
      </div>
    </div>
  </article>`;
}

function renderGrid() {
  grid.classList.toggle("is-dark", state.darkTiles);
  grid.classList.toggle("is-horizontal", state.orientation === "horizontal");
  grid.innerHTML = state.faculty.map(([name, person], index) => renderCard(name, person, index)).join("");
}

function normaliseGraduateStudent(student) {
  if (typeof student === "string") return { name: student, program: "", image: "", email: "", office: "", hours: getHours({}) };
  return {
    name: cleanValue(student?.name, "Unnamed graduate student"),
    program: String(student?.program ?? "").trim(),
    image: String(student?.["Link to Picture"] ?? student?.image ?? "").trim(),
    email: String(student?.Email ?? "").trim(),
    office: String(student?.Office ?? student?.["Office Room"] ?? "").trim(),
    hours: getHours(student),
  };
}

function renderGraduateCard(student) {
  const image = student.image
    ? `<img class="graduate-portrait" src="${escapeHtml(student.image)}" alt="Portrait of ${escapeHtml(student.name)}" loading="lazy" />`
    : "";
  const details = [
    student.email ? `<div class="graduate-detail"><strong>Email</strong><span>${escapeHtml(student.email)}</span></div>` : "",
    student.office ? `<div class="graduate-detail"><strong>Office</strong><span>${escapeHtml(student.office)}</span></div>` : "",
  ].filter(Boolean).join("");
  const hasClassRoom = student.hours.entries.some((entry) => entry.classRoom);
  const hoursHeader = hasClassRoom
    ? `<div class="hours-row hours-header hours-row-three"><strong>Class/Room</strong><strong>Day</strong><strong>Time</strong></div>`
    : `<div class="hours-row hours-header"><strong>Day</strong><strong>Time</strong></div>`;
  const hoursRows = student.hours.entries.map(({ classRoom, day, time }) => hasClassRoom
    ? `<div class="hours-row hours-row-three"><span>${escapeHtml(classRoom)}</span><span>${escapeHtml(day)}</span><span>${escapeHtml(time)}</span></div>`
    : `<div class="hours-row"><span>${escapeHtml(day)}</span><span>${escapeHtml(time)}</span></div>`).join("");
  const hours = student.hours.entries.length || student.hours.note
    ? `<div class="graduate-hours"><div class="graduate-hours-heading"><strong>Office Hours</strong>${student.hours.note ? `<span>${escapeHtml(student.hours.note)}</span>` : ""}</div>${student.hours.entries.length ? `<div class="hours-list">${hoursHeader}${hoursRows}</div>` : ""}</div>`
    : "";

  return `<article class="graduate-card">
    ${image}
    <div class="graduate-info">
      <h3>${escapeHtml(student.name)}</h3>
      ${student.program ? `<p class="graduate-program">${escapeHtml(student.program)}</p>` : ""}
      ${details ? `<div class="graduate-meta">${details}</div>` : ""}
      ${hours}
    </div>
  </article>`;
}

function renderGraduatePage() {
  const students = Array.isArray(window.GRADUATE_STUDENTS)
    ? window.GRADUATE_STUDENTS.map(normaliseGraduateStudent)
    : [];

  graduateGrid.innerHTML = students.length
    ? students.map(renderGraduateCard).join("")
    : `<div class="empty-page-state"><h3>Graduate student names are ready to be added</h3><p>Edit <code>graduate-students-data.js</code> with entries such as <code>{ name: "Student Name", program: "M.S. Mathematics", "Link to Picture": "https://example.edu/photo.jpg", Email: "student@example.edu", Office: "Room 123", "Office Hours": { "Appointment Note": "(or by appointment)", "Entries": [{ "Day": "Tuesday", "Time": "2 - 4 PM" }] } }</code>.</p></div>`;
}

function renderFloorViewer() {
  const floor = buildingFloors.find((item) => item.id === state.selectedFloor) || buildingFloors[0];
  floorViewer.innerHTML = `<div class="floor-viewer-heading"><p class="eyebrow">Selected floor</p><h3>${escapeHtml(floor.label)}</h3></div>
    <div class="map-image-wrap"><img class="floor-map-image" src="${escapeHtml(floor.image)}" alt="${escapeHtml(floor.label)} building map" /><div class="map-missing" hidden><strong>${escapeHtml(floor.label)} map image</strong><span>Add ${escapeHtml(floor.image)} to display this floor plan.</span></div></div>`;

  const image = floorViewer.querySelector(".floor-map-image");
  const missing = floorViewer.querySelector(".map-missing");
  const showMissing = () => {
    image.hidden = true;
    missing.hidden = false;
  };
  image.addEventListener("error", showMissing, { once: true });
  if (image.complete && image.naturalWidth === 0) showMissing();
}

function renderFloorList() {
  floorList.innerHTML = buildingFloors.map((floor) => `<button class="floor-button${floor.id === state.selectedFloor ? " is-active" : ""}" type="button" role="tab" aria-selected="${floor.id === state.selectedFloor}" data-floor="${floor.id}">${escapeHtml(floor.label)}</button>`).join("");
  renderFloorViewer();
}

function showPage(page) {
  state.page = page;
  const pageNames = { faculty: "Faculty", graduate: "Graduate Students", building: "Building Map" };
  currentPageLabel.textContent = pageNames[page] || "Faculty";
  currentPageLabel.classList.remove("is-entering");
  void currentPageLabel.offsetWidth;
  currentPageLabel.classList.add("is-entering");
  floorNavigation.hidden = page !== "building";
  document.querySelectorAll("[data-page-content]").forEach((content) => {
    const belongsToPage = content.dataset.pageContent === page;
    content.hidden = content === loadingState
      ? !belongsToPage || state.facultyLoaded
      : !belongsToPage;
  });
  document.querySelectorAll(".page-button").forEach((button) => {
    const active = button.dataset.page === page;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  dashboard.scrollTo({ top: 0, behavior: "smooth" });
}

function openModal(index) {
  const [name, person] = state.faculty[index] || [];
  if (!person) return;
  const profileUrl = getProfileUrl(name);
  modalTitle.textContent = name;
  websiteFrame.title = `${name} faculty website`;
  iframeLoading.classList.remove("is-hidden");
  websiteFrame.src = profileUrl;
  modalBackdrop.hidden = false;
  document.body.classList.add("modal-open");
  modalClose.focus();
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.classList.remove("modal-open");
  websiteFrame.src = "about:blank";
}

async function loadFaculty() {
  try {
    const data = window.FACULTY_DATA || await (async () => {
      const response = await fetch("faculty.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`faculty.json returned ${response.status}`);
      return response.json();
    })();
    state.faculty = Array.isArray(data) ? data : Object.entries(data);
    state.facultyLoaded = true;
    loadingState.hidden = true;
    renderGrid();
  } catch (error) {
    loadingState.innerHTML = `<div><p><strong>Could not load the faculty directory.</strong></p><p>Check faculty-data.js or run this folder through a local web server.</p></div>`;
    console.error(error);
  }
}

document.querySelectorAll(".page-button").forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

floorList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-floor]");
  if (!button) return;
  state.selectedFloor = Number(button.dataset.floor);
  renderFloorList();
});

grid.addEventListener("click", (event) => {
  const card = event.target.closest(".faculty-card");
  if (card) openModal(Number(card.dataset.index));
});

grid.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.closest(".faculty-card")) {
    event.preventDefault();
    openModal(Number(event.target.closest(".faculty-card").dataset.index));
  }
});

modalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) closeModal();
});
websiteFrame.addEventListener("load", () => iframeLoading.classList.add("is-hidden"));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modalBackdrop.hidden) closeModal();
});

renderGraduatePage();
renderFloorList();
showPage("faculty");
loadFaculty();

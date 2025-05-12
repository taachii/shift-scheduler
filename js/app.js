// 1) Definicja zmian (numer → start, end, kolor)
const shifts = {
  "1":    { start: "06:00", end: "14:00", hours: 8,  color: "#28a745" },
  "2":    { start: "14:00", end: "22:00", hours: 8,  color: "#ffc107" },
  "3":    { start: "15:00", end: "20:00", hours: 5,  color: "#17a2b8" },
  "3*":   { start: "16:00", end: "20:00", hours: 4,  color: "#dc3545" },
  "4":    { start: "09:00", end: "21:00", hours: 12, color: "#6f42c1" },
  "4S":   { start: "09:00", end: "22:00", hours: 13, color: "#fd7e14" },
  "5":    { start: "10:00", end: "20:00", hours: 10, color: "#9b4ecc" },
  "4;6R": { start: "09:00", end: "15:00", hours: 6,  color: "#007bff" },
  "4;6P": { start: "15:00", end: "21:00", hours: 6,  color: "#e83e8c" }
};

// 2) Stan aplikacji
let current = new Date();
const STORAGE_KEY = "grafikZmian";
function loadData() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
}
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// 2a) Compute hours (hh:mm → liczba godzin, uwzględnia noc)
function computeHours(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let s = sh * 60 + sm,
      e = eh * 60 + em,
      diff = e - s;
  if (diff < 0) diff += 24 * 60;
  return parseFloat((diff / 60).toFixed(2));
}

// 3) Legenda
function renderLegend() {
  const ul = document.getElementById("legendList");
  ul.innerHTML = "";
  for (let num in shifts) {
    const { start, end, color } = shifts[num];
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="color-box" style="background:${color}"></span>
      Zmiana ${num}: ${start}–${end}
    `;
    ul.appendChild(li);
  }
}

// 4) Rysowanie kalendarza
function renderCalendar() {
  const data = loadData(),
        cal  = document.getElementById("calendar");
  cal.innerHTML = "";

  const year       = current.getFullYear(),
        month      = current.getMonth(),
        monthNames = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
                      "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];

  const now      = new Date(),
        todayStr = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0")
        ].join("-");

  document.getElementById("monthLabel").textContent = `${monthNames[month]} ${year}`;

  ["Pn","Wt","Śr","Cz","Pt","Sb","Nd"].forEach(wd => {
    const hd = document.createElement("div");
    hd.className = "weekday";
    hd.textContent = wd;
    cal.appendChild(hd);
  });

  const firstDay    = new Date(year, month, 1).getDay(),
        offset      = (firstDay + 6) % 7,
        daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < offset; i++) {
    const d = document.createElement("div");
    d.className = "day empty";
    cal.appendChild(d);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell    = document.createElement("div");
    cell.className = "day";

    const dateStr = [
      year,
      String(month + 1).padStart(2, "0"),
      String(d).padStart(2, "0")
    ].join("-");

    cell.dataset.date = dateStr;
    cell.innerHTML = `<div class="date">${d}</div>`;

    if (dateStr === todayStr) {
      cell.classList.add("today");
    }

    const entry = data[dateStr];
    if (entry) {
      cell.classList.add("shift");
      if (entry.done) cell.classList.add("done");

      if (entry.shift) {
        const s = shifts[entry.shift];
        cell.style.background = s.color;
        cell.innerHTML += `<div class="shift-label">Zm. ${entry.shift}</div>`;
      } else if (entry.custom) {
        cell.style.background = "#6c757d";
        cell.innerHTML += `<div class="shift-label">${entry.start}–${entry.end}</div>`;
      }
    }

    cell.addEventListener("click", () => onDayClick(dateStr));
    cal.appendChild(cell);
  }

  const used = offset + daysInMonth,
        trailing = (7 - (used % 7)) % 7;
  for (let i = 0; i < trailing; i++) {
    const d = document.createElement("div");
    d.className = "day empty";
    cal.appendChild(d);
  }

  updateSummary();
}

// 5) Modal
function onDayClick(dateStr) {
  const data  = loadData(),
        entry = data[dateStr] || {},
        modal = document.getElementById("modal"),
        body  = document.getElementById("modalBody");

  const dayNames = ["Niedziela","Poniedziałek","Wtorek","Środa","Czwartek","Piątek","Sobota"],
        dow      = dayNames[new Date(dateStr).getDay()];

  body.innerHTML = `
    <p>Data: <strong>${dateStr}</strong> (<em>${dow}</em>)</p>
    <label>Numer zmiany:
      <select id="shiftSelect">
        <option value="">– brak –</option>
        ${Object.keys(shifts).map(n =>
          `<option value="${n}" ${entry.shift === n ? "selected" : ""}>${n}</option>`
        ).join("")}
        <option value="custom" ${entry.custom ? "selected" : ""}>Niestandardowa</option>
      </select>
    </label>
    <div id="details"></div>
    <div id="customFields" class="hidden">
      <label>Godzina rozpoczęcia:<input type="time" id="customStart" value="${entry.custom ? entry.start : ""}"></label>
      <label>Godzina zakończenia:<input type="time" id="customEnd"   value="${entry.custom ? entry.end   : ""}"></label>
    </div>
    <label class="checkbox-label">
      <input type="checkbox" id="doneChk" ${entry.done ? "checked" : ""}>
      Zmiana odbyta
    </label>
    <button id="saveBtn">Zapisz</button>
  `;

  const sel       = body.querySelector("#shiftSelect"),
        details   = body.querySelector("#details"),
        customDiv = body.querySelector("#customFields"),
        inpStart  = body.querySelector("#customStart"),
        inpEnd    = body.querySelector("#customEnd"),
        doneChk   = body.querySelector("#doneChk");

  function showDetails() {
    const val = sel.value;
    details.innerHTML = "";
    customDiv.classList.add("hidden");

    if (val === "custom") {
      customDiv.classList.remove("hidden");
      if (inpStart.value && inpEnd.value) {
        const hrs = computeHours(inpStart.value, inpEnd.value);
        details.innerHTML = `<p>Liczba godzin: ${hrs}</p>`;
      }
    } else if (val && shifts[val]) {
      const s = shifts[val];
      details.innerHTML = `
        <p>Godziny: ${s.start}–${s.end}</p>
        <p>Liczba godzin: ${s.hours}</p>
      `;
      inpStart.value = "";
      inpEnd.value = "";
    }
  }

  sel.addEventListener("change", showDetails);
  inpStart.addEventListener("input", showDetails);
  inpEnd.addEventListener("input", showDetails);
  showDetails();

  body.querySelector("#saveBtn").onclick = () => {
    const done = doneChk.checked;
    if (sel.value === "custom") {
      if (!inpStart.value || !inpEnd.value) {
        alert("Podaj godziny startu i końca.");
        return;
      }
      const hrs = computeHours(inpStart.value, inpEnd.value);
      data[dateStr] = { custom: true, start: inpStart.value, end: inpEnd.value, hours: hrs, done };
    }
    else if (sel.value && shifts[sel.value]) {
      data[dateStr] = { shift: sel.value, done };
    }
    else {
      delete data[dateStr];
    }
    saveData(data);
    closeModal();
    renderCalendar();
  };

  document.getElementById("closeModal").onclick = closeModal;
  modal.classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

// 6) Podsumowanie
function updateSummary() {
  const data = loadData();
  let totalScheduled = 0;
  let totalDone      = 0;

  const year  = current.getFullYear(),
        month = current.getMonth() + 1;

  for (let dateStr in data) {
    const [y, m] = dateStr.split("-").map(Number);
    if (y === year && m === month) {
      const e = data[dateStr];
      if (e.shift) {
        totalScheduled += shifts[e.shift].hours;
        if (e.done) totalDone += shifts[e.shift].hours;
      }
      else if (e.custom) {
        totalScheduled += e.hours;
        if (e.done) totalDone += e.hours;
      }
    }
  }

  const rate = 31;
  const percentDone = totalScheduled > 0
    ? ((totalDone / totalScheduled) * 100).toFixed(2)
    : "0.00";

  document.getElementById("totalHours").textContent   = totalScheduled;
  document.getElementById("totalPay").textContent     = (totalScheduled * rate).toFixed(2);
  document.getElementById("percentDone").textContent  = percentDone;
}

// 7) Nawigacja
document.getElementById("prev").onclick = () => {
  current.setMonth(current.getMonth() - 1);
  renderCalendar();
};
document.getElementById("next").onclick = () => {
  current.setMonth(current.getMonth() + 1);
  renderCalendar();
};

// 8) Przycisk do pokazywania/ukrywania legendy
document.getElementById("toggleLegendBtn").addEventListener("click", () => {
  const legend = document.querySelector(".legend");
  const btn = document.getElementById("toggleLegendBtn");
  legend.classList.toggle("hidden");
  btn.textContent = legend.classList.contains("hidden")
    ? "Pokaż legendę zmian"
    : "Ukryj legendę zmian";
});

// start
renderLegend();
renderCalendar();

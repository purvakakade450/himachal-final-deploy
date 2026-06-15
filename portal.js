import { initForecast } from "./app.js";
import { initMapReports, initPrecipMap } from "./map-reports.js";

let precipMapLoaded = false;

function initTabs() {
  const panels  = document.querySelectorAll(".panel");
  const allTabs = document.querySelectorAll(".tabnav .tab, .mobile-tabnav .mtab");

  function showPanel(panelId) {
    panels.forEach(p => {
      p.classList.toggle("active", p.id === panelId);
      p.hidden = p.id !== panelId;
    });
    allTabs.forEach(t => {
      const on = t.dataset.panel === panelId;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", String(on));
    });

    const fb = document.getElementById("feedback-footer");
    if (panelId === "panel-reported") {
      window.dispatchEvent(new Event("hp-map-visible"));
      fb?.classList.add("is-disabled");
    } else if (panelId === "panel-rainfall") {
      if (!precipMapLoaded) {
        precipMapLoaded = true;
        setTimeout(() => initPrecipMap(), 150);
      } else {
        setTimeout(() => window.dispatchEvent(new Event("precip-map-resize")), 80);
      }
      fb?.classList.toggle("is-disabled",
        !document.getElementById("dashboard")?.classList.contains("visible"));
    } else {
      fb?.classList.add("is-disabled");
    }
    history.replaceState(null, "",
      panelId === "panel-reported" ? "#reported-floods" :
      panelId === "panel-about"    ? "#about" : "#rainfall");
  }

  allTabs.forEach(t => t.addEventListener("click", () => showPanel(t.dataset.panel)));

  // Collapse button for float panel
  const colBtn = document.getElementById("fp-collapse-btn");
  const panel  = document.getElementById("float-panel");
  colBtn?.addEventListener("click", () => {
    panel?.classList.toggle("collapsed");
    setTimeout(() => window.dispatchEvent(new Event("precip-map-resize")), 250);
  });
  initDraggablePanel(panel);

  const hash = window.location.hash.replace("#", "");
  showPanel(hash === "reported-floods" ? "panel-reported" :
            hash === "about"           ? "panel-about" : "panel-rainfall");
}

function initDraggablePanel(panel) {
  const handle = panel?.querySelector(".fp-header");
  if (!panel || !handle) return;

  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let dragging = false;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  handle.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input, select, textarea")) return;
    if (window.matchMedia("(max-width: 600px)").matches) return;

    const rect = panel.getBoundingClientRect();
    const appRect = document.querySelector(".app").getBoundingClientRect();
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left - appRect.left;
    startTop = rect.top - appRect.top;
    panel.classList.add("is-dragging");
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const appRect = document.querySelector(".app").getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    const nextLeft = startLeft + event.clientX - startX;
    const nextTop = startTop + event.clientY - startY;
    panel.style.left = `${clamp(nextLeft, 8, appRect.width - rect.width - 8)}px`;
    panel.style.top = `${clamp(nextTop, 8, appRect.height - rect.height - 8)}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  });

  function stopDrag(event) {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove("is-dragging");
    try {
      handle.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer capture already released */
    }
  }

  handle.addEventListener("pointerup", stopDrag);
  handle.addEventListener("pointercancel", stopDrag);
}

initTabs();
initForecast();
initMapReports();
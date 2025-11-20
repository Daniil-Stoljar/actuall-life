const map = L.map("map", {
  zoomControl: false,
}).setView([40.7128, -74.006], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

L.control.zoom({ position: "bottomright" }).addTo(map);

const categories = [
  ["block_party", { color: "#ff6b6b", label: "Block party" }],
  ["police", { color: "#1e90ff", label: "Police / safety" }],
  ["traffic", { color: "#ffa500", label: "Traffic / transit" }],
  ["community", { color: "#2ecc71", label: "Community gathering" }],
  ["other", { color: "#8e44ad", label: "Other" }],
];

const categoryStyles = Object.fromEntries(categories);

let selectedLatLng = null;
let selectionMarker = null;
const markersLayer = L.layerGroup().addTo(map);

const pinForm = document.getElementById("pin-form");
const activityList = document.getElementById("activity-list");
const locationReadout = document.getElementById("location-readout");
const legendFilters = document.getElementById("legend-filters");
const clearPinsBtn = document.getElementById("clear-pins");
const locateMeBtn = document.getElementById("locate-me");

const storageKey = "community-pins-v1";
const filterKey = "community-pins-filters-v1";

const activeCategories = new Set(loadFilters());

function loadFilters() {
  try {
    const saved = localStorage.getItem(filterKey);
    return saved ? JSON.parse(saved) : categories.map(([key]) => key);
  } catch (e) {
    console.error("Could not parse saved filters", e);
    return categories.map(([key]) => key);
  }
}

function saveFilters() {
  localStorage.setItem(filterKey, JSON.stringify(Array.from(activeCategories)));
}

function renderLegend() {
  legendFilters.innerHTML = "";

  categories.forEach(([key, meta]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `legend__item${
      activeCategories.has(key) ? " is-active" : ""
    }`;
    button.style.color = meta.color;
    button.textContent = meta.label;
    button.dataset.category = key;
    legendFilters.appendChild(button);
  });
}

function loadPins() {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Could not parse saved pins", e);
    return [];
  }
}

function savePins(pins) {
  localStorage.setItem(storageKey, JSON.stringify(pins));
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function renderPins() {
  markersLayer.clearLayers();
  const pins = loadPins().filter((pin) => activeCategories.has(pin.category));

  if (!pins.length) {
    activityList.innerHTML =
      '<div class="empty-state">No pins yet. Click the map to add one!</div>';
    return;
  }

  activityList.innerHTML = "";

  pins.forEach((pin) => {
    const style = categoryStyles[pin.category] || categoryStyles.other;
    const marker = L.circleMarker([pin.lat, pin.lng], {
      radius: 11,
      color: style.color,
      fillColor: style.color,
      fillOpacity: 0.22,
      weight: 3,
    }).addTo(markersLayer);

    marker.bindPopup(`
      <strong>${pin.title}</strong><br />
      <small>${style.label}</small><br />
      <p style="margin:6px 0 0; max-width: 220px;">${
        pin.description
          ? pin.description.replace(/</g, "&lt;")
          : "No details provided."
      }</p>
      <small>Posted ${formatTime(pin.createdAt)}</small>
    `);

    const card = document.createElement("article");
    card.className = "activity-card";
    card.innerHTML = `
      <div class="activity-card__meta">
        <span class="tag" style="color:${style.color}">${style.label}</span>
        <span>${formatTime(pin.createdAt)}</span>
      </div>
      <h3 style="margin:0;">${pin.title}</h3>
      <p style="margin:0; color:#cbd5e1;">${
        pin.description || "No details provided."
      }</p>
      <p style="margin:0; color:#94a3b8; font-size:0.9rem;">${pin.lat.toFixed(
        4
      )}, ${pin.lng.toFixed(4)}</p>
    `;

    card.addEventListener("click", () => {
      map.setView([pin.lat, pin.lng], 15);
      marker.openPopup();
    });

    activityList.appendChild(card);
  });
}

function setSelection(latlng) {
  selectedLatLng = latlng;
  if (selectionMarker) {
    selectionMarker.setLatLng(latlng);
  } else {
    selectionMarker = L.circleMarker(latlng, {
      radius: 10,
      color: "#22d3ee",
      fillColor: "#22d3ee",
      fillOpacity: 0.3,
      dashArray: "4 4",
    }).addTo(map);
  }
  locationReadout.textContent = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(
    5
  )}`;
  locationReadout.style.color = "";
}

function toggleCategory(category) {
  if (activeCategories.has(category) && activeCategories.size === 1) {
    return; // keep at least one category active
  }

  if (activeCategories.has(category)) {
    activeCategories.delete(category);
  } else {
    activeCategories.add(category);
  }

  saveFilters();
  renderLegend();
  renderPins();
}

map.on("click", (evt) => {
  setSelection(evt.latlng);
});

legendFilters.addEventListener("click", (event) => {
  if (event.target instanceof HTMLButtonElement) {
    toggleCategory(event.target.dataset.category);
  }
});

clearPinsBtn.addEventListener("click", () => {
  const pins = loadPins();
  if (!pins.length) return;
  if (confirm("Clear all saved pins from this browser?")) {
    localStorage.removeItem(storageKey);
    renderPins();
  }
});

locateMeBtn.addEventListener("click", () => {
  if (!navigator.geolocation) return;
  locateMeBtn.disabled = true;
  locateMeBtn.textContent = "Locating…";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const latlng = { lat: latitude, lng: longitude };
      map.setView([latitude, longitude], 14);
      setSelection(latlng);
      locateMeBtn.disabled = false;
      locateMeBtn.textContent = "Use my location";
    },
    () => {
      locationReadout.textContent = "Unable to fetch your location.";
      locationReadout.style.color = "#f472b6";
      locateMeBtn.disabled = false;
      locateMeBtn.textContent = "Use my location";
    },
    { enableHighAccuracy: true, timeout: 5000 }
  );
});

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 13);
    },
    () => {
      // Ignore errors and keep default center.
    },
    { enableHighAccuracy: true, timeout: 5000 }
  );
}

pinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedLatLng) {
    locationReadout.textContent = "Pick a spot on the map before posting.";
    locationReadout.style.color = "#f472b6";
    return;
  }

  const pins = loadPins();
  const formData = new FormData(pinForm);

  pins.unshift({
    id: crypto.randomUUID(),
    title: formData.get("title").trim(),
    category: formData.get("category"),
    description: formData.get("description").trim(),
    lat: selectedLatLng.lat,
    lng: selectedLatLng.lng,
    createdAt: Date.now(),
  });

  savePins(pins);
  renderPins();
  pinForm.reset();
  locationReadout.textContent = "Tap the map to set a spot";
  locationReadout.style.color = "";
});

renderLegend();
renderPins();

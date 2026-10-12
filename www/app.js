import { createClient } from "@supabase/supabase-js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";

const SUPABASE_URL = "https://gtklutfnugqkntdiedqh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_vTDNH6vyrKxEbW5p3iwpkw_GqOnVHtK";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const map = L.map("map", { zoomControl: false }).setView([18.7883, 98.9853], 11);
L.control.zoom({ position: "topright" }).addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const markerById = new Map();
const cardById = new Map();
const categoryColors = new Map();
const colorPalette = [
    "#2f855a", "#2b6cb0", "#dd6b20", "#805ad5",
    "#d53f8c", "#319795", "#c53030", "#718096"
];

const statusElement = document.querySelector("#status");
const searchInput = document.querySelector("#searchInput");
const placeList = document.querySelector("#placeList");
const summaryElement = document.querySelector("#summary");
const categoryFilters = document.querySelector("#categoryFilters");
const mapLegend = document.querySelector("#mapLegend");

let allPlaces = [];
let activeCategory = "ทั้งหมด";

function escapeHtml(value) {
    return String(value ?? "-").replace(/[&<>'"]/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        "'": "&#39;", '"': "&quot;"
    })[character]);
}

function getCategories(places = allPlaces) {
    return [...new Set(places.map((place) => place.category).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "th"));
}

function colorForCategory(category) {
    if (!categoryColors.has(category)) {
        categoryColors.set(category, colorPalette[categoryColors.size % colorPalette.length]);
    }
    return categoryColors.get(category);
}

function createPopup(place) {
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    const destination = encodeURIComponent(`${latitude},${longitude}`);
    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

    return `
        <article>
            <h2 class="popup-title">${escapeHtml(place.id)}. ${escapeHtml(place.name)}</h2>
            <div class="popup-category">
                <span class="popup-dot" style="background:${colorForCategory(place.category)}"></span>
                ${escapeHtml(place.category)}
            </div>
            <p class="popup-row"><strong>พื้นที่:</strong> ต.${escapeHtml(place.subdistrict)} อ.${escapeHtml(place.district)}</p>
            <p class="popup-row"><strong>เวลาเปิด–ปิด:</strong> ${escapeHtml(place.opening_hours)}</p>
            <p class="popup-row"><strong>พิกัด:</strong> ${latitude.toFixed(5)}, ${longitude.toFixed(5)}</p>
            <a class="navigate-button" href="${navigationUrl}" target="_blank" rel="noopener noreferrer">
                🧭 เปิดเส้นทางใน Google Maps
            </a>
        </article>
    `;
}

function updateSummary(places) {
    const districtCount = new Set(places.map((place) => place.district).filter(Boolean)).size;
    const categoryCount = getCategories(places).length;
    summaryElement.innerHTML = `
        <div class="summary-item"><span class="summary-value">${places.length}</span><span class="summary-label">สถานที่</span></div>
        <div class="summary-item"><span class="summary-value">${categoryCount}</span><span class="summary-label">ประเภท</span></div>
        <div class="summary-item"><span class="summary-value">${districtCount}</span><span class="summary-label">อำเภอ</span></div>
    `;
}

function renderLegend() {
    const items = getCategories().map((category) => `
        <div class="legend-item">
            <span class="legend-dot" style="background:${colorForCategory(category)}"></span>
            <span>${escapeHtml(category)}</span>
        </div>
    `).join("");

    mapLegend.innerHTML = `
        <div class="legend-title">ประเภทสถานที่</div>
        <div class="legend-items">${items}</div>
    `;
}

function renderCategoryFilters() {
    categoryFilters.innerHTML = "";
    ["ทั้งหมด", ...getCategories()].forEach((category) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "filter-chip";
        button.textContent = category;
        button.classList.toggle("active", category === activeCategory);
        button.setAttribute("aria-pressed", String(category === activeCategory));
        button.addEventListener("click", () => {
            activeCategory = category;
            renderCategoryFilters();
            applyFilters();
        });
        categoryFilters.appendChild(button);
    });
}

function markSelectedPlace(placeId, scrollCard = false) {
    markerById.forEach((marker, id) => {
        marker.setStyle({
            radius: id === placeId ? 12 : 8,
            weight: id === placeId ? 3 : 2,
            fillOpacity: id === placeId ? 1 : 0.9
        });
    });
    cardById.forEach((card, id) => card.classList.toggle("active", id === placeId));

    const activeCard = cardById.get(placeId);
    if (scrollCard && activeCard) {
        activeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

function showPlace(place) {
    const marker = markerById.get(place.id);
    if (!marker) return;
    markSelectedPlace(place.id);
    map.flyTo([place.latitude, place.longitude], 16, { duration: 0.8 });
    marker.openPopup();
}

function renderPlaces(places) {
    markerLayer.clearLayers();
    markerById.clear();
    cardById.clear();
    placeList.innerHTML = "";
    const bounds = [];

    places.forEach((place) => {
        const latitude = Number(place.latitude);
        const longitude = Number(place.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        const marker = L.circleMarker([latitude, longitude], {
            radius: 8,
            color: "#ffffff",
            weight: 2,
            fillColor: colorForCategory(place.category),
            fillOpacity: 0.9
        }).bindPopup(createPopup(place)).addTo(markerLayer);

        marker.on("click", () => markSelectedPlace(place.id, true));
        markerById.set(place.id, marker);
        bounds.push([latitude, longitude]);

        const card = document.createElement("article");
        card.className = "place-card";
        card.tabIndex = 0;
        card.innerHTML = `
            <h2>${escapeHtml(place.id)}. ${escapeHtml(place.name)}</h2>
            <p>${escapeHtml(place.category)}</p>
            <p>ต.${escapeHtml(place.subdistrict)} · อ.${escapeHtml(place.district)}</p>
            <p>🕒 ${escapeHtml(place.opening_hours)}</p>
        `;
        card.addEventListener("click", () => showPlace(place));
        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                showPlace(place);
            }
        });
        cardById.set(place.id, card);
        placeList.appendChild(card);
    });

    if (places.length === 0) {
        placeList.innerHTML = `
            <div class="empty-state"><strong>ไม่พบสถานที่</strong>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</div>
        `;
    }

    statusElement.textContent = `แสดง ${places.length} จาก ${allPlaces.length} สถานที่`;
    updateSummary(places);
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [45, 45], maxZoom: 12 });
}

function applyFilters() {
    const keyword = searchInput.value.trim().toLowerCase();
    const filteredPlaces = allPlaces.filter((place) => {
        const matchesCategory = activeCategory === "ทั้งหมด" || place.category === activeCategory;
        const searchableText = [place.name, place.category, place.subdistrict, place.district]
            .join(" ").toLowerCase();
        return matchesCategory && searchableText.includes(keyword);
    });
    renderPlaces(filteredPlaces);
}

async function loadPlaces() {
    statusElement.textContent = "กำลังโหลดข้อมูล...";
    const { data, error } = await supabase.from("places").select("*").order("id", { ascending: true });

    if (error) {
        console.error("Supabase error:", error);
        statusElement.textContent = "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่";
        placeList.innerHTML = `
            <div class="empty-state"><strong>เชื่อมต่อฐานข้อมูลไม่สำเร็จ</strong>กรุณารีเฟรชหน้าเว็บอีกครั้ง</div>
        `;
        return;
    }

    allPlaces = data ?? [];
    getCategories().forEach(colorForCategory);
    renderCategoryFilters();
    renderLegend();
    applyFilters();
}

searchInput.addEventListener("input", applyFilters);
loadPlaces();

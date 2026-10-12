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

const streetMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});

const satelliteMap = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
        maxZoom: 19,
        attribution:
            "Tiles &copy; Esri &mdash; Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community"
    }
);

streetMap.addTo(map);

L.control.layers(
    {
        "🗺️ แผนที่ถนน": streetMap,
        "🛰️ ภาพถ่ายดาวเทียม": satelliteMap
    },
    {},
    {
        position: "topleft",
        collapsed: false
    }
).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);
const userLocationLayer = L.layerGroup().addTo(map);
const markerById = new Map();
const cardById = new Map();
const categoryColors = new Map();
const colorPalette = [
    "#2f855a", "#2b6cb0", "#dd6b20", "#805ad5",
    "#d53f8c", "#319795", "#c53030", "#718096"
];
const routeColors = ["#e53e3e", "#3182ce", "#805ad5"];
const placeImages = new Map([
    [1, {
        url: "https://commons.wikimedia.org/wiki/Special:Redirect/file/อ่างแก้ว_มหาวิทยาลัยเชียงใหม่_-_panoramio.jpg?width=900",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:อ่างแก้ว_มหาวิทยาลัยเชียงใหม่_-_panoramio.jpg",
        credit: "::::=UT=:::: · CC BY-SA 3.0"
    }],
    [12, {
        url: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chiang_Mai_-_Wat_Umong_Maha_Therachan_-_0001.jpg?width=900",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Chiang_Mai_-_Wat_Umong_Maha_Therachan_-_0001.jpg",
        credit: "Stefan Fussan · CC BY-SA 3.0"
    }]
]);

const statusElement = document.querySelector("#status");
const searchInput = document.querySelector("#searchInput");
const placeList = document.querySelector("#placeList");
const summaryElement = document.querySelector("#summary");
const categoryFilters = document.querySelector("#categoryFilters");
const mapLegend = document.querySelector("#mapLegend");
const routeDestination = document.querySelector("#routeDestination");
const nearestResult = document.querySelector("#nearestResult");
const routeResult = document.querySelector("#routeResult");
const calculateRoutesButton = document.querySelector("#calculateRoutes");
const useMyLocationButton = document.querySelector("#useMyLocation");
const pickLocationButton = document.querySelector("#pickLocation");

let allPlaces = [];
let activeCategory = "ทั้งหมด";
let currentPosition = null;
let isPickingLocation = false;

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

function haversineDistance(startLatitude, startLongitude, endLatitude, endLongitude) {
    const earthRadiusKm = 6371.0088;
    const toRadians = (degrees) => degrees * Math.PI / 180;
    const latitudeDifference = toRadians(endLatitude - startLatitude);
    const longitudeDifference = toRadians(endLongitude - startLongitude);
    const a =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(toRadians(startLatitude)) *
        Math.cos(toRadians(endLatitude)) *
        Math.sin(longitudeDifference / 2) ** 2;

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(metres) {
    if (metres < 1000) return `${Math.round(metres)} ม.`;
    return `${(metres / 1000).toFixed(1)} กม.`;
}

function formatDuration(seconds) {
    const totalMinutes = Math.round(seconds / 60);
    if (totalMinutes < 60) return `${totalMinutes} นาที`;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours} ชม. ${minutes} นาที` : `${hours} ชม.`;
}

function createPlaceMedia(place, variant = "card") {
    const media = place.image_url
        ? {
            url: place.image_url,
            sourceUrl: place.image_source_url || place.image_url,
            credit: place.image_credit || "ภาพสถานที่"
        }
        : placeImages.get(Number(place.id));

    if (!media) {
        return `
            <div class="place-media place-media-${variant} place-media-placeholder" aria-label="ยังไม่มีภาพสถานที่">
                <span aria-hidden="true">🌿</span>
                <small>ยังไม่มีภาพสถานที่</small>
            </div>
        `;
    }

    return `
        <figure class="place-media place-media-${variant}">
            <img src="${escapeHtml(media.url)}" alt="ภาพ ${escapeHtml(place.name)}" loading="lazy">
            <figcaption>
                <a href="${escapeHtml(media.sourceUrl)}" target="_blank" rel="noopener noreferrer">
                    ${escapeHtml(media.credit)}
                </a>
            </figcaption>
        </figure>
    `;
}

function createPopup(place) {
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    const destination = encodeURIComponent(`${latitude},${longitude}`);
    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

    return `
        <article>
            ${createPlaceMedia(place, "popup")}
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

function populateDestinationOptions() {
    routeDestination.innerHTML = allPlaces.map((place) => `
        <option value="${escapeHtml(place.id)}">${escapeHtml(place.id)}. ${escapeHtml(place.name)}</option>
    `).join("");
}

function showCurrentPositionOnMap(position) {
    userLocationLayer.clearLayers();

    const locationIcon = L.divIcon({
        className: "",
        html: '<div class="user-location-marker"><span class="user-location-dot"></span></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });

    L.marker([position.latitude, position.longitude], {
        icon: locationIcon,
        zIndexOffset: 1000
    })
        .bindTooltip(position.label || "ตำแหน่งของฉัน", { permanent: false, direction: "top" })
        .addTo(userLocationLayer);
}

function stopPickingLocation() {
    isPickingLocation = false;
    document.querySelector("#map").classList.remove("picking-location");
    pickLocationButton.classList.remove("active");
    pickLocationButton.textContent = "✚ เลือกบนแผนที่";
}

function setCurrentPosition(latitude, longitude, label) {
    currentPosition = { latitude, longitude, label };
    showCurrentPositionOnMap(currentPosition);
    stopPickingLocation();
    findNearestPlace();
}

function findNearestPlace() {
    if (!currentPosition) {
        nearestResult.innerHTML = '<div class="result-message error">กรุณากดค้นหาตำแหน่งของฉันก่อน</div>';
        return;
    }

    const candidates = allPlaces
        .map((place) => ({
            place,
            distance: haversineDistance(
                currentPosition.latitude,
                currentPosition.longitude,
                Number(place.latitude),
                Number(place.longitude)
            )
        }))
        .filter(({ distance }) => Number.isFinite(distance))
        .sort((first, second) => first.distance - second.distance);

    if (!candidates.length) {
        nearestResult.innerHTML = '<div class="result-message error">ไม่มีข้อมูลพิกัดที่ใช้คำนวณได้</div>';
        return;
    }

    const nearest = candidates[0];
    routeLayer.clearLayers();
    nearestResult.innerHTML = `
        <div class="nearest-result" role="button" tabindex="0">
            <strong>${escapeHtml(nearest.place.name)}</strong><br>
            ระยะเส้นตรงประมาณ ${(nearest.distance).toFixed(2)} กม.<br>
            <span>${escapeHtml(currentPosition.label)} (${currentPosition.latitude.toFixed(5)}, ${currentPosition.longitude.toFixed(5)})</span><br>
            <span>คลิกเพื่อดูบนแผนที่</span>
        </div>
    `;

    const resultCard = nearestResult.querySelector(".nearest-result");
    const openNearest = () => {
        activeCategory = "ทั้งหมด";
        searchInput.value = "";
        renderCategoryFilters();
        applyFilters();
        showPlace(nearest.place);
    };
    resultCard.addEventListener("click", openNearest);
    resultCard.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openNearest();
        }
    });

    map.fitBounds([
        [currentPosition.latitude, currentPosition.longitude],
        [nearest.place.latitude, nearest.place.longitude]
    ], { padding: [55, 55], maxZoom: 14 });
}

function highlightRoute(routeEntries, selectedIndex) {
    routeEntries.forEach((entry, index) => {
        entry.line.setStyle({
            weight: index === selectedIndex ? 8 : 5,
            opacity: index === selectedIndex ? 0.95 : 0.45
        });
        if (index === selectedIndex) entry.line.bringToFront();
    });

    routeResult.querySelectorAll(".route-result-card").forEach((card, index) => {
        card.classList.toggle("active", index === selectedIndex);
    });

    map.fitBounds(routeEntries[selectedIndex].line.getBounds(), { padding: [55, 55] });
}

async function calculateRoutes() {
    const start = currentPosition;
    const destination = allPlaces.find(
        (place) => String(place.id) === routeDestination.value
    );

    if (!start) {
        routeResult.innerHTML = '<div class="result-message error">กรุณากดค้นหาตำแหน่งของฉันก่อนคำนวณเส้นทาง</div>';
        return;
    }
    if (!destination) {
        routeResult.innerHTML = '<div class="result-message error">กรุณาเลือกสถานที่ปลายทาง</div>';
        return;
    }

    calculateRoutesButton.disabled = true;
    calculateRoutesButton.textContent = "กำลังคำนวณ...";
    routeResult.innerHTML = '<div class="result-message">กำลังค้นหาเส้นทางบนโครงข่ายถนน...</div>';
    routeLayer.clearLayers();

    const startPair = `${start.longitude},${start.latitude}`;
    const endPair = `${Number(destination.longitude)},${Number(destination.latitude)}`;
    const requestUrl =
        `https://router.project-osrm.org/route/v1/driving/${startPair};${endPair}` +
        "?alternatives=3&steps=false&geometries=geojson&overview=full";

    try {
        const response = await fetch(requestUrl);
        if (!response.ok) throw new Error(`Routing service returned ${response.status}`);

        const result = await response.json();
        if (result.code !== "Ok" || !result.routes?.length) {
            throw new Error(result.message || "No route found");
        }

        const routes = [...result.routes]
            .sort((first, second) => first.distance - second.distance)
            .slice(0, 3);
        const routeEntries = routes.map((route, index) => {
            const line = L.geoJSON(route.geometry, {
                style: {
                    color: routeColors[index],
                    weight: index === 0 ? 8 : 5,
                    opacity: index === 0 ? 0.95 : 0.45
                }
            }).addTo(routeLayer);
            return { route, line };
        });

        L.circleMarker([destination.latitude, destination.longitude], {
            radius: 8, color: "#ffffff", weight: 3,
            fillColor: "#16a34a", fillOpacity: 1
        }).bindTooltip(destination.name).addTo(routeLayer);

        routeResult.innerHTML = `
            <div class="route-results">
                ${routeEntries.map(({ route }, index) => `
                    <div class="route-result-card ${index === 0 ? "active" : ""}"
                         style="--route-color:${routeColors[index]}" role="button" tabindex="0">
                        <span class="route-rank">${index + 1}</span>
                        <div>
                            <strong>เส้นทางอันดับ ${index + 1}</strong>
                            <div class="route-meta">${formatDistance(route.distance)} · ${formatDuration(route.duration)}</div>
                        </div>
                    </div>
                `).join("")}
            </div>
            ${routeEntries.length < 3
                ? `<div class="result-message">ระบบพบเส้นทางที่แตกต่างกัน ${routeEntries.length} เส้นทาง</div>`
                : ""}
        `;

        routeResult.querySelectorAll(".route-result-card").forEach((card, index) => {
            const chooseRoute = () => highlightRoute(routeEntries, index);
            card.addEventListener("click", chooseRoute);
            card.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    chooseRoute();
                }
            });
        });

        highlightRoute(routeEntries, 0);
    } catch (error) {
        console.error("Routing error:", error);
        routeResult.innerHTML = `
            <div class="result-message error">
                คำนวณเส้นทางไม่สำเร็จ กรุณาตรวจสอบพิกัดหรือทดลองใหม่ภายหลัง
            </div>
        `;
    } finally {
        calculateRoutesButton.disabled = false;
        calculateRoutesButton.textContent = "คำนวณเส้นทาง";
    }
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
            ${createPlaceMedia(place)}
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
    populateDestinationOptions();
    renderCategoryFilters();
    renderLegend();
    applyFilters();
}

searchInput.addEventListener("input", applyFilters);
calculateRoutesButton.addEventListener("click", calculateRoutes);

useMyLocationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
        nearestResult.innerHTML = '<div class="result-message error">เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง</div>';
        return;
    }

    useMyLocationButton.disabled = true;
    useMyLocationButton.textContent = "กำลังค้นหาตำแหน่ง...";
    navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
            useMyLocationButton.disabled = false;
            useMyLocationButton.textContent = "↻ อัปเดต GPS";
            setCurrentPosition(
                coords.latitude,
                coords.longitude,
                "ตำแหน่งจาก GPS"
            );
        },
        () => {
            nearestResult.innerHTML = '<div class="result-message error">ไม่สามารถอ่านตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์</div>';
            useMyLocationButton.disabled = false;
            useMyLocationButton.textContent = "◎ ใช้ GPS";
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
});

pickLocationButton.addEventListener("click", () => {
    if (isPickingLocation) {
        stopPickingLocation();
        nearestResult.innerHTML = "";
        return;
    }

    isPickingLocation = true;
    document.querySelector("#map").classList.add("picking-location");
    pickLocationButton.classList.add("active");
    pickLocationButton.textContent = "ยกเลิกการเลือก";
    nearestResult.innerHTML = `
        <div class="result-message">คลิกตำแหน่งที่ต้องการบนแผนที่</div>
    `;
});

map.on("click", ({ latlng }) => {
    if (!isPickingLocation) return;
    setCurrentPosition(latlng.lat, latlng.lng, "ตำแหน่งที่เลือกบนแผนที่");
});

loadPlaces();

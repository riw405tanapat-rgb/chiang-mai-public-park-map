import { createClient } from "@supabase/supabase-js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";

// ===== การเชื่อมต่อฐานข้อมูล =====
// Publishable key ใช้ฝั่งเบราว์เซอร์ได้ เพราะสิทธิ์อ่านข้อมูลถูกควบคุมด้วย RLS ใน Supabase
const SUPABASE_URL = "https://gtklutfnugqkntdiedqh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_vTDNH6vyrKxEbW5p3iwpkw_GqOnVHtK";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// ===== การสร้างแผนที่และชั้นแผนที่ฐาน =====
// กำหนดจุดศูนย์กลางเริ่มต้นที่ตัวเมืองเชียงใหม่ และเพิ่มปุ่มซูมเองเพื่อเลือกตำแหน่งได้
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

// ===== ชั้นข้อมูลและตัวแปรที่ใช้ควบคุมแผนที่ =====
// แยกหมุดสถานที่ เส้นทาง และตำแหน่งผู้ใช้ออกจากกัน เพื่อให้ล้าง/วาดใหม่ได้โดยไม่กระทบชั้นอื่น
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

// รูปสำรองของแต่ละสถานที่ ใช้เมื่อแถวข้อมูลใน Supabase ยังไม่มี image_url
const placeImages = new Map([
    [1, {
        url: "https://readthecloud.co/wp-content/uploads/2026/08/005_11zon.webp",
        sourceUrl: "https://readthecloud.co/wp-content/uploads/2026/08/005_11zon.webp",
        credit: "ที่มา: The Cloud"
    }],
    [2, {
        url: "https://cdn.chiangmainews.co.th/wp-content/uploads/2020/10/04110938/สถานที่-ฟาร์ม-900ไร่_200910_8.jpg",
        sourceUrl: "https://cdn.chiangmainews.co.th/wp-content/uploads/2020/10/04110938/สถานที่-ฟาร์ม-900ไร่_200910_8.jpg",
        credit: "ที่มา: Chiang Mai News"
    }],
    [3, {
        url: "https://www.cmhy.city/uploads/photos/157-Travel-by-CMHY/159-Park/17768-Princess-Mothers-Health-Garden/place17768_IMG_20190514_1648555-panorama.jpg",
        sourceUrl: "https://www.cmhy.city/uploads/photos/157-Travel-by-CMHY/159-Park/17768-Princess-Mothers-Health-Garden/place17768_IMG_20190514_1648555-panorama.jpg",
        credit: "ที่มา: CMHY.city"
    }],
    [4, {
        url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR_57Vtc7lntqMPu07w8IRB4KRshIe-ACRkHEhbsioQXledIgsyu4uTxqk&s=10",
        sourceUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR_57Vtc7lntqMPu07w8IRB4KRshIe-ACRkHEhbsioQXledIgsyu4uTxqk&s=10",
        credit: "ที่มา: Google Images (แคช)"
    }],
    [5, {
        url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSFK5RuZ6eFDQw3pYmp-ryE7ONjrly-KZEdrKQOHKoY-v5HX4HEoZB9eJE&s=10",
        sourceUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSFK5RuZ6eFDQw3pYmp-ryE7ONjrly-KZEdrKQOHKoY-v5HX4HEoZB9eJE&s=10",
        credit: "ที่มา: Google Images (แคช)"
    }],
    [6, {
        url: "https://f.ptcdn.info/954/073/000/qvb33pohr0ufi8QH4EC-o.jpg",
        sourceUrl: "https://f.ptcdn.info/954/073/000/qvb33pohr0ufi8QH4EC-o.jpg",
        credit: "ที่มา: Pantip CDN"
    }],
    [7, {
        url: "https://www.chiangmaitouring.com/wp-content/uploads/2014/01/C360_2014-01-16-09-18-06-477.jpg",
        sourceUrl: "https://www.chiangmaitouring.com/wp-content/uploads/2014/01/C360_2014-01-16-09-18-06-477.jpg",
        credit: "ที่มา: Chiang Mai Touring"
    }],
    [8, {
        url: "https://www.cmcity.go.th/data/content/2024/22456/cms/big/image_cms_cdilnpqsux57.jpg",
        sourceUrl: "https://www.cmcity.go.th/data/content/2024/22456/cms/big/image_cms_cdilnpqsux57.jpg",
        credit: "ที่มา: เทศบาลนครเชียงใหม่"
    }],
    [9, {
        url: "https://greeningupthailand.org/wp-content/uploads/2024/12/DJI_0278-1024x576.jpg",
        sourceUrl: "https://greeningupthailand.org/wp-content/uploads/2024/12/DJI_0278-1024x576.jpg",
        credit: "ที่มา: Greening Up Thailand"
    }],
    [10, {
        url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSnwaDgWOvrs0JMjajATRsmBh1ehMKhVQhQAOvrL2eCC7tbg0JGFYKd490S&s=10",
        sourceUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSnwaDgWOvrs0JMjajATRsmBh1ehMKhVQhQAOvrL2eCC7tbg0JGFYKd490S&s=10",
        credit: "ที่มา: Google Images (แคช)"
    }],
    [11, {
        url: `${import.meta.env.BASE_URL}images/park-11-front-church.png`,
        sourceUrl: `${import.meta.env.BASE_URL}images/park-11-front-church.png`,
        credit: "ภาพสวนหย่อมท่าน้ำหน้าโบสถ์"
    }],
    [12, {
        url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRCOk8S7PPwgBuNYswwrpjr_IXE3-r11PCnl-WhYd9H6Q&s=10",
        sourceUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRCOk8S7PPwgBuNYswwrpjr_IXE3-r11PCnl-WhYd9H6Q&s=10",
        credit: "ที่มา: Google Images (แคช)"
    }],
    [13, {
        url: `${import.meta.env.BASE_URL}images/place-13-chotana-health-center.png`,
        sourceUrl: `${import.meta.env.BASE_URL}images/place-13-chotana-health-center.png`,
        credit: "ภาพศูนย์สาธารณสุขชุมชนโชตนาฑัตพร"
    }],
    [14, {
        url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQY_9vxt-iIjvpgMO0pEXQUcR8SWMhQB7cSNSFhKtFwlAR663Tt3YRKLPKL&s=10",
        sourceUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQY_9vxt-iIjvpgMO0pEXQUcR8SWMhQB7cSNSFhKtFwlAR663Tt3YRKLPKL&s=10",
        credit: "ที่มา: Google Images (แคช)"
    }],
    [15, {
        url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTeRtGtLtPAQX4UPa6U2FUd2JeQ6C6LgtSe2Pdq4-NwY_Ezn1vET8AulPqY&s=10",
        sourceUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTeRtGtLtPAQX4UPa6U2FUd2JeQ6C6LgtSe2Pdq4-NwY_Ezn1vET8AulPqY&s=10",
        credit: "ที่มา: Google Images (แคช)"
    }],
    [16, {
        url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ4s4aA0-ix2hZcPX5SpWHdrAVAIJ5i2wi-UeGttpkanJ2BBe-vBOv9UbKI&s=10",
        sourceUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ4s4aA0-ix2hZcPX5SpWHdrAVAIJ5i2wi-UeGttpkanJ2BBe-vBOv9UbKI&s=10",
        credit: "ที่มา: Google Images (แคช)"
    }],
    [17, {
        url: "https://img.wongnai.com/p/1920x0/2023/01/01/9e617130158743c6b81becc87022be26.jpg",
        sourceUrl: "https://img.wongnai.com/p/1920x0/2023/01/01/9e617130158743c6b81becc87022be26.jpg",
        credit: "ที่มา: Wongnai"
    }],
    [18, {
        url: "https://files.thailandtourismdirectory.go.th/assets/upload/2020/06/08/202006087a84fabf22a308d03e78ebf5da278efa134754.jpg",
        sourceUrl: "https://files.thailandtourismdirectory.go.th/assets/upload/2020/06/08/202006087a84fabf22a308d03e78ebf5da278efa134754.jpg",
        credit: "ที่มา: Thailand Tourism Directory"
    }],
    [19, {
        url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRPQcCE7Tqv9dhC0Gshxp0flkV21z9TftcunQuMMzXWT9EP-NxUXAgtRnA&s=10",
        sourceUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRPQcCE7Tqv9dhC0Gshxp0flkV21z9TftcunQuMMzXWT9EP-NxUXAgtRnA&s=10",
        credit: "ที่มา: Google Images (แคช)"
    }],
    [20, {
        url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR7JgU4-4mkUfHp63O7cgY02H4gpUozBWl7_rnEpmxrv3bgZANAXXjL5jU&s=10",
        sourceUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR7JgU4-4mkUfHp63O7cgY02H4gpUozBWl7_rnEpmxrv3bgZANAXXjL5jU&s=10",
        credit: "ที่มา: Google Images (แคช)"
    }],
    [21, {
        url: "https://f.ptcdn.info/463/084/000/lxakfeqeiI6YY8fEh1u-o.jpg",
        sourceUrl: "https://f.ptcdn.info/463/084/000/lxakfeqeiI6YY8fEh1u-o.jpg",
        credit: "ที่มา: Pantip CDN"
    }],
    [22, {
        url: "https://cms.dmpcdn.com/ugcarticle/2022/08/15/f6e6df50-1cb4-11ed-a661-6f690afb971b_original.jpg",
        sourceUrl: "https://cms.dmpcdn.com/ugcarticle/2022/08/15/f6e6df50-1cb4-11ed-a661-6f690afb971b_original.jpg",
        credit: "ที่มา: TrueID"
    }],
    [23, {
        url: "https://www.cmhy.city/uploads/photos/39-Sports/250-Jogging-location/33270-Thung-Siew-Park/place33270_IMG_20220903_1548003.jpg",
        sourceUrl: "https://www.cmhy.city/uploads/photos/39-Sports/250-Jogging-location/33270-Thung-Siew-Park/place33270_IMG_20220903_1548003.jpg",
        credit: "ที่มา: CMHY.city"
    }],
    [24, {
        url: "https://www.topchiangmai.com/wp-content/uploads/2016/07/หนองสะเรียม14.jpg",
        sourceUrl: "https://www.topchiangmai.com/wp-content/uploads/2016/07/หนองสะเรียม14.jpg",
        credit: "ที่มา: Top Chiang Mai"
    }]
]);

// ===== อ้างอิงองค์ประกอบบนหน้าเว็บและสถานะของแอป =====
// เก็บ DOM elements ไว้ใช้ซ้ำ โดยไม่ต้องค้นหาใหม่ทุกครั้งที่หน้าจอเปลี่ยน
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

// ป้องกันข้อความจากฐานข้อมูลถูกตีความเป็น HTML ก่อนนำไปแสดงบนหน้าเว็บ
function escapeHtml(value) {
    return String(value ?? "-").replace(/[&<>'"]/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        "'": "&#39;", '"': "&quot;"
    })[character]);
}

// สร้างรายการประเภทสถานที่แบบไม่ซ้ำ และเรียงตามภาษาไทย
function getCategories(places = allPlaces) {
    return [...new Set(places.map((place) => place.category).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "th"));
}

// กำหนดสีประจำประเภท เพื่อให้หมุด ตัวกรอง และคำอธิบายแผนที่ใช้สีเดียวกัน
function colorForCategory(category) {
    if (!categoryColors.has(category)) {
        categoryColors.set(category, colorPalette[categoryColors.size % colorPalette.length]);
    }
    return categoryColors.get(category);
}

// คำนวณระยะเส้นตรงบนผิวโลกด้วยสูตร Haversine หน่วยเป็นกิโลเมตร
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

// แปลงระยะทางจากเมตรให้เป็นข้อความที่อ่านง่าย
function formatDistance(metres) {
    if (metres < 1000) return `${Math.round(metres)} ม.`;
    return `${(metres / 1000).toFixed(1)} กม.`;
}

// แปลงเวลาเดินทางจากวินาทีเป็นนาทีหรือชั่วโมง
function formatDuration(seconds) {
    const totalMinutes = Math.round(seconds / 60);
    if (totalMinutes < 60) return `${totalMinutes} นาที`;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours} ชม. ${minutes} นาที` : `${hours} ชม.`;
}

// สร้างส่วนรูปภาพสำหรับการ์ดและป๊อปอัป โดยเลือกข้อมูลจาก Supabase ก่อน แล้วจึงใช้รูปสำรอง
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

// สร้างรายละเอียดในป๊อปอัปของหมุด พร้อมลิงก์เปิดเส้นทางใน Google Maps
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

// อัปเดตตัวเลขสรุปจำนวนสถานที่ ประเภท และอำเภอตามผลการกรองปัจจุบัน
function updateSummary(places) {
    const districtCount = new Set(places.map((place) => place.district).filter(Boolean)).size;
    const categoryCount = getCategories(places).length;
    summaryElement.innerHTML = `
        <div class="summary-item"><span class="summary-value">${places.length}</span><span class="summary-label">สถานที่</span></div>
        <div class="summary-item"><span class="summary-value">${categoryCount}</span><span class="summary-label">ประเภท</span></div>
        <div class="summary-item"><span class="summary-value">${districtCount}</span><span class="summary-label">อำเภอ</span></div>
    `;
}

// สร้างคำอธิบายสีหมุดที่มุมแผนที่
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

// สร้างปุ่มกรองประเภทและผูกเหตุการณ์คลิกให้กรองรายการทันที
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

// เติมรายชื่อสถานที่ลงในช่องเลือกปลายทางสำหรับคำนวณเส้นทาง
function populateDestinationOptions() {
    routeDestination.innerHTML = allPlaces.map((place) => `
        <option value="${escapeHtml(place.id)}">${escapeHtml(place.id)}. ${escapeHtml(place.name)}</option>
    `).join("");
}

// วาดหมุดสีน้ำเงินเพื่อแสดงตำแหน่งเริ่มต้นของผู้ใช้
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

// ออกจากโหมดคลิกเลือกตำแหน่งและคืนสถานะปุ่ม/เมาส์เป็นปกติ
function stopPickingLocation() {
    isPickingLocation = false;
    document.querySelector("#map").classList.remove("picking-location");
    pickLocationButton.classList.remove("active");
    pickLocationButton.textContent = "✚ เลือกบนแผนที่";
}

// บันทึกตำแหน่งเริ่มต้น วาดหมุด และค้นหาสถานที่ที่ใกล้ที่สุดใหม่
function setCurrentPosition(latitude, longitude, label) {
    currentPosition = { latitude, longitude, label };
    showCurrentPositionOnMap(currentPosition);
    stopPickingLocation();
    findNearestPlace();
}

// เปรียบเทียบระยะ Haversine ของทุกสถานที่ แล้วแสดงรายการที่อยู่ใกล้ที่สุด
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

// เน้นเส้นทางที่ผู้ใช้เลือก พร้อมซูมแผนที่ให้เห็นเส้นทางทั้งหมด
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

// ขอเส้นทางทางรถยนต์จาก OSRM เรียงตามระยะทาง และแสดงทางเลือกสูงสุด 3 อันดับ
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

// ทำให้หมุดและการ์ดของสถานที่ที่เลือกเด่นขึ้นพร้อมกัน
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

// เลื่อนแผนที่ไปยังสถานที่ที่เลือกและเปิดป๊อปอัป
function showPlace(place) {
    const marker = markerById.get(place.id);
    if (!marker) return;
    markSelectedPlace(place.id);
    map.flyTo([place.latitude, place.longitude], 16, { duration: 0.8 });
    marker.openPopup();
}

// วาดหมุดและการ์ดรายการใหม่ทั้งหมดจากชุดข้อมูลที่ผ่านการกรองแล้ว
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

// กรองข้อมูลจากทั้งคำค้นหาและประเภท ก่อนส่งไปวาดบนหน้าจอ
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

// โหลดข้อมูลตาราง places จาก Supabase แล้วเตรียมส่วนต่าง ๆ ของหน้าเว็บ
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

// ===== เหตุการณ์จากผู้ใช้ =====
// ค้นหาทันทีขณะพิมพ์ และเริ่มคำนวณเมื่อกดปุ่มเส้นทาง
searchInput.addEventListener("input", applyFilters);
calculateRoutesButton.addEventListener("click", calculateRoutes);

// ขอพิกัดจาก GPS ของเบราว์เซอร์ แล้วใช้เป็นจุดเริ่มต้นของการวิเคราะห์
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

// เปิด/ปิดโหมดที่ให้ผู้ใช้คลิกเลือกตำแหน่งเริ่มต้นเองบนแผนที่
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

// เมื่ออยู่ในโหมดเลือกตำแหน่ง ให้นำจุดที่คลิกมาใช้แทน GPS
map.on("click", ({ latlng }) => {
    if (!isPickingLocation) return;
    setCurrentPosition(latlng.lat, latlng.lng, "ตำแหน่งที่เลือกบนแผนที่");
});

// เริ่มต้นแอปด้วยการอ่านข้อมูลสถานที่จากฐานข้อมูล
loadPlaces();

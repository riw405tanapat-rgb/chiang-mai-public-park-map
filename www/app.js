import { createClient } from "@supabase/supabase-js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";

const SUPABASE_URL =
    "https://gtklutfnugqkntdiedqh.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_vTDNH6vyrKxEbW5p3iwpkw_GqOnVHtK";

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

const map = L.map("map").setView(
    [18.7883, 98.9853],
    11
);

L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const markerById = new Map();

const statusElement = document.querySelector("#status");
const searchInput = document.querySelector("#searchInput");
const placeList = document.querySelector("#placeList");

let allPlaces = [];

function createPopup(place) {
    return `
    <article>
      <h2 class="popup-title">
        ${place.id}. ${place.name}
      </h2>

      <p class="popup-row">
        <strong>ประเภท:</strong> ${place.category}
      </p>

      <p class="popup-row">
        <strong>พื้นที่:</strong>
        ต.${place.subdistrict} อ.${place.district}
      </p>

      <p class="popup-row">
        <strong>เวลา:</strong> ${place.opening_hours}
      </p>
    </article>
  `;
}

function showPlace(place) {
    const marker = markerById.get(place.id);

    if (!marker) {
        return;
    }

    map.flyTo(
        [place.latitude, place.longitude],
        16,
        { duration: 0.8 }
    );

    marker.openPopup();
}

function renderPlaces(places) {
    markerLayer.clearLayers();
    markerById.clear();
    placeList.innerHTML = "";

    const bounds = [];

    places.forEach((place) => {
        const latitude = Number(place.latitude);
        const longitude = Number(place.longitude);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return;
        }

        const marker = L.circleMarker(
            [latitude, longitude],
            {
                radius: 8,
                color: "#ffffff",
                weight: 2,
                fillColor: "#e0523f",
                fillOpacity: 0.95
            }
        )
            .bindPopup(createPopup(place))
            .addTo(markerLayer);

        markerById.set(place.id, marker);
        bounds.push([latitude, longitude]);

        const card = document.createElement("article");
        card.className = "place-card";

        card.innerHTML = `
      <h2>${place.id}. ${place.name}</h2>
      <p>${place.category}</p>
      <p>ต.${place.subdistrict} · อ.${place.district}</p>
    `;

        card.addEventListener(
            "click",
            () => showPlace(place)
        );

        placeList.appendChild(card);
    });

    statusElement.textContent =
        `แสดง ${places.length} สถานที่`;

    if (bounds.length > 0) {
        map.fitBounds(bounds, {
            padding: [35, 35],
            maxZoom: 12
        });
    }
}

async function loadPlaces() {
    statusElement.textContent = "กำลังโหลดข้อมูล...";

    const { data, error } = await supabase
        .from("places")
        .select("*")
        .order("id", { ascending: true });

    if (error) {
        console.error("Supabase error:", error);
        statusElement.textContent =
            "โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบ Console";
        return;
    }

    allPlaces = data;
    renderPlaces(allPlaces);
}

searchInput.addEventListener("input", () => {
    const keyword =
        searchInput.value.trim().toLowerCase();

    const filteredPlaces = allPlaces.filter(
        (place) => {
            const searchableText = [
                place.name,
                place.category,
                place.subdistrict,
                place.district
            ]
                .join(" ")
                .toLowerCase();

            return searchableText.includes(keyword);
        }
    );

    renderPlaces(filteredPlaces);
});

loadPlaces();
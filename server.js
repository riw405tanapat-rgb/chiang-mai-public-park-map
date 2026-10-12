import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { Pool } from "pg";

// ===== สร้าง Express API Server =====
const app = express();
const port = 3000;

// อ่าน request body แบบ JSON และอนุญาตให้เว็บคนละ origin เรียก API ได้
app.use(bodyParser.json());
app.use(cors());

// รหัสผ่านฐานข้อมูลต้องส่งผ่าน environment variable เพื่อไม่ให้ความลับอยู่ในโค้ด
if (!process.env.DATABASE_PASSWORD) {
    throw new Error("DATABASE_PASSWORD environment variable is required");
}

// ===== การเชื่อมต่อฐานข้อมูล PostgreSQL/PostGIS บน Supabase =====
const db = new Pool({
    host: "aws-0-ap-southeast-1.pooler.supabase.com",
    database: "postgres",
    user: "postgres.gtklutfnugqkntdiedqh",
    password: process.env.DATABASE_PASSWORD,
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

// คืนข้อมูลหมู่บ้านทั้งหมดพร้อมแปลง geometry เป็น longitude และ latitude
app.get("/api/v1/village", async (_req, res) => {
    const result = await db.query(
        "SELECT ST_x(geom) as lng, ST_y(geom) as lat, vill_nam_t FROM cm_dwr_village_4326"
    );
    res.status(200).json(result.rows);
});

// คืนข้อมูลหมู่บ้านตามจำนวนที่ระบุ โดยจำกัดไว้ระหว่าง 1–1,000 แถว
app.get("/api/v1/village/:lim", async (req, res) => {
    const limit = Math.max(1, Math.min(1000, Number.parseInt(req.params.lim, 10) || 100));
    const result = await db.query(
        `SELECT ST_x(geom) as lng, ST_y(geom) as lat, vill_nam_t
         FROM cm_dwr_village_4326 LIMIT $1`,
        [limit]
    );
    res.status(200).json(result.rows);
});

// ค้นหาหมู่บ้านจากบางส่วนของชื่อ โดยใช้ parameterized query ป้องกัน SQL injection
app.get("/api/v1/village_name/:name", async (req, res) => {
    const result = await db.query(
        `SELECT ST_x(geom) as lng, ST_y(geom) as lat, vill_nam_t
         FROM cm_dwr_village_4326
         WHERE vill_nam_t LIKE $1`,
        [`%${req.params.name}%`]
    );
    res.status(200).json(result.rows);
});

// เพิ่มจุดสนใจใหม่ลงตาราง poi และสร้าง geometry ระบบพิกัด WGS84 (EPSG:4326)
app.post("/api/v1/add_poi", async (req, res) => {
    const { text, lng, lat } = req.body;
    const result = await db.query(
        `INSERT INTO poi (poi_name, geom)
         VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326))
         RETURNING *`,
        [text, lng, lat]
    );
    res.status(200).json({ status: "success", data: result.rows[0] });
});

// Endpoint ตัวอย่างสำหรับตรวจสอบว่า API Server ทำงานอยู่
app.get("/api/v1/hello", (_req, res) => {
    res.status(200).json({
        text: "hello World",
        num: 999,
        products: [{ item: "gps" }, { item: "gis" }, { item: "rs" }]
    });
});

// เริ่มรับ request ที่พอร์ต 3000
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

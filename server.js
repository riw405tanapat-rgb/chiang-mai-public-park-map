import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { Pool } from "pg";

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors());

if (!process.env.DATABASE_PASSWORD) {
    throw new Error("DATABASE_PASSWORD environment variable is required");
}

const db = new Pool({
    host: "aws-0-ap-southeast-1.pooler.supabase.com",
    database: "postgres",
    user: "postgres.gtklutfnugqkntdiedqh",
    password: process.env.DATABASE_PASSWORD,
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

app.get("/api/v1/village", async (_req, res) => {
    const result = await db.query(
        "SELECT ST_x(geom) as lng, ST_y(geom) as lat, vill_nam_t FROM cm_dwr_village_4326"
    );
    res.status(200).json(result.rows);
});

app.get("/api/v1/village/:lim", async (req, res) => {
    const limit = Math.max(1, Math.min(1000, Number.parseInt(req.params.lim, 10) || 100));
    const result = await db.query(
        `SELECT ST_x(geom) as lng, ST_y(geom) as lat, vill_nam_t
         FROM cm_dwr_village_4326 LIMIT $1`,
        [limit]
    );
    res.status(200).json(result.rows);
});

app.get("/api/v1/village_name/:name", async (req, res) => {
    const result = await db.query(
        `SELECT ST_x(geom) as lng, ST_y(geom) as lat, vill_nam_t
         FROM cm_dwr_village_4326
         WHERE vill_nam_t LIKE $1`,
        [`%${req.params.name}%`]
    );
    res.status(200).json(result.rows);
});

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

app.get("/api/v1/hello", (_req, res) => {
    res.status(200).json({
        text: "hello World",
        num: 999,
        products: [{ item: "gps" }, { item: "gis" }, { item: "rs" }]
    });
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

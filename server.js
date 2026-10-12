import express from 'express';
const app = express();
const port = 3000;

import bodyParser from 'body-parser';
app.use(bodyParser.json());

import cors from 'cors';
app.use(cors());

import { Pool } from 'pg';

const db = new Pool({
    host: "aws-0-ap-southeast-1.pooler.supabase.com",
    database: "postgres",
    user: "postgres.gtklutfnugqkntdiedqh",
    password: "D34x4esAhw?mvk_",
    port: 5432
});

app.get("/api/v1/village", async (req, res) => {
    const sql = "SELECT ST_x(geom) as lng, ST_y(geom) as lat, vill_nam_t FROM cm_dwr_village_4326 ";
    // const sql = "SELECT count(geom) from cm_dwr_village_4326";
    const result = await db.query(sql)
    // console.log(result)

    //console.log(result.rows)
    res.status(200).json(result.rows);
})

app.get("/api/v1/village/:lim", async (req, res) => {
    const lim = req.params.lim
    const sql = `SELECT 
        ST_x(geom) as lng, 
        ST_y(geom) as lat, 
        vill_nam_t 
        FROM cm_dwr_village_4326 LIMIT ${lim}`;
    // const sql = "SELECT count(geom) from cm_dwr_village_4326";
    const result = await db.query(sql)
    // console.log(result)

    //console.log(result.rows)
    res.status(200).json(result.rows);
})

app.get("/api/v1/village_name/:name", async (req, res) => {
    const name = req.params.name
    const sql = `SELECT 
        ST_x(geom) as lng, 
        ST_y(geom) as lat, 
        vill_nam_t 
        FROM cm_dwr_village_4326 
        WHERE vill_nam_t LIKE '%${name}%'`;
    const result = await db.query(sql)
    res.status(200).json(result.rows);
})

app.post("/api/v1/add_poi", async (req, res) => {
    const { text, lng, lat } = req.body;

    const sql = `
    INSERT INTO poi (poi_name, geom)
    VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326))
    RETURNING *
  `;

    const result = await db.query(sql, [text, lng, lat]);

    res.status(200).json({
        status: "success",
        data: result.rows[0]
    });
});


app.get("/api/v1/hello", (req, res) => {
    res.status(200).json({
        text: "hello World",
        num: 999,
        products: [
            { item: "gps" },
            { item: "gis" },
            { item: "rs" }
        ]
    });
})

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`tanapat radsamafoo`);
});
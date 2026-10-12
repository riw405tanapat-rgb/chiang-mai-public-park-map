import { defineConfig } from "vite";

// ตั้งค่า Vite ให้ใช้โฟลเดอร์ www เป็น source และสร้างไฟล์พร้อมเผยแพร่ไว้ใน dist
export default defineConfig({
    root: "www",

    // ใช้ relative path เพื่อให้ asset เปิดได้ทั้ง localhost และ GitHub Pages
    base: "./",

    build: {
        // วางผลลัพธ์ build ไว้นอก www และล้างไฟล์ build เก่าก่อนทุกครั้ง
        outDir: "../dist",
        emptyOutDir: true
    }
});

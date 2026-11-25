# Roll and Ruin

**สถานะ:** Early Development

Roll and Ruin เป็นเกมกระดานออนไลน์แนวผจญภัย ใช้ภาพ 2D Isometric Pixel Art ผสมระบบทอยลูกเต๋า ไพ่ มอนสเตอร์ และการเล่นแบบ Multiplayer

## เป้าหมายแพลตฟอร์ม
- เว็บไซต์ที่เล่นผ่าน Browser
- Android APK

## เทคโนโลยี
- **Phaser 3** — แสดงผลเกม 2D และจัดการ Scene
- **TypeScript** — แยกระบบเกมและตรวจสอบข้อผิดพลาด
- **Vite** — พัฒนาและ Build เว็บไซต์
- **GitHub Actions** — ตรวจสอบและ Build อัตโนมัติ
- **Capacitor** — แผนสำหรับแพ็กเกมเป็น Android APK ในระยะถัดไป

## เริ่มต้นใช้งาน
ต้องมี Node.js เวอร์ชัน LTS

```bash
npm install
npm run dev
```

ตรวจสอบ TypeScript และ Build:
```bash
npm run typecheck
npm run build
```

## โครงสร้างปัจจุบัน
```text
src/
  game/       # กติกาและสถานะเกมที่ไม่ผูกกับภาพ
  scenes/     # ฉากและการแสดงผลด้วย Phaser
  main.ts     # จุดเริ่มต้นเกม
  style.css   # หน้าตาเว็บไซต์และ UI
```

## หลักการพัฒนา
1. แยก Game Logic ออกจาก Game Presentation
2. ให้ฝั่ง Server เป็นผู้ตัดสินผลการเล่นเมื่อเพิ่ม Multiplayer
3. การสุ่มเต๋า ไพ่ และการคำนวณผลสำคัญต้องตรวจสอบบน Server
4. รองรับหน้าจอมือถือเป็นเป้าหมายตั้งแต่ต้น
5. ใช้ภาพ Placeholder ระหว่างพัฒนาระบบ ก่อนแทนที่ด้วย Pixel Art จริง

## Roadmap
- [x] โครงสร้าง Phaser + TypeScript + Vite
- [x] กระดาน Isometric ทดลองและการเดินด้วยลูกเต๋าแบบ Local
- [ ] แยกระบบ Board, Movement และ Tile Events
- [ ] ระบบไพ่และการจัดการไพ่ในมือ
- [ ] ระบบมอนสเตอร์และลำดับเทิร์นตามกติกาหลัก
- [ ] ระบบคะแนนและเงื่อนไขจบเกม
- [ ] ห้อง Multiplayer และการเชื่อมต่อผู้เล่น
- [ ] Backend ที่ตรวจสอบกติกาฝั่ง Server
- [ ] Deploy เว็บไซต์
- [ ] แพ็ก Android APK ด้วย Capacitor

รายละเอียดกติกาฉบับเต็มจะถูกนำมาเชื่อมกับระบบตามเอกสารออกแบบหลัก โดยไม่เปลี่ยนกติกาที่กำหนดไว้แล้ว

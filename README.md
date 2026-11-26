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
- [x] โครงสร้าง Phaser + TypeScript + Vite และ GitHub Actions
- [x] กระดาน 32 ช่อง, การเดิน, ช่องพิเศษ และการสุ่มตำแหน่งช่องใหม่
- [x] Turn Engine สำหรับรูปแบบ 1v1, 1x4, 2v2 และ 2x4 พร้อม Bot เติมที่นั่ง
- [x] Card Catalogue 60 ใบ, กองจั่ว/กองทิ้ง และระบบใช้ไพ่พื้นฐาน
- [x] Card Effect Resolver ครบ 56/56 Effect IDs พร้อม Board-aware Magic Shortcut ที่เดินไปช่องพิเศษโดยไม่ทอยเต๋า
- [x] Monster Catalogue 50 ตัว, ขีดจำกัดการอัญเชิญ, การโจมตีพื้นฐาน, รางวัล และความสามารถเฉพาะหลายตัว
- [ ] ตรวจสอบและเชื่อม Monster Rules ที่เหลือให้ครบทั้ง 50 ตัว
- [ ] ทดสอบ Card Effect และ Monster interaction แบบ end-to-end ใน Browser
- [ ] ตรวจสอบคะแนนและเงื่อนไขจบเกมทุกโหมด รวมถึง Time Limit และ Speedrun
- [ ] Browser Playtest ตั้งแต่เริ่มเกมจนจบเกม
- [ ] UI/UX สำหรับมือถือและเดสก์ท็อปให้สมบูรณ์
- [ ] ห้อง Multiplayer และการเชื่อมต่อผู้เล่นจริง
- [ ] Backend ที่ตรวจสอบกติกาฝั่ง Server
- [ ] Deploy เว็บไซต์
- [ ] แพ็กและทดสอบ Android APK ด้วย Capacitor

รายละเอียดกติกาฉบับเต็มจะถูกนำมาเชื่อมกับระบบตามเอกสารออกแบบหลัก โดยไม่เปลี่ยนกติกาที่กำหนดไว้แล้ว

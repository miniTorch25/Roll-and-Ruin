# Roll and Ruin

**สถานะ:** Early Development — Browser deployment

Roll and Ruin เป็นเกมกระดานผจญภัยแนว Isometric 2D Pixel Art ผสมระบบทอยลูกเต๋า ไพ่ และมอนสเตอร์ ปัจจุบันเล่นผ่าน Browser แบบ Local Match โดยเลือกผู้เล่นจริงในเครื่อง 1–4 คน และให้ Bot เติมที่นั่งที่เหลือ (ยังไม่เปิด Multiplayer ออนไลน์)

## เว็บไซต์

หลังเปิดใช้งาน GitHub Pages ครั้งแรกและ Workflow Deploy สำเร็จ สามารถเล่นเกมผ่าน Browser ได้ที่:

https://minitorch25.github.io/Roll-and-Ruin/

**การตั้งค่าครั้งแรก:** Repository owner ต้องเปิด `Settings → Pages → Build and deployment → Source: GitHub Actions` แล้วกด Save ก่อนเริ่ม Deploy

## เป้าหมายแพลตฟอร์ม
- เว็บไซต์ที่เล่นผ่าน Browser
- Android APK

## เทคโนโลยี
- **Phaser 3** — แสดงผลเกม 2D และจัดการ Scene
- **TypeScript** — แยกระบบเกมและตรวจสอบข้อผิดพลาด
- **Vite** — พัฒนาและ Build เว็บไซต์
- **GitHub Actions** — ตรวจสอบ ทดสอบ Build และ Deploy อัตโนมัติ
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
npm test
npm run test:e2e
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

## Roadmap

อัปเดตสถานะล่าสุด: 26 พฤศจิกายน 2026

### 1. Core Foundation — เสร็จแล้ว
- [x] โครงสร้าง Phaser 3 + TypeScript + Vite
- [x] แยก Game Logic ออกจาก Game Presentation
- [x] ตั้งค่า GitHub Actions สำหรับ TypeScript check, Unit Tests, Browser E2E Tests และ Production Build
- [x] ตั้งค่า Workflow สำหรับ Deploy เว็บไซต์ไปยัง GitHub Pages
- [x] รองรับการ Build เว็บไซต์โดยใช้ relative asset path สำหรับ GitHub Pages

### 2. ระบบการเล่นหลัก — เสร็จแล้ว
- [x] กระดาน 32 ช่อง พร้อมระบบเดินและช่องพิเศษ
- [x] ระบบสุ่มตำแหน่งช่องใหม่
- [x] Turn Engine สำหรับรูปแบบ 1v1, 1x4, 2v2 และ 2x4
- [x] ระบบ Bot สำหรับเติมที่นั่งผู้เล่นที่เหลือ
- [x] Card Catalogue จำนวน 60 ใบ พร้อมกองจั่วและกองทิ้ง
- [x] ระบบใช้ไพ่และ Card Effect Resolver ครบ 56/56 Effect IDs
- [x] Board-aware Magic Shortcut สำหรับเดินไปช่องพิเศษโดยไม่ต้องทอยเต๋า
- [x] Monster Catalogue จำนวน 50 ตัว
- [x] ระบบอัญเชิญ จำกัดจำนวนมอนสเตอร์ โจมตี รับรางวัล และความสามารถเฉพาะ
- [x] ตรวจสอบและเชื่อม Monster Rules ครบทั้ง 50 ตัว
- [x] Regression Tests สำหรับความสามารถเฉพาะและรางวัลของมอนสเตอร์
- [x] ระบบคะแนนทีมและตัดสินผู้ชนะ รวมถึงกติกาตัดสินเมื่อคะแนนเสมอด้วยจำนวนผู้เล่นที่รอด
- [x] ระบบ Time Limit / Speedrun และหน้าสรุปผลการแข่งขัน

### 3. การทดสอบและคุณภาพ — เสร็จแล้วตามขอบเขตที่มี
- [x] Unit Tests สำหรับระบบเกม
- [x] Browser E2E Tests สำหรับเริ่มเกมและการกระทำในเทิร์น
- [x] Browser E2E Tests สำหรับการใช้ไพ่ที่ต้องเลือกเป้าหมาย
- [x] Browser E2E Tests สำหรับการต่อสู้กับมอนสเตอร์
- [x] Browser E2E Test สำหรับวงจรเกมแบบจับเวลา ตั้งแต่เริ่มเกมจนจบและสรุปคะแนน
- [x] Browser Playtest ตั้งแต่เริ่มเกมจนจบเกม
- [x] Responsive UI สำหรับมือถือ แท็บเล็ต และ Desktop
- [x] ปรับ Touch Targets และการจัดวางหน้าจอขนาดเล็ก
- [x] Keyboard Navigation และ Focus States
- [x] Accessibility สำหรับ Dialog และ Live Game Feedback
- [x] รองรับ Reduced Motion
- [x] ปรับผลการทอยเต๋าให้แยกเป็นบรรทัดตามผู้เล่น เพื่อให้อ่านง่ายบนมือถือ

### 4. เว็บไซต์และการเผยแพร่ — กำลังดำเนินการ
- [x] ตั้งค่า GitHub Pages Deployment Workflow
- [x] ตั้งค่าให้ Workflow ทำงานเมื่อมีการอัปเดต `main`
- [x] ตั้งค่า Workflow ให้ Deploy ด้วย GitHub Actions หลังเปิด Pages ใน Repository Settings
- [ ] ตรวจสอบการเปิดใช้งาน GitHub Pages ครั้งแรกจาก Repository Settings และยืนยันว่า Deploy สำเร็จ
- [ ] ทดสอบเว็บไซต์ที่เผยแพร่จริงบน Browser ทั้งมือถือและ Desktop
- [ ] ตรวจสอบการโหลด Asset, การ Refresh หน้า และการทำงานจาก URL ของ GitHub Pages

### 5. Android — ยังไม่ได้เริ่ม
- [ ] ติดตั้งและตั้งค่า Capacitor
- [ ] ปรับการแสดงผลและการควบคุมให้เหมาะกับ Android WebView
- [ ] ทดสอบ Touch Input, Safe Area, Orientation และการกลับเข้าเกม
- [ ] สร้าง Android APK
- [ ] ทดสอบ APK บนอุปกรณ์ Android จริง
- [ ] จัดเตรียมขั้นตอน Build และเผยแพร่ APK

### 6. Multiplayer Online และ Backend — พักไว้
ปัจจุบันเกมเป็น Local Match โดยมี Bot เติมที่นั่ง จึงยังไม่ถือว่าระบบออนไลน์เสร็จสมบูรณ์

- [ ] ระบบสร้างห้องและเข้าร่วมห้อง Multiplayer
- [ ] ระบบเชื่อมต่อผู้เล่นจริงผ่านเครือข่าย
- [ ] ระบบซิงก์สถานะเกมและการกระทำของผู้เล่น
- [ ] Backend สำหรับตรวจสอบกติกาและสถานะเกมฝั่ง Server
- [ ] จัดการกรณีผู้เล่นหลุดการเชื่อมต่อและกลับเข้าห้อง
- [ ] ทดสอบ Multiplayer หลายผู้เล่นและป้องกันสถานะเกมไม่ตรงกัน

### 7. งานภาพและการขัดเกลา — ยังเหลืองาน
- [ ] แทนที่ Placeholder Art ด้วย Pixel Art ฉบับจริงให้ครบทุกส่วน
- [ ] ตรวจสอบความสม่ำเสมอของ Sprite, Animation, Effect และ UI Art
- [ ] ปรับรายละเอียดภาพและ Feedback ระหว่างการเล่น
- [ ] ทดสอบประสิทธิภาพและการใช้หน่วยความจำบนมือถือระดับต่าง ๆ

## สรุปงานที่ยังเหลือ

**งานที่ควรทำต่อเป็นลำดับแรก**
1. ยืนยันการเปิด GitHub Pages และทดสอบเว็บไซต์ที่เผยแพร่จริง
2. ตรวจสอบการเล่นจริงบนมือถือและ Desktop ผ่าน URL สาธารณะ
3. วางแผนและเริ่มงาน Pixel Art ฉบับจริง แทนที่ Placeholder

**งานระยะถัดไป**
4. แพ็กเกมเป็น Android APK ด้วย Capacitor และทดสอบบนอุปกรณ์จริง

**งานที่พักไว้**
5. Multiplayer Online และ Backend — ยังไม่เริ่มจนกว่าจะกลับมาให้ความสำคัญกับระบบออนไลน์

หมายเหตุ: ระบบรองรับม็อดภายนอกยังไม่ได้ถูกกำหนดเป็นงานใน Roadmap นี้ เนื่องจากยังเป็นเพียงหัวข้อสอบถามและยังไม่มีข้อกำหนดให้เริ่มพัฒนา

รายละเอียด Deploy: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

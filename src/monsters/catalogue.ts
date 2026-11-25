export type MonsterRank = "Common" | "Rare" | "Epic" | "Legend" | "Myth";
export type MonsterAttackPattern = "random_living" | "all_living";

export interface MonsterDefinition {
  id: string;
  rank: MonsterRank;
  name: string;
  species: string | null;
  /** null means the rules explicitly define infinite HP. */
  hp: number | null;
  attackDamage: number;
  /** null means the monster has no fixed scheduled attack interval. */
  attackInterval: number | null;
  attackPattern: MonsterAttackPattern;
  targetCount?: number;
  /** Verbatim special-rule bullets from Roll_and_Ruin_Rules.txt. */
  rules: readonly string[];
  reward: string | null;
  info: string | null;
}

/** All 50 monsters, transcribed from the authoritative rules file. */
export const MONSTER_CATALOGUE: readonly MonsterDefinition[] = [
  {
    "id": "C01",
    "rank": "Common",
    "name": "Gob",
    "species": "Goblin",
    "hp": 5,
    "attackDamage": 1,
    "attackInterval": 2,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 2 เทิร์น",
      "60% ที่จะโจมตีเป้าหมายเดิมซ้ำ"
    ],
    "reward": null,
    "info": "สติปัญญาต่ำ มีอาการย้ำคิดย้ำทำ"
  },
  {
    "id": "C02",
    "rank": "Common",
    "name": "Bone",
    "species": "Skeleton",
    "hp": 1,
    "attackDamage": 2,
    "attackInterval": 2,
    "attackPattern": "random_living",
    "targetCount": 2,
    "rules": [
      "โจมตีทุก 2 เทิร์น ครั้งละ 2 เป้าหมาย"
    ],
    "reward": null,
    "info": null
  },
  {
    "id": "C03",
    "rank": "Common",
    "name": "Zomzom",
    "species": "Zombie",
    "hp": 20,
    "attackDamage": 1,
    "attackInterval": 1,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 1 เทิร์น",
      "ได้ +1 HP ทุกครั้งที่โจมตี"
    ],
    "reward": null,
    "info": null
  },
  {
    "id": "C04",
    "rank": "Common",
    "name": "Ratty",
    "species": "Giant Rat",
    "hp": 3,
    "attackDamage": 1,
    "attackInterval": 1,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 1 เทิร์น"
    ],
    "reward": null,
    "info": "หิวตลอดเวลา แต่ตัวเล็กมาก"
  },
  {
    "id": "C05",
    "rank": "Common",
    "name": "Webby",
    "species": "Cave Spider",
    "hp": 4,
    "attackDamage": 2,
    "attackInterval": 3,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 3 เทิร์น",
      "ถูกโจมตีด้วยไพ่ Attack แล้วตาย เจ้าของไพ่ไม่ได้รับไพ่รางวัล (ใยเหนียวติดมือ)"
    ],
    "reward": null,
    "info": "ชอบซ่อนตัวตามมุมกระดาน"
  },
  {
    "id": "C06",
    "rank": "Common",
    "name": "Fang",
    "species": "Wolf",
    "hp": 8,
    "attackDamage": 2,
    "attackInterval": 2,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 2 เทิร์น",
      "ถ้ามี Wolf อยู่บนกระดานมากกว่า 1 ตัว Dmg +1"
    ],
    "reward": null,
    "info": "ล่าเป็นฝูง ไม่ชอบอยู่ตัวเดียว"
  },
  {
    "id": "C07",
    "rank": "Common",
    "name": "Shroomy",
    "species": "Mushroom Man",
    "hp": 6,
    "attackDamage": 1,
    "attackInterval": 2,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 2 เทิร์น",
      "เมื่อถูกกำจัด ผู้กำจัดเสีย 1 HP (สปอร์ระเบิด)"
    ],
    "reward": null,
    "info": "เดินช้า แต่กลิ่นแรง"
  },
  {
    "id": "C08",
    "rank": "Common",
    "name": "Batty",
    "species": "Giant Bat",
    "hp": 2,
    "attackDamage": 1,
    "attackInterval": 1,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 1 เทิร์น",
      "สุ่มเป้าหมายใหม่ทุกครั้ง"
    ],
    "reward": null,
    "info": "บินวนไปมา ไม่เคยจำหน้าใครได้"
  },
  {
    "id": "C09",
    "rank": "Common",
    "name": "Rocky",
    "species": "Stone Golem Pup",
    "hp": 15,
    "attackDamage": 1,
    "attackInterval": 3,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 3 เทิร์น",
      "ไพ่ Attack ที่ใช้กับมัน Dmg -1 (ขั้นต่ำ 1)"
    ],
    "reward": null,
    "info": "ก้อนหินที่คิดว่าตัวเองเป็นหมา"
  },
  {
    "id": "C10",
    "rank": "Common",
    "name": "Sneaky",
    "species": "Kobold Thief",
    "hp": 4,
    "attackDamage": 0,
    "attackInterval": 2,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 2 เทิร์น: ขโมยไพ่สุ่ม 1 ใบจากผู้เล่นเป้าหมาย",
      "เมื่อถูกกำจัด คืนไพ่ที่ขโมยไว้ให้เจ้าของ"
    ],
    "reward": null,
    "info": "ชอบของมันวาว โดยเฉพาะไพ่"
  },
  {
    "id": "R01",
    "rank": "Rare",
    "name": "Bob",
    "species": "Slime",
    "hp": 40,
    "attackDamage": 3,
    "attackInterval": 3,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 3 เทิร์น",
      "เมื่อถูกโจมตี ผู้โจมตีติดดีบัฟ \"เชื่องช้า\"",
      "เชื่องช้า: จำนวนก้าวเดินของตัวละคร -1 (เช่น ทอยได้ 6 เดินได้ 5)"
    ],
    "reward": null,
    "info": null
  },
  {
    "id": "R02",
    "rank": "Rare",
    "name": "Chesty",
    "species": "Mimic",
    "hp": 30,
    "attackDamage": 4,
    "attackInterval": 3,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 3 เทิร์น เล็งผู้เล่นที่มีไพ่ในมือมากที่สุด",
      "เมื่อถูกกำจัด ได้ไพ่เขียว 1 ใบเพิ่มจากรางวัลปกติ"
    ],
    "reward": null,
    "info": "ปลอมตัวเป็นหีบสมบัติ ใครเปิดก็โดนกัด"
  },
  {
    "id": "R03",
    "rank": "Rare",
    "name": "Wizzy",
    "species": "Apprentice Mage",
    "hp": 15,
    "attackDamage": 3,
    "attackInterval": 3,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 3 เทิร์น",
      "ผู้ถูกโจมตีทอยเต๋า 1 ลูก ถ้าได้ 1-2 จะโดนเวทระเบิดซ้ำอีก 2 Dmg"
    ],
    "reward": null,
    "info": "เรียนเวทมา 3 วัน มั่นใจเกินตัว"
  },
  {
    "id": "R04",
    "rank": "Rare",
    "name": "Stoney",
    "species": "Basilisk",
    "hp": 20,
    "attackDamage": 3,
    "attackInterval": 3,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 3 เทิร์น",
      "ผู้ถูกโจมตีติด \"กลายเป็นหิน\": เทิร์นถัดไปทอยเต๋าได้เพียง 1 ลูก"
    ],
    "reward": null,
    "info": "สบตาแล้วขาแข็ง"
  },
  {
    "id": "R05",
    "rank": "Rare",
    "name": "Vampy",
    "species": "Vampire",
    "hp": 25,
    "attackDamage": 2,
    "attackInterval": 2,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 2 เทิร์น ทะลุเกราะ Defense",
      "ฟื้น HP ตัวเอง +2 ทุกครั้งที่โจมตี"
    ],
    "reward": null,
    "info": "กลัวแสงแดด แต่กลัวค่าเช่าบ้านมากกว่า"
  },
  {
    "id": "R06",
    "rank": "Rare",
    "name": "Ghosty",
    "species": "Poltergeist",
    "hp": 12,
    "attackDamage": 2,
    "attackInterval": 2,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 2 เทิร์น",
      "ไม่โดนไพ่ Attack ที่ Dmg ต่ำกว่า 3 (ทะลุผ่านตัว)"
    ],
    "reward": null,
    "info": "เป็นผีมานาน จนลืมว่าตายยังไง"
  },
  {
    "id": "R07",
    "rank": "Rare",
    "name": "Scorpy",
    "species": "Giant Scorpion",
    "hp": 18,
    "attackDamage": 3,
    "attackInterval": 3,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 3 เทิร์น",
      "ผู้ถูกโจมตีติด \"พิษ\": เสีย 1 HP ทุกต้นเทิร์นของตัวเอง นาน 3 เทิร์น"
    ],
    "reward": null,
    "info": "หางยาวกว่าความอดทน"
  },
  {
    "id": "R08",
    "rank": "Rare",
    "name": "Harpy",
    "species": "Harpy",
    "hp": 14,
    "attackDamage": 2,
    "attackInterval": 2,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 2 เทิร์น",
      "ถ้าผู้ถูกโจมตีมีไพ่เหลือ จะถูกฉกไพ่สุ่ม 1 ใบไปทิ้ง"
    ],
    "reward": null,
    "info": "ร้องเพลงเพราะ แต่เล็บไม่เพราะ"
  },
  {
    "id": "R09",
    "rank": "Rare",
    "name": "Minoo",
    "species": "Minotaur",
    "hp": 35,
    "attackDamage": 4,
    "attackInterval": 4,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 4 เทิร์น",
      "ถ้าผู้เล่นเดินผ่านหรือหยุดที่ช่องตำแหน่งเริ่มต้นของมัน (ช่องมุมที่สุ่มไว้ตอนอัญเชิญ) จะถูกโจมตีทันที 1 ครั้ง"
    ],
    "reward": null,
    "info": "หลงทางในเขาวงกตตัวเอง"
  },
  {
    "id": "R10",
    "rank": "Rare",
    "name": "Frosty",
    "species": "Ice Elemental",
    "hp": 22,
    "attackDamage": 3,
    "attackInterval": 3,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 3 เทิร์น",
      "ผู้ถูกโจมตีติด \"แช่แข็ง\": ใช้ไพ่ได้ไม่เกิน 2 ใบในเทิร์นถัดไป"
    ],
    "reward": null,
    "info": "ใจเย็น เพราะตัวเย็น"
  },
  {
    "id": "E01",
    "rank": "Epic",
    "name": "Ogrok",
    "species": "Ogre",
    "hp": 60,
    "attackDamage": 6,
    "attackInterval": 3,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 3 เทิร์น"
    ],
    "reward": "ไพ่เกรียน 4 ใบ",
    "info": "ตีแรง คิดช้า หิวตลอด"
  },
  {
    "id": "E02",
    "rank": "Epic",
    "name": "Trollo",
    "species": "Cave Troll",
    "hp": 70,
    "attackDamage": 5,
    "attackInterval": 2,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 2 เทิร์น"
    ],
    "reward": "ไพ่เกรียน 3 ใบ + ไพ่เขียว 1 ใบ",
    "info": "กระบองใหญ่กว่าสมอง"
  },
  {
    "id": "E03",
    "rank": "Epic",
    "name": "Wyvo",
    "species": "Wyvern",
    "hp": 55,
    "attackDamage": 7,
    "attackInterval": 3,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 3 เทิร์น"
    ],
    "reward": "ไพ่คำสาป 3 ใบ",
    "info": "ญาติห่างๆ ของมังกร ที่ไม่มีใครเชิญไปงานแต่ง"
  },
  {
    "id": "E04",
    "rank": "Epic",
    "name": "Cerby",
    "species": "Cerberus",
    "hp": 80,
    "attackDamage": 4,
    "attackInterval": 2,
    "attackPattern": "random_living",
    "targetCount": 3,
    "rules": [
      "โจมตีทุก 2 เทิร์น ครั้งละ 3 เป้าหมาย"
    ],
    "reward": "ไพ่เกรียน 5 ใบ",
    "info": "สามหัวทะเลาะกันเองบ่อย"
  },
  {
    "id": "E05",
    "rank": "Epic",
    "name": "Hydro",
    "species": "Hydra",
    "hp": 90,
    "attackDamage": 5,
    "attackInterval": 3,
    "attackPattern": "random_living",
    "targetCount": 2,
    "rules": [
      "โจมตีทุก 3 เทิร์น ครั้งละ 2 เป้าหมาย"
    ],
    "reward": "ไพ่เกรียน 3 ใบ + ไพ่คำสาป 2 ใบ",
    "info": "ตัดหัวหนึ่ง งอกสอง (แต่ในเกมนี้ไม่งอก)"
  },
  {
    "id": "E06",
    "rank": "Epic",
    "name": "Kraky",
    "species": "Kraken",
    "hp": 100,
    "attackDamage": 6,
    "attackInterval": 4,
    "attackPattern": "random_living",
    "targetCount": 4,
    "rules": [
      "โจมตีทุก 4 เทิร์น ครั้งละ 4 เป้าหมาย"
    ],
    "reward": "ไพ่เขียว 4 ใบ",
    "info": "หนวดเยอะ เพื่อนเยอะ ไม่มี"
  },
  {
    "id": "E07",
    "rank": "Epic",
    "name": "Gargo",
    "species": "Gargoyle",
    "hp": 65,
    "attackDamage": 6,
    "attackInterval": 3,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 3 เทิร์น"
    ],
    "reward": "ไพ่ฟ้า (Attack/Defense) 4 ใบ + ไพ่เกรียน 2 ใบ",
    "info": "ยืนนิ่งเป็นรูปปั้นจนลืมว่ามีชีวิต"
  },
  {
    "id": "E08",
    "rank": "Epic",
    "name": "Mantic",
    "species": "Manticore",
    "hp": 75,
    "attackDamage": 7,
    "attackInterval": 3,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 3 เทิร์น"
    ],
    "reward": "ไพ่คำสาป 4 ใบ",
    "info": "หัวคน ตัวสิงโต หางแมงป่อง นิสัยแย่ทุกส่วน"
  },
  {
    "id": "E09",
    "rank": "Epic",
    "name": "Cyclo",
    "species": "Cyclops",
    "hp": 120,
    "attackDamage": 8,
    "attackInterval": 4,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 4 เทิร์น"
    ],
    "reward": "ไพ่เกรียน 6 ใบ",
    "info": "ตาเดียว มองไม่เห็นความผิดตัวเอง"
  },
  {
    "id": "E10",
    "rank": "Epic",
    "name": "Drako",
    "species": "Drake Lord",
    "hp": 150,
    "attackDamage": 9,
    "attackInterval": 4,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 4 เทิร์น"
    ],
    "reward": "ไพ่เกรียน 4 ใบ + ไพ่คำสาป 2 ใบ + ไพ่เขียว 2 ใบ",
    "info": "เจ้าแห่งมังกรปีกกุด ยังพ่นไฟได้ แต่บินไม่ได้"
  },
  {
    "id": "L01",
    "rank": "Legend",
    "name": "Lizzie",
    "species": "Baby Dragon",
    "hp": 100,
    "attackDamage": 10,
    "attackInterval": 6,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 6 เทิร์น",
      "มอบไพ่บัฟ 4 ใบ -> หายไปทันที"
    ],
    "reward": null,
    "info": "ลูกมังกรแรกเกิด อ่อนแอและต้องการการรักษา"
  },
  {
    "id": "L02",
    "rank": "Legend",
    "name": "Sphinxy",
    "species": "Sphinx",
    "hp": 150,
    "attackDamage": 8,
    "attackInterval": 5,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 5 เทิร์น",
      "สะท้อน Dmg 50%",
      "มอบไพ่เกรียน 2 ใบ (\"เฉลยปริศนา\") -> หายไป"
    ],
    "reward": null,
    "info": "ถามปริศนา แต่เฉลยเองไม่ได้"
  },
  {
    "id": "L03",
    "rank": "Legend",
    "name": "Gini",
    "species": "Genie",
    "hp": 120,
    "attackDamage": 6,
    "attackInterval": 6,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 6 เทิร์น",
      "มอบไพ่ใดก็ได้ 3 ใบ -> ผู้มอบเลือกไพ่ 1 ใบจากกองได้ แล้วหายไป"
    ],
    "reward": null,
    "info": "ให้พร 3 ข้อ แต่ที่นี่ลดเหลือข้อเดียว (เงินเฟ้อ)"
  },
  {
    "id": "L04",
    "rank": "Legend",
    "name": "Unico",
    "species": "Unicorn",
    "hp": 130,
    "attackDamage": 7,
    "attackInterval": 5,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 5 เทิร์น",
      "สะท้อน Dmg 100%",
      "มอบไพ่เขียว 2 ใบ -> ฟื้น HP ให้ผู้เล่นทุกคน +10 แล้วหายไป"
    ],
    "reward": null,
    "info": "ใสซื่อ แต่ใครแตะโดนเอาคืนหนัก"
  },
  {
    "id": "L05",
    "rank": "Legend",
    "name": "Lepri",
    "species": "Leprechaun",
    "hp": 80,
    "attackDamage": 5,
    "attackInterval": 4,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 4 เทิร์น",
      "แลกไพ่ 1 ใบ -> รับไพ่สุ่ม 2 ใบ (แลกได้ 3 ครั้ง แล้วหายไป)",
      "สะท้อน Dmg 30%"
    ],
    "reward": null,
    "info": "ปลายสายรุ้งคือกับดักภาษี"
  },
  {
    "id": "L06",
    "rank": "Legend",
    "name": "Fenny",
    "species": "Phoenix",
    "hp": 200,
    "attackDamage": 8,
    "attackInterval": 5,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 5 เทิร์น",
      "ตายแล้วฟื้นด้วย HP เต็ม 1 ครั้ง",
      "มอบไพ่ Resurrection 1 ใบ -> หายไป"
    ],
    "reward": null,
    "info": "ตายบ่อยจนชิน"
  },
  {
    "id": "L07",
    "rank": "Legend",
    "name": "Mirro",
    "species": "Mirror Knight",
    "hp": 160,
    "attackDamage": 6,
    "attackInterval": 4,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 4 เทิร์น",
      "สะท้อน Dmg 100% (ไม่สนเกราะ)",
      "มอบไพ่ฟ้า Defense 2 ใบ -> หายไป"
    ],
    "reward": null,
    "info": "ตีใคร ก็ตีตัวเอง"
  },
  {
    "id": "L08",
    "rank": "Legend",
    "name": "Treeo",
    "species": "Ancient Treant",
    "hp": 250,
    "attackDamage": 7,
    "attackInterval": 6,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 6 เทิร์น",
      "สะท้อน Dmg 30%",
      "มอบไพ่เขียว 3 ใบ -> หายไป"
    ],
    "reward": null,
    "info": "ช้ามาก ตื่นมาทีก็เลยเทิร์นไปแล้ว"
  },
  {
    "id": "L09",
    "rank": "Legend",
    "name": "Dwarfy",
    "species": "Dwarf Merchant",
    "hp": 90,
    "attackDamage": 4,
    "attackInterval": 4,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 4 เทิร์น",
      "จ่ายไพ่ฟ้า 2 ใบ -> รับไพ่ Defense 3 ใบ (ครั้งเดียว แล้วหายไป)",
      "สะท้อน Dmg 50%"
    ],
    "reward": null,
    "info": "ทุกอย่างมีราคา รวมถึงความเมตตา"
  },
  {
    "id": "L10",
    "rank": "Legend",
    "name": "Kingo",
    "species": "Fallen King",
    "hp": 220,
    "attackDamage": 9,
    "attackInterval": 5,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 5 เทิร์น",
      "เรียกเก็บ \"ส่วย\" ไพ่ใดก็ได้รวม 5 ใบ (จากผู้เล่นหลายคนร่วมกันได้) -> หายไป",
      "สะท้อน Dmg 50%"
    ],
    "reward": null,
    "info": "เสียบัลลังก์ไปแล้ว แต่ไม่เสียนิสัย"
  },
  {
    "id": "M01",
    "rank": "Myth",
    "name": "Hecate",
    "species": "The Curse Witch",
    "hp": 10000,
    "attackDamage": 0,
    "attackInterval": null,
    "attackPattern": "random_living",
    "rules": [
      "สังหารผู้เล่น 1 คนทันทีที่ถูกอัญเชิญ (ไม่สนบัฟอมตะ ไม่สนเกราะ)",
      "เมื่อปรากฏตัวครั้งแรก เชื่อมพลังชีวิตผู้เล่นทุกคน: HP เท่าเดิม แต่ใครได้รับความเสียหาย",
      "มอบไพ่เกรียน 3 ใบ -> รับไพ่คำสาป 4 ใบ",
      "หากสังหารแม่มดได้ รับไพ่คำสาปแค่ 2 ใบ",
      "หายไปเองภายใน 6 เทิร์น",
      "คำสาปเชื่อมพลังชีวิตหายไปพร้อมแม่มด"
    ],
    "reward": null,
    "info": "เคยเป็นเทพ ถูกถอดยศเป็นแม่มดด้วยเหตุผลบางอย่าง แต่พลังอำนาจยังไม่ธรรมดา"
  },
  {
    "id": "M02",
    "rank": "Myth",
    "name": "Granfel",
    "species": "God of Trolling",
    "hp": null,
    "attackDamage": 1,
    "attackInterval": null,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีเฉพาะตอนถูกอัญเชิญครั้งแรก",
      "ผู้เล่นแลกไพ่เกรียนทั้งหมดเป็นไพ่คำสาปแบบสุ่มได้ผ่านเทพองค์นี้",
      "หายไปเมื่อได้ไพ่ครบตามจำนวนที่ต้องการ (4-12 ใบ) หรือไม่มีใครแลกใน 3 เทิร์น",
      "ก่อนไป มอบไพ่ชุบชีวิตให้ผู้เล่น 2 คนแบบสุ่ม"
    ],
    "reward": null,
    "info": "ผู้ตั้งชื่อเล่นเกรียนๆ ให้เหล่ามอนสเตอร์"
  },
  {
    "id": "M03",
    "rank": "Myth",
    "name": "Chronos",
    "species": "Time Eater",
    "hp": null,
    "attackDamage": 0,
    "attackInterval": null,
    "attackPattern": "random_living",
    "rules": [
      "เมื่อถูกอัญเชิญ ผู้เล่นทุกคนข้ามเทิร์นถัดไป 1 ครั้ง (ไม่สนบัฟ)",
      "ทุกเทิร์น ผู้เล่นที่ใช้ไพ่ครบ 3 ใบ ต้องทิ้งไพ่สุ่ม 1 ใบ",
      "หายไปเองใน 5 เทิร์น"
    ],
    "reward": null,
    "info": "กินเวลา แต่ไม่เคยอิ่ม"
  },
  {
    "id": "M04",
    "rank": "Myth",
    "name": "Anubix",
    "species": "Judge of the Dead",
    "hp": null,
    "attackDamage": 0,
    "attackInterval": null,
    "attackPattern": "random_living",
    "rules": [
      "เมื่อถูกอัญเชิญ ผู้เล่นที่ตายแล้ว (ไม่มีหัวใจ) ฟื้นได้ 1 คน (สุ่ม) โดยไม่ต้องใช้ไพ่",
      "ผู้เล่นที่ HP ต่ำสุด ต้องเสีย 1 หัวใจ",
      "กำจัดได้ด้วยไพ่คำสาปสังหาร 1 ใบ"
    ],
    "reward": null,
    "info": "ชั่งหัวใจกับขนนก แต่ขนนกหาย"
  },
  {
    "id": "M05",
    "rank": "Myth",
    "name": "Nyxia",
    "species": "Goddess of Night",
    "hp": null,
    "attackDamage": 0,
    "attackInterval": null,
    "attackPattern": "random_living",
    "rules": [
      "ทุกคนมองไม่เห็นไพ่ในมือตัวเอง (ใช้ได้แบบสุ่มเท่านั้น) จนกว่าเธอจะหาย",
      "หายไปเองใน 4 เทิร์น หรือเมื่อมีผู้เล่นใช้ไพ่ Luck"
    ],
    "reward": null,
    "info": "ปิดไฟทุกดวง แล้วโทษคนอื่น"
  },
  {
    "id": "M06",
    "rank": "Myth",
    "name": "Ragnar",
    "species": "Doomsday Titan",
    "hp": 99999,
    "attackDamage": 15,
    "attackInterval": 2,
    "attackPattern": "all_living",
    "rules": [
      "โจมตีทุก 2 เทิร์น ทุกเป้าหมายพร้อมกัน (ทะลุเกราะ)",
      "กำจัดได้เมื่อผู้เล่นรวมกันมอบไพ่ 10 ใบ (\"เครื่องบูชา\") หรือใช้คำสาปสังหาร",
      "หายไปเองใน 8 เทิร์น"
    ],
    "reward": null,
    "info": "ตื่นมาแล้วอารมณ์เสียเพราะถูกปลุก"
  },
  {
    "id": "M07",
    "rank": "Myth",
    "name": "Pandy",
    "species": "Pandora",
    "hp": null,
    "attackDamage": 0,
    "attackInterval": null,
    "attackPattern": "random_living",
    "rules": [
      "เมื่อถูกอัญเชิญ เปิดกล่อง: แต่ละผู้เล่นรับไพ่สุ่มจากกองกลาง 3 ใบ",
      "หายไปทันทีหลังแจกไพ่"
    ],
    "reward": null,
    "info": "บอกแล้วว่าอย่าเปิด"
  },
  {
    "id": "M08",
    "rank": "Myth",
    "name": "Ouro",
    "species": "World Serpent",
    "hp": null,
    "attackDamage": 3,
    "attackInterval": 1,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีทุก 1 เทิร์น",
      "ทุกครั้งที่โจมตี ฟื้นเต็ม (ไม่มีทางฆ่าด้วยดาเมจ)",
      "กำจัดได้เมื่อมอบไพ่ 1 ใบของแต่ละสี (ฟ้า เหลือง เขียว แดง) ครบ 4 สี (\"วงจรสมบูรณ์\")"
    ],
    "reward": null,
    "info": "กัดหางตัวเองมานับพันปี"
  },
  {
    "id": "M09",
    "rank": "Myth",
    "name": "Lucy",
    "species": "Lord of Fallen Angels",
    "hp": null,
    "attackDamage": 5,
    "attackInterval": null,
    "attackPattern": "random_living",
    "rules": [
      "โจมตีเมื่อถูกอัญเชิญ 1 ครั้ง",
      "ข้อเสนอ: ผู้เล่นเสีย 1 หัวใจ แลกกับไพ่ Immortality + Reflect (เลือกได้ครั้งเดียวต่อคน)",
      "หายไปเองใน 3 เทิร์น"
    ],
    "reward": null,
    "info": "สัญญาข้อสุดท้ายตัวเล็กเสมอ"
  },
  {
    "id": "M10",
    "rank": "Myth",
    "name": "Void",
    "species": "The Nameless One",
    "hp": null,
    "attackDamage": 0,
    "attackInterval": null,
    "attackPattern": "random_living",
    "rules": [
      "เมื่อถูกอัญเชิญ ทุกคนทิ้งไพ่ครึ่งหนึ่ง (ปัดขึ้น, สุ่ม)",
      "ไม่มีเงื่อนไขกำจัดโดยตรง",
      "หายไปเองเมื่อผู้เล่นคนใดคนหนึ่งตาย หรือครบ 5 เทิร์น"
    ],
    "reward": null,
    "info": "ไม่มีใครรู้ชื่อ เพราะเทพเกรียนยังไม่ได้ตั้งให้"
  }
];

const MONSTERS_BY_ID = new Map<string, MonsterDefinition>(
  MONSTER_CATALOGUE.map((monster) => [monster.id, monster] as const)
);

export function getMonsterDefinition(id: string): MonsterDefinition | undefined {
  return MONSTERS_BY_ID.get(id);
}

export function getMonstersByRank(rank: MonsterRank): MonsterDefinition[] {
  return MONSTER_CATALOGUE.filter((monster) => monster.rank === rank);
}

/** Selects one monster uniformly from the requested rank using an injectable random source. */
export function getRandomMonsterByRank(
  rank: MonsterRank,
  random: () => number = Math.random
): MonsterDefinition {
  const candidates = getMonstersByRank(rank);
  if (candidates.length === 0) {
    throw new Error(`No monsters are registered for rank ${rank}.`);
  }
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("Random source must return a value in the range [0, 1).");
  }
  return candidates[Math.floor(value * candidates.length)];
}

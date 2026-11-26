import { describe, expect, it } from "vitest";
import { formatPlayerStatuses } from "./statusEffects";
import type { PlayerStatusEffect } from "../game/turnEngine";

describe("formatPlayerStatuses", () => {
  it("formats every supported timed status with its duration", () => {
    const effects: PlayerStatusEffect[] = [
      { type: "skip_turn", turnsRemaining: 1 },
      { type: "dice_limit", turnsRemaining: 2 },
      { type: "dice_reduction", turnsRemaining: 3, amount: 2 },
      { type: "cards_silenced", turnsRemaining: 1 },
      { type: "movement_blocked", turnsRemaining: 2 },
      { type: "reverse_movement", turnsRemaining: 1 },
      { type: "attack_damage_reduction", turnsRemaining: 2, amount: 2 },
      { type: "reveal_hand", turnsRemaining: 1 },
      { type: "poison", turnsRemaining: 3, amount: 1 },
      { type: "cards_limit", turnsRemaining: 2, amount: 2 },
      { type: "movement_reduction", turnsRemaining: 2, amount: 1 },
      { type: "bonus_dice", turnsRemaining: 1, amount: 1 }
    ];

    expect(formatPlayerStatuses(effects)).toEqual([
      "ข้ามเทิร์น · 1 เทิร์น",
      "ทอยได้ 1 ลูก · 2 เทิร์น",
      "ผลเต๋า -2 · 3 เทิร์น",
      "ห้ามใช้ไพ่ · 1 เทิร์น",
      "หยุดเคลื่อนที่ · 2 เทิร์น",
      "เดินย้อนทิศ · 1 เทิร์น",
      "พลังโจมตี -2 · 2 เทิร์น",
      "เปิดเผยไพ่ในมือ · 1 เทิร์น",
      "พิษ -1 HP/ต้นเทิร์น · 3 เทิร์น",
      "ใช้ไพ่ได้ไม่เกิน 2 ใบ · 2 เทิร์น",
      "ระยะเดิน -1 · 2 เทิร์น",
      "ลูกเต๋า +1 · 1 เทิร์น"
    ]);
  });

  it("includes Prison separately and ignores expired effects", () => {
    expect(formatPlayerStatuses([
      { type: "poison", turnsRemaining: 0 },
      { type: "bonus_dice", turnsRemaining: -1 }
    ], 2)).toEqual(["จำคุก · 2 เทิร์น"]);
  });

  it("returns no entries when the player has no active effects", () => {
    expect(formatPlayerStatuses([])).toEqual([]);
  });
});

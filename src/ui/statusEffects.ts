import type { PlayerStatusEffect, PlayerStatusEffectType } from "../game/turnEngine";

const STATUS_LABELS: Record<PlayerStatusEffectType, (effect: PlayerStatusEffect) => string> = {
  skip_turn: () => "ข้ามเทิร์น",
  dice_limit: () => "ทอยได้ 1 ลูก",
  dice_reduction: effect => `ผลเต๋า -${effect.amount ?? 2}`,
  cards_silenced: () => "ห้ามใช้ไพ่",
  movement_blocked: () => "หยุดเคลื่อนที่",
  reverse_movement: () => "เดินย้อนทิศ",
  attack_damage_reduction: effect => `พลังโจมตี -${effect.amount ?? 2}`,
  reveal_hand: () => "เปิดเผยไพ่ในมือ",
  poison: effect => `พิษ -${effect.amount ?? 1} HP/ต้นเทิร์น`,
  cards_limit: effect => `ใช้ไพ่ได้ไม่เกิน ${effect.amount ?? 2} ใบ`,
  movement_reduction: effect => `ระยะเดิน -${effect.amount ?? 1}`,
  bonus_dice: effect => `ลูกเต๋า +${effect.amount ?? 1}`
};

export function formatPlayerStatuses(
  effects: readonly PlayerStatusEffect[],
  prisonTurnsRemaining = 0
): string[] {
  const statuses = effects
    .filter(effect => effect.turnsRemaining > 0)
    .map(effect => `${STATUS_LABELS[effect.type](effect)} · ${effect.turnsRemaining} เทิร์น`);
  if (prisonTurnsRemaining > 0) statuses.unshift(`จำคุก · ${prisonTurnsRemaining} เทิร์น`);
  return statuses;
}

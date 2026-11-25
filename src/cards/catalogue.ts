export type CardColor = "blue" | "yellow" | "green" | "red";
export type CardKind = "attack" | "defense" | "prank" | "support" | "summon" | "curse";

export type CardEffectId =
  | "damage_single"
  | "damage_single_pierce_shield"
  | "damage_and_remove_shields"
  | "damage_all_except_self"
  | "damage_with_random_splash"
  | "damage_with_self_hp_cost"
  | "conditional_damage"
  | "damage_monster_only"
  | "gain_shield"
  | "gain_team_shield"
  | "gain_shield_and_block_attack_cards"
  | "view_player_hand"
  | "steal_random_card"
  | "gain_bonus_die"
  | "draw_cards"
  | "draw_and_distribute_cards"
  | "resurrection"
  | "swap_positions"
  | "trade_for_random_card"
  | "force_discard_selected_card"
  | "skip_next_turn"
  | "limit_next_turn_dice"
  | "move_to_next_special_tile"
  | "heal"
  | "increase_max_hp"
  | "gain_heart"
  | "reroll_one_die"
  | "boost_attack_damage"
  | "boost_defense_shield"
  | "grant_invulnerability"
  | "reflect_next_damage"
  | "heal_and_end_card_play"
  | "team_heal"
  | "cleanse_negative_statuses"
  | "boost_next_attack_and_shield"
  | "summon_random_monster"
  | "instant_kill"
  | "clear_monsters_and_reroll_tiles"
  | "force_prison"
  | "reset_other_players_positions"
  | "steal_eliminated_player_cards"
  | "control_dice_values"
  | "weaken_attack_damage"
  | "drain_hp_and_heal"
  | "discard_random_half_hand"
  | "silence_card_use"
  | "remove_other_players_shields"
  | "prevent_movement"
  | "reverse_movement_direction"
  | "mark_monster_attack_target"
  | "halve_current_hp"
  | "remove_buffs_and_shields"
  | "reduce_dice_values"
  | "reveal_player_hand"
  | "swap_current_hp";

export type CurseCostOption = "pay_hp_5_to_10" | "discard_2_cards" | "curse_cooldown_3_turns";

export interface CardDefinition {
  id: string;
  sourceNumber: number;
  name: string;
  color: CardColor;
  kind: CardKind;
  scoreValue: number;
  description: string;
  effectId: CardEffectId;
  parameters?: Readonly<Record<string, string | number | boolean>>;
  curseCostOptions?: readonly CurseCostOption[];
  cooldownLimitPerGame?: number;
  cooldownEligibility?: "hp_or_cards_insufficient";
}

const CURSE_COST_OPTIONS: readonly CurseCostOption[] = [
  "pay_hp_5_to_10",
  "discard_2_cards",
  "curse_cooldown_3_turns"
];

export const CARD_CATALOGUE: readonly CardDefinition[] = [
  // BLUE — Attack / Defense (12)
  { id: "blue_common_sword", sourceNumber: 1, name: "ดาบสามัญ", color: "blue", kind: "attack", scoreValue: 1, description: "ดาเมจ 3 ใส่เป้าหมาย 1 เป้า", effectId: "damage_single", parameters: { damage: 3, target: "one_player" } },
  { id: "blue_accurate_arrow", sourceNumber: 2, name: "ธนูแม่นยำ", color: "blue", kind: "attack", scoreValue: 1, description: "ดาเมจ 2 ทะลุโล่", effectId: "damage_single_pierce_shield", parameters: { damage: 2, target: "one_player" } },
  { id: "blue_armor_breaking_axe", sourceNumber: 3, name: "ขวานผ่าเกราะ", color: "blue", kind: "attack", scoreValue: 1, description: "ดาเมจ 3 และลบโล่ทั้งหมดของเป้าหมาย", effectId: "damage_and_remove_shields", parameters: { damage: 3, target: "one_player", removeAllShields: true } },
  { id: "blue_thunderclap", sourceNumber: 4, name: "ฟ้าผ่าเปรี้ยง", color: "blue", kind: "attack", scoreValue: 1, description: "ดาเมจ 2 ใส่ผู้เล่นทุกคนยกเว้นตัวเอง", effectId: "damage_all_except_self", parameters: { damage: 2 } },
  { id: "blue_grenade", sourceNumber: 5, name: "ระเบิดมือ", color: "blue", kind: "attack", scoreValue: 1, description: "ดาเมจ 3 ใส่เป้าหมาย และ 1 ใส่ผู้เล่นหรือมอนสเตอร์อื่นแบบสุ่ม", effectId: "damage_with_random_splash", parameters: { targetDamage: 3, splashDamage: 1, splashTarget: "other_player_or_monster" } },
  { id: "blue_double_edged_sword", sourceNumber: 6, name: "ดาบสองคม", color: "blue", kind: "attack", scoreValue: 1, description: "ดาเมจ 6 ใส่เป้าหมาย แต่ตัวเองเสีย 2 HP", effectId: "damage_with_self_hp_cost", parameters: { targetDamage: 6, selfHpCost: 2 } },
  { id: "blue_counter_punch", sourceNumber: 7, name: "หมัดเอาคืน", color: "blue", kind: "attack", scoreValue: 1, description: "ดาเมจ 2 ถ้า HP เป้าหมายน้อยกว่าคุณ จะเป็นดาเมจ 4", effectId: "conditional_damage", parameters: { baseDamage: 2, conditionalDamage: 4, condition: "target_hp_below_user_hp" } },
  { id: "blue_monster_hunter", sourceNumber: 8, name: "นักล่ามอนสเตอร์", color: "blue", kind: "attack", scoreValue: 1, description: "ดาเมจ 5 ใช้ได้กับมอนสเตอร์เท่านั้น", effectId: "damage_monster_only", parameters: { damage: 5, target: "monster_only" } },
  { id: "blue_wooden_shield", sourceNumber: 9, name: "โล่ไม้", color: "blue", kind: "defense", scoreValue: 1, description: "ได้โล่ +1", effectId: "gain_shield", parameters: { amount: 1 } },
  { id: "blue_iron_shield", sourceNumber: 10, name: "โล่เหล็ก", color: "blue", kind: "defense", scoreValue: 1, description: "ได้โล่ +2", effectId: "gain_shield", parameters: { amount: 2 } },
  { id: "blue_double_wall", sourceNumber: 11, name: "กำแพงคู่", color: "blue", kind: "defense", scoreValue: 1, description: "ตัวเองได้โล่ +1 และเพื่อนร่วมทีม 1 คนได้โล่ +1 (ถ้าไม่มีเพื่อนร่วมทีม ตัวเองได้ +2)", effectId: "gain_team_shield", parameters: { selfShield: 1, teammateShield: 1, noTeammateSelfShield: 2 } },
  { id: "blue_armor_seal", sourceNumber: 12, name: "ผนึกเกราะ", color: "blue", kind: "defense", scoreValue: 1, description: "ได้โล่ +3 แต่ห้ามใช้ไพ่โจมตีในเทิร์นนี้", effectId: "gain_shield_and_block_attack_cards", parameters: { shield: 3, blockAttackCardsThisTurn: true } },

  // YELLOW — Prank (12)
  { id: "yellow_peek", sourceNumber: 1, name: "แอบดู", color: "yellow", kind: "prank", scoreValue: 0, description: "ดูไพ่บนมือผู้เล่น 1 คน", effectId: "view_player_hand", parameters: { target: "one_player" } },
  { id: "yellow_pickpocket", sourceNumber: 2, name: "ล้วงกระเป๋า", color: "yellow", kind: "prank", scoreValue: 0, description: "สุ่มขโมยไพ่ 1 ใบจากมือผู้เล่น 1 คน", effectId: "steal_random_card", parameters: { target: "one_player", count: 1 } },
  { id: "yellow_lucky_dice", sourceNumber: 3, name: "ลูกเต๋าโชคดี", color: "yellow", kind: "prank", scoreValue: 0, description: "ได้ลูกเต๋าเพิ่ม +1 ลูกในเทิร์นนี้ (ใช้ได้ 1 ใบต่อเทิร์น)", effectId: "gain_bonus_die", parameters: { dice: 1, duration: "current_turn", maxUsesPerTurn: 1 } },
  { id: "yellow_card_rain", sourceNumber: 4, name: "ฝนไพ่", color: "yellow", kind: "prank", scoreValue: 0, description: "จั่วไพ่สุ่ม 4 ใบ", effectId: "draw_cards", parameters: { count: 4 } },
  { id: "yellow_card_gift", sourceNumber: 5, name: "แจกไพ่", color: "yellow", kind: "prank", scoreValue: 0, description: "ตัวเองจั่ว 2 ใบ ผู้เล่นคนอื่นจั่วคนละ 1 ใบ", effectId: "draw_and_distribute_cards", parameters: { selfDraw: 2, otherPlayersDraw: 1 } },
  { id: "yellow_resurrection", sourceNumber: 6, name: "ชุบชีวิต", color: "yellow", kind: "prank", scoreValue: 0, description: "ใช้ชุบผู้เล่นที่ตกรอบ 1 คน หรือถือไว้เพื่อชุบตัวเองอัตโนมัติ", effectId: "resurrection", parameters: { reviveEliminatedPlayers: 1, selfReviveWhenHeld: true } },
  { id: "yellow_swap_places", sourceNumber: 7, name: "สลับที่", color: "yellow", kind: "prank", scoreValue: 0, description: "สลับตำแหน่งบนกระดานกับผู้เล่น 1 คน", effectId: "swap_positions", parameters: { target: "one_player" } },
  { id: "yellow_card_trade", sourceNumber: 8, name: "แลกไพ่", color: "yellow", kind: "prank", scoreValue: 0, description: "เลือกไพ่ 1 ใบจากมือคุณ แลกกับไพ่สุ่ม 1 ใบจากมือผู้เล่นอื่น", effectId: "trade_for_random_card", parameters: { give: 1, receiveRandom: 1, target: "another_player" } },
  { id: "yellow_forced_discard", sourceNumber: 9, name: "บังคับทิ้ง", color: "yellow", kind: "prank", scoreValue: 0, description: "ผู้เล่นเป้าหมายต้องทิ้งไพ่ 1 ใบ (เจ้าตัวเลือกเอง)", effectId: "force_discard_selected_card", parameters: { target: "one_player", count: 1, selectedByTarget: true } },
  { id: "yellow_sleep_spell", sourceNumber: 10, name: "มนต์หลับ", color: "yellow", kind: "prank", scoreValue: 0, description: "ผู้เล่นเป้าหมายข้ามเทิร์นถัดไป 1 เทิร์น", effectId: "skip_next_turn", parameters: { target: "one_player", turns: 1 } },
  { id: "yellow_cursed_dice", sourceNumber: 11, name: "ลูกเต๋าอาถรรพ์", color: "yellow", kind: "prank", scoreValue: 0, description: "เป้าหมายทอยได้เพียง 1 ลูกในเทิร์นถัดไป", effectId: "limit_next_turn_dice", parameters: { target: "one_player", diceCount: 1, duration: "next_turn" } },
  { id: "yellow_magic_shortcut", sourceNumber: 12, name: "ทางลัดมหัศจรรย์", color: "yellow", kind: "prank", scoreValue: 0, description: "เดินไปยังช่องพิเศษที่ใกล้ที่สุดข้างหน้าทันที (ไม่ต้องทอยลูกเต๋า)", effectId: "move_to_next_special_tile", parameters: { direction: "forward", requiresDiceRoll: false } },

  // GREEN — Healing / Buff (12)
  { id: "green_herbal_potion", sourceNumber: 1, name: "ยาสมุนไพร", color: "green", kind: "support", scoreValue: 1, description: "ฟื้น HP +5", effectId: "heal", parameters: { amount: 5 } },
  { id: "green_life_core", sourceNumber: 2, name: "แก่นพลังชีวิต", color: "green", kind: "support", scoreValue: 1, description: "HP สูงสุด +2 ถาวร", effectId: "increase_max_hp", parameters: { amount: 2, permanent: true } },
  { id: "green_extra_heart", sourceNumber: 3, name: "หัวใจเสริม", color: "green", kind: "support", scoreValue: 1, description: "ได้หัวใจ +1 (สูงสุด 3 ดวง)", effectId: "gain_heart", parameters: { amount: 1, maximum: 3 } },
  { id: "green_lucky_clover", sourceNumber: 4, name: "ใบโคลเวอร์นำโชค", color: "green", kind: "support", scoreValue: 1, description: "ทอยเต๋าใหม่ได้ 1 ครั้งในเทิร์นนี้", effectId: "reroll_one_die", parameters: { rerolls: 1, duration: "current_turn" } },
  { id: "green_brave_spirit", sourceNumber: 5, name: "สุรากล้าหาญ", color: "green", kind: "support", scoreValue: 1, description: "ไพ่โจมตีที่ใช้ในเทิร์นนี้ ดาเมจ +2", effectId: "boost_attack_damage", parameters: { amount: 2, duration: "current_turn" } },
  { id: "green_power_armor", sourceNumber: 6, name: "เกราะเสริมพลัง", color: "green", kind: "support", scoreValue: 1, description: "ไพ่ป้องกันที่ใช้ในเทิร์นนี้ ได้โล่เพิ่ม +1", effectId: "boost_defense_shield", parameters: { amount: 1, duration: "current_turn" } },
  { id: "green_immortal_blessing", sourceNumber: 7, name: "พรอมตะ", color: "green", kind: "support", scoreValue: 1, description: "ไม่ได้รับดาเมจเป็นเวลา 3 เทิร์นของคุณ", effectId: "grant_invulnerability", parameters: { duration: 3, durationUnit: "owner_turns" } },
  { id: "green_reflection_mirror", sourceNumber: 8, name: "กระจกสะท้อน", color: "green", kind: "support", scoreValue: 1, description: "ดาเมจที่โดนครั้งต่อไป 1 ครั้ง สะท้อนกลับไปหาผู้โจมตี", effectId: "reflect_next_damage", parameters: { hits: 1 } },
  { id: "green_greater_heal", sourceNumber: 9, name: "ยาฮีลใหญ่", color: "green", kind: "support", scoreValue: 1, description: "ฟื้น HP +10 แต่ห้ามใช้ไพ่อื่นต่อในเทิร์นนี้", effectId: "heal_and_end_card_play", parameters: { amount: 10, endCardPlay: true } },
  { id: "green_team_bond", sourceNumber: 10, name: "สายใยทีม", color: "green", kind: "support", scoreValue: 1, description: "ฟื้น HP +3 ให้ตัวเองและเพื่อนร่วมทีม 1 คน (ถ้าไม่มีเพื่อนร่วมทีม ฟื้นให้ตัวเอง +5)", effectId: "team_heal", parameters: { selfHeal: 3, teammateHeal: 3, noTeammateSelfHeal: 5 } },
  { id: "green_holy_water", sourceNumber: 11, name: "น้ำศักดิ์สิทธิ์", color: "green", kind: "support", scoreValue: 1, description: "ล้างสถานะลบทั้งหมดของตัวเอง (หลับ, ลูกเต๋าอาถรรพ์ ฯลฯ)", effectId: "cleanse_negative_statuses", parameters: { target: "self", removeAllNegativeStatuses: true } },
  { id: "green_double_blessing", sourceNumber: 12, name: "พรสองชั้น", color: "green", kind: "support", scoreValue: 1, description: "ไพ่โจมตีใบถัดไปดาเมจ +1 และได้โล่ +1 ทันที", effectId: "boost_next_attack_and_shield", parameters: { nextAttackDamage: 1, shieldNow: 1 } },

  // RED — Summon (5) / Curse (19)
  { id: "red_summon_common", sourceNumber: 1, name: "อัญเชิญสามัญ", color: "red", kind: "summon", scoreValue: -2, description: "สุ่มมอนสเตอร์ระดับ Common 1 ตัว", effectId: "summon_random_monster", parameters: { rank: "Common", count: 1 } },
  { id: "red_summon_rare", sourceNumber: 2, name: "อัญเชิญหายาก", color: "red", kind: "summon", scoreValue: -2, description: "สุ่มมอนสเตอร์ระดับ Rare 1 ตัว", effectId: "summon_random_monster", parameters: { rank: "Rare", count: 1 } },
  { id: "red_summon_epic", sourceNumber: 3, name: "อัญเชิญมหากาพย์", color: "red", kind: "summon", scoreValue: -2, description: "สุ่มมอนสเตอร์ระดับ Epic 1 ตัว", effectId: "summon_random_monster", parameters: { rank: "Epic", count: 1 } },
  { id: "red_summon_legend", sourceNumber: 4, name: "อัญเชิญตำนาน", color: "red", kind: "summon", scoreValue: -2, description: "สุ่มมอนสเตอร์ระดับ Legend 1 ตัว", effectId: "summon_random_monster", parameters: { rank: "Legend", count: 1 } },
  { id: "red_summon_myth", sourceNumber: 5, name: "อัญเชิญเทพปกรณัม", color: "red", kind: "summon", scoreValue: -2, description: "สุ่มมอนสเตอร์ระดับ Myth 1 ตัว", effectId: "summon_random_monster", parameters: { rank: "Myth", count: 1 } },
  { id: "red_instant_kill", sourceNumber: 6, name: "สังหารทันที", color: "red", kind: "curse", scoreValue: -4, description: "เป้าหมาย 1 คนตายทันที (อมตะกันได้)", effectId: "instant_kill", parameters: { target: "one_player", blockedByInvulnerability: true }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_board_wipe", sourceNumber: 7, name: "ล้างกระดาน", color: "red", kind: "curse", scoreValue: -4, description: "ลบมอนสเตอร์ทั้งหมด และสุ่มช่องพิเศษใหม่", effectId: "clear_monsters_and_reroll_tiles", curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_forced_prison", sourceNumber: 8, name: "คุกบังคับ", color: "red", kind: "curse", scoreValue: -4, description: "ส่งเป้าหมายเข้าคุก", effectId: "force_prison", parameters: { target: "one_player" }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_table_flip", sourceNumber: 9, name: "พลิกโต๊ะ", color: "red", kind: "curse", scoreValue: -4, description: "ทุกคนยกเว้นผู้ใช้กลับจุดเริ่มต้น", effectId: "reset_other_players_positions", parameters: { excludeSelf: true, position: 0 }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_grave_robbery", sourceNumber: 10, name: "ปล้นสุสาน", color: "red", kind: "curse", scoreValue: -4, description: "ยึดไพ่ทั้งหมดจากผู้เล่นที่ตายแล้ว 1 คน", effectId: "steal_eliminated_player_cards", parameters: { target: "one_eliminated_player", allCards: true }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_dice_control", sourceNumber: 11, name: "ควบคุมลูกเต๋า", color: "red", kind: "curse", scoreValue: -4, description: "เลือกค่าลูกเต๋าเองได้ (สูงสุด 3 ลูก, 1 ครั้งต่อเทิร์น)", effectId: "control_dice_values", parameters: { maximumDice: 3, maxUsesPerTurn: 1 }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_weaken", sourceNumber: 12, name: "อ่อนแรง", color: "red", kind: "curse", scoreValue: -4, description: "ดาเมจไพ่โจมตีของเป้าหมาย -2 เป็นเวลา 3 เทิร์น", effectId: "weaken_attack_damage", parameters: { target: "one_player", damageReduction: 2, duration: 3 }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_life_drain", sourceNumber: 13, name: "สูบเลือด", color: "red", kind: "curse", scoreValue: -4, description: "เป้าหมายเสีย 4 HP ผู้ใช้ฟื้น 4 HP", effectId: "drain_hp_and_heal", parameters: { targetDamage: 4, selfHeal: 4 }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_hand_robbery", sourceNumber: 14, name: "ปล้นมือ", color: "red", kind: "curse", scoreValue: -4, description: "เป้าหมายทิ้งไพ่สุ่มครึ่งมือ (ปัดขึ้น)", effectId: "discard_random_half_hand", parameters: { target: "one_player", fraction: 0.5, rounding: "up", random: true }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_silence", sourceNumber: 15, name: "เงียบงัน", color: "red", kind: "curse", scoreValue: -4, description: "เป้าหมายใช้ไพ่ไม่ได้ 1 เทิร์น (ทอยเต๋าได้)", effectId: "silence_card_use", parameters: { target: "one_player", duration: 1, canRollDice: true }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_shield_dissolve", sourceNumber: 16, name: "สลายโล่", color: "red", kind: "curse", scoreValue: -4, description: "ลบโล่ของผู้เล่นทุกคนยกเว้นผู้ใช้", effectId: "remove_other_players_shields", parameters: { excludeSelf: true }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_binding", sourceNumber: 17, name: "พันธนาการ", color: "red", kind: "curse", scoreValue: -4, description: "เป้าหมายเดินไม่ได้ 2 เทิร์น (ใช้ไพ่ได้)", effectId: "prevent_movement", parameters: { target: "one_player", duration: 2, canUseCards: true }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_reverse_walk", sourceNumber: 18, name: "เดินถอยหลัง", color: "red", kind: "curse", scoreValue: -4, description: "เป้าหมายต้องเดินย้อนทิศในเทิร์นถัดไป", effectId: "reverse_movement_direction", parameters: { target: "one_player", duration: "next_turn" }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_hunt_bait", sourceNumber: 19, name: "เหยื่อล่า", color: "red", kind: "curse", scoreValue: -4, description: "มอนสเตอร์ทุกตัวโจมตีเป้าหมายที่เลือกในรอบโจมตีถัดไป", effectId: "mark_monster_attack_target", parameters: { target: "one_player", nextScheduledAttack: true }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_despair", sourceNumber: 20, name: "สิ้นหวัง", color: "red", kind: "curse", scoreValue: -4, description: "HP ปัจจุบันของเป้าหมายลดลงครึ่ง (ปัดลง)", effectId: "halve_current_hp", parameters: { target: "one_player", divisor: 2, rounding: "down" }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_power_wipe", sourceNumber: 21, name: "ล้างพลัง", color: "red", kind: "curse", scoreValue: -4, description: "ลบบัฟและโล่ทั้งหมดของเป้าหมาย (รวมอมตะ/สะท้อน)", effectId: "remove_buffs_and_shields", parameters: { target: "one_player", removeInvulnerability: true, removeReflection: true }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_cursed_dice", sourceNumber: 22, name: "เต๋าต้องคำสาป", color: "red", kind: "curse", scoreValue: -4, description: "ค่าลูกเต๋าของเป้าหมายลด -2 (ขั้นต่ำ 1) เป็นเวลา 2 เทิร์น", effectId: "reduce_dice_values", parameters: { target: "one_player", reduction: 2, minimum: 1, duration: 2 }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_public_hand", sourceNumber: 23, name: "เปิดไพ่ประจานตัว", color: "red", kind: "curse", scoreValue: -4, description: "เป้าหมายต้องเปิดไพ่บนมือให้ทุกคนเห็น 3 เทิร์น", effectId: "reveal_player_hand", parameters: { target: "one_player", duration: 3 }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" },
  { id: "red_fate_swap", sourceNumber: 24, name: "สลับชะตา", color: "red", kind: "curse", scoreValue: -4, description: "สลับค่า HP ปัจจุบันกับเป้าหมาย 1 คน", effectId: "swap_current_hp", parameters: { target: "one_player", value: "current_hp" }, curseCostOptions: CURSE_COST_OPTIONS, cooldownLimitPerGame: 3, cooldownEligibility: "hp_or_cards_insufficient" }
];

export function getCardDefinition(cardId: string): CardDefinition | undefined {
  return CARD_CATALOGUE.find((card) => card.id === cardId);
}

export function getCardsByColor(color: CardColor): readonly CardDefinition[] {
  return CARD_CATALOGUE.filter((card) => card.color === color);
}

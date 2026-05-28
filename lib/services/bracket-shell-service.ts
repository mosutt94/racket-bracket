import type { Gender, NextMatchSlot, SlamType } from "@/lib/types";

/**
 * Pure bracket-shape definitions for a 128-player Grand Slam draw.
 * No I/O; the persistence layer uses these to insert the right rows.
 */

export interface RoundDefinition {
  roundNumber: number;
  roundName: string;
  pointsPerCorrectPick: number;
}

export interface DrawSlotPlan {
  position: number; // 1..128
  side: "top" | "bottom";
  section: number; // 1..8, used by the bracket UI for quarter grouping
}

export interface MatchPlan {
  roundNumber: number; // 1..7
  matchNumber: number; // 1..(2^(7-roundNumber))
  /** Round 1 only — references draw_slots.position. Null for rounds 2-7 (filled by advancement). */
  player1DrawSlotPosition: number | null;
  player2DrawSlotPosition: number | null;
  /** (roundNumber, matchNumber) of the next match the winner advances to. Null for the final. */
  nextRoundNumber: number | null;
  nextMatchNumber: number | null;
  nextMatchSlot: NextMatchSlot | null;
}

export interface SlamCalendarDefaults {
  qualifyingStartsAt: string; // ISO
  mainDrawStartsAt: string;
  finalStartsAt: string;
}

const ROUND_DEFAULTS: ReadonlyArray<RoundDefinition> = [
  { roundNumber: 1, roundName: "Round of 128", pointsPerCorrectPick: 1 },
  { roundNumber: 2, roundName: "Round of 64", pointsPerCorrectPick: 2 },
  { roundNumber: 3, roundName: "Round of 32", pointsPerCorrectPick: 4 },
  { roundNumber: 4, roundName: "Round of 16", pointsPerCorrectPick: 8 },
  { roundNumber: 5, roundName: "Quarterfinal", pointsPerCorrectPick: 16 },
  { roundNumber: 6, roundName: "Semifinal", pointsPerCorrectPick: 32 },
  { roundNumber: 7, roundName: "Final", pointsPerCorrectPick: 64 }
];

export function getDefaultRoundDefinitions(): RoundDefinition[] {
  return ROUND_DEFAULTS.map((round) => ({ ...round }));
}

export function getDefaultDrawSlotPlan(): DrawSlotPlan[] {
  // 128 positions split into 8 sections of 16 (quarters of 32 ≡ 2 sections each).
  // Positions 1-64 are the top half, 65-128 are the bottom half.
  return Array.from({ length: 128 }, (_, index) => {
    const position = index + 1;
    return {
      position,
      side: position <= 64 ? "top" : "bottom",
      section: Math.ceil(position / 16) // 1..8
    };
  });
}

/**
 * 127-match plan. Round 1 matches reference draw positions (2M-1, 2M).
 * Match M in round R feeds match ceil(M/2) in round R+1; odd M → player1, even M → player2.
 */
export function getDefaultBracketShellMatchPlan(): MatchPlan[] {
  const plan: MatchPlan[] = [];
  for (let roundNumber = 1; roundNumber <= 7; roundNumber += 1) {
    const matchCount = 2 ** (7 - roundNumber);
    for (let matchNumber = 1; matchNumber <= matchCount; matchNumber += 1) {
      const isFinal = roundNumber === 7;
      const nextRoundNumber = isFinal ? null : roundNumber + 1;
      const nextMatchNumber = isFinal ? null : Math.ceil(matchNumber / 2);
      const nextMatchSlot: NextMatchSlot | null = isFinal ? null : matchNumber % 2 === 1 ? "player1" : "player2";

      plan.push({
        roundNumber,
        matchNumber,
        player1DrawSlotPosition: roundNumber === 1 ? matchNumber * 2 - 1 : null,
        player2DrawSlotPosition: roundNumber === 1 ? matchNumber * 2 : null,
        nextRoundNumber,
        nextMatchNumber,
        nextMatchSlot
      });
    }
  }
  return plan;
}

/**
 * Default tournament-instance dates per Grand Slam. These cover the typical window;
 * the ESPN provider can refine them later if it ever returns calendar data.
 */
export function getSlamCalendarDefaults(slamType: SlamType, year: number): SlamCalendarDefaults {
  switch (slamType) {
    case "australian_open":
      return {
        qualifyingStartsAt: utcIso(year, 1, 8, 10),
        mainDrawStartsAt: utcIso(year, 1, 18, 10),
        finalStartsAt: utcIso(year, 1, 31, 10)
      };
    case "french_open":
      return {
        qualifyingStartsAt: utcIso(year, 5, 18, 10),
        mainDrawStartsAt: utcIso(year, 5, 24, 10),
        finalStartsAt: utcIso(year, 6, 7, 9)
      };
    case "wimbledon":
      return {
        qualifyingStartsAt: utcIso(year, 6, 23, 10),
        mainDrawStartsAt: utcIso(year, 6, 30, 10),
        finalStartsAt: utcIso(year, 7, 13, 9)
      };
    case "us_open":
      return {
        qualifyingStartsAt: utcIso(year, 8, 18, 10),
        mainDrawStartsAt: utcIso(year, 8, 25, 10),
        finalStartsAt: utcIso(year, 9, 7, 9)
      };
  }
}

export function getSlamDisplayName(slamType: SlamType, year: number, gender: Gender): string {
  const slamName: Record<SlamType, string> = {
    australian_open: "Australian Open",
    french_open: "French Open",
    wimbledon: "Wimbledon",
    us_open: "US Open"
  };
  const genderLabel = gender === "women" ? "Women's Singles" : "Men's Singles";
  return `${slamName[slamType]} ${year} ${genderLabel}`;
}

function utcIso(year: number, monthOneBased: number, day: number, hour: number) {
  return new Date(Date.UTC(year, monthOneBased - 1, day, hour, 0, 0)).toISOString();
}

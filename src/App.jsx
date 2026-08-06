import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { TermsOfService, PrivacyPolicy } from "./legal";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const loadJsPDF = () => new Promise((resolve, reject) => {
  if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  script.onload = () => resolve(window.jspdf.jsPDF);
  script.onerror = reject;
  document.head.appendChild(script);
});

const exportToPDF = async (plan) => {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const GREEN = [27, 122, 77]; // --accent
  const GREEN_DEEP = [20, 92, 58]; // --accent-deep
  const DARK = [22, 35, 28]; // --ink
  const GRAY = [110, 117, 104]; // --muted
  const LIGHT_GREEN_BG = [234, 245, 238]; // --accent-bg
  const PAPER = [248, 247, 242]; // --paper
  const WARM_BG = [251, 243, 228]; // --warm-bg
  const WARM_TEXT = [122, 90, 30]; // --warm-text
  const COOL_BG = [234, 242, 251]; // --cool-bg
  const COOL_TEXT = [30, 76, 122]; // --cool-text
  const pageW = 210;
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 20;

  const checkPage = (needed = 10) => {
    if (y + needed > 275) { doc.addPage(); y = 20; }
  };

  const addText = (text, x, fontSize, color, fontStyle = "normal", maxWidth = null) => {
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    doc.setFont("helvetica", fontStyle);
    if (maxWidth) {
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return lines.length * (fontSize * 0.45);
    } else {
      doc.text(text, x, y);
      return fontSize * 0.45;
    }
  };

  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont("times", "bold");
  doc.text("FitPlan AI", margin, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Your Personalized Fitness AI · fitplan-lake.vercel.app", margin, 20);
  y = 38;

  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  doc.setFont("times", "bold");
  const titleLines = doc.splitTextToSize(plan.title, contentW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 2;

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(plan.summary, contentW);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 4.5 + 4;

  const pillW = contentW / 2 - 2;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const scheduleLines = doc.splitTextToSize(`Schedule: ${plan.schedule?.join(", ")}`, pillW - 6);
  const durationLines = doc.splitTextToSize(`Duration: ${plan.weeks} weeks`, pillW - 6);
  const pillH = Math.max(scheduleLines.length, durationLines.length) * 4 + 4;

  doc.setFillColor(...LIGHT_GREEN_BG);
  doc.roundedRect(margin, y, pillW, pillH, 2, 2, "F");
  doc.setTextColor(...GREEN_DEEP);
  doc.text(scheduleLines, margin + 3, y + 5);
  doc.setFillColor(...COOL_BG);
  doc.roundedRect(margin + contentW / 2 + 2, y, pillW, pillH, 2, 2, "F");
  doc.setTextColor(...COOL_TEXT);
  doc.text(durationLines, margin + contentW / 2 + 5, y + 5);
  y += pillH + 6;

  if (plan.weeks_breakdown) {
    checkPage(20);
    doc.setFillColor(...PAPER);
    doc.roundedRect(margin, y, contentW, plan.weeks_breakdown.length * 9 + 10, 3, 3, "F");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "bold");
    doc.text("PROGRAM PHASES", margin + 4, y + 6);
    y += 10;
    plan.weeks_breakdown.forEach((p, i) => {
      doc.setFillColor(...GREEN);
      doc.circle(margin + 7, y + 2.5, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(String(i + 1), margin + 7, y + 2.5, { align: "center", baseline: "middle" });
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(p.phase, margin + 13, y + 3);
      doc.setTextColor(...GRAY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      const focusLines = doc.splitTextToSize(p.focus, contentW - 20);
      doc.text(focusLines, margin + 13, y + 7);
      y += focusLines.length * 4 + 6;
    });
    y += 4;
  }

  plan.workouts?.forEach(w => {
    checkPage(40);

    doc.setFillColor(...GREEN);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, "F");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont("times", "bold");
    doc.text(`${w.day.toUpperCase()} — ${w.name}`, margin + 4, y + 7);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(w.duration, pageW - margin - doc.getTextWidth(w.duration) - 4, y + 7);
    y += 13;

    checkPage(10);
    doc.setFillColor(...WARM_BG);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const warmupTextLines = doc.splitTextToSize(w.warmup, contentW - 24);
    doc.roundedRect(margin, y, contentW, warmupTextLines.length * 4.5 + 6, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(...WARM_TEXT);
    doc.setFont("helvetica", "bold");
    doc.text("WARM-UP", margin + 3, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(warmupTextLines, margin + 20, y + 5);
    y += warmupTextLines.length * 4.5 + 8;

    w.exercises?.forEach((ex, i) => {
      checkPage(12);
      doc.setFillColor(...(i % 2 === 0 ? PAPER : [255, 255, 255]));
      const noteLines = ex.note ? doc.splitTextToSize(ex.note, contentW - 40) : [];
      const rowH = 10 + (noteLines.length > 0 ? noteLines.length * 3.5 + 2 : 0) + (ex.effort ? 3.5 : 0);
      doc.roundedRect(margin, y, contentW, rowH, 1.5, 1.5, "F");

      doc.setFillColor(228, 227, 218);
      doc.circle(margin + 6, y + 5, 4, "F");
      doc.setFontSize(7);
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.text(String(i + 1), margin + 6, y + 5, { align: "center", baseline: "middle" });

      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.text(ex.name, margin + 13, y + 5.5);

      if (ex.note) {
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.setFont("helvetica", "normal");
        doc.text(noteLines, margin + 13, y + 9.5);
      }

      doc.setFontSize(8.5);
      doc.setTextColor(...GREEN);
      doc.setFont("helvetica", "bold");
      const setsText = `${ex.sets}×${ex.reps}`;
      doc.text(setsText, pageW - margin - 4, y + 5.5, { align: "right" });
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.setFont("helvetica", "normal");
      doc.text(`${ex.rest} rest`, pageW - margin - 4, y + 9.5, { align: "right" });
      if (ex.effort) {
        doc.text(ex.effort, pageW - margin - 4, y + 13, { align: "right" });
      }

      y += rowH + 1.5;
    });

    checkPage(10);
    doc.setFillColor(...LIGHT_GREEN_BG);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const cooldownLines = doc.splitTextToSize(w.cooldown, contentW - 24);
    doc.roundedRect(margin, y, contentW, cooldownLines.length * 4.5 + 6, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(...GREEN_DEEP);
    doc.setFont("helvetica", "bold");
    doc.text("COOL-DOWN", margin + 3, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(cooldownLines, margin + 22, y + 5);
    y += cooldownLines.length * 4.5 + 10;
  });

  if (plan.nutrition_tips) {
    checkPage(30);
    doc.setFillColor(...PAPER);
    doc.roundedRect(margin, y, contentW, plan.nutrition_tips.length * 8 + 12, 3, 3, "F");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "bold");
    doc.text("NUTRITION TIPS", margin + 4, y + 7);
    y += 11;
    plan.nutrition_tips.forEach(tip => {
      doc.setFillColor(...GREEN);
      doc.circle(margin + 7, y + 2, 1.5, "F");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "normal");
      const tipLines = doc.splitTextToSize(tip, contentW - 16);
      doc.text(tipLines, margin + 11, y + 3);
      y += tipLines.length * 4.5 + 2;
    });
    y += 6;
  }

  if (plan.motivation_strategy) {
    checkPage(20);
    doc.setFillColor(...LIGHT_GREEN_BG);
    const motLines = doc.splitTextToSize(plan.motivation_strategy, contentW - 8);
    doc.roundedRect(margin, y, contentW, motLines.length * 4.5 + 12, 3, 3, "F");
    doc.setFontSize(7);
    doc.setTextColor(...GREEN_DEEP);
    doc.setFont("helvetica", "bold");
    doc.text("MOTIVATION STRATEGY", margin + 4, y + 6);
    doc.setFontSize(8);
    doc.setTextColor(...GREEN_DEEP);
    doc.setFont("helvetica", "normal");
    doc.text(motLines, margin + 4, y + 11);
    y += motLines.length * 4.5 + 16;
  }

  if (plan.weekly_checkin) {
    checkPage(20);
    doc.setFillColor(...COOL_BG);
    const checkLines = doc.splitTextToSize(plan.weekly_checkin, contentW - 8);
    doc.roundedRect(margin, y, contentW, checkLines.length * 4.5 + 12, 3, 3, "F");
    doc.setFontSize(7);
    doc.setTextColor(...COOL_TEXT);
    doc.setFont("helvetica", "bold");
    doc.text("WEEKLY CHECK-IN", margin + 4, y + 6);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(checkLines, margin + 4, y + 11);
    y += checkLines.length * 4.5 + 16;
  }

  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.text("Generated by FitPlan AI · Adjust intensity to your level · Consult a doctor before starting any new fitness program", margin, 287);

  doc.save(`${plan.title.replace(/[^a-z0-9]/gi, "_")}.pdf`);
};

const HOME_EQUIPMENT_OPTIONS = [
  { id: "barbell", label: "Barbell & plates" },
  { id: "dumbbells", label: "Dumbbells" },
  { id: "kettlebells", label: "Kettlebells" },
  { id: "bench", label: "Flat bench" },
  { id: "incline_bench", label: "Incline bench" },
  { id: "pullup_bar", label: "Pull-up bar" },
  { id: "resistance_bands", label: "Resistance bands" },
  { id: "step_platform", label: "Step platform" },
  { id: "smart_bar", label: "Les Mills smart bar" },
  { id: "trx", label: "TRX / suspension trainer" },
  { id: "cardio_machines", label: "Cardio machine (bike, treadmill, etc.)" },
];

const SYSTEM_PROMPT = `You are an expert fitness coach creating personalized workout plans. Return ONLY a valid JSON object, no markdown, no explanation, no preamble. The JSON must exactly match this structure:

{
  "title": "Plan title",
  "summary": "2-3 sentence overview of the approach and why it fits this person",
  "schedule": ["Monday", "Tuesday", "Thursday", "Saturday"],
  "weeks": "8",
  "weeks_breakdown": [
    { "phase": "Phase 1 (Weeks 1-2)", "focus": "Brief focus description" },
    { "phase": "Phase 2 (Weeks 3-5)", "focus": "Brief focus description" },
    { "phase": "Phase 3 (Weeks 6-8)", "focus": "Brief focus description" }
  ],
  "workouts": [
    {
      "day": "Monday",
      "name": "Workout name",
      "duration": "45 min",
      "type": "Strength",
      "warmup": "5 min dynamic stretching — arm circles, leg swings, torso rotations",
      "exercises": [
        { "name": "Exercise name", "sets": "3", "reps": "10-12", "rest": "60s", "effort": "2 RIR", "note": "Optional form tip" }
      ],
      "cooldown": "5 min static stretching, focus on worked muscles"
    }
  ],
  "nutrition_tips": ["Tip 1", "Tip 2", "Tip 3"],
  "motivation_strategy": "1-2 sentences specifically addressing their past failures and main challenge",
  "weekly_checkin": "What to track or assess each week to measure progress"
}

Be specific. Every exercise must have sets, reps, and rest. Include 4-6 exercises per workout. Never include exercises the person dislikes. Directly address their past failures in the motivation strategy. Adapt everything to their injuries and limitations. Keep every nutrition tip to a single concise sentence, and keep motivation_strategy and weekly_checkin to 1-2 sentences each — none of these fields should ever become a paragraph.

EQUIPMENT RULE — CRITICAL: Only assign exercises that can be performed with the exact equipment listed. If an exercise requires a piece of equipment not on the list, do not include it. For example: if no bench is listed, do not assign bench press or incline dumbbell press. If no leg press machine is listed, do not assign leg press. If only a step platform is listed, use it for step-ups, not as a bench substitute.

VOLUME GUIDELINES — calibrate total weekly sets per muscle group to fitness level:
- Beginner: 10-15 sets per muscle group per week
- Intermediate: 12-18 sets per muscle group per week
- Advanced: 16-22 sets per muscle group per week
If the user requests emphasis on a specific muscle group, add 2-4 sets above their baseline spread across the week — never spike volume disproportionately in a single session. Only exceed these ranges if the user explicitly requests a specialization or high-volume program.

EFFORT TARGETS — CRITICAL: every strength/hypertrophy working set needs a populated "effort" value, 2-3 words max, matching the short label format that sits next to rest time (e.g. "2-3 RIR", "Train to failure", "Form focus") — never a full sentence:
- Compound lifts earlier in a session get a more conservative RIR than isolation/finisher moves later in the same session.
- Beginner: conservative (2-3 RIR), rarely true failure. The first time a numeric RIR value appears in a beginner's plan, add a one-sentence plain-language explanation of what it means in that exercise's "note".
- Beginner technique-priority compounds (early weeks): use a short qualitative label instead of RIR — e.g. "Form focus" or "Light effort" — no exceptions within strength work.
- Intermediate/advanced: tighter (1-2 RIR), with occasional true-failure sets allowed, especially in the Peak phase.
- Leave "effort" as "" only for true non-strength contexts: cardio/conditioning work (use pace/duration/heart-rate cues in "note" instead), warm-ups, cooldowns, and pure mobility work.
- Never target failure, and keep effort conservative ("Form focus"/"Light effort" or low RIR), for any exercise affected by the person's stated injuries/limitations.
- This governs how hard each set is pushed, not how many sets are programmed — never let it push volume outside the VOLUME GUIDELINES ranges above.

SESSION BALANCE — CRITICAL: within a single session, never let more than 2 of the exercises target the same primary muscle group unless the user explicitly requested a specialization day for that muscle. This matters most for low-frequency plans (2-3 gym days/week, especially when complementing other activities like classes or sports) — these sessions should train multiple muscle groups in a balanced, close-to-full-body way rather than concentrating on one area. Check your own exercise list against this rule before finalizing the plan.

CORE/ABS — CRITICAL: treat core/abs like any other muscle group, with real weekly volume (aim for roughly 8-15 sets/week, adjusted for fitness level same as other muscles) — do not satisfy this by inserting exactly one core exercise into every single day, since that spreads volume too thin to matter per session. Instead, concentrate direct core work (e.g. planks, hanging leg raises, cable crunches, dead bugs) into 2-4 of the training days with 1-2 exercises each, chosen to fit the session's natural focus (e.g. more core work on lower-body or full-body days is often a better fit than on isolated arm/shoulder days). Account for this within the person's stated session duration on the days it appears.

MUSCLE GROUP ACCURACY — never mislabel muscle targets:
- Medial (lateral) delt exercises: lateral raises, cable lateral raises, machine lateral raises
- Rear delt exercises: face pulls, reverse flies, bent-over lateral raises, barbell upright rows
- Barbell upright rows target the rear delts and upper traps — never label them as a medial delt exercise
- Front delt exercises: overhead press, front raises, incline dumbbell press
- Always verify that the exercise listed actually trains the muscle group stated`;

const ADJUST_SYSTEM_PROMPT = `You are an expert fitness coach adjusting a fitness plan based on a client's weekly check-in. Return ONLY a valid JSON object matching this exact structure — no markdown, no explanation:

{
  "title": "Plan title",
  "summary": "Updated 2-3 sentence overview",
  "schedule": ["Monday", "Tuesday", "Thursday", "Saturday"],
  "weeks": "8",
  "weeks_breakdown": [ { "phase": "...", "focus": "..." } ],
  "workouts": [
    {
      "day": "Monday", "name": "...", "duration": "45 min", "type": "Strength",
      "warmup": "...",
      "exercises": [ { "name": "...", "sets": "3", "reps": "10-12", "rest": "60s", "effort": "2 RIR", "note": "..." } ],
      "cooldown": "..."
    }
  ],
  "nutrition_tips": ["One concise sentence per tip"],
  "motivation_strategy": "1-2 sentences max — do not write a paragraph",
  "weekly_checkin": "1-2 sentences on what to track — do not write a paragraph"
}

ADJUSTMENT RULES:
- BREVITY — CRITICAL: keep motivation_strategy and weekly_checkin to 1-2 sentences each, and every nutrition tip to a single sentence, matching the brevity of the original plan. Do not expand these into paragraphs, even when explaining a change in detail — put detailed reasoning in the plan summary instead if needed.
- If an exercise was completed and felt manageable, apply progressive overload: increase reps, sets, or note a weight increase — small increments only.
- SKIP REASONS — CRITICAL: each skipped exercise now comes with its own specific reason. Respond to each one individually and appropriately, not with a generic swap:
  - Pain or injury mentioned → replace with a genuinely different movement pattern that avoids that stress, not just a lighter version of the same lift.
  - "Too hard" or similar → reduce load/reps or substitute an easier variation of the same movement pattern.
  - "Too easy" or similar → this is a candidate to keep at increased volume/load, not skip — flag this distinctly from a real skip if it appears here.
  - "Boring" or lack of engagement → swap for a different exercise targeting the same muscle group, not the same exercise again.
  - Time constraints → consider trimming that exercise or shortening its rest period rather than dropping the muscle group entirely.
  - If a reason is vague or missing ("No reason given"), make a reasonable substitution but don't over-interpret — a small, safe change is better than guessing aggressively.
- Read the client's general notes for the week and respond to anything not already captured by individual exercise reasons.
- Keep the same days, equipment constraints, and dislikes as the original plan — do not reintroduce disliked exercises or equipment the client doesn't have.
- EQUIPMENT RULE — CRITICAL: only assign exercises matching the equipment already established for this client.
- VOLUME GUIDELINES: Beginner 10-15 sets/muscle/week, Intermediate 12-18, Advanced 16-22. Progressive overload should never push volume outside these ranges in one jump — increase by 1-2 sets max per adjustment.
- EFFORT TARGETS: every strength/hypertrophy working set keeps a populated "effort" value, 2-3 words max (e.g. "2-3 RIR", "Train to failure", "Form focus"), consistent with the original plan's fitness level and phase — conservative RIR (2-3) for beginners with a plain-language explanation the first time a numeric RIR appears; short qualitative labels ("Form focus"/"Light effort") for beginner technique-priority compounds instead of RIR, no exceptions within strength work; tighter RIR (1-2) with occasional true-failure sets for intermediate/advanced, especially in the Peak phase. Leave "effort" as "" only for cardio/conditioning, warm-ups, cooldowns, and pure mobility work. Never target failure, and keep effort conservative, for any exercise affected by the client's injuries/limitations. This governs how hard a set is pushed, not set count — don't let it affect the volume ranges above.
- SESSION BALANCE — CRITICAL: never let more than 2 exercises in a single session target the same primary muscle group, unless the original plan was an explicit specialization day. This matters most for low-frequency plans (2-3 days/week).
- CORE/ABS — CRITICAL: keep core/abs volume concentrated into 2-4 training days with 1-2 exercises each (roughly 8-15 sets/week total) — do not spread it into a single token exercise on every day, which under-trains the muscle per session.
- Never mislabel muscle targets (e.g. upright rows = rear delts/traps, never medial delt).`;

const buildPrompt = (data) => `Create a personalized 8-week fitness plan for:

Goal: ${data.goal}
Specific target: ${data.target || "Not specified"}
Days per week: ${data.days}
Preferred training days: ${data.specificDays || "Flexible — assign optimal days"}
Minutes per session: ${data.time}
Preferred training time: ${data.trainTime}
Fitness level: ${data.level}
Other physical activity / sports / extracurriculars: ${data.otherActivity || "None"}
Main challenge / biggest excuse: ${data.excuse}
Previous attempts & what went wrong: ${data.pastAttempts || "None specified"}
Exercises they enjoy: ${data.enjoy || "None specified"}
Exercises they dislike or want to avoid: ${data.dislike || "None specified"}
Injuries or physical limitations: ${data.injuries || "None"}
Available equipment (ONLY use these): ${
  data.equipmentLocation === "full_gym" ? "Full commercial gym — all standard equipment available" :
  data.equipmentLocation === "bodyweight" ? "Bodyweight only — no equipment" :
  data.equipment.length > 0 ? data.equipment.join(", ") : "Bodyweight only"
}

CRITICAL: Do not assign any exercise that requires equipment not listed above. Return only the JSON object.`;

const buildAdjustPrompt = (plan, checkinsHistory) => {
  const latest = checkinsHistory[checkinsHistory.length - 1];
  return `Here is the client's current plan:
${JSON.stringify(plan)}

Here is their check-in history:
${JSON.stringify(checkinsHistory)}

Their most recent check-in (week ${latest.week_number}) reported, per day and exercise:
${JSON.stringify(latest.completed_exercises)}

Each exercise entry is either {"done": true} — completed as planned — or {"done": false, "reason": "..."} — skipped, with the client's own stated reason. Use these reasons individually per exercise, not as a general summary.
General notes for the week (may be empty): ${latest.notes || "None"}

Generate the adjusted plan for the upcoming week. Return only the JSON object.`;
};

const GRADE_SYSTEM_PROMPT = `You are an expert fitness coach reviewing a client's existing workout routine for quality issues. Return ONLY a valid JSON object, no markdown, no explanation, no preamble. The JSON must exactly match this structure:

{
  "summary": "1-2 sentence overall assessment of the routine's biggest strength or weakness",
  "fixes": [
    { "issue": "What's wrong, one sentence", "fix": "The specific actionable correction, one sentence", "exercise": "Exercise name this applies to, or null if it's a general/structural issue" }
  ]
}

Return 3-5 fixes, ordered from most to least impactful. Be specific and terse — one sentence per field, matching the direct style of a coach's note, not a paragraph. Never praise generically — every fix must point at something concrete in the routine as described.

VOLUME GUIDELINES — flag if weekly sets per muscle group fall outside these ranges for the client's stated fitness level:
- Beginner: 10-15 sets per muscle group per week
- Intermediate: 12-18 sets per muscle group per week
- Advanced: 16-22 sets per muscle group per week

MUSCLE GROUP ACCURACY — flag any exercise mislabeled or misunderstood relative to what it actually trains:
- Medial (lateral) delt exercises: lateral raises, cable lateral raises, machine lateral raises
- Rear delt exercises: face pulls, reverse flies, bent-over lateral raises, barbell upright rows
- Barbell upright rows target the rear delts and upper traps — never medial delt
- Front delt exercises: overhead press, front raises, incline dumbbell press

EQUIPMENT CONSISTENCY — flag any exercise in the routine that requires equipment the client doesn't have access to, given what's listed below.

SESSION / WEEKLY BALANCE — flag imbalanced sessions (e.g. one muscle group hit far harder than others in a single day) or an imbalanced week (e.g. push trained twice, pull never trained).

PROGRESSION — note if the routine has no visible way to progress over time (no rep ranges, no plan to add weight/reps, no deload or phase structure); this alone can be one of the fixes if nothing else is wrong.

If the routine is described too vaguely to grade a specific rule, say so plainly in the summary rather than inventing detail that wasn't given.`;

const buildGradePrompt = (data, routineText) => `Review this client's current workout routine and identify what's wrong with it.

Fitness level: ${data.level}
Goal: ${data.goal || "Not specified"}
Injuries or physical limitations: ${data.injuries || "None"}
Available equipment (ONLY count exercises usable with these as consistent): ${
  data.equipmentLocation === "full_gym" ? "Full commercial gym — all standard equipment available" :
  data.equipmentLocation === "bodyweight" ? "Bodyweight only — no equipment" :
  data.equipment.length > 0 ? data.equipment.join(", ") : "Bodyweight only"
}

Their current routine, as described:
${routineText}

Return only the JSON object.`;

// Add new terms here — { pattern: RegExp (global, case-insensitive), definition: one sentence }.
const GLOSSARY_TERMS = [
  { id: "rir", pattern: /\bRIR\b/gi, definition: "Reps in reserve — how many more reps you could still do before hitting failure." },
  { id: "progressive-overload", pattern: /\bprogressive overload\b/gi, definition: "Gradually increasing weight, reps, or sets over time so your muscles keep adapting." },
  { id: "failure", pattern: /\btrain(?:ing)? to failure\b/gi, definition: "Doing reps until you physically can't complete another one with good form." },
  { id: "mechanical-drop-set", pattern: /\bmechanical drop sets?\b/gi, definition: "Switching to an easier variation of the same exercise right after failure, instead of just lowering the weight." },
  { id: "drop-set", pattern: /\bdrop sets?\b/gi, definition: "Cutting the weight and continuing reps immediately after reaching failure, with no rest." },
  { id: "rest-pause-set", pattern: /\brest-pause sets?\b/gi, definition: "Pausing briefly after near-failure, then squeezing out a few more reps with the same weight." },
  { id: "myo-reps", pattern: /\bmyo-?reps\b/gi, definition: "One hard set followed by short rest-pause mini-sets to extend muscle work with less total volume." },
  { id: "superset", pattern: /\bsupersets?\b/gi, definition: "Two exercises performed back-to-back with no rest in between." },
  { id: "deload", pattern: /\bdeloads?\b/gi, definition: "A planned lighter week — less weight or volume — that lets your body recover before pushing hard again." },
  { id: "intensification", pattern: /\bintensification\b/gi, definition: "Techniques like drop sets or rest-pause that make a set harder without adding more sets." },
  { id: "connective-tissue-tolerance", pattern: /\bconnective tissue tolerance\b/gi, definition: "How much stress your tendons and ligaments can handle before they need extra recovery time." },
  { id: "form-focus", pattern: /\bform focus\b/gi, definition: "Prioritize clean technique over intensity — these sets aren't meant to feel hard yet." },
  { id: "light-effort", pattern: /\blight effort\b/gi, definition: "Keep these sets comfortably easy — building the movement pattern matters more than intensity here." },
];
const GLOSSARY_REGEX = new RegExp(GLOSSARY_TERMS.map(t => t.pattern.source).join("|"), "gi");
const findGlossaryTerm = (matchText) =>
  GLOSSARY_TERMS.find(t => new RegExp(`^(?:${t.pattern.source})$`, "i").test(matchText));

const GlossaryTerm = ({ term, definition }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); };
  }, [open]);
  return (
    <span className={`glossary-term${open ? " is-open" : ""}`} ref={ref}>
      <span
        className="glossary-term-label"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o); } }}
      >
        {term}
      </span>
      <span className="glossary-tooltip" role="tooltip">{definition}</span>
    </span>
  );
};

// Wraps recognized glossary terms in a string with GlossaryTerm spans; returns plain text untouched otherwise.
const renderWithGlossary = (text) => {
  if (!text) return text;
  const parts = [];
  let lastIndex = 0;
  const regex = new RegExp(GLOSSARY_REGEX);
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const entry = findGlossaryTerm(match[0]);
    parts.push(<GlossaryTerm key={match.index} term={match[0]} definition={entry.definition} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
};

// Groups effort labels into a "kind" so e.g. "2 RIR" and "3-4 RIR" count as the same term for
// first-occurrence tracking, independent of exercise position.
const getEffortKind = (effort) => {
  if (!effort) return null;
  if (/RIR/i.test(effort)) return "rir";
  if (/train(?:ing)? to failure/i.test(effort)) return "failure";
  return effort.trim().toLowerCase();
};

// Given a day's exercise list, returns the set of indices whose effort label is the first
// occurrence of its kind that day — those get the tooltip, repeats render as plain text.
const getFirstEffortIndices = (exercises) => {
  const seenKinds = new Set();
  const indices = new Set();
  exercises?.forEach((ex, i) => {
    const kind = getEffortKind(ex.effort);
    if (kind && !seenKinds.has(kind)) {
      seenKinds.add(kind);
      indices.add(i);
    }
  });
  return indices;
};

const LANDING_PREVIEW_EXERCISES = [
  { name: "Incline Dumbbell Press", sets: "3", reps: "10-12", rest: "90s", effort: "2 RIR", note: "No bench at home? Swapped for elevated push-ups on a step instead." },
  { name: "Chest-Supported Dumbbell Row", sets: "3", reps: "10-12", rest: "75s", effort: "2 RIR", note: "Chest support protects your lower back — matches the mild scoliosis note you gave." },
  { name: "Cable Lateral Raise", sets: "3", reps: "12-15", rest: "60s", effort: "1-2 RIR", note: "Light weight, full control — this is what actually builds shoulder width." },
  { name: "Overhead Cable Extension", sets: "2", reps: "15", rest: "60s", effort: "Train to failure", note: "Replaces the skull crusher you said caused elbow pain." },
  { name: "Cable Face Pull", sets: "2", reps: "15", rest: "45s", effort: "2 RIR", note: "Rear delts and upper back — keeps shoulders balanced against all the pressing." },
];
const LANDING_PREVIEW_FIRST_EFFORT_INDICES = getFirstEffortIndices(LANDING_PREVIEW_EXERCISES);

const TAG_COLORS = {
  "Strength": { bg: "#EFF6FF", color: "#1D4ED8" },
  "Cardio": { bg: "#FFF7ED", color: "#C2410C" },
  "HIIT": { bg: "#FEF2F2", color: "#DC2626" },
  "Yoga": { bg: "#F0FDF4", color: "#15803D" },
  "Recovery": { bg: "#FAF5FF", color: "#7E22CE" },
  "Les Mills": { bg: "#FFF1F2", color: "#BE123C" },
  "Full Body": { bg: "#ECFDF5", color: "#065F46" },
  "Upper Body": { bg: "#EFF6FF", color: "#1E40AF" },
  "Lower Body": { bg: "#FFF7ED", color: "#9A3412" },
};

const TypeTag = ({ type }) => {
  const style = TAG_COLORS[type] || { bg: "#F3F4F6", color: "#374151" };
  return (
    <span className="type-tag" style={{ background: style.bg, color: style.color }}>
      {type}
    </span>
  );
};

const inputStyle = { width: "100%", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1.5px solid #E5E7EB", fontSize: "0.9rem", color: "#111827", background: "#FAFAFA", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" };

const Field = ({ label, name, value, onChange, placeholder, as = "input", type = "text", options, hint, error, suggestions }) => {
  const isDropdown = as === "select" || !!suggestions;
  const [open, setOpen] = useState(false);
  const comboRef = useRef(null);

  useEffect(() => {
    if (!isDropdown) return;
    const handleClick = (e) => {
      if (comboRef.current && !comboRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isDropdown]);

  const pick = (val) => {
    onChange({ target: { name, value: val } });
    setOpen(false);
  };

  const selectedLabel = as === "select" ? options.find(o => o.value === value)?.label : null;

  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {hint && <p className="field-hint">{hint}</p>}
      {as === "select" ? (
        <div className="combo-wrap" ref={comboRef}>
          <button type="button" className={`field-input combo-trigger${error ? " has-error" : ""}`} onClick={() => setOpen(o => !o)}>
            <span>{selectedLabel}</span>
            <span className="combo-chevron">▾</span>
          </button>
          {open && (
            <div className="combo-menu">
              {options.map(o => (
                <div key={o.value} className={`combo-option${o.value === value ? " is-selected" : ""}`} onMouseDown={() => pick(o.value)}>{o.label}</div>
              ))}
            </div>
          )}
        </div>
      ) : as === "textarea" ? (
        <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} rows={2} className={`field-input${error ? " has-error" : ""}`} style={{ resize: "vertical", fontFamily: "inherit" }} onFocus={e => e.target.style.borderColor = "var(--accent)"} onBlur={e => e.target.style.borderColor = error ? "var(--danger)" : "var(--line)"} />
      ) : suggestions ? (
        <div className="combo-wrap" ref={comboRef}>
          <input name={name} value={value} onChange={onChange} placeholder={placeholder} autoComplete="off" className={`field-input${error ? " has-error" : ""}`} onFocus={e => { e.target.style.borderColor = "var(--accent)"; setOpen(true); }} onBlur={e => e.target.style.borderColor = error ? "var(--danger)" : "var(--line)"} />
          {open && (
            <div className="combo-menu">
              {suggestions.map(opt => (
                <div key={opt} className="combo-option" onMouseDown={() => pick(opt)}>{opt}</div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} className={`field-input${error ? " has-error" : ""}`} onFocus={e => e.target.style.borderColor = "var(--accent)"} onBlur={e => e.target.style.borderColor = error ? "var(--danger)" : "var(--line)"} />
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
};

const Divider = ({ label }) => (
  <div className="form-divider">
    <div className="form-divider-line" />
    <span className="form-divider-label">{label}</span>
    <div className="form-divider-line" />
  </div>
);

const EquipmentSelector = ({ location, onLocationChange, selected, onEquipmentChange, error }) => {
  const toggle = (id) => {
    onEquipmentChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };
  return (
    <div className="field">
      <label className="equip-label">Where do you train?</label>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.85rem", flexWrap: "wrap" }}>
        {[
          { id: "full_gym", label: "🏋️ Commercial gym" },
          { id: "home_gym", label: "🏠 Home gym" },
          { id: "bodyweight", label: "🤸 Bodyweight only" },
        ].map(opt => (
          <button key={opt.id} onClick={() => onLocationChange(opt.id)} type="button" className={`equip-btn${location === opt.id ? " is-selected" : ""}${error ? " has-error" : ""}`}>{opt.label}</button>
        ))}
      </div>
      {error && <p className="equip-error">{error}</p>}
      {location === "home_gym" && (
        <>
          <p className="equip-hint">Select what you have at home — your plan will only use these.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {HOME_EQUIPMENT_OPTIONS.map(eq => {
              const isSelected = selected.includes(eq.id);
              return (
                <button key={eq.id} onClick={() => toggle(eq.id)} type="button" className={`equip-chip${isSelected ? " is-selected" : ""}`}>
                  {isSelected ? "✓ " : ""}{eq.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default function FitnessPlanGenerator() {
  const [session, setSession] = useState(null);
  const [page, setPage] = useState("landing"); // "landing" | "app" | "terms" | "privacy"
  const [authMode, setAuthMode] = useState("login"); // "login" | "signup"
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [savedPlans, setSavedPlans] = useState([]);
  const [showSavedPlans, setShowSavedPlans] = useState(false);
  const [profile, setProfile] = useState(null);
  const [checkingOut, setCheckingOut] = useState(null); // "unlock" | "extra_generation" | null

  const [form, setForm] = useState({
    goal: "", target: "", days: "4", specificDays: "", time: "45", trainTime: "morning",
    level: "beginner", excuse: "", pastAttempts: "",
    enjoy: "", dislike: "", injuries: "", equipment: [], equipmentLocation: "",
    otherActivity: ""
  });
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("generate"); // "generate" | "grade"
  const [routineText, setRoutineText] = useState("");
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState(null);
  const [gradeError, setGradeError] = useState("");
  const [activeWorkout, setActiveWorkout] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [expandedSections, setExpandedSections] = useState({ nutrition: false, motivation: false, checkin: false });
  const toggleSection = (key) => setExpandedSections(p => ({ ...p, [key]: !p[key] }));

  // --- Check-in feature state ---
  const [planId, setPlanId] = useState(null);
  const [planCreatedAt, setPlanCreatedAt] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInState, setCheckInState] = useState({}); // "day::exerciseName" -> true/false
  const [skipReasons, setSkipReasons] = useState({}); // "day::exerciseName" -> reason string, only used when skipped
  const [checkInNotes, setCheckInNotes] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) { loadSavedPlans(); loadProfile(); }
  }, [session]);

  useEffect(() => {
    // After returning from Stripe checkout, poll for a little while so the
    // has_paid flip (written by the webhook, asynchronously) shows up without
    // requiring a manual refresh. Migration itself is handled by the
    // has_paid-driven effect below — this just keeps `profile` fresh.
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success" && session) {
      window.history.replaceState({}, "", window.location.pathname);
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        const data = await loadProfile();
        if (data?.has_paid || attempts >= 5) clearInterval(interval);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [session]);

  useEffect(() => {
    if (session && profile && !profile.has_paid && !plan) {
      const raw = localStorage.getItem(`fitplan_pending_plan_${session.user.id}`);
      if (raw) {
        try {
          const { plan: savedPlan, createdAt } = JSON.parse(raw);
          if (Date.now() - createdAt < 24 * 60 * 60 * 1000) {
            setPlan(savedPlan);
          } else {
            localStorage.removeItem(`fitplan_pending_plan_${session.user.id}`);
          }
        } catch (e) {
          localStorage.removeItem(`fitplan_pending_plan_${session.user.id}`);
        }
      }
    }
  }, [session, profile]);

  const migratingPendingPlanRef = useRef(false);
  useEffect(() => {
    // Runs any time has_paid is (or becomes) true for this session — on the
    // checkout-success redirect, on a plain refresh after has_paid flipped
    // while the tab was open, or after an out-of-band change (e.g. a manual
    // profile edit). Not gated on a URL param or a time-boxed poll, so a
    // pending plan can never be permanently stranded in localStorage.
    if (!session || !profile?.has_paid || migratingPendingPlanRef.current) return;
    const key = `fitplan_pending_plan_${session.user.id}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    migratingPendingPlanRef.current = true;
    (async () => {
      try {
        const { plan: pendingPlan, createdAt } = JSON.parse(raw);
        if (Date.now() - createdAt < 24 * 60 * 60 * 1000) {
          setPlan(pendingPlan);
          setActiveWorkout(0);
          await savePlan(pendingPlan);
          await fetch("/api/track-generation", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ userId: session.user.id }),
          });
          loadProfile();
        } else {
          setError("Your plan draft expired after 24 hours and couldn't be recovered — please generate a new one.");
        }
      } catch (e) {
        // nothing valid to migrate — user will just see the generator screen
      } finally {
        localStorage.removeItem(key);
      }
    })();
  }, [session, profile?.has_paid]);

  const loadProfile = async () => {
    if (!session) return null;
    let { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!data) {
      const { data: created } = await supabase.from("profiles").insert({ id: session.user.id }).select().single();
      data = created;
    }
    setProfile(data);
    return data;
  };

  const startCheckout = async (type) => {
    if (!session) return;
    setCheckingOut(type);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: session.user.id, type }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setError("Could not start checkout. Please try again."); setCheckingOut(null); }
    } catch (e) {
      setError("Could not start checkout. Please try again.");
      setCheckingOut(null);
    }
  };

  const loadSavedPlans = async () => {
    const { data } = await supabase.from("plans").select("id, title, created_at").order("created_at", { ascending: false });
    if (data) setSavedPlans(data);
  };

  const savePlan = async (planData) => {
    if (!session) return;
    const { data } = await supabase
      .from("plans")
      .insert({ user_id: session.user.id, title: planData.title, plan_data: planData })
      .select()
      .single();
    if (data) { setPlanId(data.id); setPlanCreatedAt(data.created_at); }
    loadSavedPlans();
  };

  const loadCheckins = async (id) => {
    const { data } = await supabase
      .from("checkins")
      .select("*")
      .eq("plan_id", id)
      .order("week_number", { ascending: true });
    setCheckins(data || []);
    setCurrentWeek((data?.length || 0) + 1);
  };

  const loadPlan = async (id) => {
    const { data } = await supabase.from("plans").select("plan_data, created_at").eq("id", id).single();
    if (data) {
      setPlan(data.plan_data);
      setPlanId(id);
      setPlanCreatedAt(data.created_at);
      setShowSavedPlans(false);
      setActiveWorkout(0);
      loadCheckins(id);
    }
  };

  const deletePlan = async (id) => {
    await supabase.from("plans").delete().eq("id", id);
    loadSavedPlans();
  };

  const handleAuth = async () => {
    setAuthLoading(true); setAuthError("");
    const { error } = authMode === "login"
      ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      : await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!authEmail.trim()) { setAuthError("Enter your email above first, then click 'Forgot password?'"); return; }
    setAuthLoading(true); setAuthError("");
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, { redirectTo: window.location.origin });
    if (error) setAuthError(error.message); else setForgotSent(true);
    setAuthLoading(false);
  };

  const handleSetNewPassword = async () => {
    setResetError("");
    if (newPassword.length < 6) { setResetError("Password must be at least 6 characters."); return; }
    if (newPassword !== newPasswordConfirm) { setResetError("Passwords don't match."); return; }
    setResetLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setResetError(error.message); else setResetSuccess(true);
    setResetLoading(false);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); setPlan(null); };

  const handleChange = e => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    if (fieldErrors[e.target.name]) setFieldErrors(p => ({ ...p, [e.target.name]: undefined }));
  };
  const handleEquipment = (equipment) => setForm(p => ({ ...p, equipment }));
  const handleEquipmentLocation = (loc) => {
    setForm(p => ({ ...p, equipmentLocation: loc, equipment: [] }));
    if (fieldErrors.equipmentLocation) setFieldErrors(p => ({ ...p, equipmentLocation: undefined }));
  };

  const openYoutube = (exerciseName) => {
    const query = encodeURIComponent(`how to do ${exerciseName} exercise`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, "_blank");
  };

  const totalAllowedGenerations = 3 + (profile?.generation_credits || 0);
  const atGenerationLimit = profile?.has_paid && (profile?.plans_generated || 0) >= totalAllowedGenerations;
  const freeActionBlocked = !profile?.has_paid && !!profile?.free_action_used;

  const [fieldErrors, setFieldErrors] = useState({});

  const generate = async () => {
    const errs = {};
    if (!form.goal.trim()) errs.goal = "Tell us your main fitness goal.";
    if (!form.excuse.trim()) errs.excuse = "This helps the plan work around your real challenge.";
    if (!form.equipmentLocation) errs.equipmentLocation = "Select where you train.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) { setError(""); return; }
    if (atGenerationLimit) { setError("You've used your included generations."); return; }
    if (freeActionBlocked) { setError(`You've used your free ${profile.free_action_used === "grade" ? "routine grade" : "plan"} — unlock to keep going.`); return; }
    setError(""); setLoading(true); setPlan(null);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 8000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: buildPrompt(form) }] }),
      });
      if (res.status === 402) {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody.error || "You've used your free action — unlock to keep going.");
        loadProfile();
        return;
      }
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setPlan(parsed);
      setActiveWorkout(0);
      setPlanId(null);
      setPlanCreatedAt(new Date().toISOString());
      setCheckins([]);
      setCurrentWeek(1);
      if (session && profile?.has_paid) {
        await savePlan(parsed);
        await fetch("/api/track-generation", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ userId: session.user.id }),
        });
        loadProfile();
        localStorage.removeItem(`fitplan_pending_plan_${session.user.id}`);
      } else {
        localStorage.setItem(`fitplan_pending_plan_${session.user.id}`, JSON.stringify({ plan: parsed, createdAt: Date.now() }));
        loadProfile();
      }
    } catch (e) {
      setError("Something went wrong generating the plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const gradeWorkout = async () => {
    if (!routineText.trim()) { setGradeError("Paste or describe your current routine first."); return; }
    if (!form.equipmentLocation) { setFieldErrors({ equipmentLocation: "Select where you train." }); return; }
    if (atGenerationLimit) { setGradeError("You've used your included generations."); return; }
    if (freeActionBlocked) { setGradeError(`You've used your free ${profile.free_action_used === "plan" ? "plan generation" : "routine grade"} — unlock to keep going.`); return; }
    setGradeError(""); setGrading(true); setGradeResult(null);
    try {
      const res = await fetch("/api/grade-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, system: GRADE_SYSTEM_PROMPT, messages: [{ role: "user", content: buildGradePrompt(form, routineText) }] }),
      });
      if (res.status === 402) {
        const errBody = await res.json().catch(() => ({}));
        setGradeError(errBody.error || "You've used your free action — unlock to keep going.");
        loadProfile();
        return;
      }
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setGradeResult(parsed);
      loadProfile();
    } catch (e) {
      setGradeError("Something went wrong grading your routine. Please try again.");
    } finally {
      setGrading(false);
    }
  };

  // --- Check-in handlers ---
  const lastActivityDate = checkins.length > 0
    ? new Date(checkins[checkins.length - 1].created_at)
    : planCreatedAt ? new Date(planCreatedAt) : null;
  const nextCheckInDate = lastActivityDate
    ? new Date(lastActivityDate.getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;
  const canCheckIn = nextCheckInDate ? new Date() >= nextCheckInDate : false;
  const daysUntilCheckIn = nextCheckInDate
    ? Math.max(1, Math.ceil((nextCheckInDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  const toggleExerciseDone = (day, exerciseName) => {
    const key = `${day}::${exerciseName}`;
    setCheckInState(p => ({ ...p, [key]: !p[key] }));
  };

  const openCheckIn = () => {
    const initial = {};
    plan.workouts.forEach(w => {
      w.exercises.forEach(ex => {
        initial[`${w.day}::${ex.name}`] = true; // default: assume completed, uncheck to report a skip
      });
    });
    setCheckInState(initial);
    setSkipReasons({});
    setShowCheckIn(true);
  };

  const updateSkipReason = (day, exerciseName, value) => {
    const key = `${day}::${exerciseName}`;
    setSkipReasons(p => ({ ...p, [key]: value }));
  };

  const submitCheckIn = async () => {
    if (!planId || !canCheckIn) return;
    setAdjusting(true);
    try {
      const completed_exercises = {};
      plan.workouts.forEach(w => {
        completed_exercises[w.day] = {};
        w.exercises.forEach(ex => {
          const key = `${w.day}::${ex.name}`;
          const done = !!checkInState[key];
          completed_exercises[w.day][ex.name] = done
            ? { done: true }
            : { done: false, reason: skipReasons[key]?.trim() || "No reason given" };
        });
      });

      const { data: checkinRow } = await supabase
        .from("checkins")
        .insert({
          plan_id: planId,
          user_id: session.user.id,
          week_number: currentWeek,
          completed_exercises,
          notes: checkInNotes,
        })
        .select()
        .single();

      const history = [...checkins, checkinRow];

      const res = await fetch("/api/adjust-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 8000,
          system: ADJUST_SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildAdjustPrompt(plan, history) }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const adjustedPlan = JSON.parse(clean);

      await supabase.from("plans").update({ plan_data: adjustedPlan }).eq("id", planId);

      setPlan(adjustedPlan);
      setCheckins(history);
      setCurrentWeek(currentWeek + 1);
      setCheckInState({});
      setSkipReasons({});
      setCheckInNotes("");
      setShowCheckIn(false);
      setActiveWorkout(0);
    } catch (e) {
      setError("Something went wrong adjusting your plan. Please try again.");
    } finally {
      setAdjusting(false);
    }
  };

  if (page === "terms") {
    return (
      <div style={{ minHeight: "100vh", background: "#F9FAFB" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "0.9rem 1.5rem", display: "flex", alignItems: "center", gap: "0.7rem" }}>
          <div style={{ width: 34, height: 34, borderRadius: "9px", background: "linear-gradient(135deg, #16A34A, #15803D)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>💪</div>
          <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>FitPlan AI</div>
          <button onClick={() => setPage("app")} style={{ marginLeft: "auto", padding: "0.4rem 0.9rem", border: "1.5px solid #E5E7EB", borderRadius: "7px", background: "transparent", fontSize: "0.82rem", color: "#6B7280", cursor: "pointer", fontWeight: 600 }}>← Back</button>
        </div>
        <TermsOfService />
      </div>
    );
  }

  if (page === "privacy") {
    return (
      <div style={{ minHeight: "100vh", background: "#F9FAFB" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "0.9rem 1.5rem", display: "flex", alignItems: "center", gap: "0.7rem" }}>
          <div style={{ width: 34, height: 34, borderRadius: "9px", background: "linear-gradient(135deg, #16A34A, #15803D)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>💪</div>
          <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>FitPlan AI</div>
          <button onClick={() => setPage("app")} style={{ marginLeft: "auto", padding: "0.4rem 0.9rem", border: "1.5px solid #E5E7EB", borderRadius: "7px", background: "transparent", fontSize: "0.82rem", color: "#6B7280", cursor: "pointer", fontWeight: 600 }}>← Back</button>
        </div>
        <PrivacyPolicy />
      </div>
    );
  }

  if (passwordRecovery) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="app-mark">💪</div>
            <div className="app-wordmark">FitPlan AI</div>
          </div>
          {resetSuccess ? (
            <>
              <h2 className="auth-title">Password updated</h2>
              <p className="auth-sub">You can continue to your account now.</p>
              <button onClick={() => { setPasswordRecovery(false); setResetSuccess(false); }} className="btn btn-solid btn-block">
                Continue to FitPlan AI
              </button>
            </>
          ) : (
            <>
              <h2 className="auth-title">Set a new password</h2>
              <p className="auth-sub">Choose a new password for your account.</p>
              <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ ...inputStyle, marginBottom: "0.75rem", display: "block" }} />
              <input type="password" placeholder="Confirm new password" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSetNewPassword()} style={{ ...inputStyle, marginBottom: "1rem", display: "block" }} />
              {resetError && <p className="auth-error">{resetError}</p>}
              <button onClick={handleSetNewPassword} disabled={resetLoading} className="btn btn-solid btn-block">
                {resetLoading ? "..." : "Set new password"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (page === "landing" && !session) {
    return (
      <div className="landing">
        <div className="landing-brand">
          <div className="app-mark">💪</div>
          <div className="app-wordmark">FitPlan AI</div>
        </div>

        <div className="landing-main">
          <h1 className="landing-title">
            A fitness plan built around your life — not a generic template
          </h1>
          <p className="landing-sub">
            Tell it your goals, equipment, injuries, and schedule. FitPlan AI's engine, purpose-built for fitness, generates a real 8-week plan around them — then adjusts it every week based on what you actually did.
          </p>
          <div className="landing-cta">
            <button className="btn btn-solid" onClick={() => { setAuthMode("signup"); setPage("app"); }}>
              Get Started Free
            </button>
            <button className="btn btn-ghost" onClick={() => { setAuthMode("login"); setPage("app"); }}>
              Log In
            </button>
          </div>

          <div className="landing-features">
            <div className="landing-feature">
              <div className="landing-feature-mark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></svg>
              </div>
              <div>
                <div className="landing-feature-title">Actually personalized</div>
                <div className="landing-feature-body">Built around your real equipment, injuries, past failed attempts, and schedule — not a one-size-fits-all template.</div>
              </div>
            </div>
            <div className="landing-feature">
              <div className="landing-feature-mark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 0 0-14.6-4.6M4 13a8 8 0 0 0 14.6 4.6" /><path d="M4 4v4h4M20 20v-4h-4" /></svg>
              </div>
              <div>
                <div className="landing-feature-title">Adjusts every week</div>
                <div className="landing-feature-body">Weekly check-ins tell it what you actually did — and it adapts next week's plan, something a static chat conversation can't do on its own.</div>
              </div>
            </div>
            <div className="landing-feature">
              <div className="landing-feature-mark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8.5L14 3Z" /><path d="M13.5 3v5.5H19" /></svg>
              </div>
              <div>
                <div className="landing-feature-title">Yours to keep</div>
                <div className="landing-feature-body">Download a clean PDF of your plan, or come back anytime to view it and check in.</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "3rem", textAlign: "left" }}>
            <p className="landing-eyebrow">
              Example from a real generated plan
            </p>
            <div className="landing-preview">
              <div className="landing-preview-tabs">
                {["Monday", "Tuesday", "Thursday", "Saturday"].map((d, i) => (
                  <span key={d} className={`landing-preview-tab${i === 0 ? " is-active" : ""}`}>{d}</span>
                ))}
              </div>
              <div className="landing-preview-head">
                <span style={{ fontWeight: 800, fontSize: "0.85rem" }}>MONDAY — Push Day: Chest, Shoulders &amp; Triceps</span>
                <span style={{ fontSize: "0.75rem" }}>50 min</span>
              </div>
              <div className="landing-preview-body">
                <div className="info-box info-box-warm" style={{ marginBottom: "0.75rem" }}>
                  <span className="info-box-label">Warm-up</span>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem" }}>5 min band pull-aparts, arm circles, and light incline push-ups</p>
                </div>
                {LANDING_PREVIEW_EXERCISES.map((ex, i) => (
                  <div key={i} className="exercise-card" style={{ marginBottom: "0.5rem" }}>
                    <div className="exercise-row" style={{ gridTemplateColumns: "1fr auto", padding: "0.7rem 0.85rem" }}>
                      <div>
                        <div className="exercise-name" style={{ fontSize: "0.85rem" }}>{ex.name}</div>
                        <div className="exercise-note">{ex.note}</div>
                      </div>
                      <div className="exercise-stats">
                        <div className="exercise-sets" style={{ fontSize: "0.8rem" }}>{ex.sets}×{ex.reps}</div>
                        <div className="exercise-rest">{ex.rest} rest</div>
                        {ex.effort && <div className="exercise-effort">{LANDING_PREVIEW_FIRST_EFFORT_INDICES.has(i) ? renderWithGlossary(ex.effort) : ex.effort}</div>}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="info-box info-box-cool" style={{ marginTop: "0.25rem" }}>
                  <span className="info-box-label">Cool-down</span>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem" }}>5 min static stretching — chest doorway stretch, cross-body shoulder stretch</p>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonials — add real, permission-confirmed quotes here once testers have said yes */}
        </div>

        <p className="landing-footer-links">
          <span onClick={() => setPage("terms")}>Terms of Service</span>
          {" · "}
          <span onClick={() => setPage("privacy")}>Privacy Policy</span>
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="app-mark">💪</div>
            <div className="app-wordmark">FitPlan AI</div>
          </div>
          <h2 className="auth-title">{authMode === "login" ? "Welcome back" : "Create account"}</h2>
          <p className="auth-sub">{authMode === "login" ? "Sign in to access your plans" : "Start your fitness journey"}</p>
          <input type="email" placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={{ ...inputStyle, marginBottom: "0.75rem", display: "block" }} />
          <input type="password" placeholder="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} style={{ ...inputStyle, marginBottom: "1rem", display: "block" }} />
          {authError && <p className="auth-error">{authError}</p>}
          <button onClick={handleAuth} disabled={authLoading} className="btn btn-solid btn-block">
            {authLoading ? "..." : authMode === "login" ? "Sign In" : "Sign Up"}
          </button>
          {authMode === "login" && (
            forgotSent ? (
              <p className="auth-success">Check your email for a reset link.</p>
            ) : (
              <p className="auth-links">
                <span onClick={handleForgotPassword}>Forgot password?</span>
              </p>
            )
          )}
          <p className="auth-footnote">
            {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
            <span onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); }}>
              {authMode === "login" ? "Sign up" : "Sign in"}
            </span>
          </p>
          <p className="auth-legal">
            By signing up you agree to our{" "}
            <span onClick={() => setPage("terms")}>Terms of Service</span>
            {" "}and{" "}
            <span onClick={() => setPage("privacy")}>Privacy Policy</span>
          </p>
          <p className="auth-back">
            <span onClick={() => setPage("landing")}>← Back to home</span>
          </p>
        </div>
      </div>
    );
  }

  if (session && profile === null) {
    return (
      <div className="auth-shell">
        <div className="auth-spinner" />
      </div>
    );
  }

  return (
    <div className="app-shell">

      <div className="app-header">
        <div className="app-mark">💪</div>
        <div>
          <div className="app-wordmark">FitPlan AI</div>
          <div className="app-tagline">Your Personalized Fitness AI</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", justifyContent: "flex-end" }}>
          {profile?.has_paid && (
            <button onClick={() => setShowSavedPlans(!showSavedPlans)} className="btn btn-ghost">
              📋 My Plans ({savedPlans.length})
            </button>
          )}
          {profile?.has_paid && plan && planId && (
            canCheckIn ? (
              <button onClick={openCheckIn} className="btn btn-cool">
                ✓ Week {currentWeek} check-in
              </button>
            ) : (
              <span title="Give the plan a full week before checking in" style={{ padding: "0.4rem 0.9rem", border: "1.5px solid var(--line)", borderRadius: "7px", background: "var(--paper)", fontSize: "0.82rem", color: "var(--faint)", fontWeight: 600, whiteSpace: "nowrap" }}>
                Check-in in {daysUntilCheckIn} day{daysUntilCheckIn === 1 ? "" : "s"}
              </span>
            )
          )}
          {plan && !profile?.has_paid && (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--faint)", textAlign: "right", maxWidth: 220, lineHeight: 1.3 }}>
                Your plan is saved in your browser for 24 hours. Unlock to save it permanently and access it anytime.
              </span>
              <button onClick={() => startCheckout("unlock")} disabled={checkingOut === "unlock"} className="btn btn-solid">
                {checkingOut === "unlock" ? "Redirecting..." : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, verticalAlign: -1, marginRight: "0.35rem" }}>
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                    Unlock this plan — €19
                  </>
                )}
              </button>
            </div>
          )}
          {plan && profile?.has_paid && (
            <>
              <button onClick={() => exportToPDF(plan)} className="btn btn-tint">
                ↓ Download
              </button>
              <button onClick={() => {
                if (window.confirm("Starting a new plan will replace this one. Routines work best when you stick with them and let check-ins adjust them over time, rather than switching often. Continue anyway?")) {
                  setPlan(null);
                }
              }} className="btn btn-ghost">
                ← New Plan
              </button>
            </>
          )}
          {plan && !profile?.has_paid && (
            <button onClick={() => {
              localStorage.removeItem(`fitplan_pending_plan_${session.user.id}`);
              setPlan(null);
            }} className="btn btn-ghost">
              ← New Plan
            </button>
          )}
          <button onClick={handleSignOut} className="btn btn-ghost">
            Sign out
          </button>
        </div>
      </div>

      {showSavedPlans && (
        <div style={{ maxWidth: 720, margin: "1rem auto", padding: "0 1.25rem" }}>
          <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #E5E7EB", padding: "1.25rem" }}>
            <h3 style={{ fontSize: "0.9rem", fontWeight: 800, margin: "0 0 1rem", letterSpacing: "-0.01em" }}>My Saved Plans</h3>
            {savedPlans.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0.5rem" }}>
                <div style={{ fontSize: "1.6rem", marginBottom: "0.5rem" }}>📋</div>
                <p style={{ fontSize: "0.85rem", color: "#6B7280", margin: 0, lineHeight: 1.5 }}>No saved plans yet. Generate a plan and unlock it to see it here.</p>
              </div>
            ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {savedPlans.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0.85rem", background: "#F9FAFB", borderRadius: "8px", border: "1px solid #F3F4F6" }}>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#111827" }}>{p.title}</div>
                    <div style={{ fontSize: "0.72rem", color: "#9CA3AF" }}>{new Date(p.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button onClick={() => loadPlan(p.id)} style={{ padding: "0.3rem 0.7rem", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "6px", fontSize: "0.78rem", color: "#16A34A", cursor: "pointer", fontWeight: 600 }}>Load</button>
                    <button onClick={() => deletePlan(p.id)} style={{ padding: "0.3rem 0.7rem", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", fontSize: "0.78rem", color: "#DC2626", cursor: "pointer", fontWeight: 600 }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.75rem 1.25rem 3rem" }}>
        {!plan && !gradeResult && !loading && !grading && (
          <>
            <div style={{ marginBottom: "1.75rem" }}>
              <h1 className="form-title">Your plan. Your life.</h1>
              <p className="form-sub">The more specific you are, the more personal your plan will be.</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
              <button type="button" onClick={() => setMode("generate")} className={`btn ${mode === "generate" ? "btn-solid" : "btn-ghost"}`}>
                Generate a plan
              </button>
              <button type="button" onClick={() => setMode("grade")} className={`btn ${mode === "grade" ? "btn-solid" : "btn-ghost"}`}>
                Grade my routine
              </button>
            </div>
            {mode === "generate" ? (
            <div className="form-card">
              <Divider label="Your Goal" />
              <Field label="What's your main fitness goal?" name="goal" value={form.goal} onChange={handleChange} placeholder="e.g. Build muscle while losing body fat" error={fieldErrors.goal} suggestions={["Build muscle", "Lose fat", "Build muscle while losing fat", "Get stronger", "Improve general fitness and health", "Improve endurance / cardio", "Train for a sport or event"]} />
              <Field label="Specific target (optional)" name="target" value={form.target} onChange={handleChange} placeholder="e.g. Lose 5kg, gain visible arm muscle, run 5km" hint="The more concrete the better — give us a number if you can." />

              <Divider label="Your Schedule" />
              <Field label="Other physical activity or sports" name="otherActivity" value={form.otherActivity} onChange={handleChange} placeholder="e.g. Football on Tuesdays and Thursdays, badminton twice a week" hint="Include anything physical — this prevents the plan from clashing with your existing activity." />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.85rem" }}>
                <Field label="Gym days per week" name="days" value={form.days} onChange={handleChange} as="select" options={[2,3,4,5,6].map(n => ({ value: String(n), label: `${n} days` }))} />
                <Field label="Minutes per session" name="time" value={form.time} onChange={handleChange} type="number" placeholder="e.g. 45" />
                <Field label="Preferred time" name="trainTime" value={form.trainTime} onChange={handleChange} as="select" options={[{ value: "morning", label: "Morning" }, { value: "afternoon", label: "Afternoon" }, { value: "evening", label: "Evening" }, { value: "flexible", label: "Flexible" }]} />
              </div>
              <Field label="Specific days? (optional)" name="specificDays" value={form.specificDays} onChange={handleChange} placeholder="e.g. Monday, Wednesday, Friday — leave blank to let the plan decide" hint="Only fill this in if you have fixed days." />
              <Field label="Fitness level" name="level" value={form.level} onChange={handleChange} as="select" options={[{ value: "beginner", label: "Beginner — just starting out" }, { value: "intermediate", label: "Intermediate — some experience" }, { value: "advanced", label: "Advanced — trained consistently" }]} />

              <Divider label="Your Challenges" />
              <Field label="What's your biggest excuse or challenge?" name="excuse" value={form.excuse} onChange={handleChange} placeholder="e.g. I get home tired at 6pm and plain lifting bores me" as="textarea" error={fieldErrors.excuse} />
              <Field label="Have you tried a fitness plan before? What went wrong?" name="pastAttempts" value={form.pastAttempts} onChange={handleChange} placeholder="e.g. I quit after 2 weeks because it felt too repetitive" as="textarea" hint="This helps build a plan that avoids your past pitfalls." />

              <Divider label="Your Preferences" />
              <Field label="Exercises or activities you enjoy" name="enjoy" value={form.enjoy} onChange={handleChange} placeholder="e.g. Group classes, cycling, bodyweight movements" />
              <Field label="Exercises you dislike or want to avoid" name="dislike" value={form.dislike} onChange={handleChange} placeholder="e.g. Running, heavy barbell squats" />
              <Field label="Injuries or physical limitations" name="injuries" value={form.injuries} onChange={handleChange} placeholder="e.g. Left knee pain, lower back issues — or 'none'" />

              <Divider label="Your Equipment" />
              <EquipmentSelector location={form.equipmentLocation} onLocationChange={handleEquipmentLocation} selected={form.equipment} onEquipmentChange={handleEquipment} error={fieldErrors.equipmentLocation} />

              {error && <p className="form-error">{error}</p>}
              {atGenerationLimit ? (
                <button onClick={() => startCheckout("extra_generation")} disabled={checkingOut === "extra_generation"} className="btn btn-cool-solid btn-block" style={{ marginTop: "0.5rem" }}>
                  {checkingOut === "extra_generation" ? "Redirecting..." : `You've used your ${totalAllowedGenerations} included plans — buy another for €7`}
                </button>
              ) : freeActionBlocked ? (
                <button onClick={() => startCheckout("unlock")} disabled={checkingOut === "unlock"} className="btn btn-cool-solid btn-block" style={{ marginTop: "0.5rem" }}>
                  {checkingOut === "unlock" ? "Redirecting..." : `You've used your free ${profile.free_action_used === "grade" ? "routine grade" : "plan"} — unlock for €19`}
                </button>
              ) : (
                <button onClick={generate} className="btn btn-solid btn-block" style={{ marginTop: "0.5rem" }}>
                  Generate My 8-Week Plan →
                </button>
              )}
            </div>
            ) : (
            <div className="form-card">
              <Divider label="Your Profile" />
              <Field label="What's your main fitness goal?" name="goal" value={form.goal} onChange={handleChange} placeholder="e.g. Build muscle while losing body fat" suggestions={["Build muscle", "Lose fat", "Build muscle while losing fat", "Get stronger", "Improve general fitness and health", "Improve endurance / cardio", "Train for a sport or event"]} />
              <Field label="Fitness level" name="level" value={form.level} onChange={handleChange} as="select" options={[{ value: "beginner", label: "Beginner — just starting out" }, { value: "intermediate", label: "Intermediate — some experience" }, { value: "advanced", label: "Advanced — trained consistently" }]} />
              <Field label="Injuries or physical limitations" name="injuries" value={form.injuries} onChange={handleChange} placeholder="e.g. Left knee pain, lower back issues — or 'none'" />

              <Divider label="Your Equipment" />
              <EquipmentSelector location={form.equipmentLocation} onLocationChange={handleEquipmentLocation} selected={form.equipment} onEquipmentChange={handleEquipment} error={fieldErrors.equipmentLocation} />

              <Divider label="Your Current Routine" />
              <Field label="Describe or paste your current routine" name="routineText" value={routineText} onChange={e => setRoutineText(e.target.value)} placeholder={"e.g. Monday: Bench press 3x10, Lat pulldown 3x12...\nWednesday: Squat 3x8, Leg curl 3x12..."} as="textarea" hint="List your days, exercises, sets and reps as best you can — rough is fine." />

              {gradeError && <p className="form-error">{gradeError}</p>}
              {atGenerationLimit ? (
                <button onClick={() => startCheckout("extra_generation")} disabled={checkingOut === "extra_generation"} className="btn btn-cool-solid btn-block" style={{ marginTop: "0.5rem" }}>
                  {checkingOut === "extra_generation" ? "Redirecting..." : `You've used your ${totalAllowedGenerations} included plans — buy another for €7`}
                </button>
              ) : freeActionBlocked ? (
                <button onClick={() => startCheckout("unlock")} disabled={checkingOut === "unlock"} className="btn btn-cool-solid btn-block" style={{ marginTop: "0.5rem" }}>
                  {checkingOut === "unlock" ? "Redirecting..." : `You've used your free ${profile.free_action_used === "plan" ? "plan generation" : "routine grade"} — unlock for €19`}
                </button>
              ) : (
                <button onClick={gradeWorkout} className="btn btn-solid btn-block" style={{ marginTop: "0.5rem" }}>
                  Grade My Routine →
                </button>
              )}
            </div>
            )}
            <p className="form-legal" style={{ marginTop: "1rem" }}>
              <span onClick={() => setPage("terms")}>Terms of Service</span>
              {" · "}
              <span onClick={() => setPage("privacy")}>Privacy Policy</span>
            </p>
          </>
        )}

        {(loading || grading) && (
          <div style={{ textAlign: "center", padding: "5rem 0" }}>
            <div className="auth-spinner" style={{ width: 44, height: 44, margin: "0 auto 1rem" }} />
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{loading ? "Building your personalized plan..." : "Grading your routine..."}</p>
          </div>
        )}

        {plan && (
          <div>
            <div style={{ marginBottom: "1.5rem" }} className={!profile?.has_paid ? "preview-badge-host" : undefined}>
              {!profile?.has_paid && (
                <div className="preview-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  Preview
                </div>
              )}
              <h2 className="results-title">{plan.title}</h2>
              <p className="results-summary">{plan.summary}</p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <span className="pill" style={{ background: "var(--accent-bg)", color: "var(--accent-deep)" }}>📅 {plan.schedule?.join(", ")}</span>
                <span className="pill" style={{ background: "var(--cool-bg)", color: "var(--cool-text)" }}>⏱ {plan.weeks} weeks</span>
              </div>
            </div>

            {plan.weeks_breakdown && (
              <div className="section-card" style={{ padding: "1.25rem" }}>
                <h3 className="section-title">Program Phases</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {plan.weeks_breakdown.map((p, i) => (
                    <div key={i} className="phase-row">
                      <div className="phase-index">{i + 1}</div>
                      <div>
                        <div className="phase-title">{p.phase}</div>
                        <div className="phase-focus">{renderWithGlossary(p.focus)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.workouts && (
              <div className="section-card">
                <div className="tab-row">
                  {plan.workouts.map((w, i) => (
                    <button key={i} onClick={() => setActiveWorkout(i)} className={`tab-btn${activeWorkout === i ? " is-active" : ""}`}>{w.day}</button>
                  ))}
                </div>
                {plan.workouts[activeWorkout] && (() => {
                  const w = plan.workouts[activeWorkout];
                  const firstEffortIndices = getFirstEffortIndices(w.exercises);
                  return (
                    <div className="workout-panel" key={activeWorkout}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                        <div>
                          <h3 className="workout-name">{w.name}</h3>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <TypeTag type={w.type} />
                            <span style={{ fontSize: "0.78rem", color: "var(--faint)" }}>⏱ {w.duration}</span>
                          </div>
                        </div>
                      </div>
                      {w.warmup && (
                        <div className="info-box info-box-warm">
                          <span className="info-box-label">Warm-up</span>
                          <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", lineHeight: 1.5 }}>{w.warmup}</p>
                        </div>
                      )}
                      <div className="exercise-list">
                        {w.exercises?.map((ex, i) => (
                          <div key={i} className={`exercise-card${selectedExercise === ex.name ? " is-selected" : ""}`}>
                            <div className="exercise-row">
                              <div className="exercise-index">{i + 1}</div>
                              <div>
                                <div className="exercise-name">
                                  {ex.name}
                                  <span onClick={() => openYoutube(ex.name)} className="exercise-how-to">▶ how to</span>
                                </div>
                                {ex.note && <div className="exercise-note">{renderWithGlossary(ex.note)}</div>}
                              </div>
                              <div className="exercise-stats">
                                <div className="exercise-sets">{ex.sets}×{ex.reps}</div>
                                <div className="exercise-rest">{ex.rest} rest</div>
                                {ex.effort && <div className="exercise-effort">{firstEffortIndices.has(i) ? renderWithGlossary(ex.effort) : ex.effort}</div>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {w.cooldown && (
                        <div className="info-box info-box-cool">
                          <span className="info-box-label">Cool-down</span>
                          <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", lineHeight: 1.5 }}>{w.cooldown}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
              {plan.nutrition_tips && (
                <div className="expand-block">
                  <h3 className="section-title">Nutrition Tips</h3>
                  <div className={`expand-body${expandedSections.nutrition ? " is-expanded" : ""}`}>
                    <ul style={{ padding: "0 0 0 1rem" }}>
                      {plan.nutrition_tips.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                  <span onClick={() => toggleSection("nutrition")} className="expand-toggle">
                    {expandedSections.nutrition ? "Show less" : "Show more"}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {plan.motivation_strategy && (
                  <div className="expand-block tint-mint">
                    <h3 className="section-title" style={{ color: "var(--accent-deep)" }}>Motivation Strategy</h3>
                    <div className={`expand-body${expandedSections.motivation ? " is-expanded" : ""}`} style={{ color: "var(--accent-deep)" }}>
                      <p>{plan.motivation_strategy}</p>
                    </div>
                    <span onClick={() => toggleSection("motivation")} className="expand-toggle">
                      {expandedSections.motivation ? "Show less" : "Show more"}
                    </span>
                  </div>
                )}
                {plan.weekly_checkin && (
                  <div className="expand-block tint-sky">
                    <h3 className="section-title" style={{ color: "var(--cool-text)" }}>Weekly Check-in</h3>
                    <div className={`expand-body${expandedSections.checkin ? " is-expanded" : ""}`} style={{ color: "var(--cool-text)" }}>
                      <p>{plan.weekly_checkin}</p>
                    </div>
                    <span onClick={() => toggleSection("checkin")} className="expand-toggle">
                      {expandedSections.checkin ? "Show less" : "Show more"}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <p className="results-footnote">
              Generated by FitPlan AI · Adjust intensity to your level · Consult a doctor before starting a new fitness program
            </p>
            <p className="results-footnote" style={{ marginTop: "0.5rem" }}>
              <span onClick={() => setPage("terms")} style={{ color: "var(--accent-deep)", cursor: "pointer", textDecoration: "underline" }}>Terms of Service</span>
              {" · "}
              <span onClick={() => setPage("privacy")} style={{ color: "var(--accent-deep)", cursor: "pointer", textDecoration: "underline" }}>Privacy Policy</span>
            </p>
          </div>
        )}

        {gradeResult && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 className="results-title">Routine Review</h2>
              <p className="results-summary">{renderWithGlossary(gradeResult.summary)}</p>
            </div>
            <div className="section-card" style={{ padding: "1.25rem" }}>
              <h3 className="section-title">What to Fix</h3>
              <div className="exercise-list">
                {gradeResult.fixes?.map((f, i) => (
                  <div key={i} className="exercise-card">
                    <div className="exercise-row" style={{ gridTemplateColumns: "1.6rem 1fr" }}>
                      <div className="exercise-index">{i + 1}</div>
                      <div>
                        <div className="exercise-name">{f.exercise || "General"}</div>
                        <div className="exercise-note">{renderWithGlossary(f.issue)}</div>
                        <div className="exercise-note" style={{ color: "var(--accent-deep)", fontWeight: 600, marginTop: "0.3rem" }}>→ {renderWithGlossary(f.fix)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => { setGradeResult(null); setRoutineText(""); }} className="btn btn-ghost" style={{ marginTop: "1rem" }}>
              ← Grade another routine
            </button>
          </div>
        )}
      </div>

      {showCheckIn && plan && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: "14px", maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: "1.5rem" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: "0 0 0.25rem" }}>Week {currentWeek} check-in</h3>
            <p style={{ fontSize: "0.85rem", color: "#6B7280", margin: "0 0 1.25rem" }}>Everything's checked as done by default — uncheck anything you skipped and tell us why.</p>

            {plan.workouts.map((w, wi) => (
              <div key={wi} style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#111827", marginBottom: "0.4rem" }}>{w.day} — {w.name}</div>
                {w.exercises.map((ex, ei) => {
                  const key = `${w.day}::${ex.name}`;
                  const done = !!checkInState[key];
                  return (
                    <div key={ei} style={{ padding: "0.4rem 0" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.83rem", color: "#374151", cursor: "pointer" }}>
                        <input type="checkbox" checked={done} onChange={() => toggleExerciseDone(w.day, ex.name)} />
                        {ex.name}
                      </label>
                      {!done && (
                        <input
                          type="text"
                          value={skipReasons[key] || ""}
                          onChange={e => updateSkipReason(w.day, ex.name, e.target.value)}
                          placeholder="Why? (pain, too hard, ran out of time, boring...)"
                          style={{ width: "100%", marginTop: "0.3rem", padding: "0.4rem 0.6rem", fontSize: "0.78rem", borderRadius: "6px", border: "1.5px solid #FCA5A5", background: "#FEF2F2", color: "#111827", outline: "none", boxSizing: "border-box" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            <Field label="Anything else overall? (optional)" name="checkInNotes" value={checkInNotes} onChange={e => setCheckInNotes(e.target.value)} as="textarea" hint="General comments about the week — specific skip reasons are captured above, next to each exercise." />

            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
              <button onClick={() => setShowCheckIn(false)} style={{ flex: 1, padding: "0.65rem", border: "1.5px solid #E5E7EB", borderRadius: "9px", background: "transparent", color: "#6B7280", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={submitCheckIn} disabled={adjusting} style={{ flex: 2, padding: "0.65rem", border: "none", borderRadius: "9px", background: "#16A34A", color: "#fff", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
                {adjusting ? "Adjusting your plan..." : "Submit & adjust next week"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
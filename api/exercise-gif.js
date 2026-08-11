import { getVerifiedUser } from "./_lib/supabaseAuth.js";

// Equipment words that actually show up in generated exercise names, mapped to
// the ExerciseDB `equipment` values that count as agreeing with them. A name
// with none of these words implies no specific equipment, so nothing to check.
const EQUIPMENT_KEYWORDS = [
  { keyword: "barbell", equipment: ["barbell", "ez barbell", "olympic barbell", "trap bar"] },
  { keyword: "dumbbell", equipment: ["dumbbell"] },
  { keyword: "kettlebell", equipment: ["kettlebell"] },
  { keyword: "cable", equipment: ["cable"] },
  { keyword: "machine", equipment: ["leverage machine", "sled machine", "smith machine"] },
  { keyword: "band", equipment: ["band", "resistance band"] },
  { keyword: "bodyweight", equipment: ["body weight"] },
];

// What equipment (if any) the exercise's own name implies — null means the
// name doesn't mention equipment, so there's nothing to validate a match against.
export const impliedEquipment = (name) => {
  const lower = name.toLowerCase();
  const found = EQUIPMENT_KEYWORDS.find(e => new RegExp(`\\b${e.keyword}\\b`).test(lower));
  return found ? found.equipment : null;
};

export const equipmentAgrees = (implied, candidateEquipment) => {
  if (!implied) return true;
  const eq = (candidateEquipment || "").toLowerCase();
  return implied.some(e => eq === e || eq.includes(e));
};

// Just the full name, lowercased — no truncation fallback. A word-count
// truncation tier was tried and dropped: ExerciseDB's search does plain
// substring matching, not tokenized/fuzzy matching, so a shortened query like
// "barbell overhead" (from "Barbell Overhead Press") can land inside a
// completely unrelated stored name ("barbell overhead squat") that happens to
// contain the same short substring. Equipment agreement doesn't catch that
// case — the exercise itself is just wrong. A missed match is safe; a
// same-ish-looking wrong one isn't, so no truncation guessing at all.
export const buildAttempts = (name) => [name.toLowerCase().replace(/\s+/g, " ").trim()];

// Given a batch of ExerciseDB search results, the first one (if any) whose
// equipment field actually agrees with what the searched name implies.
export const pickMatch = (candidates, implied) =>
  (candidates || []).find(c => equipmentAgrees(implied, c.equipment)) || null;

const RAPIDAPI_HEADERS = {
  "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
  "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
};

async function findMatch(name) {
  const implied = impliedEquipment(name);
  for (const attempt of buildAttempts(name)) {
    try {
      const response = await fetch(
        `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(attempt)}?limit=10&offset=0`,
        { headers: RAPIDAPI_HEADERS }
      );
      const data = await response.json();
      const match = pickMatch(data, implied);
      if (match) return match;
    } catch (e) {
      continue;
    }
  }
  return null;
}

// The search/detail endpoints don't include a usable gifUrl — the real image
// lives behind a separate, key-gated /image endpoint, so it has to be fetched
// server-side (the key can't go to the browser) and inlined as a data URI
// rather than handed back as a URL for the client to hotlink. This also means
// a broken image is caught here, before ever responding — if the fetch fails,
// this returns null and the caller falls back to "no animation available"
// exactly like a no-match, instead of returning a URL that 404s in the browser.
async function fetchGifDataUri(exerciseId) {
  try {
    const res = await fetch(
      `https://exercisedb.p.rapidapi.com/image?exerciseId=${exerciseId}&resolution=180`,
      { headers: RAPIDAPI_HEADERS }
    );
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:image/gif;base64,${buf.toString("base64")}`;
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const user = await getVerifiedUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });

  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "No exercise name provided" });

  const match = await findMatch(name);
  const gifUrl = match ? await fetchGifDataUri(match.id) : null;

  if (!gifUrl) return res.status(404).json({ gifUrl: null });
  res.status(200).json({ gifUrl, bodyPart: match.bodyPart, target: match.target });
}

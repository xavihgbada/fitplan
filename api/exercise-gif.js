export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "No exercise name provided" });

  // Simplify name to improve matching — ExerciseDB uses inconsistent naming
  const simplified = name
    .toLowerCase()
    .replace(/\b(barbell|dumbbell|cable|machine|weighted|assisted|bodyweight)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Try full name first, then simplified
  const attempts = [
    name.toLowerCase(),
    simplified,
    simplified.split(" ").slice(0, 2).join(" "), // first two words only
  ];

  for (const attempt of attempts) {
    try {
      const response = await fetch(
        `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(attempt)}?limit=1&offset=0`,
        {
          headers: {
            "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
            "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
          },
        }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        return res.status(200).json({ gifUrl: data[0].gifUrl, bodyPart: data[0].bodyPart, target: data[0].target });
      }
    } catch (e) {
      continue;
    }
  }

  res.status(404).json({ gifUrl: null });
}
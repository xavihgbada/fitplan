export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "No exercise name provided" });

  try {
    const response = await fetch(
      `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(name.toLowerCase())}?limit=1`,
      {
        headers: {
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
          "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
        },
      }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      res.status(200).json({ gifUrl: data[0].gifUrl, bodyPart: data[0].bodyPart, target: data[0].target });
    } else {
      res.status(404).json({ gifUrl: null });
    }
  } catch (e) {
    res.status(500).json({ gifUrl: null });
  }
}
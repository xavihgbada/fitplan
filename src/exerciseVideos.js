// Curated exercise name -> YouTube video id for the "how to" modal. Hand-picked, not
// fetched via search at runtime — youtube.com/embed/{id} is a public, unauthenticated
// embed, so no API key is involved anywhere in this. Keys should match the clean
// equipment + movement base names the AI is instructed to use (see EXERCISE NAMING in
// App.jsx's SYSTEM_PROMPT) so lookups actually hit. Any exercise name missing here
// falls back to opening a plain YouTube search in a new tab instead of the modal.
export const EXERCISE_VIDEOS = {};

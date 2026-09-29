import type { Exercise } from "./types";

/**
 * The exercise's technique video on YouTube. The catalog has no video
 * column, so this is a YouTube search for the exercise on DeltaBolic's
 * channel (short, form-focused demos), the same link the session screen
 * has always used; the top result is the demo for that exercise.
 */
export const exerciseVideoUrl = (exercise: Pick<Exercise, "name">) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`DeltaBolic ${exercise.name}`)}`;

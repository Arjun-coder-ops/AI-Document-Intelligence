export interface ThresholdEvaluationResult {
  passesThreshold: boolean;
  topScore: number;
  fallbackMessage?: string | undefined;
}

export const DEFAULT_NOT_FOUND_MESSAGE =
  'I could not find relevant information in your uploaded documents to answer this question.';

export function evaluateRelevanceThreshold(
  scores: number[],
  threshold: number,
  customNotFoundMessage?: string,
): ThresholdEvaluationResult {
  if (scores.length === 0) {
    return {
      passesThreshold: false,
      topScore: 0,
      fallbackMessage: customNotFoundMessage ?? DEFAULT_NOT_FOUND_MESSAGE,
    };
  }

  const topScore = Math.max(...scores);
  if (topScore < threshold) {
    return {
      passesThreshold: false,
      topScore,
      fallbackMessage: customNotFoundMessage ?? DEFAULT_NOT_FOUND_MESSAGE,
    };
  }

  return {
    passesThreshold: true,
    topScore,
  };
}

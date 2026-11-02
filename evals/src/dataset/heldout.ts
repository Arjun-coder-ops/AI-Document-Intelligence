import { UNANSWERABLE_QUESTIONS } from './unanswerable.js';
import { PARAPHRASED_QUESTIONS } from './paraphrased.js';

export const HELDOUT_QUESTIONS = [...UNANSWERABLE_QUESTIONS, ...PARAPHRASED_QUESTIONS];

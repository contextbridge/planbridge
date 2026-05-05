import { Result } from 'neverthrow';
import { toError } from './errors.ts';

export const safeJsonParse = Result.fromThrowable((text: string) => JSON.parse(text) as unknown, toError);

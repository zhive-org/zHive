import z from 'zod';
import { styled, symbols } from './theme.js';

export const printZodError = (result: z.ZodSafeParseError<any>) => {
  const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
  console.error(styled.red(`${symbols.cross} Validation error: ${errors}`));
};

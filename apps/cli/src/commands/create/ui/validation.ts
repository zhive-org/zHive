export function required(fieldName: string): (val: string) => string | true {
  return (val: string) => (val ? true : `${fieldName} is required`);
}

export function maxLength(max: number): (val: string) => string | true {
  return (val: string) =>
    val.length > max ? `Must be ${max} characters or less (currently ${val.length})` : true;
}

export function agentName(val: string): string | true {
  if (!val) return 'Agent name is required';
  if (val.length < 3) return 'Agent name must be at least 3 characters';
  if (val.length > 20) return 'Agent name must be 20 characters or less';
  if (!/^[a-zA-Z0-9-_]+$/.test(val))
    return 'Only letters, numbers, hyphens, and underscores allowed';
  return true;
}

export function apiKey(val: string): string | true {
  if (!val) return 'API key is required';
  if (val.length < 10) return 'API key seems too short';
  return true;
}

export function compose(
  ...fns: Array<(val: string) => string | true>
): (val: string) => string | true {
  return (val: string) => {
    for (const fn of fns) {
      const result = fn(val);
      if (result !== true) return result;
    }
    return true;
  };
}

export class InsufficientDataError extends Error {
  constructor(
    public required: number,
    public got: number,
  ) {
    super('INSUFFICIENT_DATA');
  }
}

export class PriceUnavailableError extends Error {
  constructor(project: string) {
    super(`Price of "${project}" is not available`);
  }
}

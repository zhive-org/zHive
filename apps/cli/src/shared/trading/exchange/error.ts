export class UnSupportedAssetError extends Error {}

export class PositionNotFound extends Error {}

export class UnknownError extends Error {}

export class PositionFlipNotSupported extends Error {
  constructor() {
    super('cannot flip position side; close existing position first');
  }
}

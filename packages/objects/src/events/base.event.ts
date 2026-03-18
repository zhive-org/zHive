export interface BaseEvent<T extends string> {
  readonly type: T;
}

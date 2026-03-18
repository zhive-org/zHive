import { ObjectId } from 'mongodb';
export type ResponseSerialized<T> = T extends ObjectId | Date
  ? string
  : {
      [P in keyof T]: T[P] extends Date | ObjectId | undefined
        ? string
        : T[P] extends object | undefined
          ? ResponseSerialized<NonNullable<T[P]>>
          : T[P] extends object
            ? ResponseSerialized<T[P]>
            : T[P];
    };

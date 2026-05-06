export type ChatPath = 'preset' | 'custom';

export type State =
  | { kind: 'preset' }
  | { kind: 'seed' }
  | { kind: 'custom' }
  | {
      kind: 'streaming';
      chatPath: ChatPath;
      feedbackCount: number;
      stream: AsyncIterable<string>;
    }
  | { kind: 'review'; chatPath: ChatPath; feedbackCount: number }
  | {
      kind: 'error';
      chatPath: ChatPath;
      feedbackCount: number;
      message: string;
    };

export type Event =
  | { type: 'PRESET_PICKED' }
  | { type: 'CUSTOM_PICKED' }
  | { type: 'SEED_SUBMITTED' }
  | { type: 'INTERVIEW_DONE'; stream: AsyncIterable<string> }
  | { type: 'STREAM_COMPLETED' }
  | { type: 'STREAM_FAILED'; message: string }
  | { type: 'DRAFT_ACCEPTED' }
  | { type: 'REGEN_REQUESTED'; stream: AsyncIterable<string> }
  | { type: 'RETRY'; stream: AsyncIterable<string> }
  | { type: 'BACK' };

export const initial: State = { kind: 'preset' };

export function reduce(state: State, event: Event): State {
  switch (state.kind) {
    case 'preset':
      if (event.type === 'PRESET_PICKED') {
        return { kind: 'review', chatPath: 'preset', feedbackCount: 0 };
      }
      if (event.type === 'CUSTOM_PICKED') return { kind: 'seed' };
      return state;

    case 'seed':
      if (event.type === 'SEED_SUBMITTED') return { kind: 'custom' };
      if (event.type === 'BACK') return { kind: 'preset' };
      return state;

    case 'custom':
      if (event.type === 'INTERVIEW_DONE') {
        return {
          kind: 'streaming',
          chatPath: 'custom',
          feedbackCount: 0,
          stream: event.stream,
        };
      }
      if (event.type === 'BACK') return { kind: 'seed' };
      return state;

    case 'streaming':
      if (event.type === 'STREAM_COMPLETED') {
        return {
          kind: 'review',
          chatPath: state.chatPath,
          feedbackCount: state.feedbackCount,
        };
      }
      if (event.type === 'STREAM_FAILED') {
        return {
          kind: 'error',
          chatPath: state.chatPath,
          feedbackCount: state.feedbackCount,
          message: event.message,
        };
      }
      return state;

    case 'review':
      if (event.type === 'REGEN_REQUESTED') {
        return {
          kind: 'streaming',
          chatPath: state.chatPath,
          feedbackCount: state.feedbackCount + 1,
          stream: event.stream,
        };
      }
      if (event.type === 'DRAFT_ACCEPTED') return state;
      if (event.type === 'BACK') {
        return state.chatPath === 'custom' ? { kind: 'custom' } : { kind: 'preset' };
      }
      return state;

    case 'error':
      if (event.type === 'RETRY') {
        return {
          kind: 'streaming',
          chatPath: state.chatPath,
          feedbackCount: state.feedbackCount,
          stream: event.stream,
        };
      }
      if (event.type === 'BACK') {
        return state.chatPath === 'custom' ? { kind: 'custom' } : { kind: 'preset' };
      }
      return state;
  }
}

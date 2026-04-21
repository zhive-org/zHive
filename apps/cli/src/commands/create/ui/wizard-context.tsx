import React, { createContext, useContext, useReducer } from 'react';
import type { AIProviderId } from '../../../shared/config/ai-providers.js';

// ── Step navigation ────────────────────────────────────────────

export const STEP_ORDER = ['identity', 'watchlist', 'api-key', 'strategy', 'scaffold'] as const;

export type Step = (typeof STEP_ORDER)[number];

export const STEP_LABELS: Record<Step, string> = {
  identity: 'Identity',
  watchlist: 'Watchlist',
  'api-key': 'API Key',
  strategy: 'Strategy',
  scaffold: 'Create',
};

// ── State slices ───────────────────────────────────────────────

export interface IdentityState {
  name: string;
  bio: string;
  avatarUrl: string;
}

export interface WatchlistState {
  assets: string[];
}

export interface ApiKeyState {
  providerId: AIProviderId | null;
  apiKey: string;
}

export interface GenerationState {
  /** Generated md file */
  content: string;
  /** Draft md file */
  draft: string;
  /** User input */
  input: string;
}

export interface WizardState {
  step: Step;
  identity: IdentityState;
  watchlist: WatchlistState;
  apiConfig: ApiKeyState;
  soul: GenerationState;
  strategy: GenerationState;
  error: string;
}

// ── Actions ────────────────────────────────────────────────────

export type WizardAction =
  | { type: 'GO_TO_STEP'; step: Step }
  | { type: 'GO_BACK' }
  | { type: 'SET_IDENTITY'; payload: IdentityState }
  | { type: 'SET_WATCHLIST'; payload: WatchlistState }
  | { type: 'SET_API_CONFIG'; payload: ApiKeyState }
  | { type: 'SET_STRATEGY'; payload: GenerationState }
  | { type: 'UPDATE_STRATEGY'; payload: Partial<GenerationState> }
  | { type: 'SET_ERROR'; message: string };

// ── Reducer ────────────────────────────────────────────────────

function goBackStep(current: Step): Step {
  const idx = STEP_ORDER.indexOf(current);
  return idx > 0 ? STEP_ORDER[idx - 1]! : current;
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'GO_TO_STEP':
      return { ...state, step: action.step };

    case 'GO_BACK':
      return { ...state, step: goBackStep(state.step) };

    case 'SET_IDENTITY':
      return { ...state, identity: action.payload, step: 'watchlist' };

    case 'SET_WATCHLIST':
      return { ...state, watchlist: action.payload, step: 'api-key' };

    case 'SET_API_CONFIG':
      return { ...state, apiConfig: action.payload, step: 'strategy' };

    case 'SET_STRATEGY':
      return {
        ...state,
        strategy: { ...action.payload, draft: '' },
        step: 'scaffold',
      };

    case 'UPDATE_STRATEGY':
      return {
        ...state,
        strategy: { ...state.strategy, ...action.payload },
      };

    case 'SET_ERROR':
      return { ...state, error: action.message };

    default:
      return state;
  }
}

// ── Initial state ──────────────────────────────────────────────

export function createInitialState(initialName?: string): WizardState {
  return {
    step: 'identity',
    identity: { name: initialName ?? '', bio: '', avatarUrl: '' },
    watchlist: { assets: [] },
    apiConfig: { providerId: null, apiKey: '' },
    soul: { content: '', draft: '', prompt: '' },
    strategy: { content: '', draft: '', prompt: '' },
    error: '',
  };
}

// ── Context + hook ─────────────────────────────────────────────

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used within WizardProvider');
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────

interface WizardProviderProps {
  initialName?: string;
  initialState?: WizardState;
  children: React.ReactNode;
}

export function WizardProvider({
  initialName,
  initialState,
  children,
}: WizardProviderProps): React.ReactElement {
  const [state, dispatch] = useReducer(
    wizardReducer,
    initialState ?? createInitialState(initialName),
  );

  return <WizardContext.Provider value={{ state, dispatch }}>{children}</WizardContext.Provider>;
}

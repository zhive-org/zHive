import React, { createContext, useContext, useReducer } from 'react';
import type { AIProviderId } from '../../../shared/config/ai-providers.js';

// ── Step navigation ────────────────────────────────────────────

export type Step = 'identity' | 'api-key' | 'soul' | 'strategy' | 'scaffold';

export const STEP_ORDER: Step[] = ['identity', 'api-key', 'soul', 'strategy', 'scaffold'];

export const STEP_LABELS: Record<Step, string> = {
  identity: 'Identity',
  'api-key': 'API Key',
  soul: 'Soul',
  strategy: 'Strategy',
  scaffold: 'Create',
};

// ── State slices ───────────────────────────────────────────────

export interface IdentityState {
  name: string;
  bio: string;
  avatarUrl: string;
}

export interface ApiKeyState {
  providerId: AIProviderId | null;
  apiKey: string;
}

export interface GenerationState {
  content: string;
  draft: string;
  prompt: string;
}

export interface StrategyState extends GenerationState {
  sectors: string[];
  timeframes: string[];
}

export interface WizardState {
  step: Step;
  identity: IdentityState;
  apiConfig: ApiKeyState;
  soul: GenerationState;
  strategy: StrategyState;
  error: string;
}

// ── Actions ────────────────────────────────────────────────────

export type WizardAction =
  | { type: 'GO_TO_STEP'; step: Step }
  | { type: 'GO_BACK' }
  | { type: 'SET_IDENTITY'; payload: IdentityState }
  | { type: 'SET_API_CONFIG'; payload: ApiKeyState }
  | { type: 'SET_SOUL'; content: string }
  | { type: 'SAVE_SOUL_DRAFT'; payload: Partial<GenerationState> }
  | { type: 'SET_STRATEGY'; payload: StrategyState }
  | { type: 'SAVE_STRATEGY_DRAFT'; payload: Partial<StrategyState> }
  | { type: 'UPDATE_STRATEGY'; payload: Partial<StrategyState> }
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
      return { ...state, identity: action.payload, step: 'api-key' };

    case 'SET_API_CONFIG':
      return { ...state, apiConfig: action.payload, step: 'soul' };

    case 'SET_SOUL':
      return {
        ...state,
        soul: { content: action.content, draft: '', prompt: '' },
        step: 'strategy',
      };

    case 'SAVE_SOUL_DRAFT':
      return {
        ...state,
        soul: { ...state.soul, ...action.payload },
        step: goBackStep(state.step),
      };

    case 'SET_STRATEGY':
      return {
        ...state,
        strategy: { ...action.payload, draft: '', prompt: '' },
        step: 'scaffold',
      };

    case 'SAVE_STRATEGY_DRAFT':
      return {
        ...state,
        strategy: { ...state.strategy, ...action.payload },
        step: goBackStep(state.step),
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
    apiConfig: { providerId: null, apiKey: '' },
    soul: { content: '', draft: '', prompt: '' },
    strategy: { content: '', draft: '', prompt: '', sectors: [], timeframes: [] },
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

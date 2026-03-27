import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { type AgentConfig } from '../../shared/config/agent';
import { getHiveDir } from '../../shared/config/constant';

export type AgentStatus = 'spawning' | 'running' | 'exited' | 'errored';

export interface AgentState {
  name: string;
  status: AgentStatus;
  exitCode: number | null;
}

interface ManagedAgent {
  name: string;
  status: AgentStatus;
  exitCode: number | null;
  child: ChildProcess | null;
}

const FORCE_KILL_TIMEOUT_MS = 5_000;
const ABSOLUTE_TIMEOUT_MS = FORCE_KILL_TIMEOUT_MS + 2_000;

export class AgentProcessManager {
  private _agents: Map<string, ManagedAgent> = new Map();
  private _agentsDir: string = path.join(getHiveDir(), 'agents');

  public spawnAll(discovered: AgentConfig[]): void {
    for (const agent of discovered) {
      this._agents.set(agent.name, {
        name: agent.name,
        status: 'spawning',
        exitCode: null,
        child: null,
      });
      this._spawnPiped(agent.name);
    }
  }

  public getStates(): AgentState[] {
    const states: AgentState[] = [];
    for (const agent of this._agents.values()) {
      states.push({
        name: agent.name,
        status: agent.status,
        exitCode: agent.exitCode,
      });
    }
    return states;
  }

  public async stopAgent(name: string): Promise<void> {
    const agent = this._agents.get(name);
    if (!agent?.child) {
      return;
    }

    const child = agent.child;

    const exitPromise = new Promise<void>((resolve) => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      child.on('exit', () => resolve());
      // Absolute safety timeout in case SIGKILL is not enough
      setTimeout(() => resolve(), ABSOLUTE_TIMEOUT_MS);
    });

    child.kill('SIGTERM');

    const forceKillTimer = setTimeout(() => {
      child.kill('SIGKILL');
    }, FORCE_KILL_TIMEOUT_MS);

    await exitPromise;
    clearTimeout(forceKillTimer);

    agent.child = null;
  }

  public respawnPiped(name: string): void {
    const agent = this._agents.get(name);
    if (!agent) {
      return;
    }

    agent.status = 'spawning';
    agent.exitCode = null;
    agent.child = null;
    this._spawnPiped(name);
  }

  private _spawnPiped(name: string): void {
    const agentDir = path.join(this._agentsDir, name);
    const child = spawn('npx', ['@zhive/cli@latest', 'run'], {
      cwd: agentDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const agent = this._agents.get(name);
    if (!agent) {
      return;
    }

    agent.child = child;

    // Transition to 'running' once the OS has spawned the process
    child.on('spawn', () => {
      if (agent.status === 'spawning') {
        agent.status = 'running';
      }
    });

    // Drain stdout/stderr to prevent buffer blocking
    child.stdout?.resume();
    child.stderr?.resume();

    child.on('error', () => {
      agent.status = 'errored';
      agent.exitCode = null;
      agent.child = null;
    });

    child.on('exit', (code) => {
      const exitCode = code ?? 1;
      agent.status = exitCode === 0 ? 'exited' : 'errored';
      agent.exitCode = exitCode;
      agent.child = null;
    });
  }
}

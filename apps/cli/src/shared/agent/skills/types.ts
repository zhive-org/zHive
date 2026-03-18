/**
 * Metadata parsed from SKILL.md frontmatter.
 */
export interface SkillMetadata {
  /** Skill name (from frontmatter) */
  readonly name: string;
  /** Description shown to agent for skill selection (from frontmatter) */
  readonly description: string;
  /** Environment requirements (max 500 chars). Optional. */
  readonly compatibility?: string;
}

/**
 * Definition for a skill that can be enabled by agents.
 * Skills provide knowledge and guidance documents only.
 * Tools are always available separately from the CLI bundle.
 */
export interface SkillDefinition {
  /** Unique identifier for the skill (directory name) */
  readonly id: string;
  /** Absolute path to the skill directory */
  readonly path: string;
  /** Metadata from SKILL.md frontmatter */
  readonly metadata: SkillMetadata;
  /** Full SKILL.md content (for agent to read) - knowledge only, no tools */
  readonly body: string;
}

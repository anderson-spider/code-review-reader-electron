// -----------------------------------------------------------------------------
// Prompt Profile Types
// -----------------------------------------------------------------------------

export interface PromptProfile {
  id: string;
  name: string;
  customInstructions: string;
  isDefault?: boolean;
}

export interface PromptConfig {
  profiles: PromptProfile[];
  activeProfileId: string;
}

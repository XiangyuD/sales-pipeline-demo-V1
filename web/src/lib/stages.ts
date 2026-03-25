export const STAGES = [
    "Lead",
    "Qualification",
    "Spec Review",
    "Proposal",
    "Negotiation",
    "Closing",
  ] as const;
  
  export type Stage = (typeof STAGES)[number];
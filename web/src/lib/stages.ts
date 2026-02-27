export const STAGES = [
    "Lead",
    "Qualification",
    "Solution Design",
    "Proposal",
    "Negotiation",
    "Contract Review",
    "Closing",
  ] as const;
  
  export type Stage = (typeof STAGES)[number];
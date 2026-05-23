export type ShrutiFftFrameResult = {
  voiced: boolean;
  confidence?: number;
  hz?: number;
  hzFolded?: number;
  token?: string | null;
  chartHz?: number | null;
  centsOff?: number | null;
  inRaga?: boolean;
  ragaId?: string | null;
};

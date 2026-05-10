export interface UserInsightInfo {
  _id:      string;
  type:     'system' | 'custom';
  model:    string;
  promptId: string | null;
  enabled:  boolean;
}

export interface InsightCard {
  _id:              string;
  name:             string;
  label:            string;
  model:            string;
  isSystemTemplate: boolean;
  userInsight:      UserInsightInfo | null;
}

export interface InsightDetail {
  _id:           string;
  name:          string;
  label:         string;
  type:          'system' | 'custom';
  model:         string;
  promptId:      string | null;
  promptContent: string | null;
  accountId:     string | null;
  enabled:       boolean;
}

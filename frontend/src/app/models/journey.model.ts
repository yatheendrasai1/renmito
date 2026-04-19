export type JourneySpan        = 'indefinite' | 'definite';
export type JourneyTrackerType = 'point-log' | 'derived';
export type JourneyStatus      = 'active' | 'completed' | 'paused';
export type ValueType          = 'numeric' | 'categorical';
export type ValueMetric        = 'duration' | 'count' | 'start-time' | 'end-time';

export interface JourneyConfig {
  metricName:    string;
  valueType:     ValueType;
  allowedValues: string[];
}

export interface JourneyDerivedFrom {
  logTypeId:   string;
  logTypeName: string;
  valueMetric: ValueMetric;
}

export interface Journey {
  id:          string;
  name:        string;
  startDate:   string;   // YYYY-MM-DD
  span:        JourneySpan;
  endDate:     string | null;  // YYYY-MM-DD
  trackerType: JourneyTrackerType;
  status:      JourneyStatus;
  config:      JourneyConfig;
  derivedFrom: JourneyDerivedFrom | null;
  createdAt:   string;
  updatedAt:   string;
}

export interface CreateJourney {
  name:        string;
  startDate:   string;
  span:        JourneySpan;
  endDate?:    string;
  trackerType: JourneyTrackerType;
  config?: {
    metricName?:    string;
    valueType?:     ValueType;
    allowedValues?: string[];
  };
  derivedFrom?: {
    logTypeId:   string;
    logTypeName: string;
    valueMetric: ValueMetric;
  };
}

export interface JourneyEntry {
  id:               string;
  journeyId:        string;
  timestamp:        string;   // ISO datetime
  valueType:        ValueType;
  numericValue:     number | null;
  categoricalValue: string | null;
  sourceLogId:      string | null;
  createdAt:        string;
  updatedAt:        string;
}

export interface CreateJourneyEntry {
  timestamp:         string;   // ISO datetime
  valueType:         ValueType;
  numericValue?:     number;
  categoricalValue?: string;
}

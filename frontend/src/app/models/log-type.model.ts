export interface LogType {
  _id: string;
  name: string;
  domain: 'work' | 'personal' | 'family';
  category: string;
  color: string;
  icon: string;
  isBuiltIn: boolean;
  isActive: boolean;
  /** 'default' = shared, read-only (defaultlogtypes collection)
   *  'user'    = created by this account (logtypes collection) */
  source: 'default' | 'user';
}

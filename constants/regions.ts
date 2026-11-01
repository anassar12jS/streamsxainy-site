export interface RegionOption {
  id: string;
  name: string;
  country: string;
  flag: string;
  tz: string;
  offsetBadge: string;
}

export const REGIONS: RegionOption[] = [
  { id: 'morocco', name: 'Morocco / Maroc', country: 'Casablanca & Rabat', flag: '🇲🇦', tz: 'UTC', offsetBadge: 'GMT (UTC+0)' },
  { id: 'spain', name: 'Spain / España', country: 'Madrid & Barcelona', flag: '🇪🇸', tz: 'Europe/Madrid', offsetBadge: 'CET (GMT+2)' },
  { id: 'uk', name: 'United Kingdom', country: 'London & Manchester', flag: '🇬🇧', tz: 'Europe/London', offsetBadge: 'BST (GMT+1)' },
  { id: 'france', name: 'France', country: 'Paris & Marseille', flag: '🇫🇷', tz: 'Europe/Paris', offsetBadge: 'CET (GMT+2)' },
  { id: 'italy', name: 'Italy / Italia', country: 'Rome & Milan', flag: '🇮🇹', tz: 'Europe/Rome', offsetBadge: 'CET (GMT+2)' },
  { id: 'saudi', name: 'Saudi Arabia', country: 'Riyadh & Jeddah', flag: '🇸🇦', tz: 'Asia/Riyadh', offsetBadge: 'AST (GMT+3)' },
  { id: 'uae', name: 'United Arab Emirates', country: 'Dubai & Abu Dhabi', flag: '🇦🇪', tz: 'Asia/Dubai', offsetBadge: 'GST (GMT+4)' },
  { id: 'egypt', name: 'Egypt', country: 'Cairo & Alexandria', flag: '🇪🇬', tz: 'Africa/Cairo', offsetBadge: 'EET (GMT+3)' },
  { id: 'algeria', name: 'Algeria / Algérie', country: 'Algiers & Oran', flag: '🇩🇿', tz: 'Africa/Algiers', offsetBadge: 'CET (GMT+1)' },
  { id: 'tunisia', name: 'Tunisia / Tunisie', country: 'Tunis & Sfax', flag: '🇹🇳', tz: 'Africa/Tunis', offsetBadge: 'CET (GMT+1)' },
  { id: 'us-east', name: 'USA Eastern', country: 'New York & Miami', flag: '🇺🇸', tz: 'America/New_York', offsetBadge: 'EDT (GMT-4)' },
  { id: 'us-west', name: 'USA Pacific', country: 'Los Angeles & SF', flag: '🇺🇸', tz: 'America/Los_Angeles', offsetBadge: 'PDT (GMT-7)' },
  { id: 'local', name: 'My Device Local Time', country: 'Auto-detected', flag: '🌐', tz: (typeof Intl !== 'undefined' && Intl.DateTimeFormat) ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC') : 'UTC', offsetBadge: 'Local' },
];

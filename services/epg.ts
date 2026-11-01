import { XMLParser } from 'fast-xml-parser';

export interface EPGProgram {
  start: string;
  stop: string;
  channel: string;
  title: string;
  desc?: string;
}

export interface EPGData {
  channels: { id: string; display: string }[];
  programs: Record<string, EPGProgram[]>; // Keyed by channel ID
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_"
});

export const fetchAndParseEPG = async (url: string): Promise<EPGData> => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch EPG");
    const text = await res.text();
    const jsonObj = parser.parse(text);

    const tv = jsonObj.tv;
    if (!tv) return { channels: [], programs: {} };

    const channels = Array.isArray(tv.channel) ? tv.channel : [tv.channel];
    const programsRaw = Array.isArray(tv.programme) ? tv.programme : [tv.programme];

    const mappedChannels = channels.map((c: any) => ({
      id: c['@_id'],
      display: c['display-name']
    }));

    const mappedPrograms: Record<string, EPGProgram[]> = {};

    programsRaw.forEach((p: any) => {
      const channelId = p['@_channel'];
      if (!mappedPrograms[channelId]) mappedPrograms[channelId] = [];
      
      mappedPrograms[channelId].push({
        start: parseTVTime(p['@_start']),
        stop: parseTVTime(p['@_stop']),
        channel: channelId,
        title: typeof p.title === 'object' ? p.title['#text'] : p.title,
        desc: p.desc ? (typeof p.desc === 'object' ? p.desc['#text'] : p.desc) : ''
      });
    });

    return { channels: mappedChannels, programs: mappedPrograms };
  } catch (e) {
    console.error("EPG Parse Error", e);
    return { channels: [], programs: {} };
  }
};

const parseTVTime = (timeStr: string): string => {
  // XMLTV Format: YYYYMMDDhhmmss Z
  // Return ISO string
  if (!timeStr) return '';
  const y = timeStr.substring(0, 4);
  const m = timeStr.substring(4, 6);
  const d = timeStr.substring(6, 8);
  const h = timeStr.substring(8, 10);
  const min = timeStr.substring(10, 12);
  const s = timeStr.substring(12, 14);
  return `${y}-${m}-${d}T${h}:${min}:${s}`;
};

export const getCurrentProgram = (programs: EPGProgram[]): EPGProgram | null => {
    const now = new Date();
    return programs.find(p => {
        const start = new Date(p.start); // Note: Simple parse, timezone handling is complex in XMLTV
        const stop = new Date(p.stop);
        return now >= start && now <= stop;
    }) || null;
};
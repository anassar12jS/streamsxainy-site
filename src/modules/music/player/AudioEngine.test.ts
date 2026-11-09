import test from 'node:test';
import assert from 'node:assert/strict';

// AudioEngine start-up tests against a fake YouTube iframe player.
// Browser globals are stubbed BEFORE the engine (and shaka-player) is imported.
const g: any = globalThis;
g.window = g; g.self = g;
g.location = { origin: 'http://localhost' };
const el = () => ({ style: {}, appendChild() {}, setAttribute() {}, addEventListener() {}, removeEventListener() {} });
g.document = { getElementById: () => null, createElement: el, head: { appendChild() {} }, body: { appendChild() {} } };
Object.defineProperty(g, 'navigator', { value: { userAgent: 'node-test', platform: 'test', vendor: '', userAgentData: undefined, languages: ['en'], language: 'en' }, configurable: true });
g.AudioContext = undefined; g.requestAnimationFrame = () => 0; g.cancelAnimationFrame = () => {};

let fakeEvents: any = null;
const calls: string[] = [];
g.YT = { Player: class { constructor(_id: string, opts: any) { fakeEvents = opts.events; setTimeout(() => fakeEvents.onReady(), 5); }
  loadVideoById(o: any) { calls.push('load:' + o.videoId + ':' + o.suggestedQuality); }
  playVideo() { calls.push('play'); } pauseVideo() {} setVolume() {} mute() {} unMute() {} setPlaybackQuality() {}
  getCurrentTime() { return 0; } getDuration() { return 100; } seekTo() {} destroy() {} } };

const audio: any = { crossOrigin: '', pause() {}, removeAttribute() {}, load() {}, volume: 1, muted: false, play: async () => {}, addEventListener() {}, removeEventListener() {}, currentTime: 0 };


const tick = (ms: number) => new Promise(r => setTimeout(r, ms));

test('YouTube start-up reports what YouTube actually did', async () => {
  const { MusicAudioEngine } = await import('./AudioEngine');
  const statuses: string[] = [];
  const errors: any[] = [];
  const engine = new MusicAudioEngine(audio, { onStatusChange: s => statuses.push(s), onYouTubeError: c => errors.push(c) });

  // Player not ready yet: video must still be loaded exactly once, never claimed as playing early
  const p1 = engine.playYouTube('abc');
  await tick(40);
  assert.equal(calls.filter(c => c.startsWith('load:')).length, 1, 'no duplicate load after ready');
  assert.equal(calls[0], 'load:abc:tiny', 'low-quality hint for a faster start');
  let settled = false;
  p1.then(() => { settled = true; });
  await tick(10);
  assert.equal(settled, false, 'must not claim playing before YouTube confirms');
  fakeEvents.onStateChange({ data: 1 });
  assert.equal(await p1, 'playing');
  assert.ok(statuses.includes('playing'));

  // Embedding refused (150) -> 'error' so the app can try another upload
  const p2 = engine.playYouTube('no-embed');
  await tick(10);
  fakeEvents.onError({ data: 150 });
  assert.equal(await p2, 'error');
  assert.equal(errors[0], 150);

  // Rapid switching: the older request is superseded, the newest wins
  const p3 = engine.playYouTube('first');
  await tick(10);
  const p4 = engine.playYouTube('second');
  assert.equal(await p3, 'superseded');
  fakeEvents.onStateChange({ data: 1 });
  assert.equal(await p4, 'playing');

  // Autoplay blocked: never starts -> 'blocked' (UI shows a play button), after one nudge
  assert.equal(await engine.playYouTube('stuck'), 'blocked');
  assert.ok(calls.includes('play'), 'nudged once before giving up');
  engine.destroy();
});

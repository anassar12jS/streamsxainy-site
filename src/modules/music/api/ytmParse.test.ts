import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePanelVideo, parseSong, parseAlbumHeader, parseAlbumCard, parseShelf, parsePlaylistCard, thumbOf, hiRes } from './ytmParse';

// Fixtures are shaped like the youtubei.js 18.x classes (field names from its .d.ts files).
const T = (text: string, endpoint?: any, runs?: any[]) => ({ text, endpoint, runs });
const UC = (id: string) => ({ payload: { browseId: id } });

test('album page with MusicResponsiveHeader (no author/year fields) still yields artist, id, year, art', () => {
  const h = parseAlbumHeader({
    title: T('Soldier of Love'),
    subtitle: T('Album • 2010'),
    strapline_text_one: T('Sade', UC('UCsadeREAL')),
    second_subtitle: T('10 songs • 46 minutes'),
    thumbnail: { contents: [
      { url: 'https://lh3.googleusercontent.com/x=w60-h60-l90-rj', width: 60 },
      { url: 'https://lh3.googleusercontent.com/x=w544-h544-l90-rj', width: 544 },
    ] },
  });
  assert.equal(h.artist, 'Sade');
  assert.equal(h.artistId, 'UCsadeREAL');
  assert.equal(h.year, '2010');
  assert.equal(h.artwork, 'https://lh3.googleusercontent.com/x=w1200-h1200-l90-rj');
});

test('album page with legacy MusicDetailHeader', () => {
  const h = parseAlbumHeader({
    title: T('Love Deluxe'), year: '1992',
    author: { name: 'Sade', channel_id: 'UCsade2' },
    thumbnails: [{ url: 'https://lh3.googleusercontent.com/y=w226-h226', width: 226 }],
  });
  assert.deepEqual([h.artist, h.artistId, h.year], ['Sade', 'UCsade2', '1992']);
});

test('album track rows inherit album artist/ids so artist links work', () => {
  const t = parseSong(
    { item_type: 'song', id: 'vid1', title: 'The Moon and the Sky', duration: { seconds: 268 } },
    { album: 'Soldier of Love', albumId: 'MPREb_x', artist: 'Sade', artistId: 'UCsadeREAL' }
  )!;
  assert.deepEqual([t.artist, t.artistId, t.albumId, t.duration, t.id], ['Sade', 'UCsadeREAL', 'MPREb_x', 268, 'vid1']);
});

test('artists are read from channel_id, not id', () => {
  const t = parseSong({
    item_type: 'song', id: 'v2', title: 'Song',
    artists: [{ name: 'Wisp', channel_id: 'UCwisp' }, { name: 'X', channel_id: 'UCx' }],
    album: { id: 'MPREb_a', name: 'Pandora' }, duration: { seconds: 200 },
  })!;
  assert.deepEqual([t.artist, t.artistId, t.album, t.albumId], ['Wisp, X', 'UCwisp', 'Pandora', 'MPREb_a']);
});

test('non-track rows are rejected and nothing is invented', () => {
  assert.equal(parseSong({ item_type: 'album', id: 'MPRE', title: 'A' }), null);
  assert.equal(parseSong({ item_type: 'song', title: 'A' }), null);
  assert.equal(parseSong({ item_type: 'song', id: 'v', title: 'A' })!.duration, 0);
});

test('album card falls back to subtitle runs for the artist', () => {
  const c = parseAlbumCard({
    id: 'MPREb_z', item_type: 'album', title: T('Pandora'),
    subtitle: T('Single • Wisp • 2024', undefined, [
      { text: 'Single' }, { text: ' • ' }, { text: 'Wisp', endpoint: UC('UCwisp') }, { text: ' • ' }, { text: '2024' },
    ]),
    thumbnail: [{ url: 'https://lh3.googleusercontent.com/z=w226-h226-l90-rj', width: 226 }],
  })!;
  assert.deepEqual([c.artist, c.artistId, c.year, c.genre], ['Wisp', 'UCwisp', '2024', 'Single']);
  assert.equal(c.artwork, 'https://lh3.googleusercontent.com/z=w600-h600-l90-rj');
});

test('playlist card: strips VL prefix, parses track count', () => {
  const p = parsePlaylistCard({
    id: 'VLPLabc', item_type: 'playlist', title: T('Life'),
    subtitle: T('Playlist • M3rcyCr45h! • 57 tracks'), thumbnail: [],
  })!;
  assert.deepEqual([p.id, p.subtitle, p.trackCount], ['PLabc', 'M3rcyCr45h! • 57 tracks', 57]);
});

test('home shelf keeps openable items and drops nav buttons / empty shelves', () => {
  const shelf = parseShelf({
    header: { title: T('Mixed for you') },
    contents: [
      { item_type: 'playlist', id: 'RDCLAKx', title: T('My Mix 1'), subtitle: T('YouTube Music'), thumbnail: [] },
      { item_type: 'album', id: 'MPREb_1', title: T('A'), subtitle: T('Album • B • 2020') },
      { item_type: 'endpoint', id: 'nav', title: T('Charts') },
    ],
  }, 'home-0-0')!;
  assert.deepEqual(shelf.items.map(i => i.kind), ['playlist', 'album']);
  assert.equal(parseShelf({ header: { title: T('X') }, contents: [{ item_type: 'endpoint' }] }, 'x'), null);
});

test('image helpers', () => {
  assert.equal(hiRes('https://i.ytimg.com/vi/a/sddefault.jpg?sqp=1'), 'https://i.ytimg.com/vi/a/sddefault.jpg?sqp=1');
  assert.equal(thumbOf([{ url: 'a', width: 10 }, { url: 'b', width: 99 }]), 'b');
});

test('up-next rows: direct and wrapped (primary) both parse, with artist ids', () => {
  const row = {
    video_id: 'vidA', title: T('Cherry Wine'), author: 'Hozier',
    artists: [{ name: 'Hozier', channel_id: 'UChozier' }],
    album: { id: 'MPREb_h', name: 'Hozier' }, duration: { seconds: 238 },
    thumbnail: [{ url: 'https://lh3.googleusercontent.com/h=w60-h60', width: 60 }, { url: 'https://lh3.googleusercontent.com/h=w226-h226', width: 226 }],
  };
  const direct = parsePanelVideo(row)!;
  assert.deepEqual([direct.id, direct.artist, direct.artistId, direct.albumId, direct.duration], ['vidA', 'Hozier', 'UChozier', 'MPREb_h', 238]);
  assert.equal(direct.youtubeId, 'vidA');
  const wrapped = parsePanelVideo({ primary: row })!;
  assert.equal(wrapped.id, 'vidA');
  assert.equal(parsePanelVideo({ nothing: true }), null); // e.g. AutomixPreviewVideo
});

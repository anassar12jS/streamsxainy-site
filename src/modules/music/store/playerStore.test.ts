import test from 'node:test';
import assert from 'node:assert/strict';
import { useMusicPlayerStore } from './useMusicPlayerStore';
import { MusicTrack } from '../types';

const mockTrackA: MusicTrack = {
  id: 'test-1',
  title: 'Track A',
  artist: 'Artist One',
  album: 'Album One',
  artwork: 'https://example.com/a.jpg',
  duration: 200,
  youtubeId: 'yt-1',
};

const mockTrackB: MusicTrack = {
  id: 'test-2',
  title: 'Track B',
  artist: 'Artist Two',
  album: 'Album Two',
  artwork: 'https://example.com/b.jpg',
  duration: 180,
  youtubeId: 'yt-2',
};

test('MusicPlayerStore: initial state and playTrack updates', () => {
  const store = useMusicPlayerStore.getState();
  assert.equal(store.playbackStatus, 'idle');

  // Play track A
  store.playTrack(mockTrackA, [mockTrackA, mockTrackB]);
  const updatedState = useMusicPlayerStore.getState();

  assert.equal(updatedState.currentTrack?.id, 'test-1');
  assert.equal(updatedState.playbackStatus, 'loading');
  assert.equal(updatedState.queue.length, 2);
  assert.equal(updatedState.queueIndex, 0);
  assert.ok(updatedState.trackPlayNonce > 0);
});

test('MusicPlayerStore: addToQueue with playNext flag', () => {
  const mockTrackC: MusicTrack = {
    id: 'test-3',
    title: 'Track C',
    artist: 'Artist Three',
    album: 'Album Three',
    artwork: 'https://example.com/c.jpg',
    duration: 210,
  };

  const store = useMusicPlayerStore.getState();
  store.addToQueue(mockTrackC, true);

  const updatedState = useMusicPlayerStore.getState();
  // Since index was 0, mockTrackC should be inserted at index 1
  assert.equal(updatedState.queue[1].id, 'test-3');
});

test('MusicPlayerStore: repeat and shuffle cycle state transitions', () => {
  const store = useMusicPlayerStore.getState();
  
  // Cycle repeat: off -> all -> one -> off
  store.cycleRepeat();
  assert.equal(useMusicPlayerStore.getState().repeatMode, 'all');
  store.cycleRepeat();
  assert.equal(useMusicPlayerStore.getState().repeatMode, 'one');
  store.cycleRepeat();
  assert.equal(useMusicPlayerStore.getState().repeatMode, 'off');

  // Toggle shuffle
  assert.equal(useMusicPlayerStore.getState().shuffle, false);
  store.toggleShuffle();
  assert.equal(useMusicPlayerStore.getState().shuffle, true);
  store.toggleShuffle();
  assert.equal(useMusicPlayerStore.getState().shuffle, false);
});

test('MusicPlayerStore: toggleLike persists and checks like status', () => {
  const store = useMusicPlayerStore.getState();
  assert.equal(store.isLiked('test-1'), false);

  store.toggleLike('test-1');
  assert.equal(useMusicPlayerStore.getState().isLiked('test-1'), true);

  store.toggleLike('test-1');
  assert.equal(useMusicPlayerStore.getState().isLiked('test-1'), false);
});

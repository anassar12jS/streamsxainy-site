import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFootballLogoIndex,
  buildFootballLogoUrl,
  isNonFootballSport,
  matchFootballLogoEntry,
  normalizeLogoText,
  stripClubAffixes,
  type FootballLogoEntry,
} from './footballLogos';

const SAMPLE_ENTRIES: FootballLogoEntry[] = [
  {
    id: 'arsenal',
    name: 'Arsenal',
    categoryId: 'england',
    alt: ['Arsenal FC'],
    h: 'dea9477e',
    hasPng: true,
    variantCount: 4,
  },
  {
    id: 'tottenham',
    name: 'Tottenham',
    categoryId: 'england',
    alt: ['Tottenham Hotspur', 'Spurs'],
    h: '11223344',
    hasPng: true,
    variantCount: 3,
  },
  {
    id: 'manchester-united',
    name: 'Manchester United',
    categoryId: 'england',
    alt: ['Man United', 'Man Utd'],
    h: 'abcdef12',
    hasPng: true,
    variantCount: 5,
  },
  {
    id: 'barcelona',
    name: 'Barcelona',
    categoryId: 'spain',
    alt: ['FC Barcelona', 'Barca'],
    h: 'aa11bb22',
    hasPng: true,
    variantCount: 6,
  },
  {
    id: 'barcelona-sc',
    name: 'Barcelona SC',
    categoryId: 'ecuador',
    alt: ['Barcelona'],
    h: 'cc33dd44',
    hasPng: true,
    variantCount: 1,
  },
  {
    id: 'liverpool',
    name: 'Liverpool',
    categoryId: 'england',
    alt: ['Liverpool FC'],
    h: 'ee55ff66',
    hasPng: true,
    variantCount: 5,
  },
  {
    id: 'liverpool-fc-montevideo',
    name: 'Liverpool FC',
    categoryId: 'uruguay',
    alt: ['Liverpool'],
    h: '99887766',
    hasPng: true,
    variantCount: 1,
  },
  {
    id: 'atletico-madrid',
    name: 'Atlético Madrid',
    categoryId: 'spain',
    alt: ['Atlético de Madrid'],
    h: '12345678',
    hasPng: true,
    variantCount: 4,
  },
  {
    id: 'psg',
    name: 'PSG',
    categoryId: 'france',
    alt: ['Paris Saint-Germain'],
    h: '87654321',
    hasPng: true,
    variantCount: 4,
  },
  {
    id: 'raja-casablanca',
    name: 'Raja Casablanca',
    categoryId: 'morocco',
    alt: ['Raja CA', 'Raja Club Athletic'],
    h: 'a1b2c3d4',
    hasPng: true,
    variantCount: 2,
  },
  {
    id: 'wydad-ac',
    name: 'Wydad AC',
    categoryId: 'morocco',
    alt: ['Wydad Athletic Club', 'Wydad Casablanca'],
    h: 'b2c3d4e5',
    hasPng: true,
    variantCount: 2,
  },
  {
    id: 'morocco-national-team',
    name: 'Morocco National Team',
    categoryId: 'morocco',
    alt: ['Morocco', 'Atlas Lions'],
    h: 'f1e2d3c4',
    hasPng: true,
    variantCount: 3,
  },
  {
    id: 'la-liga',
    name: 'La Liga',
    categoryId: 'spain',
    alt: ['La Liga EA Sports', 'Primera División'],
    h: '33445566',
    hasPng: true,
    variantCount: 3,
  },
  {
    id: 'ligue-1',
    name: 'Ligue 1',
    categoryId: 'france',
    alt: ['French Ligue 1'],
    h: '44556677',
    hasPng: true,
    variantCount: 3,
  },
  {
    id: 'ligue-1-algeria',
    name: 'Ligue 1',
    categoryId: 'algeria',
    alt: ['Algerian Ligue 1'],
    h: '55667788',
    hasPng: true,
    variantCount: 1,
  },
  {
    id: 'uefa-champions-league',
    name: 'UEFA Champions League',
    categoryId: 'tournaments',
    alt: ['Champions League', 'UCL'],
    h: '66778899',
    hasPng: true,
    variantCount: 4,
  },
  {
    id: 'uefa--union-of-european-football-associations',
    name: 'UEFA',
    categoryId: 'tournaments',
    alt: [],
    h: '77889900',
    hasPng: true,
    variantCount: 1,
  },
];

const index = buildFootballLogoIndex(SAMPLE_ENTRIES);

test('buildFootballLogoUrl formats club, league, and confederation CDN URLs accurately', () => {
  assert.equal(
    buildFootballLogoUrl({ id: 'arsenal', categoryId: 'england', h: 'dea9477e' }),
    'https://assets.football-logos.cc/logos/england/64x64/arsenal.dea9477e.png'
  );
  assert.equal(
    buildFootballLogoUrl({ id: 'uefa-champions-league', categoryId: 'tournaments', h: '66778899' }),
    'https://assets.football-logos.cc/logos/tournaments/64x64/uefa-champions-league.66778899.png'
  );
  assert.equal(
    buildFootballLogoUrl({
      id: 'uefa--union-of-european-football-associations',
      categoryId: 'tournaments',
      h: '77889900',
    }),
    'https://assets.football-logos.cc/logos/64x64/uefa--union-of-european-football-associations.77889900.png'
  );
});

test('normalizeLogoText and stripClubAffixes handle accents and affixes cleanly', () => {
  assert.equal(normalizeLogoText('Atlético de Madrid'), 'atletico de madrid');
  assert.equal(stripClubAffixes('FC Barcelona'), 'barcelona');
  assert.equal(stripClubAffixes('RCD Espanyol 1900'), 'espanyol');
});

test('matchFootballLogoEntry resolves clubs, colloquial aliases, and Moroccan teams', () => {
  assert.equal(matchFootballLogoEntry('Spurs', index)?.id, 'tottenham');
  assert.equal(matchFootballLogoEntry('Man Utd', index)?.id, 'manchester-united');
  assert.equal(matchFootballLogoEntry('Atleti', index)?.id, 'atletico-madrid');
  assert.equal(matchFootballLogoEntry('Paris Saint-Germain', index)?.id, 'psg');
  assert.equal(matchFootballLogoEntry('Raja CA', index)?.id, 'raja-casablanca');
  assert.equal(matchFootballLogoEntry('Wydad Athletic Club', index)?.id, 'wydad-ac');
});

test('matchFootballLogoEntry disambiguates same-name clubs and leagues by popularity & competition', () => {
  assert.equal(matchFootballLogoEntry('Barcelona', index)?.categoryId, 'spain');
  assert.equal(
    matchFootballLogoEntry('Barcelona', index, { competition: 'Ecuador LigaPro' })?.id,
    'barcelona'
  );
  assert.equal(matchFootballLogoEntry('Liverpool', index)?.categoryId, 'england');
  assert.equal(matchFootballLogoEntry('Ligue 1', index, { kind: 'league' })?.categoryId, 'france');
});

test('matchFootballLogoEntry resolves competitions and national teams', () => {
  assert.equal(matchFootballLogoEntry('La Liga EA Sports', index, { kind: 'league' })?.id, 'la-liga');
  assert.equal(matchFootballLogoEntry('UCL', index, { kind: 'league' })?.id, 'uefa-champions-league');
  assert.equal(
    matchFootballLogoEntry('Morocco', index, { competition: 'FIFA World Cup Qualifiers' })?.id,
    'morocco-national-team'
  );
});

test('isNonFootballSport excludes NBA/NFL/NHL/MLB/UFC/F1/Tennis from football logo matching', () => {
  assert.equal(isNonFootballSport('basketball'), true);
  assert.equal(isNonFootballSport('NBA'), true);
  assert.equal(isNonFootballSport('american football'), true);
  assert.equal(isNonFootballSport('ice hockey'), true);
  assert.equal(isNonFootballSport('fight'), true);
  assert.equal(isNonFootballSport('football'), false);
  assert.equal(isNonFootballSport('soccer'), false);
  assert.equal(matchFootballLogoEntry('Barcelona', index, { category: 'basketball' }), undefined);
});

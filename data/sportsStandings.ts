import { getTeamLogoUrl } from './clubLogos';

export interface LeagueTeamStanding {
  pos: number;
  team: string;
  logo: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
  zone?: 'ucl' | 'uel' | 'conf' | 'relegation' | 'playoff';
}

export interface LeagueTable {
  id: string;
  name: string;
  shortName: string;
  season: string;
  flag: string;
  country: string;
  category: string;
  standings: LeagueTeamStanding[];
}

export const LEAGUE_TABLES: LeagueTable[] = [
  {
    "id": "laliga",
    "name": "La Liga EA Sports",
    "shortName": "La Liga",
    "season": "2026/2027",
    "flag": "🇪🇸",
    "country": "Spain",
    "category": "football",
    "standings": [
      {
        "pos": 1,
        "team": "Barcelona",
        "logo": "https://worldcup26.ir/media/clubs/545419bb2f40a648c6467e8a10bd01a2cd724758e9059360a1b4193050a135d3.png",
        "played": 7,
        "won": 7,
        "drawn": 0,
        "lost": 0,
        "gf": 31,
        "ga": 7,
        "gd": 24,
        "points": 21,
        "form": [
          "W",
          "W",
          "W",
          "W",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 2,
        "team": "Atlético Madrid",
        "logo": "https://worldcup26.ir/media/clubs/0a19237e80a62e7502552359857068adc23019e4e740bf95b269b07be1a9146a.png",
        "played": 7,
        "won": 5,
        "drawn": 1,
        "lost": 1,
        "gf": 16,
        "ga": 7,
        "gd": 9,
        "points": 16,
        "form": [
          "W",
          "D",
          "W",
          "W",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 3,
        "team": "Real Betis",
        "logo": "https://worldcup26.ir/media/clubs/73eea6fd581d8839c4231a1dbc9f7f9fd59226918bdca95b73a244e8da32af9d.png",
        "played": 7,
        "won": 5,
        "drawn": 1,
        "lost": 1,
        "gf": 9,
        "ga": 7,
        "gd": 2,
        "points": 16,
        "form": [
          "W",
          "W",
          "D",
          "W",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 4,
        "team": "Real Madrid",
        "logo": "https://worldcup26.ir/media/clubs/6b0b9bab7a0770372ab75cf214ab89627b15a696c69dc9c1ca51d9b52d1518d0.png",
        "played": 7,
        "won": 5,
        "drawn": 0,
        "lost": 2,
        "gf": 18,
        "ga": 8,
        "gd": 10,
        "points": 15,
        "form": [
          "W",
          "W",
          "W",
          "L",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 5,
        "team": "Sevilla",
        "logo": "https://worldcup26.ir/media/clubs/1d934d1239fc65c4eaef667ef464374d77b894c264664151af903ab592c28937.png",
        "played": 7,
        "won": 4,
        "drawn": 1,
        "lost": 2,
        "gf": 10,
        "ga": 9,
        "gd": 1,
        "points": 13,
        "form": [
          "W",
          "L",
          "W",
          "D",
          "W"
        ],
        "zone": "uel"
      },
      {
        "pos": 6,
        "team": "Villarreal",
        "logo": "https://worldcup26.ir/media/clubs/9611443b459252444281ed6651874dfe4a6ea6b8f39c6b7e050fce457e143a3f.png",
        "played": 7,
        "won": 4,
        "drawn": 1,
        "lost": 2,
        "gf": 14,
        "ga": 11,
        "gd": 3,
        "points": 13,
        "form": [
          "L",
          "W",
          "W",
          "W",
          "L"
        ],
        "zone": "conf"
      },
      {
        "pos": 7,
        "team": "Athletic Club Bilbao",
        "logo": "https://worldcup26.ir/media/clubs/df9093c7751c2e8a8e828819d06b37bbacc00e10902c7ff2e2750728ebcbea89.png",
        "played": 7,
        "won": 4,
        "drawn": 0,
        "lost": 3,
        "gf": 12,
        "ga": 8,
        "gd": 4,
        "points": 12,
        "form": [
          "W",
          "W",
          "L",
          "W",
          "L"
        ]
      },
      {
        "pos": 8,
        "team": "Girona",
        "logo": "https://worldcup26.ir/media/clubs/7f8fbf02a45a3be20e3687c4a1622329ebc4533da80ad4593bb29e0618037a54.png",
        "played": 7,
        "won": 3,
        "drawn": 2,
        "lost": 2,
        "gf": 11,
        "ga": 9,
        "gd": 2,
        "points": 11,
        "form": [
          "D",
          "L",
          "W",
          "W",
          "D"
        ]
      },
      {
        "pos": 9,
        "team": "Real Sociedad",
        "logo": "https://worldcup26.ir/media/clubs/dc3fc34977e456d90c6a58dbfa880b82f34c0798509c806f73bdfd85ac956a64.png",
        "played": 7,
        "won": 3,
        "drawn": 1,
        "lost": 3,
        "gf": 8,
        "ga": 7,
        "gd": 1,
        "points": 10,
        "form": [
          "L",
          "D",
          "W",
          "L",
          "W"
        ]
      },
      {
        "pos": 10,
        "team": "Celta de Vigo",
        "logo": "https://worldcup26.ir/media/clubs/0d5ee633d9f7e09d92aa827143ed1cf6a45ec9dd2a1ccfb5bfeccb55f5045a8c.png",
        "played": 7,
        "won": 3,
        "drawn": 0,
        "lost": 4,
        "gf": 11,
        "ga": 13,
        "gd": -2,
        "points": 9,
        "form": [
          "L",
          "W",
          "L",
          "W",
          "L"
        ]
      },
      {
        "pos": 11,
        "team": "Rayo Vallecano",
        "logo": "https://worldcup26.ir/media/clubs/6a6f4d839097f9cf72c77931270a9eb310838f5a59e0109aa658912b63e90676.png",
        "played": 7,
        "won": 2,
        "drawn": 3,
        "lost": 2,
        "gf": 9,
        "ga": 9,
        "gd": 0,
        "points": 9,
        "form": [
          "D",
          "D",
          "L",
          "W",
          "D"
        ]
      },
      {
        "pos": 12,
        "team": "Osasuna",
        "logo": "https://worldcup26.ir/media/clubs/a68df398708085e0c1d573402f7d03a9ee714086b32477ef10ac2a660af8d693.png",
        "played": 7,
        "won": 2,
        "drawn": 2,
        "lost": 3,
        "gf": 8,
        "ga": 11,
        "gd": -3,
        "points": 8,
        "form": [
          "W",
          "L",
          "W",
          "D",
          "L"
        ]
      },
      {
        "pos": 13,
        "team": "Mallorca",
        "logo": "https://worldcup26.ir/media/clubs/178d2bdf78508491c1b181a1795fa72186ee97960fa0a24911765ad8452ef327.png",
        "played": 7,
        "won": 2,
        "drawn": 2,
        "lost": 3,
        "gf": 6,
        "ga": 9,
        "gd": -3,
        "points": 8,
        "form": [
          "W",
          "W",
          "L",
          "D",
          "L"
        ]
      },
      {
        "pos": 14,
        "team": "Alavés",
        "logo": "https://worldcup26.ir/media/clubs/971ec444c9afdb30d13fd61c8ac8bd9cc069e945ae904384ed08c777876a5d1b.png",
        "played": 7,
        "won": 2,
        "drawn": 1,
        "lost": 4,
        "gf": 7,
        "ga": 11,
        "gd": -4,
        "points": 7,
        "form": [
          "L",
          "L",
          "W",
          "L",
          "W"
        ]
      },
      {
        "pos": 15,
        "team": "Espanyol",
        "logo": "https://worldcup26.ir/media/clubs/e8e3d4a33a3a846e8cc09e456ff26a8f8a6d507bd1ff874656cb72032ace855a.png",
        "played": 7,
        "won": 2,
        "drawn": 1,
        "lost": 4,
        "gf": 6,
        "ga": 11,
        "gd": -5,
        "points": 7,
        "form": [
          "L",
          "L",
          "W",
          "L",
          "W"
        ]
      },
      {
        "pos": 16,
        "team": "Valencia",
        "logo": "https://worldcup26.ir/media/clubs/cbea42e967d85654d6d121d15ae3cda160010d105c04ee2ecd455686144e3ff7.png",
        "played": 7,
        "won": 1,
        "drawn": 3,
        "lost": 3,
        "gf": 6,
        "ga": 11,
        "gd": -5,
        "points": 6,
        "form": [
          "D",
          "L",
          "W",
          "D",
          "L"
        ]
      },
      {
        "pos": 17,
        "team": "Getafe",
        "logo": "https://worldcup26.ir/media/clubs/e7055ae7e4881a84e85149273676e62de7c2612592e8bea455e6495e2aa445c3.png",
        "played": 7,
        "won": 1,
        "drawn": 3,
        "lost": 3,
        "gf": 5,
        "ga": 9,
        "gd": -4,
        "points": 6,
        "form": [
          "D",
          "L",
          "D",
          "L",
          "W"
        ]
      },
      {
        "pos": 18,
        "team": "Leganés",
        "logo": "https://worldcup26.ir/media/clubs/d92eeefb24a353d4c82c2b740523fc6c7f8f94d306b3a3250b73c2a939e6a0d4.png",
        "played": 7,
        "won": 1,
        "drawn": 2,
        "lost": 4,
        "gf": 4,
        "ga": 10,
        "gd": -6,
        "points": 5,
        "form": [
          "L",
          "L",
          "D",
          "L",
          "L"
        ],
        "zone": "relegation"
      },
      {
        "pos": 19,
        "team": "Real Valladolid",
        "logo": "https://worldcup26.ir/media/clubs/2be61f67f25964893796f64c67b93e2a05cf4b5f8f8b65da9f387a2a4bdfd924.png",
        "played": 7,
        "won": 1,
        "drawn": 2,
        "lost": 4,
        "gf": 5,
        "ga": 14,
        "gd": -9,
        "points": 5,
        "form": [
          "L",
          "D",
          "L",
          "L",
          "D"
        ],
        "zone": "relegation"
      },
      {
        "pos": 20,
        "team": "Las Palmas",
        "logo": "https://worldcup26.ir/media/clubs/efc94e819b222d4c0b6dfda14a600a7479769dae13b86022e39ea658df8a7356.png",
        "played": 7,
        "won": 0,
        "drawn": 3,
        "lost": 4,
        "gf": 5,
        "ga": 13,
        "gd": -8,
        "points": 3,
        "form": [
          "L",
          "D",
          "L",
          "D",
          "L"
        ],
        "zone": "relegation"
      }
    ]
  },
  {
    "id": "pl",
    "name": "Premier League",
    "shortName": "Premier League",
    "season": "2026/2027",
    "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    "country": "England",
    "category": "football",
    "standings": [
      {
        "pos": 1,
        "team": "Manchester City",
        "logo": "https://worldcup26.ir/media/clubs/3e9f9da7593e8aa99216a4bc14803a632508cb323d3b7d010d2d7e72bdcf876d.png",
        "played": 6,
        "won": 5,
        "drawn": 0,
        "lost": 1,
        "gf": 14,
        "ga": 5,
        "gd": 9,
        "points": 15,
        "form": [
          "W",
          "W",
          "W",
          "L",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 2,
        "team": "Liverpool",
        "logo": "https://worldcup26.ir/media/clubs/500f02856e36a79ab0127ef0d1eeb269a34a33f2b01d9624808e2782b50b3b91.png",
        "played": 6,
        "won": 5,
        "drawn": 0,
        "lost": 1,
        "gf": 13,
        "ga": 4,
        "gd": 9,
        "points": 15,
        "form": [
          "W",
          "W",
          "L",
          "W",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 3,
        "team": "Arsenal",
        "logo": "https://worldcup26.ir/media/clubs/9ccb335946107299818e6e2c39c970c5941e70ba7c861595129b49086e82db79.png",
        "played": 6,
        "won": 4,
        "drawn": 2,
        "lost": 0,
        "gf": 12,
        "ga": 4,
        "gd": 8,
        "points": 14,
        "form": [
          "W",
          "D",
          "W",
          "D",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 4,
        "team": "Chelsea",
        "logo": "https://worldcup26.ir/media/clubs/eaabb3995384efc089bf9bd4489168c3aedbd7c2c23479ccec0d4591d0392bb3.png",
        "played": 6,
        "won": 4,
        "drawn": 1,
        "lost": 1,
        "gf": 15,
        "ga": 7,
        "gd": 8,
        "points": 13,
        "form": [
          "W",
          "D",
          "W",
          "W",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 5,
        "team": "Aston Villa",
        "logo": "https://worldcup26.ir/media/clubs/c275d579f1b7a4d5ce0b892886ae336c5b726ef78aefa812ecaece0a03a4b495.png",
        "played": 6,
        "won": 4,
        "drawn": 1,
        "lost": 1,
        "gf": 12,
        "ga": 8,
        "gd": 4,
        "points": 13,
        "form": [
          "W",
          "W",
          "W",
          "D",
          "W"
        ],
        "zone": "uel"
      },
      {
        "pos": 6,
        "team": "Newcastle United",
        "logo": "https://worldcup26.ir/media/clubs/062eabdac65b09d2b51edc480f26d48c83db2b309299c129d6d4ddc9a92c6725.png",
        "played": 6,
        "won": 3,
        "drawn": 2,
        "lost": 1,
        "gf": 9,
        "ga": 6,
        "gd": 3,
        "points": 11,
        "form": [
          "W",
          "W",
          "W",
          "L",
          "D"
        ],
        "zone": "conf"
      },
      {
        "pos": 7,
        "team": "Tottenham Hotspur",
        "logo": "https://worldcup26.ir/media/clubs/9732b8bccc164215e1eb77e792d670dfc7528b5d050de5838a0ea552dad170b8.png",
        "played": 6,
        "won": 3,
        "drawn": 1,
        "lost": 2,
        "gf": 12,
        "ga": 6,
        "gd": 6,
        "points": 10,
        "form": [
          "L",
          "L",
          "W",
          "W",
          "W"
        ]
      },
      {
        "pos": 8,
        "team": "Brighton",
        "logo": "https://worldcup26.ir/media/clubs/579aefa8cd8b24f6e283e5715bd28d2ac88d279f96053658e2c62b723c62e216.png",
        "played": 6,
        "won": 2,
        "drawn": 3,
        "lost": 1,
        "gf": 10,
        "ga": 8,
        "gd": 2,
        "points": 9,
        "form": [
          "D",
          "D",
          "D",
          "L",
          "W"
        ]
      },
      {
        "pos": 9,
        "team": "Fulham",
        "logo": "https://worldcup26.ir/media/clubs/dd4bf81d56f200e322d1ff8af141c848fbcaf3fec749a3fc298b056a4fba52c8.png",
        "played": 6,
        "won": 2,
        "drawn": 3,
        "lost": 1,
        "gf": 8,
        "ga": 7,
        "gd": 1,
        "points": 9,
        "form": [
          "D",
          "W",
          "D",
          "W",
          "L"
        ]
      },
      {
        "pos": 10,
        "team": "Manchester United",
        "logo": "https://worldcup26.ir/media/clubs/664d0eb3b134308f941da8e6382e20f9650d14b4c94b955d3161493c39bcf33f.png",
        "played": 6,
        "won": 2,
        "drawn": 1,
        "lost": 3,
        "gf": 7,
        "ga": 10,
        "gd": -3,
        "points": 7,
        "form": [
          "L",
          "W",
          "D",
          "L",
          "W"
        ]
      }
    ]
  },
  {
    "id": "ligue1",
    "name": "Ligue 1 McDonald’s",
    "shortName": "Ligue 1",
    "season": "2026/2027",
    "flag": "🇫🇷",
    "country": "France",
    "category": "football",
    "standings": [
      {
        "pos": 1,
        "team": "Monaco",
        "logo": "https://worldcup26.ir/media/clubs/4bc674bb9f257521abfcb36d6a6952d7e0085a6e872c819777f98c7e97424ad9.png",
        "played": 6,
        "won": 4,
        "drawn": 1,
        "lost": 1,
        "gf": 11,
        "ga": 4,
        "gd": 7,
        "points": 13,
        "form": [
          "W",
          "W",
          "D",
          "W",
          "L"
        ],
        "zone": "ucl"
      },
      {
        "pos": 2,
        "team": "Paris Saint-Germain",
        "logo": "https://worldcup26.ir/media/clubs/d82373d3e95dc1341c0a6852574133be5d491ca8cf81c641aa8d1755084edd50.png",
        "played": 6,
        "won": 4,
        "drawn": 0,
        "lost": 2,
        "gf": 14,
        "ga": 6,
        "gd": 8,
        "points": 12,
        "form": [
          "W",
          "W",
          "L",
          "W",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 3,
        "team": "Marseille",
        "logo": "https://worldcup26.ir/media/clubs/a72d4449091b31ba67771a9446b27e3ce008127a90cd80185c15f530186132f1.png",
        "played": 6,
        "won": 4,
        "drawn": 0,
        "lost": 2,
        "gf": 13,
        "ga": 8,
        "gd": 5,
        "points": 12,
        "form": [
          "W",
          "W",
          "W",
          "L",
          "L"
        ],
        "zone": "ucl"
      },
      {
        "pos": 4,
        "team": "Lille",
        "logo": "https://worldcup26.ir/media/clubs/77fce39d01c37dcfa2b7439ba4072d040bde73400a7d40f1e162e18cb386ceb5.png",
        "played": 6,
        "won": 3,
        "drawn": 1,
        "lost": 2,
        "gf": 10,
        "ga": 7,
        "gd": 3,
        "points": 10,
        "form": [
          "L",
          "L",
          "D",
          "W",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 5,
        "team": "Lens",
        "logo": "https://worldcup26.ir/media/clubs/38bf88e115acc6746b3c8c54fca6f38e49e1e75de55a12539728f11e782ac4ab.png",
        "played": 6,
        "won": 2,
        "drawn": 4,
        "lost": 0,
        "gf": 6,
        "ga": 3,
        "gd": 3,
        "points": 10,
        "form": [
          "D",
          "D",
          "D",
          "D",
          "W"
        ],
        "zone": "uel"
      },
      {
        "pos": 6,
        "team": "Lyon",
        "logo": "https://worldcup26.ir/media/clubs/edaf7abce693a7b8ec9451d99683ffb10e0f8deda9cf46a8e4508f558557ee6f.png",
        "played": 6,
        "won": 3,
        "drawn": 0,
        "lost": 3,
        "gf": 9,
        "ga": 11,
        "gd": -2,
        "points": 9,
        "form": [
          "W",
          "L",
          "L",
          "W",
          "W"
        ],
        "zone": "conf"
      }
    ]
  },
  {
    "id": "seriea",
    "name": "Serie A Enilive",
    "shortName": "Serie A",
    "season": "2026/2027",
    "flag": "🇮🇹",
    "country": "Italy",
    "category": "football",
    "standings": [
      {
        "pos": 1,
        "team": "Roma",
        "logo": "https://worldcup26.ir/media/clubs/b53b1b369f6f69919f2065e8a7194f1c9bb7cf430b56fc3992b8cf7b3fa69727.png",
        "played": 6,
        "won": 4,
        "drawn": 1,
        "lost": 1,
        "gf": 10,
        "ga": 4,
        "gd": 6,
        "points": 13,
        "form": [
          "W",
          "W",
          "W",
          "D",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 2,
        "team": "Juventus",
        "logo": "https://worldcup26.ir/media/clubs/7a75d00dacaf994e49fae1f7c6131bda20d16294f56743e9ed06201506779c58.png",
        "played": 6,
        "won": 3,
        "drawn": 3,
        "lost": 0,
        "gf": 9,
        "ga": 0,
        "gd": 9,
        "points": 12,
        "form": [
          "D",
          "D",
          "D",
          "W",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 3,
        "team": "Napoli",
        "logo": "https://worldcup26.ir/media/clubs/307cbddd83c59faac0155ae7189ed376dd2cc734c3518a5bceea162240fe64c3.png",
        "played": 6,
        "won": 3,
        "drawn": 2,
        "lost": 1,
        "gf": 11,
        "ga": 5,
        "gd": 6,
        "points": 11,
        "form": [
          "W",
          "W",
          "W",
          "D",
          "L"
        ],
        "zone": "ucl"
      },
      {
        "pos": 4,
        "team": "Internazionale",
        "logo": "https://worldcup26.ir/media/clubs/c6097bc86cf9eced8e3dea735f8698d4a7191e6e5aaf38d5d39ac7ee69c1977a.png",
        "played": 6,
        "won": 3,
        "drawn": 2,
        "lost": 1,
        "gf": 13,
        "ga": 7,
        "gd": 6,
        "points": 11,
        "form": [
          "D",
          "W",
          "L",
          "W",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 5,
        "team": "AC Milan",
        "logo": "https://worldcup26.ir/media/clubs/ec4cdaccef7f46329f47a1aa4dc8019eecdbe6b660b977767e385ebb0a15426d.png",
        "played": 6,
        "won": 3,
        "drawn": 2,
        "lost": 1,
        "gf": 14,
        "ga": 7,
        "gd": 7,
        "points": 11,
        "form": [
          "D",
          "W",
          "W",
          "W",
          "W"
        ],
        "zone": "uel"
      },
      {
        "pos": 6,
        "team": "Lazio",
        "logo": "https://worldcup26.ir/media/clubs/5a70142586fbc4da88b74a1a574b102c3a9cd055f99111feb03e5db1dbc45457.png",
        "played": 6,
        "won": 3,
        "drawn": 1,
        "lost": 2,
        "gf": 12,
        "ga": 10,
        "gd": 2,
        "points": 10,
        "form": [
          "D",
          "W",
          "L",
          "W",
          "W"
        ],
        "zone": "conf"
      }
    ]
  },
  {
    "id": "ucl",
    "name": "UEFA Champions League",
    "shortName": "UCL League Phase",
    "season": "2026/2027",
    "flag": "🇪🇺",
    "country": "Europe",
    "category": "football",
    "standings": [
      {
        "pos": 1,
        "team": "Real Madrid",
        "logo": "https://worldcup26.ir/media/clubs/6b0b9bab7a0770372ab75cf214ab89627b15a696c69dc9c1ca51d9b52d1518d0.png",
        "played": 2,
        "won": 2,
        "drawn": 0,
        "lost": 0,
        "gf": 6,
        "ga": 1,
        "gd": 5,
        "points": 6,
        "form": [
          "W",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 2,
        "team": "Barcelona",
        "logo": "https://worldcup26.ir/media/clubs/545419bb2f40a648c6467e8a10bd01a2cd724758e9059360a1b4193050a135d3.png",
        "played": 2,
        "won": 2,
        "drawn": 0,
        "lost": 0,
        "gf": 7,
        "ga": 1,
        "gd": 6,
        "points": 6,
        "form": [
          "W",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 3,
        "team": "Manchester City",
        "logo": "https://worldcup26.ir/media/clubs/3e9f9da7593e8aa99216a4bc14803a632508cb323d3b7d010d2d7e72bdcf876d.png",
        "played": 2,
        "won": 1,
        "drawn": 1,
        "lost": 0,
        "gf": 4,
        "ga": 0,
        "gd": 4,
        "points": 4,
        "form": [
          "D",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 4,
        "team": "Liverpool",
        "logo": "https://worldcup26.ir/media/clubs/500f02856e36a79ab0127ef0d1eeb269a34a33f2b01d9624808e2782b50b3b91.png",
        "played": 2,
        "won": 2,
        "drawn": 0,
        "lost": 0,
        "gf": 5,
        "ga": 1,
        "gd": 4,
        "points": 6,
        "form": [
          "W",
          "W"
        ],
        "zone": "ucl"
      },
      {
        "pos": 5,
        "team": "Arsenal",
        "logo": "https://worldcup26.ir/media/clubs/9ccb335946107299818e6e2c39c970c5941e70ba7c861595129b49086e82db79.png",
        "played": 2,
        "won": 1,
        "drawn": 1,
        "lost": 0,
        "gf": 2,
        "ga": 0,
        "gd": 2,
        "points": 4,
        "form": [
          "D",
          "W"
        ],
        "zone": "ucl"
      }
    ]
  },
  {
    "id": "nba",
    "name": "NBA (National Basketball Association)",
    "shortName": "NBA",
    "season": "2026/2027",
    "flag": "🏀",
    "country": "USA",
    "category": "basketball",
    "standings": [
      {
        "pos": 1,
        "team": "Boston Celtics",
        "logo": "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg",
        "played": 8,
        "won": 7,
        "drawn": 0,
        "lost": 1,
        "gf": 124,
        "ga": 110,
        "gd": 14,
        "points": 14,
        "form": [
          "W",
          "W",
          "W",
          "W",
          "W"
        ],
        "zone": "playoff"
      },
      {
        "pos": 2,
        "team": "Oklahoma City Thunder",
        "logo": "https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg",
        "played": 8,
        "won": 7,
        "drawn": 0,
        "lost": 1,
        "gf": 119,
        "ga": 102,
        "gd": 17,
        "points": 14,
        "form": [
          "W",
          "W",
          "W",
          "W",
          "W"
        ],
        "zone": "playoff"
      },
      {
        "pos": 3,
        "team": "Denver Nuggets",
        "logo": "https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg",
        "played": 8,
        "won": 6,
        "drawn": 0,
        "lost": 2,
        "gf": 118,
        "ga": 112,
        "gd": 6,
        "points": 12,
        "form": [
          "W",
          "W",
          "L",
          "W",
          "W"
        ],
        "zone": "playoff"
      },
      {
        "pos": 4,
        "team": "Golden State Warriors",
        "logo": "https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg",
        "played": 8,
        "won": 6,
        "drawn": 0,
        "lost": 2,
        "gf": 120,
        "ga": 108,
        "gd": 12,
        "points": 12,
        "form": [
          "W",
          "W",
          "W",
          "L",
          "W"
        ],
        "zone": "playoff"
      },
      {
        "pos": 5,
        "team": "Los Angeles Lakers",
        "logo": "https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg",
        "played": 8,
        "won": 5,
        "drawn": 0,
        "lost": 3,
        "gf": 116,
        "ga": 115,
        "gd": 1,
        "points": 10,
        "form": [
          "W",
          "L",
          "W",
          "W",
          "L"
        ],
        "zone": "playoff"
      }
    ]
  }
];

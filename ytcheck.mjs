const urls = [
  'https://yt3.ggpht.com/lGF_DN_bSSIWgqZxoWGgyYsP_hjBmJbTyNCn-xQpe70GRwOb54W9fOGwfjlUbHHwob1heiRVlyY=s48-c-k-c0x00ffffff-no-rj',
  'https://yt3.googleusercontent.com/pv-FsW0K0SuCVyGOydic5qr7mXmycusuIB59TK7vw3OwQkyWl9VQjZqcWdP_8Gd0Lo_CWby8LLZr74Iw=w600-h600-l90-rj',
  'https://yt3.googleusercontent.com/HAv6pC3IobTkhqtPUL_N8NdUx5S6xWN9NJA2G3eqyL4EMHurn_3PBwYuEbMpHCxhL5W5X4YqiXljpY7N=w600-h600-l90-rj',
  'https://yt3.googleusercontent.com/nV6-j8xJRemJs6BC4Mk3K5Clha_SlhvyUEfluKb_xCCgHqYYDKUXfrGipM8cZHq2kZEIZWVCdIU=s600',
  'https://yt3.googleusercontent.com/qOzNCn6OSt4FUypLr-H7CuI296VJwLr-HJDZ_b20adEbS1-mF95AktioqMfSFDg6xL7FbSkB7vmPYCG2=w600-h600-s-l90-rj',
];
for (const u of urls) {
  try {
    const r = await fetch(u);
    const buf = await r.arrayBuffer();
    console.log(r.status, buf.byteLength, u.slice(8, 40));
  } catch (e) { console.log('ERR', e.message); }
}

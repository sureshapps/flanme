/*
  songs.js  -  playlist for the music player in the widget panel.

  Put this file in your project's /public folder (so it is served at /songs.js).
  Edit, add or remove songs here; no rebuild needed, just refresh the page.

  Each song:
    title  : song name shown in big letters
    artist : name shown under the title (optional)
    cover  : image URL or /public path, e.g. '/music/covers/night-drive.jpg' (optional)
    src    : audio URL or /public path, e.g. '/music/night-drive.mp3' (.mp3 .m4a .ogg .wav)

  Order = play order. The player auto-plays the first song and moves to the next when one ends.
  (Browsers only allow sound after the visitor's first tap/click/key press, so autoplay
   starts at that first interaction if the browser blocks it on load.)
*/
window.MUSIC_PLAYLIST = [
  {
    title: 'Night Drive',
    artist: 'Vaporwave Collective',
    cover: 'https://picsum.photos/seed/nightdrive/300/300',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    title: 'Neon Skyline',
    artist: 'Synth Rider',
    cover: 'https://picsum.photos/seed/neonskyline/300/300',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    title: 'Midnight Code',
    artist: 'Suresh',
    cover: 'https://picsum.photos/seed/midnightcode/300/300',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
];

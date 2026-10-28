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
   title: 'THE TRUE LEADER',
    artist: 'Anirudh',
    cover: 'https://c.ndtvimg.com/2026-07/vqm6emf_jana-nayagan_625x300_17_July_26.jpg?im=FitAndFill,algorithm=dnn,width=400,height=225&q=70',
    src: 'music/TheTrueLeader.mp3',
  },
  {
    title: 'JD MASTER',
    artist: 'Anirudh',
    cover: 'https://upload.wikimedia.org/wikipedia/en/c/c4/Master_album_cover.jpg',
    src: 'music/JDIntro.mp3',
  },
  {
   title: 'THE MAN JD',
    artist: 'Anirudh',
    cover: 'https://i.scdn.co/image/ab6761610000e5ebd8f08b897814e1bf70efccfa',
    src: 'music/JDTheAlcoholic.mp3',
  },
    {
   title: 'MASTER THE BLASTER',
    artist: 'Anirudh',
    cover: 'https://www.thestatesman.com/wp-content/uploads/2026/01/Jana-Nayagan-Thalapathy-Vijay-CFBC-Supreme-Court.webp',
    src: 'music/MasterTheBlaster.mp3',
  },
 
];


// MIT adaptation: use native HTML audio instead of obsolete Flash loading.
Game.loadSounds = function (cfg) {
  var sounds = {};
  Object.keys(cfg.sounds).forEach(function (id) { var audio = new Audio(cfg.sounds[id]); audio.preload = 'auto'; audio.volume = 0.5; sounds[id] = audio; });
  window.soundManager = { play: function (id) { var audio = sounds[id]; if (audio) { audio.currentTime = 0; audio.play().catch(function () {}); } } };
};

// GPL-2.0-or-later adaptation, 2026 Yuqing Game Hall contributors.
// Generated tones replace the original recordings; no external audio needed.
var hallAudioContext;
Board.prototype.playSound = function (name) {
  if (!this.sound) return;
  var Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  hallAudioContext = hallAudioContext || new Context();
  hallAudioContext.resume().catch(function () {});
  var osc = hallAudioContext.createOscillator(), gain = hallAudioContext.createGain();
  osc.type = 'sine'; osc.frequency.value = /check|win/.test(name) ? 660 : /capture/.test(name) ? 330 : 440;
  gain.gain.setValueAtTime(.06, hallAudioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, hallAudioContext.currentTime + .1);
  osc.connect(gain); gain.connect(hallAudioContext.destination); osc.start(); osc.stop(hallAudioContext.currentTime + .1);
};

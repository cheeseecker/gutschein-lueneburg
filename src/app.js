// YouTube erst nach Klick laden (Zwei-Klick-Lösung, DSGVO)
(function () {
  var btn = document.getElementById('yt-btn');
  if (!btn) return;
  btn.addEventListener('click', function (e) {
    if (e.target.closest('a')) return; // Link zur Datenschutzerklärung nicht abfangen
    var box = document.getElementById('yt');
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/RM2R-YoOSEc?autoplay=1&rel=0';
    f.title = 'Lüneburger Kultursommer 2026 – Video';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    box.innerHTML = '';
    box.appendChild(f);
  });
})();

// Vergangene Events ausblenden (falls seit dem letzten Build ein Tag vergangen ist)
(function () {
  var heute = new Date();
  heute.setHours(0, 0, 0, 0);
  var karten = document.querySelectorAll('.e-card[data-datum]');
  var sichtbar = 0;
  karten.forEach(function (k) {
    var d = new Date(k.getAttribute('data-datum') + 'T23:59:59');
    if (d < heute) k.remove(); else sichtbar++;
  });
  if (karten.length && !sichtbar) {
    var g = document.querySelector('.e-grid');
    if (g) g.outerHTML = '<p>Neue Termine folgen in Kürze – schau gern direkt im Ticketshop vorbei.</p>';
  }
})();

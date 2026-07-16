/* Clubtech branded landing — white-label gift-card purchase demo (.ckg). */
(function () {
  'use strict';

  var mounts = [].slice.call(document.querySelectorAll('[data-giftdemo]'));
  if (!mounts.length) return;

  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || 'js/giftcard.js';
  var BRAND_MARK = SCRIPT_SRC.replace(/js\/giftcard\.js.*$/, 'brand/clubtech-mark-white.png');

  mounts.forEach(function (root) {
    var state = { view: root.getAttribute('data-giftdemo') || 'buy', value: 250, theme: 'navy', recipient: 'Alex', sender: 'Jordan', message: 'Dinner is on me.', email: 'alex@example.com' };
    var values = [100, 250, 500];
    var themes = [
      { id: 'navy', name: 'Midnight', cls: 'is-navy' },
      { id: 'indigo', name: 'Indigo', cls: 'is-indigo' },
      { id: 'paper', name: 'Paper', cls: 'is-paper' }
    ];

    function track(name, props) {
      try { if (window.CTGTrack && window.CTGTrack.event) window.CTGTrack.event(name, props || {}); } catch (_) {}
    }
    function money(n) { return '$' + n.toLocaleString('en-US'); }
    function esc(value) { return String(value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function theme() { return themes.filter(function (item) { return item.id === state.theme; })[0]; }
    function stepClass(name) { return state.view === name ? ' is-active' : (name === 'buy' || (name === 'recipient' && state.view === 'confirm')) ? ' is-done' : ''; }

    function cardMarkup() {
      return '<div class="ckg-card ' + theme().cls + '">' +
        '<div class="ckg-card-top"><img src="' + BRAND_MARK + '" alt=""><span>Gift card</span></div>' +
        '<div class="ckg-card-value">' + money(state.value) + '</div>' +
        '<div class="ckg-card-copy"><span>For ' + esc(state.recipient || 'your guest') + '</span><b>Sunset Deck</b></div>' +
        '<div class="ckg-card-foot"><span>Redeem toward a booking or add-on</span><span>Demo</span></div>' +
      '</div>';
    }

    function headerMarkup() {
      return '<div class="ckg-top"><div class="ckg-brand"><span>Sunset Deck</span><small>Gift cards</small></div><div class="ckg-steps">' +
        '<span class="ckg-step' + stepClass('buy') + '"><b>1</b>Value</span><i></i>' +
        '<span class="ckg-step' + stepClass('recipient') + '"><b>2</b>Recipient</span><i></i>' +
        '<span class="ckg-step' + stepClass('confirm') + '"><b>3</b>Confirm</span>' +
      '</div><span class="ckg-demo-tag">Demo purchase</span></div>';
    }

    function buyMarkup() {
      return '<div class="ckg-layout"><section class="ckg-editor"><p class="ckg-kicker">Choose the value</p><h3>Give them the venue.</h3><p class="ckg-lead">Stored value, bought on the venue site and redeemed inside the booking flow.</p>' +
        '<div class="ckg-values">' + values.map(function (value) { return '<button type="button" data-value="' + value + '" class="' + (state.value === value ? 'is-selected' : '') + '">' + money(value) + '</button>'; }).join('') + '</div>' +
        '<label class="ckg-label">Card design</label><div class="ckg-themes">' + themes.map(function (item) { return '<button type="button" data-theme="' + item.id + '" class="' + item.cls + (state.theme === item.id ? ' is-selected' : '') + '"><i></i><span>' + item.name + '</span></button>'; }).join('') + '</div>' +
        '<button type="button" class="ckg-primary" data-next="recipient">Continue to recipient</button></section><aside class="ckg-preview"><span class="ckg-preview-label">Live preview</span>' + cardMarkup() + '<p>Valid for 12 months · Demo terms</p></aside></div>';
    }

    function recipientMarkup() {
      return '<div class="ckg-layout"><section class="ckg-editor"><p class="ckg-kicker">Recipient details</p><h3>Send it to the right guest.</h3><div class="ckg-form"><label><span>Recipient name</span><input data-field="recipient" value="' + esc(state.recipient) + '"></label><label><span>Recipient email</span><input data-field="email" type="email" value="' + esc(state.email) + '"></label><label><span>From</span><input data-field="sender" value="' + esc(state.sender) + '"></label><label class="is-wide"><span>Message</span><textarea data-field="message" rows="3">' + esc(state.message) + '</textarea></label></div><div class="ckg-actions"><button type="button" class="ckg-secondary" data-next="buy">Back</button><button type="button" class="ckg-primary" data-next="confirm">Review gift card</button></div></section><aside class="ckg-preview"><span class="ckg-preview-label">Live preview</span>' + cardMarkup() + '<blockquote>“' + esc(state.message) + '”<small>— ' + esc(state.sender) + '</small></blockquote></aside></div>';
    }

    function confirmMarkup() {
      return '<div class="ckg-confirm"><div class="ckg-check">✓</div><p class="ckg-kicker">Ready to purchase</p><h3>' + money(state.value) + ' for ' + esc(state.recipient) + '</h3><p>The gift card will be emailed to <strong>' + esc(state.email) + '</strong>. This demo takes no payment and sends no email.</p><div class="ckg-confirm-card">' + cardMarkup() + '</div><div class="ckg-actions"><button type="button" class="ckg-secondary" data-next="recipient">Edit details</button><button type="button" class="ckg-primary" data-finish>Complete demo purchase</button></div></div>';
    }

    function successMarkup() {
      return '<div class="ckg-success"><div class="ckg-check">✓</div><p class="ckg-kicker">Demo complete</p><h3>Gift card ready.</h3><p>No payment was taken and no email was sent. In the live flow, the recipient receives the venue-branded card and redeems it against a booking.</p><button type="button" class="ckg-primary" data-reset>Start again</button></div>';
    }

    function render() {
      root.innerHTML = headerMarkup() + '<div class="ckg-surface">' + (state.view === 'recipient' ? recipientMarkup() : state.view === 'confirm' ? confirmMarkup() : state.view === 'success' ? successMarkup() : buyMarkup()) + '</div>';
      root.querySelectorAll('[data-value]').forEach(function (button) { button.addEventListener('click', function () { state.value = +button.getAttribute('data-value'); render(); track('giftdemo_value', { value: state.value }); }); });
      root.querySelectorAll('[data-theme]').forEach(function (button) { button.addEventListener('click', function () { state.theme = button.getAttribute('data-theme'); render(); track('giftdemo_theme', { theme: state.theme }); }); });
      root.querySelectorAll('[data-field]').forEach(function (field) { field.addEventListener('input', function () { state[field.getAttribute('data-field')] = field.value; }); });
      root.querySelectorAll('[data-next]').forEach(function (button) { button.addEventListener('click', function () { state.view = button.getAttribute('data-next'); render(); track('giftdemo_view', { view: state.view }); }); });
      var finish = root.querySelector('[data-finish]');
      if (finish) finish.addEventListener('click', function () { state.view = 'success'; render(); track('giftdemo_complete', { value: state.value }); });
      var reset = root.querySelector('[data-reset]');
      if (reset) reset.addEventListener('click', function () { state.view = 'buy'; render(); track('giftdemo_restart'); });
      root.classList.toggle('ckg-narrow', root.clientWidth < 760);
      root.classList.toggle('ckg-tiny', root.clientWidth < 520);
    }

    var badge = root.getAttribute('data-giftdemo-badge');
    if (badge) {
      var host = document.createElement('div');
      host.className = 'demo-badge-host';
      root.parentNode.insertBefore(host, root);
      host.appendChild(root);
      var badgeEl = document.createElement('div');
      badgeEl.className = 'ckg-badge';
      badgeEl.innerHTML = '<i></i>' + esc(badge);
      host.appendChild(badgeEl);
    }
    render();
    if (window.ResizeObserver) new ResizeObserver(render).observe(root);
  });
})();

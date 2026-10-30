(() => {
  const banner = document.getElementById('examCountdown');
  if (!banner) return;
  const label = document.getElementById('examCountdownLabel');
  const value = document.getElementById('examCountdownDays');
  const unit = document.getElementById('examCountdownUnit');
  const [year, month, day] = banner.dataset.examDate.split('-').map(Number);
  const examDay = Date.UTC(year, month - 1, day);
  const calendar = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric'
  });
  function update() {
    const parts = Object.fromEntries(calendar.formatToParts(new Date()).map(part => [part.type, part.value]));
    const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
    const remaining = Math.round((examDay - today) / 86400000);
    label.textContent = remaining > 0 ? '距离考试还有' : remaining === 0 ? '今天考试' : '考试已结束';
    value.textContent = remaining > 0 ? String(remaining) : '';
    unit.textContent = remaining > 0 ? '天' : '';
    value.hidden = unit.hidden = remaining <= 0;
  }
  update();
  setInterval(update, 60000);
  window.addEventListener('focus', update);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
})();

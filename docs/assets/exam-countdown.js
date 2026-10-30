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
  let reminder = '';
  function addReminder(selector, placement, style = '') {
    const target = document.querySelector(selector);
    if (!target) return;
    const badge = document.createElement('span');
    badge.className = 'exam-reminder ' + style;
    badge.dataset.examReminder = '';
    badge.textContent = reminder;
    if (placement === 'after') target.after(badge);
    else if (placement === 'append') target.append(badge);
    else target.prepend(badge);
  }
  addReminder('.header-tools', 'prepend', 'exam-header-reminder');
  addReminder('#dock .dockhead', 'after', 'exam-dock-reminder');
  addReminder('#restore', 'append', 'exam-bubble-reminder');
  addReminder('.we-workspace', 'prepend', 'exam-workspace-reminder');
  addReminder('.we-library-heading', 'append');
  addReminder('#sstCard', 'prepend', 'exam-card-reminder');
  addReminder('#practiceStatsDialog .stats-heading', 'after', 'exam-stats-reminder');
  function essayReminder() {
    const article = document.getElementById('weLibraryDetail');
    if (article && !article.querySelector('[data-exam-reminder]')) {
      addReminder('#weLibraryDetail', 'prepend', 'exam-card-reminder');
    }
  }
  essayReminder();
  const essay = document.getElementById('weLibraryDetail');
  if (essay) new MutationObserver(() => { essayReminder(); update(); }).observe(essay, { childList: true });
  function update() {
    const parts = Object.fromEntries(calendar.formatToParts(new Date()).map(part => [part.type, part.value]));
    const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
    const remaining = Math.round((examDay - today) / 86400000);
    label.textContent = remaining > 0 ? '距离考试还有' : remaining === 0 ? '今天考试' : '考试已结束';
    value.textContent = remaining > 0 ? String(remaining) : '';
    unit.textContent = remaining > 0 ? '天' : '';
    value.hidden = unit.hidden = remaining <= 0;
    reminder = remaining > 0 ? `距离考试还有 ${remaining} 天` : remaining === 0 ? '今天考试' : '考试已结束';
    document.querySelectorAll('[data-exam-reminder]').forEach(badge => {
      const text = badge.classList.contains('exam-bubble-reminder') && remaining > 0 ? `还剩 ${remaining} 天` : reminder;
      if (badge.textContent !== text) badge.textContent = text;
    });
    document.title = `${remaining > 0 ? `考试倒计时 ${remaining} 天` : reminder} · 窝瓜汤`;
    const bubble = document.getElementById('restore');
    if (bubble) bubble.title = `继续练习 · ${reminder} · 11 月 5 日考试`;
  }
  update();
  setInterval(update, 60000);
  window.addEventListener('focus', update);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
})();

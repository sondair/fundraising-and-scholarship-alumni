// ============================================================
// STATISTIK DONASI — widget chart (dipakai user & admin)
// Filter: Semua Waktu (default) · Per Tahun · Rentang Tanggal.
// Hanya periode yang ada transaksinya yang ditampilkan, maksimal 5 batang
// (bulan digabung otomatis jadi kuartal/semester/tahun bila perlu).
// Klik batang → daftar transaksi periode itu.
// ============================================================
(function () {
  const BLN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const BLN_PANJANG = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const pad = n => String(n).padStart(2, '0');

  // Maksimal batang. Jika bulan yang ada datanya > MAX_BARS, digabung otomatis
  // ke satuan lebih besar (selaras kalender) sampai jumlah batang <= MAX_BARS.
  const MAX_BARS = 5;
  const GRANS = [1, 2, 3, 4, 6, 12, 24, 36, 60, 120, 240, 600]; // dalam bulan
  const GRAN_NAME = { 1: 'per bulan', 2: 'per 2 bulan', 3: 'per kuartal', 4: 'per caturwulan', 6: 'per semester', 12: 'per tahun' };
  const granName = g => GRAN_NAME[g] || `per ${g / 12} tahun`;

  // s = indeks bulan absolut (tahun*12 + bulan0)
  function shortLabel(s, g) {
    const y = Math.floor(s / 12), m = s % 12, e = s + g - 1, ey = Math.floor(e / 12), em = e % 12;
    if (g === 1) return `${BLN[m]} ${String(y).slice(2)}`;
    if (g === 12) return String(y);
    if (g > 12) return `${y}–${ey}`;
    return `${BLN[m]}–${BLN[em]} ${String(y).slice(2)}`;
  }
  function longLabel(s, g) {
    const y = Math.floor(s / 12), m = s % 12, e = s + g - 1, ey = Math.floor(e / 12), em = e % 12;
    if (g === 1) return `${BLN_PANJANG[m]} ${y}`;
    if (g === 12) return `Tahun ${y}`;
    if (g > 12) return `${y} – ${ey}`;
    return `${BLN_PANJANG[m]} – ${BLN_PANJANG[em]} ${y}`;
  }

  // ── HELPERS ──────────────────────────────────────────────
  function parseNominal(v) {
    if (typeof v === 'number') return isFinite(v) ? Math.round(v) : 0;
    const s = String(v == null ? '' : v).trim().replace(/[.,]00$/, '');
    return parseInt(s.replace(/\D/g, ''), 10) || 0;
  }

  // Normalisasi tanggal → 'YYYY-MM-DD' (atau '' jika tidak terbaca).
  function dayKey(tgl) {
    const s = String(tgl || '').trim();
    if (!s) return '';
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    if ((m = s.match(/^(\d{4})-(\d{1,2})$/))) return `${m[1]}-${pad(m[2])}-01`;
    if ((m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/))) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    const d = new Date(s);
    if (!isNaN(d)) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return '';
  }
  function monthKey(tgl) { return dayKey(tgl).slice(0, 7); }

  function fmtDay(dk) {
    if (!dk) return '-';
    const [y, m, d] = dk.split('-');
    return `${parseInt(d, 10)} ${BLN[parseInt(m, 10) - 1]} ${y}`;
  }

  function fmtShort(n) {
    if (!n) return '0';
    const trim = x => x.toFixed(1).replace(/\.0$/, '').replace('.', ',');
    if (n >= 1e9) return trim(n / 1e9) + 'M';
    if (n >= 1e6) return trim(n / 1e6) + 'Jt';
    if (n >= 1e3) return Math.round(n / 1e3) + 'Rb';
    return String(n);
  }

  function rp(n) { return 'Rp ' + (n || 0).toLocaleString('id-ID'); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function ssGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch {} }

  // ── STYLE ────────────────────────────────────────────────
  function injectStyle() {
    if (document.getElementById('pc-style')) return;
    const css = `
.pc-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
.pc-modes{display:inline-flex;background:var(--bg-body,#f3f4f6);border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:3px;gap:2px;flex-wrap:wrap}
.pc-modes button{border:none;background:none;padding:6px 12px;border-radius:9px;font-family:inherit;font-size:12px;font-weight:600;color:var(--text-muted,#6b7280);cursor:pointer;white-space:nowrap}
.pc-modes button.on{background:var(--surface,#fff);color:var(--text-main,#111827);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.pc-select,.pc-date{padding:7px 10px;border:1px solid var(--border,#e5e7eb);border-radius:10px;background:var(--surface,#fff);font-family:inherit;font-size:12px;font-weight:600;color:var(--text-main,#111827);outline:none}
.pc-select:focus,.pc-date:focus{border-color:var(--primary,#059669)}
.pc-range{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pc-range span{font-size:12px;color:var(--text-muted,#6b7280)}
.pc-caption{font-size:12px;color:var(--text-muted,#6b7280);font-weight:600;margin-bottom:4px}
.pc-chart{position:relative}
.pc-scroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}
.pc-inner{min-width:100%}
.pc-bars{display:flex;align-items:flex-end;gap:8px;padding-top:22px;border-bottom:1px solid var(--border,#e5e7eb)}
.pc-col{flex:1 1 0;min-width:0;max-width:140px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;cursor:pointer;border-radius:8px 8px 0 0;transition:background .15s}
.pc-col:hover{background:rgba(5,150,105,.06)}
.pc-col.sel{background:rgba(5,150,105,.12)}
.pc-col.dim .pc-stack{opacity:.35}
.pc-val{font-size:10.5px;font-weight:700;color:var(--primary,#059669);margin-bottom:4px;white-space:nowrap}
.pc-stack{width:60%;max-width:36px;display:flex;flex-direction:column;justify-content:flex-end;transition:opacity .2s}
.pc-seg{width:100%;transition:height .4s ease}
.pc-seg.p{background:#fbbf24}
.pc-seg.v{background:var(--primary,#059669)}
.pc-stack>.pc-seg:first-child{border-radius:6px 6px 0 0}
.pc-labels{display:flex;gap:8px;margin-top:6px}
.pc-lbl{flex:1 1 0;min-width:0;max-width:140px;text-align:center;font-size:11px;line-height:1.3;font-weight:600;color:var(--text-muted,#6b7280);cursor:pointer}
.pc-lbl.sel{color:var(--primary,#059669);font-weight:800}
.pc-legend{display:flex;gap:14px;margin-top:10px;font-size:11px;color:var(--text-muted,#6b7280);font-weight:600}
.pc-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.pc-tip{position:absolute;z-index:20;pointer-events:none;background:#111827;color:#fff;border-radius:10px;padding:8px 10px;font-size:11px;line-height:1.5;white-space:nowrap;opacity:0;transition:opacity .12s;transform:translate(-50%,-100%)}
.pc-tip.show{opacity:1}
.pc-tip b{font-size:12px}
.pc-onb{position:absolute;z-index:30;left:50%;top:0;transform:translate(-50%,-100%);margin-top:-6px;background:#111827;color:#fff;border-radius:12px;padding:10px 12px;font-size:12px;line-height:1.45;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);width:max-content;max-width:calc(100% - 8px);animation:pcPop .25s ease}
.pc-onb::after{content:'';position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);border:6px solid transparent;border-bottom:0;border-top-color:#111827}
.pc-onb button{flex-shrink:0;background:var(--primary,#059669);color:#fff;border:none;border-radius:8px;padding:5px 10px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer}
@keyframes pcPop{from{opacity:0;margin-top:0}to{opacity:1;margin-top:-6px}}
.pc-none{text-align:center;padding:36px 12px;font-size:13px;font-weight:600;color:var(--text-muted,#6b7280)}
.pc-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}
.pc-stat{background:var(--bg-body,#f9fafb);border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:10px 12px;min-width:0}
.pc-stat-l{font-size:10.5px;color:var(--text-muted,#6b7280);font-weight:600}
.pc-stat-v{font-size:14px;font-weight:800;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc-stat-n{font-size:10.5px;font-weight:700;color:#d97706;margin-top:1px}
@media(max-width:420px){.pc-stat-v{font-size:12.5px}}
.pc-detail{margin-top:16px;border-top:1px dashed var(--border,#e5e7eb);padding-top:14px}
.pc-detail-h{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:8px}
.pc-detail-t{font-size:14px;font-weight:800}
.pc-detail-s{font-size:11.5px;color:var(--text-muted,#6b7280);margin-top:2px}
.pc-detail-x{background:var(--bg-body,#f3f4f6);border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:5px 10px;color:var(--text-muted,#6b7280);font-weight:700;font-size:11px;cursor:pointer;font-family:inherit;flex-shrink:0}
.pc-list{list-style:none;margin:0;padding:0;max-height:340px;overflow-y:auto;border:1px solid var(--border,#e5e7eb);border-radius:12px}
.pc-li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border,#e5e7eb)}
.pc-li:last-child{border-bottom:none}
.pc-li-main{min-width:0}
.pc-li-top{font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-li-sub{font-size:11px;color:var(--text-muted,#6b7280);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-li-right{text-align:right;flex-shrink:0}
.pc-li-amt{font-size:13px;font-weight:800}
.pc-badge{display:inline-block;margin-top:3px;padding:2px 8px;border-radius:6px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}
.pc-badge.v{background:#d1fae5;color:#047857}
.pc-badge.p{background:#fef3c7;color:#d97706}
`;
    const el = document.createElement('style');
    el.id = 'pc-style';
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ── WIDGET ───────────────────────────────────────────────
  /**
   * opts: {
   *   mountId, getData:()=>donasi[], height?,
   *   isAdmin?   — tampilkan nama donatur & jumlah donatur,
   *   tipKey?    — kunci tooltip panduan (muncul sekali per login),
   *   onChange?({ match(d)->bool, label })
   * }
   */
  function createPeriodChart(opts) {
    injectStyle();
    const root = document.getElementById(opts.mountId);
    const H = opts.height || 140;
    const state = { mode: 'all', year: null, from: '', to: '', selected: null };

    root.innerHTML = `
      <div class="pc-toolbar">
        <div class="pc-modes" data-r="modes">
          <button type="button" data-mode="all">Semua Waktu</button>
          <button type="button" data-mode="year">Per Tahun</button>
          <button type="button" data-mode="custom">Rentang Tanggal</button>
        </div>
        <select class="pc-select" data-r="year" aria-label="Pilih tahun"></select>
        <div class="pc-range" data-r="range">
          <input type="date" class="pc-date" data-r="from" aria-label="Dari tanggal">
          <span>s/d</span>
          <input type="date" class="pc-date" data-r="to" aria-label="Sampai tanggal">
        </div>
      </div>
      <div class="pc-caption" data-r="caption"></div>
      <div class="pc-chart" data-r="chart"></div>
      <div data-r="legend"></div>
      <div data-r="summary"></div>
      <div data-r="detail"></div>`;

    const $ = r => root.querySelector(`[data-r="${r}"]`);

    root.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      state.selected = null;
      const data = opts.getData() || [];
      if (state.mode === 'custom' && !state.from && !state.to) {
        const days = data.map(d => dayKey(d.tanggal_transfer)).filter(Boolean).sort();
        state.from = days[0] || `${new Date().getFullYear()}-01-01`;
        state.to = todayKey() > (days[days.length - 1] || '') ? todayKey() : days[days.length - 1];
      }
      render();
    }));
    $('year').addEventListener('change', e => { state.year = e.target.value; state.selected = null; render(); });
    $('from').addEventListener('change', e => { state.from = e.target.value; state.selected = null; render(); });
    $('to').addEventListener('change', e => { state.to = e.target.value; state.selected = null; render(); });

    function baseMatch(d) {
      const dk = dayKey(d.tanggal_transfer);
      if (!dk) return false;
      if (state.mode === 'year') return dk.slice(0, 4) === state.year;
      if (state.mode === 'custom') {
        if (state.from && dk < state.from) return false;
        if (state.to && dk > state.to) return false;
      }
      return true;
    }

    // minI/maxI = indeks bulan pertama/terakhir yang ada datanya
    function captionText(minI, maxI, gran) {
      let t;
      if (state.mode === 'year') t = `Tahun ${state.year}`;
      else if (state.mode === 'custom') t = `${state.from ? fmtDay(state.from) : 'Awal'} – ${state.to ? fmtDay(state.to) : 'Sekarang'}`;
      else if (minI == null) t = 'Semua waktu';
      else if (minI === maxI) t = `Semua waktu · ${longLabel(minI, 1)}`;
      else t = `Semua waktu · ${shortLabel(minI, 1)} – ${shortLabel(maxI, 1)}`;
      return gran > 1 ? `${t} · ${granName(gran)}` : t;
    }

    function dismissOnboarding() {
      if (opts.tipKey) ssSet('pc_onb_' + opts.tipKey, '1');
      const el = $('onb');
      if (el) el.remove();
    }

    function render() {
      const data = opts.getData() || [];

      // tahun yang ada datanya
      const years = [...new Set(data.map(d => dayKey(d.tanggal_transfer).slice(0, 4)).filter(Boolean))].sort().reverse();
      if (!years.length) years.push(String(new Date().getFullYear()));
      if (!state.year || !years.includes(state.year)) state.year = years[0];

      // toolbar
      root.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === state.mode));
      $('year').style.display = state.mode === 'year' ? '' : 'none';
      $('range').style.display = state.mode === 'custom' ? '' : 'none';
      $('year').innerHTML = years.map(y => `<option value="${y}" ${y === state.year ? 'selected' : ''}>${y}</option>`).join('');
      $('from').value = state.from; $('to').value = state.to;

      // kelompokkan (hanya periode yang ada transaksinya, maksimal MAX_BARS batang)
      const rows = data.filter(d => (d.status === 'valid' || d.status === 'pending') && baseMatch(d));
      const mIdx = d => { const k = monthKey(d.tanggal_transfer); return parseInt(k.slice(0, 4), 10) * 12 + parseInt(k.slice(5, 7), 10) - 1; };
      const distinct = [...new Set(rows.map(mIdx))];
      let gran = 1;
      for (const g of GRANS) {
        gran = g;
        if (new Set(distinct.map(i => Math.floor(i / g))).size <= MAX_BARS) break;
      }
      const keyOf = d => `${gran}:${Math.floor(mIdx(d) / gran) * gran}`;
      const map = new Map();
      rows.forEach(d => {
        const k = keyOf(d);
        if (!map.has(k)) {
          const s = Math.floor(mIdx(d) / gran) * gran;
          map.set(k, { key: k, start: s, short: shortLabel(s, gran), long: longLabel(s, gran), valid: 0, pending: 0, nValid: 0, nPending: 0, donors: new Set(), items: [] });
        }
        const b = map.get(k), n = parseNominal(d.nominal);
        b.items.push(d);
        if (d.status === 'valid') { b.valid += n; b.nValid++; b.donors.add(d.email); }
        else { b.pending += n; b.nPending++; }
      });
      const buckets = [...map.values()].sort((a, b) => a.start - b.start);
      if (state.selected && !map.has(state.selected)) state.selected = null;
      const sel = state.selected;
      const selB = sel ? map.get(sel) : null;
      const caption = distinct.length
        ? captionText(Math.min(...distinct), Math.max(...distinct), gran)
        : captionText(null, null, 1);

      $('caption').textContent = caption;

      const notify = () => {
        if (!opts.onChange) return;
        opts.onChange({
          match: selB ? (d => baseMatch(d) && keyOf(d) === sel) : baseMatch,
          label: selB ? selB.long : caption,
        });
      };

      // kosong
      if (!buckets.length) {
        $('chart').innerHTML = '<div class="pc-none">Tidak ada transaksi</div>';
        $('legend').innerHTML = $('summary').innerHTML = $('detail').innerHTML = '';
        notify();
        return;
      }

      // chart
      const maxVal = Math.max(1, ...buckets.map(b => b.valid + b.pending));
      const lbl = b => b.short;
      $('chart').innerHTML = `
        <div class="pc-scroll" data-r="scroll"><div class="pc-inner">
          <div class="pc-bars" style="height:${H + 26}px">
            ${buckets.map(b => {
              const vh = b.valid ? Math.max(Math.round(b.valid / maxVal * H), 6) : 0;
              const ph = b.pending ? Math.max(Math.round(b.pending / maxVal * H), 4) : 0;
              const cls = ['pc-col', sel === b.key ? 'sel' : '', sel && sel !== b.key ? 'dim' : ''].join(' ');
              return `<div class="${cls}" data-k="${b.key}">
                <div class="pc-val">${b.valid ? fmtShort(b.valid) : ''}</div>
                <div class="pc-stack">
                  ${ph ? `<div class="pc-seg p" style="height:${ph}px"></div>` : ''}
                  ${vh ? `<div class="pc-seg v" style="height:${vh}px"></div>` : ''}
                </div>
              </div>`;
            }).join('')}
          </div>
          <div class="pc-labels">${buckets.map(b => `<div class="pc-lbl ${sel === b.key ? 'sel' : ''}" data-k="${b.key}">${lbl(b)}</div>`).join('')}</div>
        </div></div>
        <div class="pc-tip" data-r="tip"></div>`;

      const chartEl = $('chart'), tip = $('tip'), scroll = $('scroll');
      if (!sel) scroll.scrollLeft = scroll.scrollWidth; // tampilkan bulan terbaru
      chartEl.querySelectorAll('[data-k]').forEach(col => {
        const b = map.get(col.dataset.k);
        col.addEventListener('click', () => {
          dismissOnboarding();
          state.selected = state.selected === b.key ? null : b.key;
          const left = scroll.scrollLeft;
          render();
          $('scroll').scrollLeft = left;
        });
        if (!col.classList.contains('pc-col')) return;
        col.addEventListener('mouseenter', () => {
          tip.innerHTML = `<b>${b.long}</b><br>Tervalidasi: ${rp(b.valid)} (${b.nValid})` +
            (b.nPending ? `<br>Menunggu: ${rp(b.pending)} (${b.nPending})` : '');
          const cr = chartEl.getBoundingClientRect(), r = col.getBoundingClientRect();
          tip.classList.add('show');
          const half = tip.offsetWidth / 2;
          tip.style.left = Math.max(half, Math.min(cr.width - half, r.left - cr.left + r.width / 2)) + 'px';
          tip.style.top = '16px';
        });
        col.addEventListener('mouseleave', () => tip.classList.remove('show'));
      });

      // tooltip panduan — sekali per login
      if (opts.tipKey && !ssGet('pc_onb_' + opts.tipKey)) {
        const onb = document.createElement('div');
        onb.className = 'pc-onb';
        onb.dataset.r = 'onb';
        onb.innerHTML = '<span>Klik batang untuk melihat daftar transaksi bulan itu</span><button type="button">Mengerti</button>';
        onb.querySelector('button').addEventListener('click', dismissOnboarding);
        onb.style.top = Math.round((H + 26) * 0.55) + 'px'; // melayang di atas area batang
        chartEl.appendChild(onb);
        clearTimeout(render._onbTimer);
        render._onbTimer = setTimeout(dismissOnboarding, 10000);
      }

      // legenda (kuning hanya jika ada yang menunggu)
      const anyPending = buckets.some(b => b.nPending);
      $('legend').innerHTML = anyPending
        ? '<div class="pc-legend"><span><i style="background:var(--primary,#059669)"></i>Tervalidasi</span><span><i style="background:#fbbf24"></i>Menunggu validasi</span></div>'
        : '';

      // ringkasan
      const scope = selB ? [selB] : buckets;
      const tot = scope.reduce((s, b) => s + b.valid, 0);
      const trx = scope.reduce((s, b) => s + b.nValid, 0);
      const pend = scope.reduce((s, b) => s + b.nPending, 0);
      const donors = new Set(); scope.forEach(b => b.donors.forEach(e => donors.add(e)));
      const third = opts.isAdmin
        ? ['Donatur', donors.size]
        : selB ? ['Rata-rata', trx ? rp(Math.round(tot / trx)) : '–']
        : ['Bulan Berdonasi', new Set(rows.filter(d => d.status === 'valid').map(mIdx)).size];
      $('summary').innerHTML = `<div class="pc-summary">
        <div class="pc-stat"><div class="pc-stat-l">Total Tervalidasi</div><div class="pc-stat-v">${rp(tot)}</div></div>
        <div class="pc-stat"><div class="pc-stat-l">Transaksi</div><div class="pc-stat-v">${trx}</div>${pend ? `<div class="pc-stat-n">+${pend} menunggu</div>` : ''}</div>
        <div class="pc-stat"><div class="pc-stat-l">${third[0]}</div><div class="pc-stat-v">${third[1]}</div></div>
      </div>`;

      // detail (format list) — hanya saat batang dipilih
      if (selB) {
        const items = [...selB.items].sort((a, b) => dayKey(b.tanggal_transfer).localeCompare(dayKey(a.tanggal_transfer)));
        $('detail').innerHTML = `<div class="pc-detail">
          <div class="pc-detail-h">
            <div>
              <div class="pc-detail-t">${selB.long}</div>
              <div class="pc-detail-s">${items.length} transaksi · ${rp(selB.valid)} tervalidasi</div>
            </div>
            <button type="button" class="pc-detail-x" data-r="close">Tutup ✕</button>
          </div>
          <ul class="pc-list">
            ${items.map(d => {
              const ok = d.status === 'valid';
              const top = opts.isAdmin ? `${esc(d.nama || d.email)}` : fmtDay(dayKey(d.tanggal_transfer));
              const sub = opts.isAdmin
                ? `${fmtDay(dayKey(d.tanggal_transfer))} · ${esc(d.peruntukan || 'Umum')}`
                : esc(d.peruntukan || 'Umum');
              return `<li class="pc-li">
                <div class="pc-li-main"><div class="pc-li-top">${top}</div><div class="pc-li-sub">${sub}</div></div>
                <div class="pc-li-right"><div class="pc-li-amt">${rp(parseNominal(d.nominal))}</div><span class="pc-badge ${ok ? 'v' : 'p'}">${ok ? 'Tervalidasi' : 'Menunggu'}</span></div>
              </li>`;
            }).join('')}
          </ul>
        </div>`;
        $('close').addEventListener('click', () => { state.selected = null; render(); });
      } else {
        $('detail').innerHTML = '';
      }

      notify();
    }

    return { render, state };
  }

  window.Stats = { parseNominal, dayKey, monthKey, fmtShort, createPeriodChart };
})();

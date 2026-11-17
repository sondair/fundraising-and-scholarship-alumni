function saveSession(data) {
  sessionStorage.setItem('beasiswa_session', JSON.stringify(data));
}
function getSession() {
  try {
    const raw = sessionStorage.getItem('beasiswa_session');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearSession() {
  sessionStorage.removeItem('beasiswa_session');
  // reset tooltip panduan chart supaya muncul lagi di login berikutnya
  try {
    Object.keys(sessionStorage).filter(k => k.startsWith('pc_onb_')).forEach(k => sessionStorage.removeItem(k));
  } catch {}
}
function requireAuth(requiredRole) {
  const session = getSession();
  if (!session) { window.location.href = '../index.html'; return null; }
  if (requiredRole === 'admin' && session.role !== 'admin') {
    window.location.href = '../index.html'; return null;
  }
  return session;
}
function logout() {
  clearSession();
  window.location.href = '../index.html';
}
function formatRupiah(angka) {
  const num = parseInt(String(angka).replace(/\D/g, '')) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}
function formatTanggal(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}
async function apiCall(params) {
  const res = await fetch(CONFIG.API_URL + '?' + new URLSearchParams(params).toString());
  return res.json();
}
async function apiPost(body) {
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    // INI YANG MEMPERBAIKI KESALAHAN JARINGAN (BYPASS CORS)
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
    body: JSON.stringify(body),
  });
  return res.json();
}
// ===================================================================
// ===== HESABLAR (accounts.js) =====
// ===================================================================
// Bu fayl hesab açmaq (qeydiyyat), hesaba girmək və hər hesabın 3 dünyasını (plot) idarə edir.
//
// DİQQƏT: oyun GitHub Pages-də işləyir və serveri yoxdur. Ona görə hesablar yalnız
// həmin cihazın brauzerində saxlanılır (başqa telefonda eyni hesab görünməz).
// Parollar açıq yazılmır, salt + SHA-256 ilə şifrələnib saxlanılır.

// ---------- Ayarlar ----------

export const PLOT_COUNT = 3;                 // hər hesabın dünya sayı
export const ADMIN_START_MONEY = 10000000;   // admin hesabın yeni dünyada başlanğıc pulu

// Bu adlar yalnız admin kodu ilə açıla bilər (kiçik-böyük hərf fərqi yoxdur)
const ADMIN_USERNAMES = ['admin'];

// Admin kodunun SHA-256 şifrəsi (kodun özü burada yazılmır).
// İndiki admin kodu: AyAdmin2026
// Kodu dəyişmək üçün brauzer konsolunda yaz: ayAdminHash('yeni_kod')
// Çıxan uzun yazını aşağıdakı dırnaqların içinə qoy.
const ADMIN_CODE_HASH = '38e4ce1c07bce592fae5e4d9995eefa59c78ff49cb8904245948ae70cc882b5b';

const USER_KEY_PREFIX = 'ay_user_v1:';       // hər hesab öz açarı ilə saxlanılır
const CURRENT_USER_KEY = 'ay_current_user_v1'; // hazırda daxil olmuş hesab
const DB_NAME = 'ay_worlds_v1';              // dünyanın təmizlik xəritəsi (böyük məlumat) burada saxlanılır
const DB_STORE = 'worlds';

// ---------- Şifrələmə ----------

// Baytlar siyahısını hex yazıya çevirir
function bytesToHex(bytes) {
  let text = '';
  for (const value of bytes) {
    text += value.toString(16).padStart(2, '0');
  }
  return text;
}

// Təsadüfi salt düzəldir (hər hesabın öz duzu olur)
function makeSalt() {
  const bytes = new Uint8Array(16);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

// Təhlükəsiz bağlantıda (https və ya localhost) SHA-256 işləyir
function hasSecureHash() {
  return Boolean(window.crypto && window.crypto.subtle);
}

// SHA-256 hash (yalnız təhlükəsiz bağlantıda)
async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const buffer = await window.crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(buffer));
}

// Təhlükəsiz bağlantı olmayanda işləyən sadə (zəif) hash
function weakHash(text) {
  let first = 7;
  let second = 13;
  for (let round = 0; round < 50; round++) {
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index);
      first = (first * 31 + code) % 4294967291;
      second = (second * 37 + code + first) % 4294967279;
    }
  }
  return first.toString(16) + '-' + second.toString(16);
}

// Verilmiş üsulla hash edir ('sha256' və ya 'weak')
async function hashWith(algo, text) {
  if (algo === 'sha256') {
    return sha256Hex(text);
  }
  return weakHash(text);
}

// Parolu hesabın duzu ilə birləşdirib hash edir
async function hashPassword(algo, salt, password) {
  return hashWith(algo, salt + ':' + password);
}

// Brauzer konsolundan admin kodunun hash-ini almaq üçün köməkçi: ayAdminHash('kod')
window.ayAdminHash = async function (code) {
  if (!hasSecureHash()) {
    console.log('Bu bağlantıda SHA-256 yoxdur (https və ya localhost lazımdır)');
    return;
  }
  console.log(await sha256Hex(code));
};

// ---------- Hesab məlumatı ----------

// Adı müqayisə üçün hazırlayır (kiçik hərflər, boşluqsuz)
function nameKeyOf(name) {
  return String(name).trim().toLowerCase();
}

// Ad qaydalarını yoxlayır: 3-16 simvol, yalnız hərf, rəqəm və _
function validateName(name) {
  const clean = String(name).trim();
  if (clean.length < 3 || clean.length > 16) {
    return 'İstifadəçi adı 3-16 simvol olmalıdır';
  }
  if (!/^[A-Za-z0-9_]+$/.test(clean)) {
    return 'Ad yalnız hərf, rəqəm və _ işarəsindən ibarət ola bilər (boşluq olmaz)';
  }
  return '';
}

// Bu ad admin adıdırmı (admin kodu tələb olunur)
export function isAdminName(name) {
  return ADMIN_USERNAMES.includes(nameKeyOf(name));
}

// Hesabın qeydini yaddaşdan oxuyur (yoxdursa null)
function readUser(name) {
  try {
    const raw = localStorage.getItem(USER_KEY_PREFIX + nameKeyOf(name));
    if (!raw) { return null; }
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Hesab oxuma xətası:', error);
    return null;
  }
}

// Hesabın qeydini yaddaşa yazır
function writeUser(record) {
  localStorage.setItem(USER_KEY_PREFIX + nameKeyOf(record.name), JSON.stringify(record));
}

// Hesab qeydinin surəti (təhlükəsizlik üçün parol hash-i xaric)
function publicUser(record) {
  return {
    name: record.name,
    isAdmin: record.isAdmin === true,
    plots: record.plots,
  };
}

// Hazırda daxil olmuş hesabı qaytarır (yoxdursa null)
export function getCurrentUser() {
  try {
    const name = localStorage.getItem(CURRENT_USER_KEY);
    if (!name) { return null; }
    const record = readUser(name);
    if (record === null) { return null; }
    return publicUser(record);
  } catch (error) {
    return null;
  }
}

// Hesabdan çıxır
export function logoutUser() {
  try {
    localStorage.removeItem(CURRENT_USER_KEY);
  } catch (error) {
    console.warn('Çıxış xətası:', error);
  }
}

// Hesabı yenidən oxuyub təzə vəziyyətini qaytarır
export function refreshUser(name) {
  const record = readUser(name);
  if (record === null) { return null; }
  return publicUser(record);
}

// ---------- Qeydiyyat və giriş ----------

// Yeni hesab açır. Uğurlu olarsa hesaba daxil də edir.
export async function registerUser(name, password, passwordRepeat, adminCode) {
  const nameError = validateName(name);
  if (nameError !== '') { return { ok: false, message: nameError }; }

  if (String(password).length < 4) {
    return { ok: false, message: 'Parol ən azı 4 simvol olmalıdır' };
  }
  if (password !== passwordRepeat) {
    return { ok: false, message: 'Parollar eyni deyil' };
  }

  const cleanName = String(name).trim();
  if (readUser(cleanName) !== null) {
    return { ok: false, message: 'Bu ad artıq tutulub, başqa ad seç' };
  }

  // Admin adları yalnız düzgün admin kodu ilə açılır
  let isAdmin = false;
  if (isAdminName(cleanName)) {
    if (!hasSecureHash()) {
      return { ok: false, message: 'Admin hesabı yalnız təhlükəsiz bağlantıda (https) açıla bilər' };
    }
    const codeHash = await sha256Hex(String(adminCode));
    if (codeHash !== ADMIN_CODE_HASH) {
      return { ok: false, message: 'Admin kodu səhvdir' };
    }
    isAdmin = true;
  }

  let algo = 'weak';
  if (hasSecureHash()) {
    algo = 'sha256';
  }
  const salt = makeSalt();
  const hash = await hashPassword(algo, salt, password);

  const plots = [];
  for (let index = 0; index < PLOT_COUNT; index++) {
    plots.push(null);
  }

  const record = {
    name: cleanName,
    algo: algo,
    salt: salt,
    hash: hash,
    isAdmin: isAdmin,
    createdAt: Date.now(),
    plots: plots,
  };

  try {
    writeUser(record);
    localStorage.setItem(CURRENT_USER_KEY, record.name);
  } catch (error) {
    return { ok: false, message: 'Yaddaşa yazmaq olmadı (yer qalmayıb?)' };
  }
  return { ok: true, message: 'Hesab açıldı!', user: publicUser(record) };
}

// Hesaba daxil olur
export async function loginUser(name, password) {
  const record = readUser(name);
  if (record === null) {
    return { ok: false, message: 'Belə hesab tapılmadı' };
  }
  if (record.algo === 'sha256' && !hasSecureHash()) {
    return { ok: false, message: 'Bu hesab üçün təhlükəsiz bağlantı (https) lazımdır' };
  }

  const hash = await hashPassword(record.algo, record.salt, password);
  if (hash !== record.hash) {
    return { ok: false, message: 'Parol səhvdir' };
  }

  try {
    localStorage.setItem(CURRENT_USER_KEY, record.name);
  } catch (error) {
    console.warn('Sessiya yazma xətası:', error);
  }
  return { ok: true, message: 'Xoş gəldin!', user: publicUser(record) };
}

// ---------- Dünyalar (plot) ----------

// Yeni dünya açır (başlanğıc pulu: adi oyunçuda 0, adminlərdə çox)
export async function createPlot(name, plotIndex) {
  const record = readUser(name);
  if (record === null) { return { ok: false, message: 'Hesab tapılmadı' }; }
  if (plotIndex < 0 || plotIndex >= PLOT_COUNT) { return { ok: false, message: 'Yanlış dünya nömrəsi' }; }
  if (record.plots[plotIndex] !== null) { return { ok: false, message: 'Bu yerdə artıq dünya var' }; }

  let startMoney = 0;
  if (record.isAdmin === true) {
    startMoney = ADMIN_START_MONEY;
  }

  const plot = {
    createdAt: Date.now(),
    savedAt: Date.now(),
    completed: false,
    percent: 0,
    state: { money: startMoney },
  };

  // Köhnə qalıq varsa, təmizlik xəritəsini silirik
  await deleteWorldData(record.name, plotIndex);

  record.plots[plotIndex] = plot;
  try {
    writeUser(record);
  } catch (error) {
    return { ok: false, message: 'Yaddaşa yazmaq olmadı' };
  }
  return { ok: true, message: 'Yeni dünya açıldı!', plot: plot };
}

// Dünyanı silir. Adi oyunçu yalnız bitmiş dünyanı silə bilər, admin istənilən dünyanı.
export async function deletePlot(name, plotIndex) {
  const record = readUser(name);
  if (record === null) { return { ok: false, message: 'Hesab tapılmadı' }; }
  const plot = record.plots[plotIndex];
  if (!plot) { return { ok: false, message: 'Bu dünya artıq boşdur' }; }

  if (plot.completed !== true && record.isAdmin !== true) {
    return { ok: false, message: 'Dünyanı silmək üçün əvvəlcə onu bitirməlisən' };
  }

  await deleteWorldData(record.name, plotIndex);
  record.plots[plotIndex] = null;
  try {
    writeUser(record);
  } catch (error) {
    return { ok: false, message: 'Yaddaşa yazmaq olmadı' };
  }
  return { ok: true, message: 'Dünya silindi' };
}

// Dünyanın qısa məlumatını (pul, vəziyyət, faiz) yaddaşa yazır
export function savePlotMeta(name, plotIndex, plot) {
  const record = readUser(name);
  if (record === null) { return false; }
  record.plots[plotIndex] = plot;
  try {
    writeUser(record);
    return true;
  } catch (error) {
    console.warn('Dünya məlumatını yazma xətası:', error);
    return false;
  }
}

// ---------- Dünyanın təmizlik xəritəsi (IndexedDB) ----------

let dbPromise = null;

// Verilənlər bazasını açır (bir dəfə açılır, sonra təkrar istifadə olunur)
function openDatabase() {
  if (dbPromise !== null) { return dbPromise; }

  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB yoxdur'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => { resolve(request.result); };
    request.onerror = () => { reject(request.error); };
  });
  return dbPromise;
}

// Dünyanın saxlama açarı
function worldKey(name, plotIndex) {
  return nameKeyOf(name) + ':' + plotIndex;
}

// Bir əməliyyatı bazada icra edir
async function runStoreRequest(mode, makeRequest) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, mode);
    const store = transaction.objectStore(DB_STORE);
    const request = makeRequest(store);
    transaction.oncomplete = () => { resolve(request.result); };
    transaction.onerror = () => { reject(transaction.error); };
    transaction.onabort = () => { reject(transaction.error); };
  });
}

// Dünyanın təmizlik xəritəsini oxuyur (yoxdursa null)
export async function loadWorldData(name, plotIndex) {
  try {
    const data = await runStoreRequest('readonly', (store) => store.get(worldKey(name, plotIndex)));
    if (data === undefined || data === null) { return null; }
    return data;
  } catch (error) {
    console.warn('Dünya xəritəsini oxuma xətası:', error);
    return null;
  }
}

// Dünyanın təmizlik xəritəsini yazır
export async function saveWorldData(name, plotIndex, data) {
  await runStoreRequest('readwrite', (store) => store.put(data, worldKey(name, plotIndex)));
}

// Dünyanın təmizlik xəritəsini silir
async function deleteWorldData(name, plotIndex) {
  try {
    await runStoreRequest('readwrite', (store) => store.delete(worldKey(name, plotIndex)));
  } catch (error) {
    console.warn('Dünya xəritəsini silmə xətası:', error);
  }
}

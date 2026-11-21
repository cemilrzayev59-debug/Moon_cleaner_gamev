// ===================================================================
// ===== GİRİŞ EKRANLARI (authui.js) =====
// ===================================================================
// Giriş, hesab açma və 3 dünyadan birini seçmə ekranları.
// Hamısı bu faylda JavaScript ilə düzəldilir, ona görə index.html və style.css dəyişmir.

import {
  PLOT_COUNT,
  getCurrentUser,
  logoutUser,
  refreshUser,
  registerUser,
  loginUser,
  createPlot,
  deletePlot,
  isAdminName,
} from './accounts.js';

// Ortaq üslublar
const OVERLAY_CSS =
  'position:fixed; top:0; right:0; bottom:0; left:0; z-index:1000; overflow-y:auto;' +
  'background:radial-gradient(circle at 50% 20%, #1e293b, #020617); color:#fff;' +
  'display:flex; align-items:flex-start; justify-content:center; padding:20px 12px;';

const CARD_CSS =
  'width:100%; max-width:420px; background:rgba(15,23,42,0.92); border:2px solid rgba(255,255,255,0.25);' +
  'border-radius:16px; padding:18px; margin:auto 0; box-shadow:0 8px 30px rgba(0,0,0,0.6);';

const INPUT_CSS =
  'width:100%; padding:12px; margin:6px 0; border-radius:8px; border:2px solid rgba(255,255,255,0.3);' +
  'background:#0f172a; color:#fff; font-size:16px; outline:none;' +
  'user-select:text; -webkit-user-select:text;';

const BUTTON_CSS =
  'width:100%; padding:12px; margin:6px 0; border:none; border-radius:10px; font-size:16px;' +
  'font-weight:800; color:#fff; cursor:pointer; background:#22c55e;';

// HTML elementi düzəldir (növ, mətn, üslub)
function makeElement(tag, text, css) {
  const element = document.createElement(tag);
  if (text !== '') {
    element.textContent = text;
  }
  if (css !== '') {
    element.style.cssText = css;
  }
  return element;
}

// Yazı sahəsi düzəldir
function makeInput(type, placeholder) {
  const input = makeElement('input', '', INPUT_CSS);
  input.type = type;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.autocapitalize = 'off';
  input.spellcheck = false;
  return input;
}

// Düymə düzəldir (rəng istəyə görə dəyişir)
function makeButton(text, color) {
  const button = makeElement('button', text, BUTTON_CSS);
  if (color !== undefined) {
    button.style.background = color;
  }
  return button;
}

// Başlıq: oyunun adı
function makeTitle(text) {
  const title = makeElement('div', '🌙 Ayın Səthini Təmizləmək', 'font-size:20px; font-weight:800; text-align:center;');
  const subtitle = makeElement('div', text, 'font-size:14px; color:#cbd5e1; text-align:center; margin:4px 0 10px;');
  const box = makeElement('div', '', '');
  box.appendChild(title);
  box.appendChild(subtitle);
  return box;
}

// Giriş, qeydiyyat və dünya seçimi ekranlarını göstərir.
// Oyunçu bir dünya seçəndə { user, plotIndex, plot } qaytarır və oyun başlayır.
export function showAuthScreens() {
  return new Promise((resolve) => {
    const overlay = makeElement('div', '', OVERLAY_CSS);
    const card = makeElement('div', '', CARD_CSS);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Ekranı bağlayır və oyunu başlatmaq üçün nəticəni verir
    function finish(user, plotIndex, plot) {
      overlay.remove();
      resolve({ user: user, plotIndex: plotIndex, plot: plot });
    }

    // Kartın içini təmizləyir
    function clearCard() {
      while (card.firstChild) {
        card.removeChild(card.firstChild);
      }
    }

    // Xəta və ya məlumat yazısı üçün sahə
    function makeMessage(text, isError) {
      let color = '#86efac';
      if (isError) {
        color = '#fca5a5';
      }
      return makeElement('div', text, 'min-height:20px; font-size:14px; text-align:center; margin:6px 0; color:' + color + ';');
    }

    // ---------- Giriş ekranı ----------
    function showLogin(startMessage) {
      clearCard();
      card.appendChild(makeTitle('Hesabına daxil ol'));

      const nameInput = makeInput('text', 'İstifadəçi adı');
      const passInput = makeInput('password', 'Parol');
      const message = makeMessage(startMessage || '', false);
      const loginButton = makeButton('Daxil ol');
      const registerButton = makeButton('Yeni hesab aç', '#3b82f6');

      card.appendChild(nameInput);
      card.appendChild(passInput);
      card.appendChild(message);
      card.appendChild(loginButton);
      card.appendChild(registerButton);

      // Giriş düyməsi basılanda
      async function submit() {
        loginButton.disabled = true;
        message.textContent = 'Yoxlanılır...';
        const result = await loginUser(nameInput.value, passInput.value);
        loginButton.disabled = false;
        if (result.ok) {
          showPlots(result.user, '');
        } else {
          message.style.color = '#fca5a5';
          message.textContent = result.message;
        }
      }

      loginButton.addEventListener('click', submit);
      passInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { submit(); }
      });
      registerButton.addEventListener('click', () => { showRegister(); });
    }

    // ---------- Qeydiyyat ekranı ----------
    function showRegister() {
      clearCard();
      card.appendChild(makeTitle('Yeni hesab aç'));

      const nameInput = makeInput('text', 'İstifadəçi adı (3-16 simvol, hərf/rəqəm/_)');
      const passInput = makeInput('password', 'Parol (ən azı 4 simvol)');
      const repeatInput = makeInput('password', 'Parolu təkrar yaz');
      const codeInput = makeInput('password', 'Admin kodu');
      codeInput.style.display = 'none';
      const message = makeMessage('', true);
      const createButton = makeButton('Hesab aç');
      const backButton = makeButton('Geri (daxil ol)', '#64748b');

      card.appendChild(nameInput);
      card.appendChild(passInput);
      card.appendChild(repeatInput);
      card.appendChild(codeInput);
      card.appendChild(message);
      card.appendChild(createButton);
      card.appendChild(backButton);

      // Admin adı yazılanda admin kodu sahəsi görünür
      nameInput.addEventListener('input', () => {
        if (isAdminName(nameInput.value)) {
          codeInput.style.display = 'block';
        } else {
          codeInput.style.display = 'none';
        }
      });

      // Hesab aç düyməsi basılanda
      async function submit() {
        createButton.disabled = true;
        message.style.color = '#fca5a5';
        message.textContent = 'Hesab açılır...';
        const result = await registerUser(nameInput.value, passInput.value, repeatInput.value, codeInput.value);
        createButton.disabled = false;
        if (result.ok) {
          showPlots(result.user, 'Hesab açıldı! Dünya seç.');
        } else {
          message.textContent = result.message;
        }
      }

      createButton.addEventListener('click', submit);
      repeatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { submit(); }
      });
      backButton.addEventListener('click', () => { showLogin(''); });
    }

    // ---------- Dünya seçimi ekranı ----------
    function showPlots(startUser, startMessage) {
      clearCard();

      // Ən yeni məlumatı yaddaşdan oxuyuruq
      const user = refreshUser(startUser.name);
      if (user === null) {
        logoutUser();
        showLogin('Hesab tapılmadı, yenidən daxil ol');
        return;
      }

      let who = user.name;
      if (user.isAdmin) {
        who = user.name + ' 👑 (admin)';
      }
      card.appendChild(makeTitle('Salam, ' + who + '! Dünya seç'));

      const message = makeMessage(startMessage, false);
      card.appendChild(message);

      for (let index = 0; index < PLOT_COUNT; index++) {
        card.appendChild(makePlotCard(user, index, message));
      }

      const logoutButton = makeButton('Hesabdan çıx', '#64748b');
      logoutButton.addEventListener('click', () => {
        logoutUser();
        showLogin('');
      });
      card.appendChild(logoutButton);
    }

    // Bir dünyanın kartını düzəldir
    function makePlotCard(user, index, message) {
      const plot = user.plots[index];
      const box = makeElement('div', '',
        'border:2px solid rgba(255,255,255,0.2); border-radius:12px; padding:10px; margin:8px 0;' +
        'background:rgba(255,255,255,0.05);');

      box.appendChild(makeElement('div', '🌍 Dünya ' + (index + 1), 'font-weight:800; font-size:16px;'));

      // Boş yer
      if (!plot) {
        box.appendChild(makeElement('div', 'Boş yer. Yeni, təmiz dünya aça bilərsən.', 'font-size:13px; color:#cbd5e1; margin:4px 0;'));
        const newButton = makeButton('➕ Yeni dünya aç', '#3b82f6');
        newButton.addEventListener('click', async () => {
          newButton.disabled = true;
          const result = await createPlot(user.name, index);
          if (result.ok) {
            finish(refreshUser(user.name), index, result.plot);
          } else {
            newButton.disabled = false;
            message.style.color = '#fca5a5';
            message.textContent = result.message;
          }
        });
        box.appendChild(newButton);
        return box;
      }

      // Dolu dünya
      let state = 'Davam edir';
      if (plot.completed) {
        state = '✅ Tamamlanıb';
      }
      const money = Math.floor((plot.state && plot.state.money) || 0);
      const percent = Number(plot.percent || 0).toFixed(1);
      box.appendChild(makeElement('div',
        'Təmizlənib: ' + percent + '%  ·  💰 ' + money + '  ·  ' + state,
        'font-size:13px; color:#cbd5e1; margin:4px 0;'));

      const playButton = makeButton('▶ Oyna');
      playButton.addEventListener('click', () => {
        finish(user, index, plot);
      });
      box.appendChild(playButton);

      const canDelete = plot.completed === true || user.isAdmin === true;
      const deleteButton = makeButton('🗑 Dünyanı sil', '#ef4444');
      if (!canDelete) {
        deleteButton.disabled = true;
        deleteButton.style.background = '#475569';
        deleteButton.style.color = '#94a3b8';
        deleteButton.style.cursor = 'default';
        box.appendChild(deleteButton);
        box.appendChild(makeElement('div', 'Silmək üçün əvvəlcə dünyanı bitir.', 'font-size:12px; color:#94a3b8;'));
        return box;
      }

      deleteButton.addEventListener('click', async () => {
        const sure = window.confirm('Dünya ' + (index + 1) + ' həmişəlik silinəcək. Əminsən?');
        if (!sure) { return; }
        deleteButton.disabled = true;
        const result = await deletePlot(user.name, index);
        if (result.ok) {
          showPlots(user, 'Dünya ' + (index + 1) + ' silindi. İndi yeni dünya aça bilərsən.');
        } else {
          deleteButton.disabled = false;
          message.style.color = '#fca5a5';
          message.textContent = result.message;
        }
      });
      box.appendChild(deleteButton);
      return box;
    }

    // Əvvəl daxil olmuş hesab varsa, birbaşa dünya seçiminə keçirik
    const current = getCurrentUser();
    if (current !== null) {
      showPlots(current, '');
    } else {
      showLogin('');
    }
  });
}

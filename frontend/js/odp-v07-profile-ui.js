(function () {
  'use strict';
  const copy = {
    en: { title:'Profile',home:'Home',verify:'Verify',intro:'Connect your own wallet to check or register a profile.',connect:'Connect wallet',role:'Profile type',roleC:'C — individual creator',roleB:'B — brand',roleP:'P — expert or institution',roleM:'M — museum',warning:'Registration is public and irreversible. The wallet will show the network fee. Keep your wallet recovery phrase private.',confirm:'I understand and want to register this profile.',register:'Register profile',connecting:'Checking wallet and registry…',ready:'Wallet ready. Choose a profile type.',registered:'Registered profile: ',unresolved:'A previous registration may still be pending. Check again later; a new request will not be sent.',submitted:'Request sent. Check again after confirmation. Transaction: ',rejected:'Request rejected in the wallet.',error:'Could not check the wallet or registry. Use one account on Polygon and try again.',changed:'Wallet changed. Connect again.',switch:'Change language to Russian' },
    ru: { title:'Профиль',home:'Главная',verify:'Проверить',intro:'Подключите свой кошелёк, чтобы проверить или зарегистрировать профиль.',connect:'Подключить кошелёк',role:'Тип профиля',roleC:'C — индивидуальный автор',roleB:'B — бренд',roleP:'P — эксперт или организация',roleM:'M — музей',warning:'Регистрация публичная и необратимая. Комиссию сети покажет кошелёк. Не сообщайте никому секретную фразу восстановления.',confirm:'Я понимаю условия и хочу зарегистрировать профиль.',register:'Зарегистрировать профиль',connecting:'Проверяем кошелёк и реестр…',ready:'Кошелёк готов. Выберите тип профиля.',registered:'Зарегистрированный профиль: ',unresolved:'Предыдущая регистрация может ещё выполняться. Проверьте позже: повторный запрос не будет отправлен.',submitted:'Запрос отправлен. Проверьте результат после подтверждения. Транзакция: ',rejected:'Запрос отклонён в кошельке.',error:'Не удалось проверить кошелёк или реестр. Выберите один аккаунт в сети Polygon и попробуйте снова.',changed:'Кошелёк изменился. Подключите его снова.',switch:'Switch language to English' },
  };
  const connect = document.getElementById('connect'), form = document.getElementById('registration'), status = document.getElementById('status');
  const role = document.getElementById('role'), confirm = document.getElementById('confirm'), language = document.getElementById('language');
  const confirmation = document.getElementById('confirmation'), review = document.getElementById('review'), back = document.getElementById('back'), selection = document.getElementById('selection');
  Object.assign(copy.en, { review:'Review registration', reviewTitle:'Confirm profile registration', back:'Back', warning:'The profile type is permanent and bound to this account forever. ODP cannot recover, block or move it. If you lose account access, you can no longer issue under this profile. Registration is public and irreversible.', backup:'You are responsible for your wallet backup. Never share your recovery phrase.', safeAdvice:'For an organisation, consider a multisignature wallet with at least two owners on separate devices.' });
  Object.assign(copy.ru, { review:'Проверить перед регистрацией', reviewTitle:'Подтверждение регистрации профиля', back:'Назад', warning:'Тип профиля нельзя изменить: он навсегда привязан к этому аккаунту. ODP не может восстановить, заблокировать или перенести профиль. Потеря доступа к аккаунту прекращает выпуск под этим номером профиля. Регистрация публичная и необратимая.', backup:'Вы сами отвечаете за резервную копию кошелька. Никому не сообщайте секретную фразу.', safeAdvice:'Для организации рассмотрите мультиподписной кошелёк как минимум с двумя владельцами на разных устройствах.' });
  Object.assign(copy.en,{connectSafe:'Connect Safe App',safe_pending:'Safe proposal is awaiting signatures or execution.',safePersonal:'A personal C profile cannot use Safe.'});
  Object.assign(copy.ru,{connectSafe:'Подключить Safe App',safe_pending:'Предложение Safe ожидает подписей или исполнения.',safePersonal:'Личный профиль C нельзя зарегистрировать через Safe.'});
  copy.en.connectMobile='Mobile wallet · WalletConnect'; copy.ru.connectMobile='Мобильный кошелёк · WalletConnect';
  let locale; try { locale = localStorage.getItem('odp_locale'); } catch (_) {}
  if (!['en','ru'].includes(locale)) locale = (navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  let state = { key: 'intro' }, current = null, reviewedRole = null, busy = false;
  function render() {
    document.documentElement.lang = locale;
    document.querySelectorAll('[data-copy]').forEach(el => { el.textContent = copy[locale][el.dataset.copy]; });
    language.textContent = locale === 'en' ? 'RU' : 'EN'; language.setAttribute('aria-label', copy[locale].switch);
    status.textContent = (copy[locale][state.key] || '') + (state.value || '');
    connect.disabled = busy; document.getElementById('connectMobile').disabled = busy; document.getElementById('connectSafe').disabled = busy; form.querySelectorAll('button').forEach(button => { button.disabled = busy; });
  }
  language.addEventListener('click', () => { locale = locale === 'en' ? 'ru' : 'en'; try { localStorage.setItem('odp_locale', locale); } catch (_) {} render(); });
  function closeReview() { confirmation.hidden = true; reviewedRole = null; confirm.checked = false; }
  function invalidate() { current = null; form.hidden = true; closeReview(); state = { key: 'changed' }; render(); }
  review.addEventListener('click', () => { if (!current || busy) return; if(current.sdk && role.value==='C'){state={key:'safePersonal'};render();return;} reviewedRole = role.value; selection.textContent = role.options[role.selectedIndex].textContent + ' · ' + current.wallet; document.getElementById('safeAdvice').hidden = reviewedRole === 'C'; confirmation.hidden = false; confirm.checked = false; });
  back.addEventListener('click', closeReview);
  role.addEventListener('change', closeReview);
  async function connectWith(kind) {
    if (busy) return; busy = true; current = null; form.hidden = true; closeReview(); state = { key: 'connecting' }; render();
    try {
      const eth = await ODPV07Wallet.connect(kind);
      if (!eth || !window.ethers || !window.ODPV07Reader) throw new Error('Unavailable');
      const accounts = await eth.request({ method: kind === 'injected' ? 'eth_requestAccounts' : 'eth_accounts' });
      if (!Array.isArray(accounts) || accounts.length !== 1 || !ethers.utils.isAddress(accounts[0]) || Number(await eth.request({ method:'eth_chainId' })) !== 137) throw new Error('Wrong wallet');
      const response = await fetch('backend/config/odp-0.7/ObjectDigitalPassport.json'); if (!response.ok) throw new Error('ABI unavailable');
      const abi = await response.json(), provider = new ethers.providers.Web3Provider(eth, 'any');
      const reader = await ODPV07Reader.open(provider, abi, ethers), result = await reader.readProfileByWallet(accounts[0]);
      const live = await eth.request({ method:'eth_accounts' });
      if (!Array.isArray(live) || live.length !== 1 || live[0].toLowerCase() !== accounts[0].toLowerCase() || Number(await eth.request({ method:'eth_chainId' })) !== 137) throw new Error('Wallet changed');
      current = { wallet: accounts[0], eth, reader, abi, sdk:eth.odpSafeSdk||null };
      ODPV07Wallet.watch(eth, provider => { if (current && current.eth === provider) invalidate(); });
      if (result.profile) state = { key:'registered', value:result.profile.creatorId };
      else { state = { key:'ready' }; form.hidden = false; }
    } catch (_) { current = null; state = { key:'error' }; }
    finally { busy = false; render(); }
  }
  connect.addEventListener('click',()=>void connectWith('injected'));
  document.getElementById('connectMobile').addEventListener('click',()=>void connectWith('walletconnect'));
  document.getElementById('connectSafe').addEventListener('click',()=>void connectWith('safe'));
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !current || !confirm.checked || confirmation.hidden || reviewedRole !== role.value) return;
    busy = true; state = { key:'connecting' }; render();
    try {
      const args={ role:role.value, wallet:current.wallet, ethereum:current.eth, reader:current.reader, abi:current.abi, ethers, storage:localStorage, locks:navigator.locks };
      const result=current.sdk?await ODPV07Profile.registerSafe({...args,sdk:current.sdk}):await ODPV07Profile.register(args);
      if (result.state === 'registered') { state = { key:'registered', value:result.profile.creatorId }; form.hidden = true; }
      else if (result.state === 'submitted') { state = { key:'submitted', value:result.hash }; form.hidden = true; }
      else { state = { key:result.state }; if (result.state === 'unresolved' || result.state === 'safe_pending') form.hidden = true; }
    } catch (_) { state = { key:'error' }; form.hidden = true; }
    finally { busy = false; closeReview(); render(); }
  });
  render();
})();

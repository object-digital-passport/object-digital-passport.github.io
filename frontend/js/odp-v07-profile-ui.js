(function (initializeWorkflow) {
  'use strict';
  const copy = {
    en: { title:'Profile',home:'Home',verify:'Verify',intro:'Connect your own wallet to check or register a profile.',role:'Profile type',roleC:'C — individual creator',roleB:'B — brand',roleP:'P — expert or institution',roleM:'M — museum',warning:'Registration is public and irreversible. The wallet will show the network fee. Keep your wallet recovery phrase private.',confirm:'I understand and want to register this profile.',register:'Register profile',connecting:'Checking wallet and registry…',ready:'Wallet ready. Choose a profile type.',registered:'Registered profile: ',unresolved:'A previous registration may still be pending. Check again later; a new request will not be sent.',submitted:'Request sent. Check again after confirmation. Transaction: ',rejected:'Request rejected in the wallet.',error:'Could not check the wallet or registry. Use one account on Polygon and try again.',changed:'Wallet changed. Connect again.' },
    ru: { title:'Профиль',home:'Главная',verify:'Проверить',intro:'Подключите свой кошелёк, чтобы проверить или зарегистрировать профиль.',role:'Тип профиля',roleC:'C — индивидуальный автор',roleB:'B — бренд',roleP:'P — эксперт или организация',roleM:'M — музей',warning:'Регистрация публичная и необратимая. Комиссию сети покажет кошелёк. Не сообщайте никому секретную фразу восстановления.',confirm:'Я понимаю условия и хочу зарегистрировать профиль.',register:'Зарегистрировать профиль',connecting:'Проверяем кошелёк и реестр…',ready:'Кошелёк готов. Выберите тип профиля.',registered:'Зарегистрированный профиль: ',unresolved:'Предыдущая регистрация может ещё выполняться. Проверьте позже: повторный запрос не будет отправлен.',submitted:'Запрос отправлен. Проверьте результат после подтверждения. Транзакция: ',rejected:'Запрос отклонён в кошельке.',error:'Не удалось проверить кошелёк или реестр. Выберите один аккаунт в сети Polygon и попробуйте снова.',changed:'Кошелёк изменился. Подключите его снова.' },
  };
  Object.assign(copy.en, { review:'Review registration', reviewTitle:'Confirm profile registration', back:'Back', warning:'The profile type is permanent and bound to this account forever. ODP cannot recover, block or move it. If you lose account access, you can no longer issue under this profile. Registration is public and irreversible.', backup:'You are responsible for your wallet backup. Never share your recovery phrase.', safeAdvice:'For an organisation, consider a multisignature wallet with at least two owners on separate devices.' });
  Object.assign(copy.ru, { review:'Проверить перед регистрацией', reviewTitle:'Подтверждение регистрации профиля', back:'Назад', warning:'Тип профиля нельзя изменить: он навсегда привязан к этому аккаунту. ODP не может восстановить, заблокировать или перенести профиль. Потеря доступа к аккаунту прекращает выпуск под этим номером профиля. Регистрация публичная и необратимая.', backup:'Вы сами отвечаете за резервную копию кошелька. Никому не сообщайте секретную фразу.', safeAdvice:'Для организации рассмотрите мультиподписной кошелёк как минимум с двумя владельцами на разных устройствах.' });
  copy.en.locksUnavailable='This browser cannot safely register a profile. Open the HTTPS site in an updated browser and try again.';
  copy.ru.locksUnavailable='Этот браузер не может безопасно зарегистрировать профиль. Откройте сайт по HTTPS в обновлённом браузере и попробуйте снова.';

  Object.assign(copy.en, {
    connect:'Connect with WalletConnect',
    disconnect:'Disconnect wallet',
    disconnected:'Wallet disconnected.',
    walletHelp:'Choose your wallet in WalletConnect and approve the connection.',
    connectError:'Could not connect. Open WalletConnect again and select one account on Polygon.'
  });
  Object.assign(copy.ru, {
    connect:'Подключить через WalletConnect',
    disconnect:'Отключить кошелёк',
    disconnected:'Кошелёк отключён.',
    walletHelp:'Выберите кошелёк в WalletConnect и подтвердите подключение.',
    connectError:'Не удалось подключиться. Откройте WalletConnect снова и выберите один аккаунт в сети Polygon.'
  });

  window.ODPLocale?.mountPage("profile-07", copy, initializeWorkflow);
})(function (i18n) {
  'use strict';
  const { translate: t } = i18n;
  const connect = document.getElementById('connect'), form = document.getElementById('registration'), status = document.getElementById('status');
  const role = document.getElementById('role'), confirm = document.getElementById('confirm'), language = document.getElementById('language');
  const confirmation = document.getElementById('confirmation'), review = document.getElementById('review'), back = document.getElementById('back'), selection = document.getElementById('selection');
  let state = { key: null }, current = null, reviewedRole = null, busy = false;
  function render() {
    if (!confirmation.hidden) selection.textContent = role.options[role.selectedIndex].textContent + ' · ' + current.wallet;
    status.textContent = (t(state.key) || '') + (state.value || '');
    connect.disabled = busy; connect.hidden = !!current;
    document.getElementById('disconnect').hidden = !current;
    document.getElementById('disconnect').disabled = busy;
    document.getElementById('walletHelp').hidden = !!current; form.querySelectorAll('button').forEach(button => { button.disabled = busy; });
  }
  language.addEventListener('odp:localechange', render);
  function closeReview() { confirmation.hidden = true; reviewedRole = null; confirm.checked = false; }
  function invalidate(key = 'changed') { current = null; form.hidden = true; closeReview(); state = { key }; render(); }
  review.addEventListener('click', () => { if (!current || busy) return; reviewedRole = role.value; selection.textContent = role.options[role.selectedIndex].textContent + ' · ' + current.wallet; confirmation.hidden = false; confirm.checked = false; confirmation.querySelector('h2').focus(); });
  back.addEventListener('click', () => { closeReview(); review.focus(); });
  role.addEventListener('change', closeReview);
  async function connectWith() {
    if (busy) return; busy = true; current = null; form.hidden = true; closeReview(); state = { key: 'connecting' }; render();
    try {
      const eth = await ODPV07Wallet.connect();
      if (!eth || !window.ethers || !window.ODPV07Reader) throw new Error('Unavailable');
      const accounts = await eth.request({ method: 'eth_accounts' });
      if (!Array.isArray(accounts) || accounts.length !== 1 || !ethers.utils.isAddress(accounts[0]) || Number(await eth.request({ method:'eth_chainId' })) !== 137) throw new Error('Wrong wallet');
      const response = await fetch('backend/config/odp-0.7/ObjectDigitalPassport.json'); if (!response.ok) throw new Error('ABI unavailable');
      const abi = await response.json(), provider = new ethers.providers.Web3Provider(eth, 'any');
      const reader = await ODPV07Reader.open(provider, abi, ethers), result = await reader.readProfileByWallet(accounts[0]);
      const live = await eth.request({ method:'eth_accounts' });
      if (!Array.isArray(live) || live.length !== 1 || live[0].toLowerCase() !== accounts[0].toLowerCase() || Number(await eth.request({ method:'eth_chainId' })) !== 137) throw new Error('Wallet changed');
      current = { wallet: accounts[0], eth, reader, abi };
      ODPV07Wallet.watch(eth, provider => { if (current && current.eth === provider) invalidate(); });
      if (result.profile) state = { key:'registered', value:result.profile.creatorId };
      else { state = { key:'ready' }; form.hidden = false; }
    } catch (_) { current = null; state = { key:'connectError' }; }
    finally { busy = false; render(); }
  }
  document.getElementById('connect').addEventListener('click', () => void connectWith());
  document.getElementById('disconnect').addEventListener('click', async () => {
    if (busy || !current) return;
    invalidate('disconnected');
    busy = true; render();
    try { await ODPV07Wallet.disconnect(); } finally { busy = false; render(); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !current || !confirm.checked || confirmation.hidden || reviewedRole !== role.value) return;
    if (!ODPV07Wallet.supportsWrites()) { state = { key:'locksUnavailable' }; render(); return; }
    busy = true; state = { key:'connecting' }; render();
    try {
      const args={ role:role.value, wallet:current.wallet, ethereum:current.eth, reader:current.reader, abi:current.abi, ethers, storage:localStorage, locks:navigator.locks };
      const result=await ODPV07Profile.register(args);
      if (result.state === 'registered') { state = { key:'registered', value:result.profile.creatorId }; form.hidden = true; }
      else if (result.state === 'submitted') { state = { key:'submitted', value:result.hash }; form.hidden = true; }
      else { state = { key:result.state }; if (result.state === 'unresolved' || result.state === 'safe_pending') form.hidden = true; }
    } catch (_) { state = { key:'error' }; form.hidden = true; }
    finally { busy = false; closeReview(); render(); }
  });
  render();
});

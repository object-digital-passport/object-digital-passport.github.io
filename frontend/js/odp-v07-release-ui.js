(function (initializeWorkflow) {
  'use strict';
  const copy={en:{title:'Passport actions',home:'Home',create:'Create passport',verify:'Verify',intro:'Connect the issuing wallet to withdraw a passport or confirm it for print.',passport:'Passport ID',load:'Load passport',actions:'Choose an action',action:'Action',revoke:'Withdraw passport',finalize:'Confirm for print',reason:'Reason for withdrawal',reasonNote:'Only a hash of this reason is published; keep the text yourself if you need it. Do not include secrets.',review:'Review action',confirmTitle:'Confirm action',warning:'This action is permanent. Confirming for print ends the withdrawal window immediately. A withdrawn passport remains visible as withdrawn.',agree:'I understand and want to continue.',send:'Confirm in wallet',back:'Back',connecting:'Checking wallet and registry…',ready:'Wallet connected: ',invalid:'Could not complete this step. Check the passport, issuing wallet and network.',deadline:'Withdrawal deadline: ',loaded:'Passport loaded.',submitted:'Request submitted. Check the passport again after confirmation.',unresolved:'The outcome is unknown or still pending. Check the passport later; no second request was sent.',completed:'This action is already recorded.',expired:'The withdrawal window has expired.',finalized:'This passport is already confirmed for print.',revoked:'This passport is withdrawn.',rejected:'Request rejected in the wallet.',changed:'Wallet changed. Reconnect to continue.',reasonMissing:'Enter a reason for withdrawal.'},ru:{title:'Действия с паспортом',home:'Главная',create:'Создать паспорт',verify:'Проверить',intro:'Подключите кошелёк издателя, чтобы отозвать паспорт или подтвердить его для печати.',passport:'Номер паспорта',load:'Загрузить паспорт',actions:'Выберите действие',action:'Действие',revoke:'Отозвать паспорт',finalize:'Подтвердить для печати',reason:'Причина отзыва',reasonNote:'Публикуется только хеш причины. Сохраните текст самостоятельно, если он нужен. Не указывайте секретные данные.',review:'Проверить действие',confirmTitle:'Подтвердить действие',warning:'Действие необратимо. Подтверждение для печати сразу завершает срок отзыва. Отозванный паспорт остаётся видимым с отметкой об отзыве.',agree:'Я понимаю последствия и хочу продолжить.',send:'Подтвердить в кошельке',back:'Назад',connecting:'Проверяем кошелёк и реестр…',ready:'Кошелёк подключён: ',invalid:'Не удалось выполнить действие. Проверьте паспорт, кошелёк издателя и сеть.',deadline:'Срок отзыва до: ',loaded:'Паспорт загружен.',submitted:'Запрос отправлен. Проверьте паспорт после подтверждения.',unresolved:'Результат неизвестен или запрос ещё обрабатывается. Проверьте паспорт позже; повторный запрос не отправлен.',completed:'Это действие уже записано.',expired:'Срок отзыва истёк.',finalized:'Паспорт уже подтверждён для печати.',revoked:'Паспорт отозван.',rejected:'Запрос отклонён в кошельке.',changed:'Кошелёк изменился. Подключите его снова.',reasonMissing:'Укажите причину отзыва.'}};
  copy.en.locksUnavailable='This browser cannot safely perform this action. Open the HTTPS site in an updated browser and try again.';
  copy.ru.locksUnavailable='Этот браузер не может безопасно выполнить действие. Откройте сайт по HTTPS в обновлённом браузере и попробуйте снова.';

  Object.assign(copy.en, {
    connect:'Connect with WalletConnect',
    disconnect:'Disconnect wallet',
    disconnected:'Wallet disconnected.',
    walletHelp:'Choose your wallet in WalletConnect and approve the connection.',
    connectError:'Could not connect. Open WalletConnect again and select one account on Polygon.',
    actionPlaceholder:'Choose an action',
    invalidId:'Enter a passport ID such as ODP-2026-09-000000001.',
    loadingPassport:'Looking up the passport…',
    loadError:'Could not load this passport. Check the ID and try again.',
    differentIssuer:'This passport was issued from a different wallet. Connect the wallet that issued it.'
  });
  Object.assign(copy.ru, {
    connect:'Подключить через WalletConnect',
    disconnect:'Отключить кошелёк',
    disconnected:'Кошелёк отключён.',
    walletHelp:'Выберите кошелёк в WalletConnect и подтвердите подключение.',
    connectError:'Не удалось подключиться. Откройте WalletConnect снова и выберите один аккаунт в сети Polygon.',
    actionPlaceholder:'Выберите действие',
    invalidId:'Введите номер паспорта, например ODP-2026-09-000000001.',
    loadingPassport:'Ищем паспорт в реестре…',
    loadError:'Не удалось загрузить паспорт. Проверьте номер и попробуйте снова.',
    differentIssuer:'Этот паспорт выпущен с другого кошелька. Подключите кошелёк, с которого его выпустили.'
  });

  window.ODPLocale?.mountPage("release-07", copy, initializeWorkflow);
})(function (i18n) {
  'use strict';
  const { translate: t, getLocale } = i18n;
  const $=id=>document.getElementById(id);
  let busy=false,current=null,record=null,pending=null,statusKey='',statusValue='';
  function render(){$('status').textContent=(statusKey?t(statusKey):'')+statusValue;$('connect').disabled=busy;$('connect').hidden=!!current;$('disconnect').disabled=busy;$('disconnect').hidden=!current;$('walletHelp').hidden=!!current;$('send').disabled=busy||!pending||!$('confirm').checked;$('review').disabled=busy||!$('action').value;}
  function status(key,value=''){statusKey=key;statusValue=value;render();}
  function invalidate(key='changed'){current=null;clearRecord();$('lookup').hidden=true;status(key);}
  $('language').addEventListener('odp:localechange', render);
  async function connectWith(){if(busy)return;busy=true;status('connecting');try{const eth=await ODPV07Wallet.connect();if(!eth||!window.ethers)throw Error('wallet');const accounts=await eth.request({method:'eth_accounts'});if(!Array.isArray(accounts)||accounts.length!==1||!ethers.utils.isAddress(accounts[0])||Number(await eth.request({method:'eth_chainId'}))!==137)throw Error('wallet');const response=await fetch('backend/config/odp-0.7/ObjectDigitalPassport.json');if(!response.ok)throw Error('abi');const abi=await response.json(),provider=new ethers.providers.Web3Provider(eth,'any'),reader=await ODPV07Reader.open(provider,abi,ethers),live=await eth.request({method:'eth_accounts'});if(!Array.isArray(live)||live.length!==1||live[0].toLowerCase()!==accounts[0].toLowerCase()||Number(await eth.request({method:'eth_chainId'}))!==137)throw Error('changed');current={eth,wallet:accounts[0],abi,reader};ODPV07Wallet.watch(eth,provider=>{if(current&&current.eth===provider)invalidate();});$('lookup').hidden=false;$('actions').hidden=true;$('confirmation').hidden=true;status('ready',accounts[0]);}catch(_){invalidate();status('connectError');}finally{busy=false;render();}}
  document.getElementById('connect').addEventListener('click', () => void connectWith());
  document.getElementById('disconnect').addEventListener('click', async () => {
    if (busy || !current) return;
    invalidate('disconnected');
    busy = true; render();
    try { await ODPV07Wallet.disconnect(); } finally { busy = false; render(); }
  });
  function clearRecord() {
    record = null;
    pending = null;
    $('actions').hidden = true;
    $('confirmation').hidden = true;
    $('action').value = '';
    $('reason').value = '';
    $('reasonGroup').hidden = true;
    $('confirm').checked = false;
  }
  const passportId = $('passportId');
  function enteredId() { return passportId.value.trim().toUpperCase(); }
  $('lookup').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !current) return;
    const session = current;
    const id = enteredId();
    clearRecord();
    if (!/^ODP-\d{4}-(0[1-9]|1[0-2])-\d{9}$/.test(id)) {
      status('invalidId');
      passportId.focus();
      return;
    }
    busy = true;
    status('loadingPassport');
    try {
      const found = await session.reader.readPassport(id);
      if (current !== session || enteredId() !== id) return;
      if (!found) { status('loadError'); return; }
      if (String(found.header.creator).toLowerCase() !== session.wallet.toLowerCase()) {
        status('differentIssuer');
        return;
      }
      record = found;
      $('record').textContent = found.header.passportId + ' · ' + found.header.title + '\n'
        + t('deadline') + new Date(Number(found.release.revocationDeadline) * 1000).toLocaleString(getLocale());
      $('actions').hidden = false;
      status('loaded');
    } catch (_) {
      if (current === session && enteredId() === id) status('loadError');
    } finally {
      busy = false;
      render();
    }
  });
  passportId.addEventListener('input', () => {
    if (!current) return;
    clearRecord();
    status('ready', current.wallet);
  });
  $('action').addEventListener('change', () => {
    $('reasonGroup').hidden = $('action').value !== 'revoke';
    render();
  });
  $('review').addEventListener('click',()=>{if(!record||!current||busy)return;try{const action=$('action').value,reason=$('reason').value.trim();if(action==='revoke'&&!reason){status('reasonMissing');$('reason').focus();return;}const reasonHash=action==='revoke'?ethers.utils.keccak256(ethers.utils.toUtf8Bytes(reason.normalize('NFC'))):undefined;const plan=ODPV07Release.prepare({action,passportId:record.header.passportId,reasonHash,record,wallet:current.wallet,abi:current.abi,ethers});if(plan.state!=='ready'){status(plan.state);return;}pending={action,passportId:record.header.passportId,reasonHash};$('summary').textContent=t(action)+' · '+pending.passportId+'\n'+current.wallet+'\n'+t('deadline')+new Date(Number(plan.deadline)*1000).toLocaleString(getLocale())+(reasonHash?'\n'+reasonHash:'');$('confirm').checked=false;$('actions').hidden=true;$('confirmation').hidden=false;$('confirmation').querySelector('h2').focus();render();}catch(_){status('invalid');}});
  $('confirm').addEventListener('change',render);$('back').addEventListener('click',()=>{pending=null;$('confirmation').hidden=true;$('actions').hidden=false;render();$('review').focus();});
  $('send').addEventListener('click',async()=>{if(!pending||!current||!$('confirm').checked||busy)return;if(!ODPV07Wallet.supportsWrites()){status('locksUnavailable');return;}busy=true;render();try{const args={...pending,wallet:current.wallet,reader:current.reader,ethereum:current.eth,storage:localStorage,locks:navigator.locks,abi:current.abi,ethers};const result=await ODPV07Release.send(args);pending=null;$('confirm').checked=false;$('confirmation').hidden=true;$('actions').hidden=true;status(result.state);}catch(_){status('invalid');}finally{busy=false;render();}});
  render();
});

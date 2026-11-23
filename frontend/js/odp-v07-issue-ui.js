(function (initializeWorkflow) {
  'use strict';
  const en = { title:'Create a passport',home:'Home',profile:'Profile',verify:'Verify',manage:'Passport actions',intro:'Connect your own wallet with an ODP 0.7 profile to prepare a unique passport.',type:'Object type',physical:'Physical',digital:'Digital',mixed:'Physical and digital',objectTitle:'Title',author:'Author name declared by issuer',description:'Short description',domain:'Domain or field',contentClass:'Content class',static:'Static',timeBased:'Time-based',spatial:'Spatial',textual:'Textual',composite:'Composite',executable:'Executable',lifecycle:'Object status',produced:'Produced',concept:'Concept',prototype:'Prototype',archived:'Archived',ai:'AI involvement',aiNone:'None',aiAssisted:'Assisted',aiGenerated:'Generated',physicalDetails:'Physical object',photo:'Original photo',width:'Width',height:'Height',unit:'Unit',materials:'Materials, separated by commas',features:'Distinguishing features',category:'Category',digitalDetails:'Digital original',digitalFile:'Original file',subtype:'Digital type',fileFormat:'File format',prepare:'Prepare passport',review:'Review before issuing',warning:'The public card, hashes, issuer profile and registration time become permanent. The card cannot be edited. The author name is your declaration. Withdrawal is limited; the exact deadline is set by the registry at issuance. ODP cannot recover, block or move the issuer profile. You are responsible for your wallet backup.',confirm:'I reviewed these details and want to issue permanently.',issue:'Issue permanently',check:'Check issuance status',downloadPassport:'Download .odpass',connecting:'Checking wallet and registry…',ready:'Profile ready: ',needProfile:'Register an ODP 0.7 profile first.',invalid:'Could not complete this step. Check the fields, wallet and network.',prepared:'Passport prepared. Review the details and confirm to issue it.',submitted:'Request sent. Keep this page open and check the status after confirmation.',unresolved:'The result is unknown. Check your wallet and the issuance status before trying again.',minted:'Passport registered: ',rejected:'Request rejected in the wallet.',saved:'Archive verified. Save the downloaded file.',changed:'Wallet changed. Reconnect to continue.',fileLimit:'Select files no larger than 50 MiB each.',deadline:'Withdrawal window: ',hours:' hours from registration. The exact deadline is recorded at issuance.',network:'Network: Polygon · Generation: 0.7-redesign-8',fingerprint:'Job fingerprint',files:'Original hashes',retryWarning:'Only continue after checking all devices and your wallet history: another signed or pending request for this job may still be sent. The site checks the known failed transaction and the connected node, but cannot see every wallet or pending transaction.',retryAgree:'I checked that no other request for this job is pending or can still be sent.',retryFailed:'Check failed transaction and prepare retry',retryReady:'The failed transaction was verified. Review the details and confirm to retry.',transactionHash:'Mint transaction hash from your wallet',receiptHelp:'The transaction will be checked against the finalized registry before export.',noReceipt:'The transaction could not be verified. Check its hash and try again after finalization.',switch:'Change language to Russian' };
  const ru = { title:'Создать паспорт',home:'Главная',profile:'Профиль',verify:'Проверить',manage:'Действия с паспортом',intro:'Подключите свой кошелёк с профилем ODP 0.7, чтобы подготовить уникальный паспорт.',type:'Тип объекта',physical:'Физический',digital:'Цифровой',mixed:'Физический и цифровой',objectTitle:'Название',author:'Имя автора по заявлению издателя',description:'Краткое описание',domain:'Область',contentClass:'Класс содержимого',static:'Статичное',timeBased:'Во времени',spatial:'Пространственное',textual:'Текстовое',composite:'Составное',executable:'Исполняемое',lifecycle:'Статус объекта',produced:'Создан',concept:'Концепция',prototype:'Прототип',archived:'В архиве',ai:'Участие ИИ',aiNone:'Нет',aiAssisted:'С помощью ИИ',aiGenerated:'Создано ИИ',physicalDetails:'Физический объект',photo:'Оригинал фотографии',width:'Ширина',height:'Высота',unit:'Единица',materials:'Материалы через запятую',features:'Отличительные признаки',category:'Категория',digitalDetails:'Цифровой оригинал',digitalFile:'Оригинальный файл',subtype:'Тип цифрового объекта',fileFormat:'Формат файла',prepare:'Подготовить паспорт',review:'Проверить перед выпуском',warning:'Карточка, хеши, профиль издателя и время регистрации станут публичными навсегда. Карточку нельзя изменить. Имя автора — ваше заявление. Отзыв ограничен по времени; точный срок установит реестр при выпуске. ODP не может восстановить, заблокировать или перенести профиль издателя. Вы сами отвечаете за резервную копию кошелька.',confirm:'Я проверил данные и хочу выпустить паспорт навсегда.',issue:'Выпустить навсегда',check:'Проверить статус выпуска',downloadPassport:'Скачать .odpass',connecting:'Проверяем кошелёк и реестр…',ready:'Профиль готов: ',needProfile:'Сначала зарегистрируйте профиль ODP 0.7.',invalid:'Не удалось выполнить действие. Проверьте данные, кошелёк и сеть.',prepared:'Паспорт подготовлен. Проверьте данные и подтвердите выпуск.',submitted:'Запрос отправлен. Оставьте эту страницу открытой и проверьте статус после подтверждения.',unresolved:'Результат неизвестен. Перед повторной попыткой проверьте кошелёк и статус выпуска.',minted:'Паспорт зарегистрирован: ',rejected:'Запрос отклонён в кошельке.',saved:'Архив проверен. Сохраните загруженный файл.',changed:'Кошелёк изменился. Подключите его снова.',fileLimit:'Выберите файлы размером не более 50 МиБ каждый.',deadline:'Срок отзыва: ',hours:' ч с момента регистрации. Точный срок будет записан при выпуске.',network:'Сеть: Polygon · Поколение: 0.7-redesign-8',fingerprint:'Отпечаток задания',files:'Хеши оригиналов',retryWarning:'Продолжайте только после проверки всех устройств и истории кошелька: другой подписанный или ожидающий запрос может быть отправлен. Сайт проверяет известную неуспешную транзакцию и подключённый узел, но не видит все кошельки и ожидающие запросы.',retryAgree:'Я проверил, что других ожидающих или готовых к отправке запросов для этого задания нет.',retryFailed:'Проверить ошибку и подготовить повтор',retryReady:'Неуспешная транзакция проверена. Проверьте данные и подтвердите повторный выпуск.',transactionHash:'Хеш транзакции выпуска из вашего кошелька',receiptHelp:'Перед экспортом транзакция будет проверена по финализированному реестру.',noReceipt:'Не удалось проверить транзакцию. Проверьте хеш и повторите после финализации.',switch:'Switch language to English' };
  Object.assign(en,{unsentWarning:'Only continue if you know this job was never sent or signed on any device. The connected node cannot see every wallet or private pending transaction. If another copy is sent later, it may fail and cost a network fee.',unsentAgree:'I checked every wallet and device: no signed or pending request for this job exists.',unsentButton:'Check wallet and prepare the saved job',unsentReady:'The saved job is ready to review. Its operation ID is unchanged; confirm the details before sending.'});
  Object.assign(ru,{unsentWarning:'Продолжайте, только если знаете, что задание не отправлялось и не подписывалось ни на одном устройстве. Подключённый узел не видит все кошельки и приватные ожидающие транзакции. Если другая копия будет отправлена позже, она может завершиться ошибкой с оплатой комиссии.',unsentAgree:'Я проверил все кошельки и устройства: подписанных и ожидающих запросов для задания нет.',unsentButton:'Проверить кошелёк и подготовить задание',unsentReady:'Задание готово к проверке. Его идентификатор не изменился; подтвердите данные перед отправкой.'});
  Object.assign(en,{photoPreview:'Original photo for this passport',photoInvalid:'The original photo cannot be displayed. Choose a valid image before issuing.',editDraft:'Edit details',editing:'Edit the details, select the original files again and prepare a new job.'});
  Object.assign(ru,{photoPreview:'Оригинальная фотография для этого паспорта',photoInvalid:'Не удалось показать оригинальную фотографию. Перед выпуском выберите корректное изображение.',editDraft:'Изменить данные',editing:'Измените данные, заново выберите оригиналы и подготовьте новое задание.'});
  Object.assign(en,{digitalReview:'Review the digital original',digitalUnavailable:'Preview is unavailable; download and review the original file.',downloadOriginal:'Download the exact original',digitalAgree:'I reviewed this digital original.',digitalImageAlt:'Digital original for this passport'});
  Object.assign(ru,{digitalReview:'Проверьте цифровой оригинал',digitalUnavailable:'Предпросмотр недоступен: скачайте и проверьте оригинальный файл.',downloadOriginal:'Скачать точный оригинал',digitalAgree:'Я проверил цифровой оригинал.',digitalImageAlt:'Цифровой оригинал для этого паспорта'});
  en.safe_pending='Safe proposal is awaiting confirmation or execution. No second request was sent.'; en.safe_expired='The Safe proposal has passed its execution deadline. If it was not mined in time, it cannot execute; inspect the Safe queue before taking action.'; en.safeDetails='Safe proposal · nonce';
  ru.safe_pending='Предложение Safe ожидает подтверждений или исполнения. Повторный запрос не отправлен.'; ru.safe_expired='Срок исполнения предложения Safe истёк. Если оно не попало в блок вовремя, его нельзя исполнить; проверьте очередь Safe перед дальнейшими действиями.'; ru.safeDetails='Предложение Safe · nonce';
  en.executionDeadline='Mint execution deadline'; en.deadlineNear='Less than 24 hours remain on this device clock; co-signers may miss the deadline.'; en.deadlineExpired='The month has ended on this device clock. A transaction not yet mined cannot execute with these inputs.'; en.unique='Unique object · edition size 1';
  ru.executionDeadline='Крайний срок исполнения выпуска'; ru.deadlineNear='По часам этого устройства осталось менее 24 часов; остальные подписанты могут не успеть.'; ru.deadlineExpired='По часам этого устройства месяц закончился. Невключённая в блок транзакция с этими данными не исполнится.'; ru.unique='Уникальный объект · тираж 1';
  en.locksUnavailable='This browser cannot safely issue a passport. Open the HTTPS site in an updated browser and try again.';
  ru.locksUnavailable='Этот браузер не может безопасно выпустить паспорт. Откройте сайт по HTTPS в обновлённом браузере и попробуйте снова.';
  en.preparationTime='Prepared at'; ru.preparationTime='Подготовлено';
  en.registrationTimeNote='The registry records the actual issuance time separately when the transaction is confirmed.';
  ru.registrationTimeNote='Реестр отдельно запишет фактическое время выпуска при подтверждении транзакции.';
  en.appArchiveSizeWarning='These originals may produce an archive larger than the current app import limit of 100 MiB. Reduce their size if you need to import this passport into the app.';
  ru.appArchiveSizeWarning='Из этих оригиналов может получиться архив больше 100 МиБ — текущего ограничения импорта в приложении. Уменьшите файлы, если хотите импортировать паспорт в приложение.';

  Object.assign(en, {
    connect:'Connect with WalletConnect',
    disconnect:'Disconnect wallet',
    disconnected:'Wallet disconnected.',
    walletHelp:'Choose your wallet in WalletConnect and approve the connection.',
    connectError:'Could not connect. Open WalletConnect again and select one account on Polygon.',
    registerProfile:'Register a profile',
  });
  Object.assign(ru, {
    connect:'Подключить через WalletConnect',
    disconnect:'Отключить кошелёк',
    disconnected:'Кошелёк отключён.',
    walletHelp:'Выберите кошелёк в WalletConnect и подтвердите подключение.',
    connectError:'Не удалось подключиться. Откройте WalletConnect снова и выберите один аккаунт в сети Polygon.',
    registerProfile:'Зарегистрировать профиль',
  });

  window.ODPLocale?.mountPage({ en, ru }, initializeWorkflow);
})(function (i18n) {
  'use strict';
  const { translate: t, getLocale } = i18n;
  const $ = id => document.getElementById(id), form=$('draft'), review=$('review'), status=$('status'), confirm=$('confirm');
  let busy=false, current=null, job=null, statusKey='', statusValue='', previewURL=null, digitalURL=null, photoReady=true, photoFailed=false, digitalRequired=false, digitalAvailable=true, digitalFingerprint=null;
  function render() {
    status.textContent=(statusKey?t(statusKey):'')+statusValue;
    $('connect').disabled=busy; $('connect').hidden=!!current; $('disconnect').disabled=busy; $('disconnect').hidden=!current; $('walletHelp').hidden=!!current; $('issue').disabled=busy || !job || job.state!=='prepared' || !confirm.checked || !photoReady || !digitalAvailable || (digitalRequired&&!$('digitalConfirm').checked);
    $('preview').alt=t('photoPreview'); $('photoStatus').textContent=photoFailed?t('photoInvalid'):''; $('editDraft').disabled=busy;
    $('digitalPreviewImage').alt=t('digitalImageAlt'); $('downloadOriginal').disabled=busy||!digitalAvailable;
    $('unsentRecovery').hidden=!(current&&job&&job.state==='handoff'); $('unsentButton').disabled=busy||!$('unsentConfirm').checked; $('retryFailed').disabled=busy||!$('retryConfirm').checked; $('check').disabled=busy; $('downloadPassport').disabled=busy; $('profileRequired').hidden=!current||!!current.profile;
  }
  function showStatus(key,value='') { statusKey=key; statusValue=value; render(); }
  $('language').addEventListener('click', () => { render(); if (job) showReview(); });
  function controls() { const type=$('objectType').value; $('physicalFields').hidden=type==='digital'; $('physicalFields').disabled=type==='digital'; $('digitalFields').hidden=type==='physical'; $('digitalFields').disabled=type==='physical'; }
  $('objectType').addEventListener('change',controls); controls();
  function invalidate(key = 'changed') { current=null; job=null;  if(previewURL)URL.revokeObjectURL(previewURL);if(digitalURL)URL.revokeObjectURL(digitalURL);previewURL=null;digitalURL=null;digitalFingerprint=null;photoReady=true;photoFailed=false;digitalRequired=false;digitalAvailable=true;form.hidden=true; review.hidden=true; confirm.checked=false; showStatus(key); }
  function download(bytes,name,type) { const url=URL.createObjectURL(new Blob([bytes],{type})), a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000); }
  function showReview() {
    const d=ODPV07Canonical.parseJSON(job.canonicalPassport), photo=d.anchors.find(a=>a.type==='photo'&&a.data&&a.data.role==='primary');
    const hours=job.identity.creatorId[0]==='C'?72:24;
    const lines=[t('network'),job.identity.creatorId+' · '+job.identity.issuer,t('type')+': '+t(d.objectType),t('objectTitle')+': '+d.title,t('author')+': '+d.authorName,t('description')+': '+d.shortDescription,t('domain')+': '+d.domain,t('contentClass')+': '+d.contentClass,t('lifecycle')+': '+d.status,t('ai')+': '+d.aiStatus];
    const anchor=type=>d.anchors.find(a=>a.type===type);
    if(d.physical){const dimensions=anchor('dimensions').data;lines.push(t('physicalDetails')+': '+d.physical.category,t('width')+' × '+t('height')+': '+dimensions.width+' × '+dimensions.height+' '+dimensions.unit,t('materials')+': '+anchor('materials').data.list.join(', '),t('features')+': '+anchor('distinguishing_features').data.text,t('photo')+': '+photo.hash);}
    if(d.digital)lines.push(t('digitalDetails')+': '+d.digital.subtype+' · '+d.digital.format,t('digitalFile')+': '+d.digital.fileHash+' ('+d.digital.fileSize+' bytes)');
    if(job.safeProposal)lines.push(t('safeDetails')+': '+job.safeProposal.nonce+' · '+job.safeProposal.safeTxHash);
    const monthDeadline=ODPV07Deadline.issuance(d.year,d.month,Math.floor(Date.now()/1000)), endDate=new Date(monthDeadline.end*1000);
    lines.push(t('unique'),t('preparationTime')+': '+d.registration.utcIso8601,t('registrationTimeNote'),t('executionDeadline')+': '+endDate.toISOString().replace('.000Z',' UTC')+' · '+endDate.toLocaleString(getLocale()));
    if(job.identity.originals.reduce((total,file)=>total+Number(file.byteLength),0)>99*1048576)lines.push(t('appArchiveSizeWarning'));
    if(monthDeadline.status==='near')lines.push(t('deadlineNear')); if(monthDeadline.status==='expired')lines.push(t('deadlineExpired'));
    lines.push(t('deadline')+hours+t('hours'),t('files')+': '+job.identity.originals.map(x=>x.hash+' ('+x.byteLength+' bytes)').join(', '),t('fingerprint')+': '+job.fingerprint);
    $('summary').textContent=lines.join('\n');
    if(previewURL) URL.revokeObjectURL(previewURL); previewURL=null; $('preview').hidden=true; photoReady=!photo;photoFailed=false;
    if(photo){const original=job.originals.find(f=>f.hash===photo.hash);if(original){previewURL=URL.createObjectURL(new Blob([original.bytes]));const expected=previewURL, img=$('preview');img.onload=()=>{if(previewURL===expected){photoReady=img.naturalWidth>0&&img.naturalHeight>0;photoFailed=!photoReady;render();}};img.onerror=()=>{if(previewURL===expected){photoReady=false;photoFailed=true;render();}};img.src=expected;img.hidden=false;}else photoFailed=true;}
    if(digitalURL)URL.revokeObjectURL(digitalURL);digitalURL=null;digitalRequired=!!d.digital;digitalAvailable=true;
    $('digitalReview').hidden=!digitalRequired;$('digitalPreviewImage').hidden=true;$('digitalPreviewText').hidden=true;$('digitalPreviewText').textContent='';$('digitalPreviewNote').hidden=false;
    if(digitalFingerprint!==job.fingerprint){$('digitalConfirm').checked=false;digitalFingerprint=job.fingerprint;}
    if(d.digital){const original=job.originals.find(f=>f.hash===d.digital.fileHash);digitalAvailable=!!original;
      if(original){const b=original.bytes,hex=(...x)=>x.every((v,i)=>b[i]===v);let type='';
        if(hex(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a))type='image/png';else if(hex(0xff,0xd8,0xff))type='image/jpeg';else if(hex(0x47,0x49,0x46,0x38))type='image/gif';else if(hex(0x52,0x49,0x46,0x46)&&b.length>=12&&b[8]===0x57&&b[9]===0x45&&b[10]===0x42&&b[11]===0x50)type='image/webp';
        if(type){digitalURL=URL.createObjectURL(new Blob([b],{type}));const expected=digitalURL,img=$('digitalPreviewImage');img.onload=()=>{if(digitalURL===expected&&img.naturalWidth&&img.naturalHeight){img.hidden=false;$('digitalPreviewNote').hidden=true;}};img.onerror=()=>{if(digitalURL===expected){img.hidden=true;$('digitalPreviewNote').hidden=false;}};img.src=expected;}
        else if(['txt','text/plain'].includes(d.digital.format.toLowerCase())&&b.length<=1048576){try{const text=new TextDecoder('utf-8',{fatal:true}).decode(b);if(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)){$('digitalPreviewText').textContent=text;$('digitalPreviewText').hidden=false;$('digitalPreviewNote').hidden=true;}}catch(_){}}
      }
    }
    $('editDraft').hidden=job.state!=='prepared';
    review.hidden=false; form.hidden=true; $('check').hidden=job.state==='prepared'; $('downloadPassport').hidden=job.state!=='minted'; $('receiptRecovery').hidden=job.state!=='minted'||!!job.transactionHash; $('retryRecovery').hidden=job.state!=='submitted';
    render();
  }
  async function readFile(id) { const file=$(id).files[0]; if(!file||file.size>50*1048576||file.size===0) throw new Error('file'); return new Uint8Array(await file.arrayBuffer()); }
  async function connectWallet() {
    const eth=await ODPV07Wallet.connect(); if(!eth||!window.ethers||!window.ODPV07Reader) throw new Error('wallet');
    const accounts=await eth.request({method:'eth_accounts'});
    if(!Array.isArray(accounts)||accounts.length!==1||!ethers.utils.isAddress(accounts[0])||Number(await eth.request({method:'eth_chainId'}))!==137)throw new Error('wallet');
    const response=await fetch('backend/config/odp-0.7/ObjectDigitalPassport.json'); if(!response.ok)throw new Error('abi');
    const abi=await response.json(), provider=new ethers.providers.Web3Provider(eth,'any'), reader=await ODPV07Reader.open(provider,abi,ethers);
    const result=await reader.readProfileByWallet(accounts[0]), live=await eth.request({method:'eth_accounts'});
    if(!Array.isArray(live)||live.length!==1||live[0].toLowerCase()!==accounts[0].toLowerCase()||Number(await eth.request({method:'eth_chainId'}))!==137)throw new Error('wallet changed');
    const db=await ODPV07JobStore.open(indexedDB); return {eth,wallet:accounts[0],provider,reader,abi,profile:result.profile,db};
  }
  async function connectWith(){if(busy)return;busy=true;showStatus('connecting');try{current=await connectWallet();ODPV07Wallet.watch(current.eth,provider=>{if(current&&current.eth===provider)invalidate();});job=null;review.hidden=true;form.hidden=!current.profile;showStatus(current.profile?'ready':'needProfile',current.profile?current.profile.creatorId:'');}catch(_){current=null;form.hidden=true;showStatus('connectError');}finally{busy=false;render();}}
  document.getElementById('connect').addEventListener('click', () => void connectWith());
  document.getElementById('disconnect').addEventListener('click', async () => {
    if (busy || !current) return;
    invalidate('disconnected');
    busy = true; render();
    try { await ODPV07Wallet.disconnect(); } finally { busy = false; render(); }
  });
  form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!current||!current.profile)return;const session=current;busy=true;showStatus('connecting');try{
    const block=await session.eth.request({method:'eth_getBlockByNumber',params:['latest',false]});if(current!==session)return;if(!block||!/^0x[0-9a-f]+$/i.test(block.timestamp||''))throw new Error('time');
    const type=$('objectType').value,input={objectType:type,title:$('objectTitle').value,authorName:$('author').value,shortDescription:$('description').value,domain:$('domain').value,contentClass:$('contentClass').value,status:$('lifecycle').value,aiStatus:$('ai').value,timestamp:Number(block.timestamp),width:$('width').value,height:$('height').value,unit:$('unit').value,materials:$('materials').value,features:$('features').value,physicalCategory:$('category').value,digitalSubtype:$('subtype').value,digitalFormat:$('fileFormat').value};
    if(type!=='digital')input.photo=await readFile('photo'); if(type!=='physical')input.digitalFile=await readFile('digitalFile');if(current!==session)return;
    const built=await ODPV07Draft.build(input);if(current!==session)return;
    const prepared=await ODPV07Job.prepare({...built,profile:session.profile,wallet:session.wallet,abi:session.abi,ethers});if(current!==session)return;
    const saved=await ODPV07JobStore.save(session.db,prepared,{abi:session.abi,ethers});if(current!==session)return;
    job=saved;confirm.checked=false;showReview();review.querySelector('h2').focus();showStatus('prepared');
  }catch(_){if(current===session)showStatus('invalid');}finally{busy=false;render();}});
  confirm.addEventListener('change',render);
  async function sendOrCheck(){
    if(busy||!current||!job||(job.state==='prepared'&&(!photoReady||!digitalAvailable||(digitalRequired&&!$('digitalConfirm').checked)||!confirm.checked)))return;
    if(!ODPV07Wallet.supportsWrites()){showStatus('locksUnavailable');return;}
    const session=current, activeJob=job;
    busy=true;render();
    try{
      const args={db:session.db,operationId:activeJob.identity.operationId,expectedFingerprint:activeJob.fingerprint,reader:session.reader,ethereum:session.eth,wallet:session.wallet,locks:navigator.locks,abi:session.abi,ethers};
      const result=await ODPV07Issue.send(args);
      if(current!==session)return;
      const updated=await ODPV07JobStore.get(session.db,activeJob.identity.operationId,{abi:session.abi,ethers});
      if(current!==session)return;
      job=updated;confirm.checked=false;showReview();showStatus(result.state,result.state==='minted'?result.passportId:'');
    }catch(_){if(current===session)showStatus('invalid');}
    finally{busy=false;render();}
  }
  $('digitalConfirm').addEventListener('change',render);
  $('downloadOriginal').addEventListener('click',()=>{if(!job||busy)return;const d=ODPV07Canonical.parseJSON(job.canonicalPassport);if(!d.digital)return;const file=job.originals.find(f=>f.hash===d.digital.fileHash);if(!file)return;const format=d.digital.format.toLowerCase();download(file.bytes,'odp-original.'+(/^[a-z0-9]{1,10}$/.test(format)?format:'bin'),'application/octet-stream');});
  $('issue').addEventListener('click',()=>{if(confirm.checked&&photoReady&&digitalAvailable&&(!digitalRequired||$('digitalConfirm').checked))void sendOrCheck();}); $('check').addEventListener('click',()=>void sendOrCheck());
  $('editDraft').addEventListener('click',()=>{if(busy||!job||job.state!=='prepared')return;
    const d=ODPV07Canonical.parseJSON(job.canonicalPassport),anchor=type=>d.anchors.find(a=>a.type===type);
    for(const [id,value] of Object.entries({objectType:d.objectType,objectTitle:d.title,author:d.authorName,description:d.shortDescription,domain:d.domain||'',contentClass:d.contentClass,lifecycle:d.status,ai:d.aiStatus}))$(id).value=value;
    if(d.physical){const dim=anchor('dimensions').data;$('width').value=dim.width;$('height').value=dim.height;$('unit').value=dim.unit;$('materials').value=anchor('materials').data.list.join(', ');$('features').value=anchor('distinguishing_features').data.text;$('category').value=d.physical.category;}
    if(d.digital){$('subtype').value=d.digital.subtype;$('fileFormat').value=d.digital.format;}
    $('photo').value='';$('digitalFile').value='';controls();job=null;confirm.checked=false;if(previewURL)URL.revokeObjectURL(previewURL);if(digitalURL)URL.revokeObjectURL(digitalURL);previewURL=null;digitalURL=null;digitalFingerprint=null;photoReady=true;photoFailed=false;digitalRequired=false;digitalAvailable=true;review.hidden=true;form.hidden=false;showStatus('editing');});
  $('unsentConfirm').addEventListener('change',render);
  $('unsentButton').addEventListener('click',async()=>{if(busy||!current||!job||!$('unsentConfirm').checked)return;if(!ODPV07Wallet.supportsWrites()){showStatus('locksUnavailable');return;}busy=true;render();try{await ODPV07Issue.recoverUnsent({db:current.db,operationId:job.identity.operationId,expectedFingerprint:job.fingerprint,reader:current.reader,ethereum:current.eth,wallet:current.wallet,locks:navigator.locks,abi:current.abi,ethers});job=await ODPV07JobStore.get(current.db,job.identity.operationId,{abi:current.abi,ethers});$('unsentConfirm').checked=false;confirm.checked=false;showReview();showStatus('unsentReady');}catch(_){showStatus('invalid');}finally{busy=false;render();}});
  $('retryConfirm').addEventListener('change',render);
  $('retryFailed').addEventListener('click',async()=>{if(!current||!job||job.state!=='submitted'||!$('retryConfirm').checked||busy)return;if(!ODPV07Wallet.supportsWrites()){showStatus('locksUnavailable');return;}busy=true;render();try{await ODPV07Issue.recoverFailed({db:current.db,operationId:job.identity.operationId,expectedFingerprint:job.fingerprint,reader:current.reader,ethereum:current.eth,wallet:current.wallet,locks:navigator.locks,abi:current.abi,ethers});job=await ODPV07JobStore.get(current.db,job.identity.operationId,{abi:current.abi,ethers});confirm.checked=false;$('retryConfirm').checked=false;showReview();showStatus('retryReady');}catch(_){showStatus('invalid');}finally{busy=false;render();}});
  $('downloadPassport').addEventListener('click',async()=>{if(!current||!job||job.state!=='minted'||busy)return;busy=true;render();try{const hash=(job.transactionHash||$('transactionHash').value.trim()).toLowerCase();if(!/^0x[0-9a-f]{64}$/.test(hash))throw new Error('receipt');const r=await current.provider.getTransactionReceipt(hash);if(!r)throw new Error('receipt');const response=await fetch('backend/config/odp-0.7/generation.json');if(!response.ok)throw new Error('generation');const generation=await response.json(), receipt={format:'odp-bundle-receipt-0.7',generationId:generation.generationId,chainId:'137',registry:job.identity.registry,passportId:job.passportId,transactionHash:hash,blockNumber:String(r.blockNumber),blockHash:r.blockHash.toLowerCase(),operationId:job.identity.operationId};const archive=await ODPV07Export.make({job,receipt,trustedGeneration:generation,reader:current.reader,abi:current.abi,ethers});download(archive.bytes,job.passportId+'.odpass','application/zip');showStatus('saved');}catch(_){showStatus('noReceipt');}finally{busy=false;render();}});
  render();
});

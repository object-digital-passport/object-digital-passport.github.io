/* Wallet selection only. No connection is opened until the user chooses it. */
(function (root) {
  'use strict';
  async function connect(kind) {
    if (kind === 'injected') {
      if (!root.ethereum) throw new Error('Browser wallet unavailable');
      return root.ethereum;
    }
    if (kind === 'safe') {
      if (typeof root.odpOpenSafeApp !== 'function') await new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src='backend/js/odp-v07-safe-app.bundle.js';
        script.onload=resolve;script.onerror=()=>reject(new Error('Safe App unavailable'));document.head.appendChild(script);
      });
      return root.odpOpenSafeApp();
    }
    if (kind !== 'walletconnect' || typeof root.odpEnsureWalletConnectBundle !== 'function') throw new Error('Mobile wallet unavailable');
    await root.odpEnsureWalletConnectBundle();
    return root.odpWalletConnectConnect({chainId:137,rpcUrl:'https://polygon-bor-rpc.publicnode.com'});
  }
  function watch(provider, onChange) {
    if (!provider || typeof provider.on !== 'function') return;
    for (const event of ['accountsChanged','chainChanged','disconnect']) provider.on(event,()=>onChange(provider));
  }
  root.ODPV07Wallet=Object.freeze({connect,watch});
})(window);

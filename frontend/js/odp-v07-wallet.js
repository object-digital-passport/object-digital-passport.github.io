/* Wallet selection only. No connection is opened until the user chooses it. */
(function (root) {
  'use strict';
  async function connect() {
    await root.odpEnsureWalletConnectBundle();
    return root.odpWalletConnectConnect({ chainId: 137, rpcUrl: 'https://polygon-bor-rpc.publicnode.com' });
  }
  async function disconnect() {
    await root.odpWalletConnectDisconnect?.();
  }
  function watch(provider, onChange) {
    if (!provider || typeof provider.on !== 'function') return;
    for (const event of ['accountsChanged','chainChanged','disconnect']) provider.on(event,()=>onChange(provider));
  }
  function supportsWrites() {
    return !!(root.navigator && root.navigator.locks && typeof root.navigator.locks.request === 'function');
  }
  root.ODPV07Wallet=Object.freeze({connect,disconnect,watch,supportsWrites});
})(window);

/* The bridge is activated only inside Safe's official app and after explicit selection. */
import SafeAppsSDK from '@safe-global/safe-apps-sdk';
import { SafeAppProvider } from '@safe-global/safe-apps-provider';
window.odpOpenSafeApp = async function () {
  if (window.parent === window) throw new Error('Open this page inside Safe');
  const sdk = new SafeAppsSDK({allowedDomains:[/^https:\/\/app\.safe\.global$/]});
  let timer;
  const timeout = new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Safe connection timed out')),10000);});
  let info;
  try { info=await Promise.race([sdk.safe.getInfo(),timeout]); } finally { clearTimeout(timer); }
  if (!info || info.chainId !== 137 || info.isReadOnly || info.version !== '1.4.1' || !/^0x[0-9a-f]{40}$/i.test(info.safeAddress || '')) throw new Error('Unsupported Safe account');
  const provider=new SafeAppProvider(info,sdk);
  provider.odpSafeSdk=sdk;
  return provider;
};

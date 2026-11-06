/* Profile registration for the pinned 0.7 registry. No automatic wallet access. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require('./odp-v07-safe-ops.js'));
  else root.ODPV07Profile = factory(root.ODPV07SafeOps);
})(typeof globalThis !== "undefined" ? globalThis : this, function (safeOps) {
  "use strict";
  const REGISTRY = "0x3281492981dcd492cc2f7c17398134e1d3b5ca1f";
  function prepareRegistration(role, abi, ethers) {
    if (!["C", "B", "P", "M"].includes(role) || !Array.isArray(abi) || !ethers || !ethers.utils) throw new Error("Invalid profile registration");
    const prefix = "0x" + role.charCodeAt(0).toString(16);
    const data = new ethers.utils.Interface(abi).encodeFunctionData("registerCreator", [prefix]);
    return Object.freeze({ chainId: 137, to: REGISTRY, role, data });
  }
  /** The lock and persistent journal prevent duplicate prompts after an uncertain hand-off. */
  async function register({ role, wallet, ethereum, reader, storage, locks, abi, ethers }) {
    if (!ethers || !ethers.utils.isAddress(wallet) || !ethereum || !reader || !storage || !locks || typeof locks.request !== 'function') throw new Error('Registration prerequisites unavailable');
    const normalized = wallet.toLowerCase(), key = 'odp-v07-register:' + REGISTRY + ':' + normalized;
    return locks.request(key, { ifAvailable: true }, async lock => {
      if (!lock) throw new Error('Registration already in progress');
      let existing;
      try { existing = storage.getItem(key); } catch (_) { throw new Error('Registration journal unavailable'); }
      const profile = await reader.readProfileByWallet(wallet);
      if (profile.profile) return { state: 'registered', profile: profile.profile };
      if (existing !== null) return { state: 'unresolved' };
      const plan = prepareRegistration(role, abi, ethers);
      async function checkWallet() {
        const [chain, accounts] = await Promise.all([ethereum.request({ method: 'eth_chainId' }), ethereum.request({ method: 'eth_accounts' })]);
        if (Number(chain) !== 137 || !Array.isArray(accounts) || accounts.length !== 1 || String(accounts[0]).toLowerCase() !== normalized) throw new Error('Wallet account or network changed');
      }
      await checkWallet();
      if (role === 'C') {
        const code = await ethereum.request({ method: 'eth_getCode', params: [wallet, 'latest'] });
        if (typeof code !== 'string' || !/^0x(?:[0-9a-f]{2})*$/i.test(code) || code.toLowerCase() !== '0x') throw new Error('A personal profile requires an externally owned account');
      }
      const tx = { from: wallet, to: plan.to, data: plan.data, value: '0x0' };
      await ethereum.request({ method: 'eth_estimateGas', params: [tx] });
      await checkWallet();
      const journal = JSON.stringify({ version: 1, wallet: normalized, registry: REGISTRY, role, state: 'before-wallet' });
      try {
        storage.setItem(key, journal);
        if (storage.getItem(key) !== journal) throw new Error('Journal write failed');
      } catch (_) { throw new Error('Registration journal unavailable'); }
      let hash;
      try { hash = await ethereum.request({ method: 'eth_sendTransaction', params: [tx] }); }
      catch (error) {
        if (error && error.code === 4001) { try { storage.removeItem(key); } catch (_) {} return { state: 'rejected' }; }
        return { state: 'unresolved' };
      }
      if (!/^0x[0-9a-f]{64}$/i.test(hash || '')) return { state: 'unresolved' };
      try { storage.setItem(key, JSON.stringify({ version: 1, wallet: normalized, registry: REGISTRY, role, state: 'submitted', hash: hash.toLowerCase() })); } catch (_) {}
      return { state: 'submitted', hash };
    });
  }
  async function registerSafe({role,wallet,ethereum,reader,storage,locks,abi,ethers,sdk}) {
    if (!['B','P','M'].includes(role) || !ethers || !ethers.utils.isAddress(wallet) || !reader || !storage || !locks || !safeOps) throw new Error('Invalid Safe registration');
    const normalized=wallet.toLowerCase(),key='odp-v07-register:'+REGISTRY+':'+normalized;
    return locks.request(key,{ifAvailable:true},async lock=>{
      if(!lock)throw Error('Registration already in progress');
      const profile=await reader.readProfileByWallet(wallet);if(profile.profile)return {state:'registered',profile:profile.profile};
      const existing=storage.getItem(key);if(existing!==null){try{const saved=JSON.parse(existing);if(saved.kind==='safe'&&saved.state==='pending')return {state:'safe_pending'};}catch(_){}return {state:'unresolved'};}
      const plan=prepareRegistration(role,abi,ethers);
      return safeOps.submit({sdk,ethereum,wallet,data:plan.data,action:'register',deadline:0,storage,key,ethers});
    });
  }
  return Object.freeze({ prepareRegistration, register, registerSafe });
});

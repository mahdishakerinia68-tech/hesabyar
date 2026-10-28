export function compareRecords(a,b){const ar=Number(a?.revision)||0,br=Number(b?.revision)||0;if(ar!==br)return ar-br;const at=Date.parse(a?.updatedAt||'')||0,bt=Date.parse(b?.updatedAt||'')||0;if(at!==bt)return at-bt;return String(a?.deviceId||'').localeCompare(String(b?.deviceId||''));}
export function mergeRecord(local,remote){return compareRecords(local,remote)>=0?local:remote;}

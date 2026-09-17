/* TripDomain: capa de dominio, pura.
   Reglas: cero dependencias externas (sin DOM, sin localStorage, sin Firebase).
   Las capas exteriores dependen de este archivo; este archivo no depende de nada.
   Tradeoff explícito: el importe se guarda en euros (float) para no migrar los
   datos existentes ni romper el formato del enlace de sincronización. Todo el
   cálculo se hace en céntimos enteros para que las sumas sean exactas. */
(function(global){
  "use strict";

  function DomainError(code, message){
    const e = new Error(message);
    e.name = "DomainError";
    e.code = code;
    return e;
  }

  // Objeto-valor dinero: céntimos enteros, inmutable por convención.
  function eurosToCents(euros){
    const n = Number(euros);
    if(!isFinite(n)) throw DomainError("INVALID_AMOUNT", "Importe no numérico");
    return Math.round(n*100);
  }
  function formatEUR(cents){
    return (cents/100).toFixed(2)+"€";
  }

  // Entidad Gasto: identidad en `key` (se conserva el nombre del campo
  // existente para no migrar datos; equivale al id de la entidad).
  function createExpense(input){
    const title = String(input.title||"").trim();
    const payer = String(input.payer||"").trim();
    const parts = Array.isArray(input.parts) ? input.parts.slice() : [];
    const cents = eurosToCents(input.amountEuros);
    if(!title) throw DomainError("TITLE_REQUIRED", "Falta el concepto");
    if(cents<=0) throw DomainError("AMOUNT_POSITIVE", "El importe debe ser mayor que cero");
    if(!payer) throw DomainError("PAYER_REQUIRED", "Falta quién pagó");
    if(!parts.length) throw DomainError("PARTICIPANTS_REQUIRED", "Falta entre quién se divide");
    return {
      key: input.key||null,
      title: title,
      amount: cents/100,
      payer: payer,
      parts: parts,
      by: input.by||payer,
      date: input.date||"",
      ts: input.ts||Date.now()
    };
  }

  // Reparto equitativo en céntimos: el resto del redondeo va a los primeros.
  function splitShares(expense){
    const total = eurosToCents(expense.amount);
    const n = expense.parts.length;
    const base = Math.floor(total/n);
    const rest = total-base*n;
    return expense.parts.map((who,i)=>({who: who, cents: base+(i<rest?1:0)}));
  }

  function computeBalances(expenses, people){
    const bal = {};
    (people||[]).forEach(p=>{ bal[p]=0; });
    expenses.forEach(g=>{
      const total = eurosToCents(g.amount);
      if(bal[g.payer]===undefined) bal[g.payer]=0;
      bal[g.payer]+=total;
      splitShares(g).forEach(s=>{
        if(bal[s.who]===undefined) bal[s.who]=0;
        bal[s.who]-=s.cents;
      });
    });
    return bal;
  }

  // Servicio de dominio: simplificación de deudas (algoritmo voraz).
  function simplifyDebts(balancesCents){
    const cred = Object.entries(balancesCents).filter(([_,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    const debt = Object.entries(balancesCents).filter(([_,v])=>v<0).sort((a,b)=>a[1]-b[1]);
    const out = [];
    let i=0, j=0;
    const c = cred.map(x=>[x[0],x[1]]), d = debt.map(x=>[x[0],x[1]]);
    while(i<c.length && j<d.length){
      const amt = Math.min(c[i][1], -d[j][1]);
      out.push({from:d[j][0], to:c[i][0], cents:amt});
      c[i][1]-=amt; d[j][1]+=amt;
      if(c[i][1]<=0) i++;
      if(d[j][1]>=0) j++;
    }
    return out;
  }

  // Entidad Lugar propio (los fijos viven en la UI como datos de referencia).
  function createPlace(input){
    const name = String(input.name||"").trim();
    const lat = Number(input.lat), lng = Number(input.lng);
    if(!name) throw DomainError("NAME_REQUIRED", "Falta el nombre del lugar");
    if(!isFinite(lat)||lat<-90||lat>90) throw DomainError("LAT_RANGE", "Latitud fuera de rango");
    if(!isFinite(lng)||lng<-180||lng>180) throw DomainError("LNG_RANGE", "Longitud fuera de rango");
    return {
      key: input.key||null,
      n: name,
      c: input.category||"extra",
      lat: lat,
      lng: lng,
      d: input.note||"",
      ts: input.ts||Date.now()
    };
  }

  global.TripDomain = {
    DomainError: DomainError,
    eurosToCents: eurosToCents,
    formatEUR: formatEUR,
    createExpense: createExpense,
    splitShares: splitShares,
    computeBalances: computeBalances,
    simplifyDebts: simplifyDebts,
    createPlace: createPlace
  };
})(typeof window!=="undefined"?window:globalThis);

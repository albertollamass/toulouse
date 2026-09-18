/* Repositorios: adaptadores driven (infraestructura).
   Contrato del puerto (duck typing, mismo para gastos y lugares):
     all()            -> registros locales (espejo)
     saveAll(items)   -> guarda el espejo local
     push(record)     -> key; escribe en la nube (sin key en lo enviado)
     remove(key)      -> borra en la nube
     replaceAll(recs) -> reescribe la colección en la nube, devuelve con keys
     fetchAll()       -> Promise de registros con key desde la nube
   El dominio define lo que necesita; estos adaptadores lo implementan.
   La UI nunca toca Firebase ni localStorage de gastos/lugares directamente:
   lo hace a través de los casos de uso (usecases.js). */
(function(global){
  "use strict";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCwtSOzDuc8KxcV8NMk8s-GWojF8gR5UDI",
    authDomain: "toulouse-6de5f.firebaseapp.com",
    databaseURL: "https://toulouse-6de5f-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "toulouse-6de5f",
    appId: "1:720597387651:web:1cd43c47b4ae119a9b4eb6"
  };
  const ROOM_ID = "toulouse-oct-2026"; // debe coincidir con las reglas de Realtime Database

  const Cloud = { on:false, db:null };
  function cloudReady(){ return Cloud.on && Cloud.db; }
  function localKey(){ return "local-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
  function stripKey(it){ const c=Object.assign({},it); delete c.key; return c; }
  function snapshotToList(snap){
    const val = snap.val()||{};
    return Object.entries(val).map(([key,v])=>Object.assign({key:key},v));
  }

  function normalize(list){
    let changed = false;
    list.forEach(it=>{
      if(!it.key){ it.key = localKey(); changed = true; }
      if(!it.ts){ it.ts = Date.now(); changed = true; }
    });
    return {list:list, changed:changed};
  }

  function LocalRepo(storageKey){
    return {
      all: function(){
        try{
          const raw = JSON.parse(localStorage.getItem(storageKey)||"[]");
          const n = normalize(Array.isArray(raw)?raw:[]);
          if(n.changed) localStorage.setItem(storageKey, JSON.stringify(n.list));
          return n.list;
        }catch(e){ return []; }
      },
      saveAll: function(items){
        localStorage.setItem(storageKey, JSON.stringify(items));
      }
    };
  }

  function FirebaseRepo(childPath){
    function ref(){
      return Cloud.db.ref("rooms/"+ROOM_ID+"/"+childPath);
    }
    return {
      push: function(record){
        const c = stripKey(record); c.ts = c.ts||Date.now();
        return ref().push(c).key;
      },
      remove: function(key){
        ref().child(key).remove();
      },
      replaceAll: function(records){
        const r = ref(), obj = {};
        records.forEach(it=>{
          const c = stripKey(it); c.ts = c.ts||Date.now();
          obj[r.push().key] = c;
        });
        r.set(obj);
        return Object.entries(obj).map(([key,v])=>Object.assign({key:key},v));
      },
      fetchAll: function(){
        return ref().once("value").then(snapshotToList);
      }
    };
  }

  function initCloudDb(){
    if(!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey==="PEGAR_AQUI")
      return Promise.resolve(null);
    if(typeof firebase==="undefined") return Promise.resolve(null);
    try{
      if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      Cloud.db = firebase.database();
    }catch(e){ return Promise.resolve(null); }
    return firebase.auth().signInAnonymously().then(()=>{
      Cloud.on = true;
      return Cloud.db;
    }).catch(()=>{ Cloud.on = false; return null; });
  }

  // Puertos para un documento único (objeto, no lista): p. ej. objetivos.
  function LocalDoc(storageKey, fallback){
    function clone(v){ return JSON.parse(JSON.stringify(v)); }
    return {
      load: function(){
        try{
          const v = JSON.parse(localStorage.getItem(storageKey));
          return (v===null||v===undefined) ? clone(fallback) : v;
        }catch(e){ return clone(fallback); }
      },
      save: function(v){
        localStorage.setItem(storageKey, JSON.stringify(v));
      }
    };
  }

  function FirebaseDoc(childPath){
    function ref(){
      return Cloud.db.ref("rooms/"+ROOM_ID+"/"+childPath);
    }
    return {
      fetch: function(){
        return ref().once("value").then(snap=>snap.val());
      },
      save: function(v){
        return ref().set(v);
      }
    };
  }

  global.TripRepos = {
    ROOM_ID: ROOM_ID,
    cloudReady: cloudReady,
    localKey: localKey,
    LocalRepo: LocalRepo,
    FirebaseRepo: FirebaseRepo,
    LocalDoc: LocalDoc,
    FirebaseDoc: FirebaseDoc,
    initCloudDb: initCloudDb
  };
})(typeof window!=="undefined"?window:globalThis);

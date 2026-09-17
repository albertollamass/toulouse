/* Casos de uso: orquestación (capa de aplicación).
   Solo conocen el dominio (TripDomain) y los puertos (repositorios).
   No tocan el DOM ni saben si la nube es Firebase o localStorage.
   La raíz de composición (createApp) cablea los adaptadores concretos. */
(function(global){
  "use strict";

  function byTsDesc(a,b){ return (b.ts||0)-(a.ts||0); }
  function byTsAsc(a,b){ return (a.ts||0)-(b.ts||0); }
  function isLocalOnly(it){ return String(it.key||"").startsWith("local-"); }

  // Libro de gastos compartidos (tricount).
  function ExpenseLedger(localRepo, cloudRepo){
    function list(){ return localRepo.all().slice().sort(byTsDesc); }
    function add(input){
      const record = global.TripDomain.createExpense(input);
      if(cloudRepo) record.key = cloudRepo.push(record);
      else record.key = global.TripRepos.localKey();
      const arr = localRepo.all();
      arr.unshift(record);
      localRepo.saveAll(arr);
      return record;
    }
    function remove(key){
      if(cloudRepo && key && !isLocalOnly({key:key})) cloudRepo.remove(key);
      localRepo.saveAll(localRepo.all().filter(x=>x.key!==key));
    }
    function clear(){
      if(cloudRepo) cloudRepo.replaceAll([]);
      localRepo.saveAll([]);
    }
    // La nube manda; lo solo-local se sube. Devuelve la lista fusionada.
    function refresh(){
      if(!cloudRepo) return Promise.resolve(list());
      return cloudRepo.fetchAll().then(cloud=>{
        const keys = {};
        cloud.forEach(e=>{ keys[e.key]=true; });
        const pending = localRepo.all().filter(isLocalOnly);
        pending.forEach(it=>{ it.key = cloudRepo.push(it); });
        const merged = cloud.concat(pending).sort(byTsDesc);
        localRepo.saveAll(merged);
        return merged;
      });
    }
    function importAll(records){
      if(cloudRepo){
        const keyed = cloudRepo.replaceAll(records);
        keyed.sort(byTsDesc);
        localRepo.saveAll(keyed);
        return keyed;
      }
      localRepo.saveAll(records);
      return records;
    }
    return {list:list, add:add, remove:remove, clear:clear, refresh:refresh, importAll:importAll};
  }

  // Lugares añadidos por el grupo (los fijos son datos de referencia de la UI).
  function PlaceBook(localRepo, cloudRepo){
    function list(){ return localRepo.all().slice().sort(byTsAsc); }
    function add(input){
      const record = global.TripDomain.createPlace(input);
      if(cloudRepo) record.key = cloudRepo.push(record);
      else record.key = global.TripRepos.localKey();
      const arr = localRepo.all();
      arr.push(record);
      localRepo.saveAll(arr);
      return record;
    }
    function remove(key){
      if(cloudRepo && key && !isLocalOnly({key:key})) cloudRepo.remove(key);
      localRepo.saveAll(localRepo.all().filter(x=>x.key!==key));
    }
    function refresh(){
      if(!cloudRepo) return Promise.resolve(list());
      return cloudRepo.fetchAll().then(cloud=>{
        const keys = {};
        cloud.forEach(e=>{ keys[e.key]=true; });
        const pending = localRepo.all().filter(isLocalOnly);
        pending.forEach(it=>{ it.key = cloudRepo.push(it); });
        const merged = cloud.concat(pending).sort(byTsAsc);
        localRepo.saveAll(merged);
        return merged;
      });
    }
    function importAll(records){
      if(cloudRepo){
        const keyed = cloudRepo.replaceAll(records);
        keyed.sort(byTsAsc);
        localRepo.saveAll(keyed);
        return keyed;
      }
      localRepo.saveAll(records);
      return records;
    }
    return {list:list, add:add, remove:remove, refresh:refresh, importAll:importAll};
  }

  // Raíz de composición: aquí, y solo aquí, se eligen los adaptadores.
  function createApp(storageKeys, onStatus){
    const status = onStatus||function(){};
    const expenses = ExpenseLedger(
      global.TripRepos.LocalRepo(storageKeys.exp),
      null
    );
    const places = PlaceBook(
      global.TripRepos.LocalRepo(storageKeys.places),
      null
    );
    const app = {
      expenses: expenses,
      places: places,
      cloud: false,
      ready: Promise.resolve(),
      refresh: function(silent){ return Promise.resolve(); }
    };
    app.ready = global.TripRepos.initCloudDb().then(db=>{
      if(!db){
        status("Modo local. Pega la config de Firebase en repos.js para usar la nube.");
        return app;
      }
      app.cloud = true;
      const expCloud = global.TripRepos.FirebaseRepo("expenses");
      const plCloud = global.TripRepos.FirebaseRepo("customPlaces");
      app.expenses = ExpenseLedger(global.TripRepos.LocalRepo(storageKeys.exp), expCloud);
      app.places = PlaceBook(global.TripRepos.LocalRepo(storageKeys.places), plCloud);
      status("Conectando con la nube…");
      return app.refresh().catch(()=>{
        status("No se pudo actualizar. Sigo con los datos locales.");
      }).then(()=>app);
    }).catch(()=>{
      status("Sin acceso a la nube (activa login anónimo y revisa las reglas). Funciono en local.");
      return app;
    });
    app.refresh = function(silent){
      if(!app.cloud) return Promise.resolve();
      if(!silent) status("Actualizando…");
      return Promise.all([app.expenses.refresh(), app.places.refresh()]).then(()=>{
        const h = new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
        status("Nube activa. Actualizado a las "+h+".");
      }).catch(()=>{
        status("No se pudo actualizar. Sigo con los datos locales.");
      });
    };
    return app;
  }

  global.TripApp = { createApp: createApp };
})(typeof window!=="undefined"?window:globalThis);

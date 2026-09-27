'use strict';
(() => {
  const model=Dawnwalker.createModel(window.DawnwalkerData);
  delete window.DawnwalkerData;
  let router;
  const catalog=Dawnwalker.createCatalog(model,()=>router.getSelection());
  const reader=Dawnwalker.createReader(model,()=>router.remember());
  router=Dawnwalker.createRouter(model,reader,catalog);
  catalog.start();
  router.start();
})();

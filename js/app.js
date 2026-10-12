'use strict';
(() => {
  document.documentElement.classList.add('js-enabled');
  Dawnwalker.ui.enhance(document);
  const model=Dawnwalker.createModel(window.DawnwalkerData);
  delete window.DawnwalkerData;
  let router;
  const references=Dawnwalker.createReferences(model,()=>router?.remember());
  const catalog=Dawnwalker.createCatalog(model,references);
  const reader=Dawnwalker.createReader(model,()=>router.remember());
  router=Dawnwalker.createRouter(model,reader,catalog,references);
  Dawnwalker.navigation.start(model.navigate);
  Dawnwalker.createGlobalSearch(model);
  window.GuideUI?.icons();
  catalog.start();
  router.start();
})();

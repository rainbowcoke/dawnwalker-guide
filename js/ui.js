/* Apply shared icons and image error states after rendering. */
'use strict';
Dawnwalker.ui={
  enhance(container){
    for(const image of container.querySelectorAll('.poster-art'))image.addEventListener('error',()=>image.closest('.poster-card').classList.add('missing-art'),{once:true});
    window.GuideUI.icons();
  }
};

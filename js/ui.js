/* Apply shared icons and image error states after rendering. */
'use strict';
const enhancedImages=new WeakSet();
Dawnwalker.ui={
  enhance(container){
    for(const image of container.querySelectorAll('img')){
      if(enhancedImages.has(image))continue;enhancedImages.add(image);image.decoding='async';
      const failed=()=>{if(image.matches('.poster-art'))image.closest('.poster-card')?.classList.add('missing-art');else image.remove();};
      image.addEventListener('error',failed,{once:true});
      if(image.complete&&!image.naturalWidth)failed();
    }
    window.GuideUI.icons();
  }
};

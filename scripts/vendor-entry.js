import '@awesome.me/webawesome/dist/styles/themes/default.css';
import '@awesome.me/webawesome/dist/components/dialog/dialog.js';
import '@awesome.me/webawesome/dist/components/tooltip/tooltip.js';
import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/dropdown/dropdown.js';
import '@awesome.me/webawesome/dist/components/select/select.js';
import '@awesome.me/webawesome/dist/components/input/input.js';
import '@awesome.me/webawesome/dist/components/card/card.js';
import '@awesome.me/webawesome/dist/components/breadcrumb/breadcrumb.js';
import '@awesome.me/webawesome/dist/components/breadcrumb-item/breadcrumb-item.js';
import {registerIconLibrary} from '@awesome.me/webawesome/dist/components/icon/library.js';
import Panzoom from '@panzoom/panzoom';
import {createIcons,createElement,Search,X,ZoomIn,ZoomOut,Maximize,Undo2,RotateCcw,ChevronDown,ChevronRight,ArrowLeft,ArrowRight,ArrowUpRight,Plus,Minus,Link,LockKeyhole,Check,CircleX,LoaderCircle} from 'lucide';

// Brand icons are not exported by this Lucide version. Register the local SVG.
const Github=[['path',{d:'M9 19c-4.3 1.3-4.3-2.2-6-2.7M15 22v-3.4c0-1 .1-1.6-.5-2.2 3.3-.4 6.7-1.6 6.7-7.3a5.7 5.7 0 0 0-1.5-4c.2-.5.6-2-.2-4 0 0-1.2-.4-4 1.5a14 14 0 0 0-7 0C5.7.7 4.5 1.1 4.5 1.1c-.8 2-.4 3.5-.2 4a5.7 5.7 0 0 0-1.5 4c0 5.7 3.4 6.9 6.7 7.3-.5.5-.6 1.1-.5 2.2V22'}]];
const icons={Search,X,ZoomIn,ZoomOut,Maximize,Undo2,RotateCcw,ChevronDown,ChevronRight,ArrowLeft,ArrowRight,ArrowUpRight,Plus,Minus,Link,LockKeyhole,Check,CircleX,LoaderCircle,Github};
const system={'chevron-down':ChevronDown,'chevron-right':ChevronRight,'chevron-left':ArrowLeft,'x-lg':X,'x':X,'check':Check,'check-lg':Check,'x-circle-fill':CircleX,'caret':ChevronDown,'grip-vertical':Minus};
registerIconLibrary('system',{resolver:name=>'data:image/svg+xml,'+encodeURIComponent(createElement(system[name]||ChevronDown).outerHTML)});
window.GuideUI={Panzoom,icons:()=>createIcons({icons})};

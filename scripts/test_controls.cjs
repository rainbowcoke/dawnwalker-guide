/* Interact with the controls used by the application. */
async function fill(locator,text){return locator.locator('input').fill(text);}
async function select(locator,value){
 await locator.evaluate(async(e,value)=>{await customElements.whenDefined('wa-select');e.value=value;await e.updateComplete;e.dispatchEvent(new Event('change',{bubbles:true,composed:true}));},value);
}
async function value(locator){return locator.evaluate(e=>e.value);}
module.exports={fill,select,value};

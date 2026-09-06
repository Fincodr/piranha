export function bindTouchControls(buttons,state){
  let enabled=false;
  const entries=Array.from(buttons,button=>({button,held:new Set()}));
  function sync({button,held}){
    const active=held.size>0;
    state[button.dataset.control]=active;
    button.classList.toggle('pressed',active);
    button.setAttribute('aria-pressed',String(active));
  }
  function reset(){
    for(const entry of entries){
      const pointers=[...entry.held].filter(id=>typeof id==='number');
      entry.held.clear();sync(entry);
      for(const id of pointers)if(entry.button.hasPointerCapture(id))entry.button.releasePointerCapture(id);
    }
  }
  for(const entry of entries){
    const {button,held}=entry;
    button.addEventListener('pointerdown',event=>{
      if(!enabled||(event.pointerType==='mouse'&&event.button!==0))return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);held.add(event.pointerId);sync(entry);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>{
      held.delete(event.pointerId);sync(entry);
    });
    for(const type of ['keydown','keyup'])button.addEventListener(type,event=>{
      if(!['Space','Enter'].includes(event.code))return;
      event.preventDefault();event.stopPropagation();
      if(type==='keydown'&&enabled)held.add(event.code);else held.delete(event.code);
      sync(entry);
    });
    button.addEventListener('blur',()=>{held.delete('Space');held.delete('Enter');sync(entry);});
  }
  return {reset,setEnabled(value){
    enabled=value;if(!enabled)reset();
    for(const {button} of entries)button.disabled=!enabled;
  }};
}

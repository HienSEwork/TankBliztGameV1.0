// mobileControls.js - map touch controls to TB.Game input
(function(){
  if(!window.TB || !window.TB.Game) {
    // wait until TB.Game is available
    document.addEventListener('DOMContentLoaded', init);
  } else init();

  function init(){
    const api = window.TB && window.TB.Game;
    if(!api) return;

    // Provide press/release API used by this script. game.js should expose pressControl/releaseControl.
    const press = (name)=>{
      if(typeof api.pressControl === 'function') api.pressControl(name);
    };
    const release = (name)=>{
      if(typeof api.releaseControl === 'function') api.releaseControl(name);
    };

    // Helpers
    function bindButton(sel, name){
      const el = document.querySelector(sel);
      if(!el) return;
      el.addEventListener('touchstart', (e)=>{ e.preventDefault(); press(name); }, {passive:false});
      el.addEventListener('mousedown', (e)=>{ e.preventDefault(); press(name); });
      const end = (e)=>{ e.preventDefault(); release(name); };
      el.addEventListener('touchend', end, {passive:false});
      el.addEventListener('touchcancel', end, {passive:false});
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', end);
    }

    // D-pad mapping
    bindButton('#dpad .up', 'up');
    bindButton('#dpad .down', 'down');
    bindButton('#dpad .left', 'left');
    bindButton('#dpad .right', 'right');

    // Fire button
    bindButton('#btnFire', 'fire');

    // small actions
    const btnPause = document.getElementById('btnPause');
    if(btnPause) btnPause.addEventListener('click', ()=>api.togglePause());
    const btnMenu = document.getElementById('btnMenu');
    if(btnMenu) btnMenu.addEventListener('click', ()=>{
      if(confirm('Bạn có chắc chắn muốn quay về Menu chính?')) location.href = 'index.html';
    });
    const btnSound = document.getElementById('btnSound');
    if(btnSound) btnSound.addEventListener('click', ()=>api.toggleSound());

    // Support multi-touch: when touchstart on any dpad child, keep it pressed until touchend
    // No further code required because each button handles its own touch events.

    // Expose for debugging
    window.__TB_MOBILE = { press, release };
  }
})();

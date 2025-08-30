// assets.js - manage sprite loading (updated with debug logs)
window.TB = window.TB || {};
TB.Assets = (function(){
  let useImages = false;
  const imgs = {
    player:null, enemy:null, boss:null, sharkBoss:null,
    bullet:null, bossBullet:null, sharkBullet:null,
    tiles:{brick:null,steel:null,water:null,bush:null,base:null,empty:null}
  };

  let readyPromise = null;

  function loadImage(url){
    return new Promise((resolve, reject)=>{
      const image = new Image();
      image.onload = ()=>{
        console.log("[Assets] Loaded:", url);
        resolve(image);
      };
      image.onerror = ()=>{
        console.error("[Assets] Failed to load:", url);
        reject(new Error("Failed to load " + url));
      };
      image.src = url;
    });
  }

  async function fillImagesFromMap(target, map){
    const tasks = [];
    for(const key in map){
      const value = map[key];
      if(typeof value === 'string'){
        tasks.push(
          loadImage(value).then(img=>{
            target[key] = img;
          }).catch(err=>{
            console.error("[Assets] Error loading", value, err);
          })
        );
      } else if(value && typeof value === 'object'){
        if(!target[key]) target[key] = {};
        tasks.push(fillImagesFromMap(target[key], value));
      }
    }
    if(tasks.length){ await Promise.all(tasks); }
  }

  function loadSprites(map){
    readyPromise = fillImagesFromMap(imgs, map)
      .then(()=>{
        console.log("[Assets] All sprites loaded successfully");
        return imgs;
      })
      .catch(err=>{
        console.error("[Assets] Failed while loading sprites:", err);
        throw err;
      });
    return readyPromise;
  }

  function whenReady(){
    return readyPromise || Promise.resolve(imgs);
  }

  return {
    loadSprites,
    whenReady,
    get:()=>({ imgs, useImages }),
    setUseImages:v=>{ useImages = !!v; }
  };
})();

self.addEventListener("push", event => {
  let data={};
  try{ data=event.data ? event.data.json() : {}; }catch{ data={body:event.data?.text()||""}; }

  const title=data.title || "IMPORTB2B";
  const options={
    body:data.body || "Nueva actualización",
    tag:data.tag || "importb2b",
    renotify:true,
    data:{url:data.url || "./",...(data.data||{})},
    badge:undefined,
    icon:undefined
  };

  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target=event.notification.data?.url || "./";
  event.waitUntil(
    clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
      for(const client of list){
        if("focus" in client){
          client.navigate(target).catch(()=>{});
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});

self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(clients.claim()));

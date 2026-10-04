import React from 'react';
import {createRoot} from 'react-dom/client';
import Page from './Page';
import {liveData} from './live-server';
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
 if(url.origin===location.origin&&url.pathname==='/api/live'){
  try{return Response.json(await liveData(new Request(url)),{headers:{'Cache-Control':'no-store'}});}
  catch{return Response.json({error:'Falha ao consultar o TSE'},{status:502});}
 }
 if(url.hostname==='resultados.tse.jus.br')return nativeFetch(input,{...init,headers:undefined,credentials:'omit'});
 return nativeFetch(input,init);
};
createRoot(document.getElementById('root')!).render(<Page/>);

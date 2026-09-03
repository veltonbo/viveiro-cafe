
(()=>{
"use strict";

function fecharFabSeguro(){
  try{
    document.getElementById("v16FabMenu")?.classList.add("hidden");
    document.getElementById("v16FabBackdrop")?.classList.add("hidden");
  }catch(e){}
}

/* Intercepta cliques que abrem modais para garantir que o menu + feche antes. */
document.addEventListener("click",e=>{
  const alvo=e.target.closest("button,[onclick]");
  const acao=alvo?.getAttribute?.("onclick")||"";
  if(
    acao.includes("abrirModal") ||
    acao.includes("abrirPerdaFinal") ||
    acao.includes("abrirTransferFinal") ||
    acao.includes("abrirReservaFinal") ||
    acao.includes("abrirManejoFinal") ||
    acao.includes("abrirInsumoFinal") ||
    acao.includes("abrirMovInsumoFinal") ||
    acao.includes("abrirBuscaFinal") ||
    acao.includes("abrirCanteiro")
  ){
    fecharFabSeguro();
  }
},true);

/* Ao trocar de aba também fecha o menu flutuante. */
document.addEventListener("click",e=>{
  if(e.target.closest(".navbtn"))fecharFabSeguro();
},true);

/* Impede o fundo de rolar quando um modal estiver aberto. */
const obs=new MutationObserver(()=>{
  const aberto=!!document.querySelector(".modal:not(.hidden)");
  document.documentElement.classList.toggle("v161-modal-open",aberto);
  document.body.classList.toggle("v161-modal-open",aberto);
});
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".modal").forEach(m=>obs.observe(m,{attributes:true,attributeFilter:["class"]}));
});
})();

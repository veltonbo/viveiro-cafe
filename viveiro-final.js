
/* =========================================================
   VIVEIRO CAFÉ — V16 FINAL
   ========================================================= */

let reservas = [];
let manejos = [];
let insumos = [];
let movimentosInsumos = [];
let lixeira = [];
let auditoria = [];

function v16El(id){ return document.getElementById(id); }
function v16Hoje(){ return new Date().toISOString().slice(0,10); }
function v16Ts(v){
  if(Number.isFinite(Number(v))) return Number(v);
  const n=Date.parse(v||"");
  return Number.isFinite(n)?n:0;
}
function v16Meta(r){
  return v16Ts(r?.updatedAt)||v16Ts(r?.alteradoEm)||v16Ts(r?.data)||v16Ts(r?.createdAt)||1;
}
function v16Key(base){
  const uid=window.viveiroUid||"";
  return uid ? `viveiro_${uid}_${base}` : `viveiro_${base}`;
}
function v16Audit(acao,detalhe="",tipo="sistema"){
  auditoria.unshift({id:novoId(),acao,detalhe,tipo,data:new Date().toISOString(),updatedAt:Date.now()});
  auditoria=auditoria.slice(0,250);
}
function garantirEstruturaFinal(){
  if(!Array.isArray(reservas)) reservas=[];
  if(!Array.isArray(manejos)) manejos=[];
  if(!Array.isArray(insumos)) insumos=[];
  if(!Array.isArray(movimentosInsumos)) movimentosInsumos=[];
  if(!Array.isArray(lixeira)) lixeira=[];
  if(!Array.isArray(auditoria)) auditoria=[];

  canteiros.forEach(c=>{
    if(c.updatedAt==null)c.updatedAt=1;
    if(!c.fase)c.fase="formacao";
    if(c.lote==null)c.lote="";
    if(c.origem==null)c.origem="";
    if(c.dataEstaquia==null)c.dataEstaquia="";
    if(c.dataTransplante==null)c.dataTransplante="";
    if(c.previsaoPronta==null)c.previsaoPronta="";
  });
  lancamentos.forEach(l=>{
    if(l.updatedAt==null)l.updatedAt=v16Ts(l.data)||1;
    if(l.telefone==null)l.telefone="";
    if(l.responsavel==null)l.responsavel="";
  });
}

function salvarFinalLocal(){
  garantirEstruturaFinal();
  const dados={
    canteiros,lancamentos,reservas,manejos,insumos,movimentosInsumos,lixeira,auditoria
  };
  Object.entries(dados).forEach(([k,v])=>localStorage.setItem(v16Key(k),JSON.stringify(v)));
}

/* Substitui persistência antiga por cache separado por usuário. */
salvar=function(marcarAlteracao=true){
  salvarFinalLocal();
  if(marcarAlteracao){
    const agora=Date.now();
    localStorage.setItem(v16Key("last_modified"),String(agora));
    if(window.firebaseSync && !window.firebaseSync.aplicandoNuvem)window.firebaseSync.agendar();
  }
  atualizarStatusBackup();
};

/* -------------------------- cálculo real -------------------------- */
function reservasCanteiroFinal(id,ignorar=null){
  return reservas
    .filter(r=>r.canteiro===id && r.status==="pendente" && r.id!==ignorar)
    .reduce((s,r)=>s+Number(r.quantidade||0),0);
}

calculoCanteiro=function(id,ignorarLancamentoId=null){
  const c=canteiros.find(x=>x.id===id);
  if(!c)return null;

  const ativos=lancamentos.filter(l=>l.id!==ignorarLancamentoId);
  const plantadas=ativos.filter(l=>l.tipo==="plantio"&&l.canteiro===id)
    .reduce((s,l)=>s+Number(l.quantidade||0),0);
  const saidas=ativos.filter(l=>l.tipo==="saida"&&l.canteiro===id)
    .reduce((s,l)=>s+Number(l.quantidade||0),0);
  const perdas=ativos.filter(l=>l.tipo==="perda"&&l.canteiro===id)
    .reduce((s,l)=>s+Number(l.quantidade||0),0);
  const transfSaida=ativos.filter(l=>l.tipo==="transferencia"&&l.canteiro===id)
    .reduce((s,l)=>s+Number(l.quantidade||0),0);
  const transfEntrada=ativos.filter(l=>l.tipo==="transferencia"&&l.destinoCanteiro===id)
    .reduce((s,l)=>s+Number(l.quantidade||0),0);

  const baseRecebida=plantadas+transfEntrada;
  const ocupacaoPlantio=Math.max(0,baseRecebida-perdas-transfSaida);
  const existentes=Math.max(0,ocupacaoPlantio-saidas);
  const reservadas=reservasCanteiroFinal(id);
  const disponiveis=Math.max(0,existentes-reservadas);
  const falta=Math.max(0,Number(c.capacidade||0)-ocupacaoPlantio);
  const sobrevivencia=baseRecebida>0?Math.max(0,(baseRecebida-perdas)/baseRecebida*100):100;

  return {
    capacidade:Number(c.capacidade||0),plantadas,saidas,perdas,
    transferenciasEntrada:transfEntrada,transferenciasSaida:transfSaida,
    ocupacaoPlantio,existentes,reservadas,disponiveis,falta,sobrevivencia
  };
};

function resumoGeralFinal(){
  return canteiros.reduce((a,c)=>{
    const r=calculoCanteiro(c.id);
    a.cap+=r.capacidade;a.plant+=r.plantadas;a.saidas+=r.saidas;a.perdas+=r.perdas;
    a.reservadas+=r.reservadas;a.disp+=r.disponiveis;a.falta+=r.falta;
    a.base+=r.plantadas+r.transferenciasEntrada;
    return a;
  },{cap:0,plant:0,saidas:0,perdas:0,reservadas:0,disp:0,falta:0,base:0});
}

function diasDesdeFinal(data){
  if(!data)return null;
  const d=new Date(data+"T12:00:00"),ag=new Date();
  return Math.max(0,Math.floor((ag-d)/86400000));
}
function formatDataFinal(data){
  if(!data)return "—";
  try{return new Date(data+"T12:00:00").toLocaleDateString("pt-BR")}catch{return data}
}
function faseTextoFinal(f){return f==="pronta"?"Pronta":f==="rustificacao"?"Rustificação":"Formação"}

/* -------------------------- dashboard -------------------------- */
const resumoBaseFinal=resumo;
resumo=function(){
  resumoBaseFinal();
  const t=resumoGeralFinal();
  const surv=t.base>0?Math.max(0,(t.base-t.perdas)/t.base*100):100;
  v16El("v16Reservadas").textContent=fmt(t.reservadas);
  v16El("v16Perdas").textContent=fmt(t.perdas);
  v16El("v16Sobrevivencia").textContent=surv.toFixed(1).replace(".",",")+"%";
  v16El("v16Prontas").textContent=String(canteiros.filter(c=>c.fase==="pronta").length);
  renderAlertasFinal();
};

function renderAlertasFinal(){
  const alvo=v16El("v16Alertas");if(!alvo)return;
  const hoje=v16Hoje(),limite=new Date();limite.setDate(limite.getDate()+7);
  const lim=limite.toISOString().slice(0,10);
  const itens=[];

  const vencidas=reservas.filter(r=>r.status==="pendente"&&r.dataPrevista&&r.dataPrevista<hoje).length;
  if(vencidas)itens.push({c:"danger",t:`${vencidas} reserva(s) com retirada atrasada.`});

  const breve=reservas.filter(r=>r.status==="pendente"&&r.dataPrevista&&r.dataPrevista>=hoje&&r.dataPrevista<=lim).length;
  if(breve)itens.push({c:"warn",t:`${breve} reserva(s) previstas para os próximos 7 dias.`});

  const manejosAtrasados=manejos.filter(m=>m.status==="programado"&&m.data&&m.data<hoje).length;
  if(manejosAtrasados)itens.push({c:"warn",t:`${manejosAtrasados} manejo(s) programados estão atrasados.`});

  const baixos=insumos.filter(i=>Number(i.minimo||0)>0&&saldoInsumoFinal(i.id)<=Number(i.minimo||0)).length;
  if(baixos)itens.push({c:"warn",t:`${baixos} insumo(s) atingiram o estoque mínimo.`});

  const altaPerda=canteiros.filter(c=>{
    const r=calculoCanteiro(c.id);
    return r.plantadas>0 && r.perdas/r.plantadas>=.05;
  }).length;
  if(altaPerda)itens.push({c:"danger",t:`${altaPerda} canteiro(s) estão com perdas iguais ou superiores a 5%.`});

  const prontasHoje=canteiros.filter(c=>c.previsaoPronta&&c.previsaoPronta<=hoje&&c.fase!=="pronta").length;
  if(prontasHoje)itens.push({c:"ok",t:`${prontasHoje} canteiro(s) já alcançaram a previsão de muda pronta.`});

  alvo.innerHTML=itens.length
    ?itens.map(x=>`<div class="v16-alert ${x.c}">${escapeHtml(x.t)}</div>`).join("")
    :`<div class="v16-alert ok">Nenhum alerta importante no momento.</div>`;
}

/* -------------------------- canteiros -------------------------- */
const renderCanteirosBaseFinal=renderCanteiros;
renderCanteiros=function(){
  renderCanteirosBaseFinal();
  document.querySelectorAll(".canteiro[data-canteiro-id]").forEach(card=>{
    const id=Number(card.dataset.canteiroId),c=canteiros.find(x=>x.id===id),r=calculoCanteiro(id);
    if(!c||!r)return;
    const body=card.querySelector(".canteiro-body");
    const botoes=body?.querySelector(".btnrow");
    if(!body||!botoes)return;

    const idade=diasDesdeFinal(c.dataTransplante||c.dataEstaquia);
    const extra=document.createElement("div");
    extra.className="v16-canteiro-extra";
    extra.innerHTML=`
      <div><small>Lote</small><strong>${escapeHtml(c.lote||"—")}</strong></div>
      <div><small>Fase</small><strong>${faseTextoFinal(c.fase)}</strong></div>
      <div><small>Idade</small><strong>${idade==null?"—":idade+" dias"}</strong></div>
      <div><small>Reservadas</small><strong>${fmt(r.reservadas)}</strong></div>
      <div><small>Perdas</small><strong>${fmt(r.perdas)}</strong></div>
      <div><small>Sobrevivência</small><strong>${r.sobrevivencia.toFixed(1).replace(".",",")}%</strong></div>
      <div><small>Previsão pronta</small><strong>${formatDataFinal(c.previsaoPronta)}</strong></div>
      <div><small>Existentes</small><strong>${fmt(r.existentes)}</strong></div>
      <div><small>Disponíveis reais</small><strong>${fmt(r.disponiveis)}</strong></div>`;
    body.insertBefore(extra,botoes);

    const mini=document.createElement("div");
    mini.className="v16-mini-actions";
    mini.innerHTML=`
      <button class="secondary" onclick="abrirPerdaFinal(${id})">Perda</button>
      <button class="secondary" onclick="abrirTransferFinal(${id})">Transferir</button>
      <button class="secondary" onclick="abrirReservaFinal('',${id})">Reservar</button>`;
    body.insertBefore(mini,botoes);

    const danger=botoes.querySelector(".danger");
    if(danger)danger.textContent="Lixeira";
  });
};

abrirAdicionarCanteiro=(function(base){
  return function(){
    base();
    v16El("cLote").value="";
    v16El("cOrigem").value="";
    v16El("cDataEstaquia").value="";
    v16El("cDataTransplante").value="";
    v16El("cPrevisaoPronta").value="";
    v16El("cFase").value="formacao";
  };
})(abrirAdicionarCanteiro);

abrirCanteiro=(function(base){
  return function(id){
    base(id);
    const c=canteiros.find(x=>x.id===id);if(!c)return;
    v16El("cLote").value=c.lote||"";
    v16El("cOrigem").value=c.origem||"";
    v16El("cDataEstaquia").value=c.dataEstaquia||"";
    v16El("cDataTransplante").value=c.dataTransplante||"";
    v16El("cPrevisaoPronta").value=c.previsaoPronta||"";
    v16El("cFase").value=c.fase||"formacao";
  };
})(abrirCanteiro);

salvarCanteiro=function(){
  const numero=Number(cNumero.value),variedade=cVar.value.trim();
  const cima=Math.max(0,Number(cCima.value||0)),baixo=Math.max(0,Number(cBaixo.value||0)),capacidade=cima+baixo;
  const obs=cObs.value.trim(),agora=Date.now();
  if(!Number.isInteger(numero)||numero<=0){toastMsg("Informe um número de canteiro válido.");return}
  if(!variedade){toastMsg("Informe a variedade.");return}
  if(capacidade<=0){toastMsg("Informe a capacidade do canteiro de cima e/ou de baixo.");return}

  const extras={
    lote:v16El("cLote").value.trim(),origem:v16El("cOrigem").value.trim(),
    dataEstaquia:v16El("cDataEstaquia").value,dataTransplante:v16El("cDataTransplante").value,
    previsaoPronta:v16El("cPrevisaoPronta").value,fase:v16El("cFase").value||"formacao"
  };

  if(modoNovoCanteiro){
    if(canteiros.some(c=>c.id===numero)){toastMsg("Já existe um canteiro com esse número.");return}
    backupAutomatico();
    canteiros.push({id:numero,variedade,cima,baixo,capacidade,obs,...extras,createdAt:agora,updatedAt:agora});
    v16Audit("Canteiro criado",`Canteiro ${numero} • ${variedade}`,"canteiro");
    salvar();fecharModalCanteiro();renderTudo();toastMsg("Canteiro adicionado.");return;
  }

  const c=canteiros.find(x=>x.id===editandoCanteiroId);if(!c)return;
  const r=calculoCanteiro(c.id);
  if(capacidade<r.ocupacaoPlantio){
    toastMsg(`A capacidade não pode ficar abaixo das ${fmt(r.ocupacaoPlantio)} posições atualmente ocupadas.`);return;
  }
  backupAutomatico();
  Object.assign(c,{variedade,cima,baixo,capacidade,obs,...extras,updatedAt:agora});
  v16Audit("Canteiro atualizado",`Canteiro ${c.id} • ${variedade}`,"canteiro");
  salvar();fecharModalCanteiro();renderTudo();toastMsg("Canteiro atualizado.");
};

/* -------------------------- plantio / saída -------------------------- */
novoLancamento=function(tipo,canteiro,quantidade,destino,obs,extras={}){
  backupAutomatico();
  const agora=Date.now();
  lancamentos.push({
    id:novoId(),tipo,canteiro,quantidade,destino,obs,data:new Date().toISOString(),
    inicial:false,createdAt:agora,updatedAt:agora,...extras
  });
  v16Audit("Movimentação registrada",`${tipo} • Canteiro ${canteiro} • ${quantidade}`,"movimentacao");
  salvar();renderTudo();
  toastMsg(tipo==="plantio"?"Plantio registrado.":tipo==="saida"?"Saída registrada.":"Movimentação registrada.");
};

abrirModalSaida=(function(base){
  return function(id=null){
    base(id);
    v16El("saidaTelefone").value="";
    v16El("saidaResponsavel").value="";
  };
})(abrirModalSaida);

registrarSaida=function(){
  const id=Number(saidaBed.value),qtd=Number(saidaQty.value),destino=saidaDestino.value.trim(),obs=saidaObs.value.trim();
  const r=calculoCanteiro(id);
  if(!Number.isFinite(qtd)||qtd<=0){toastMsg("Informe uma quantidade válida.");return}
  if(qtd>r.disponiveis){toastMsg(`Há ${fmt(r.disponiveis)} mudas disponíveis e não reservadas nesse canteiro.`);return}
  novoLancamento("saida",id,qtd,destino,obs,{telefone:v16El("saidaTelefone").value.trim(),responsavel:v16El("saidaResponsavel").value.trim()});
  fecharModalSaida();
};

salvarEdicaoLancamento=function(){
  const l=lancamentos.find(x=>x.id===editandoLancamentoId);if(!l)return;
  const tipo=eTipo.value,canteiro=Number(eBed.value),qtd=Number(eQtd.value),destino=eDestino.value.trim(),obs=eObs.value.trim();
  if(!Number.isFinite(qtd)||qtd<=0){toastMsg("Informe uma quantidade válida.");return}
  if(tipo==="plantio"){if(!validarPlantio(canteiro,qtd,l.id))return}
  else{
    const r=calculoCanteiro(canteiro,l.id);
    if(!r){toastMsg("Canteiro não encontrado.");return}
    if(qtd>r.disponiveis){toastMsg(`Há ${fmt(r.disponiveis)} mudas disponíveis considerando a correção.`);return}
  }
  backupAutomatico();
  Object.assign(l,{tipo,canteiro,quantidade:qtd,destino:tipo==="saida"?destino:"",obs,updatedAt:Date.now()});
  v16Audit("Movimentação editada",`${tipo} • Canteiro ${canteiro}`,"movimentacao");
  salvar();fecharModalEdit();renderTudo();toastMsg("Lançamento alterado.");
};

/* -------------------------- perda / transferência -------------------------- */
function popularCanteirosFinal(select,valor="",incluirViveiro=false){
  if(!select)return;
  select.innerHTML=(incluirViveiro?`<option value="">Viveiro inteiro</option>`:"")+
    canteiros.map(c=>`<option value="${c.id}">Canteiro ${String(c.id).padStart(2,"0")} • ${escapeHtml(c.variedade)}</option>`).join("");
  if(valor!==""&&[...select.options].some(o=>o.value===String(valor)))select.value=String(valor);
}
function fecharModalFinal(id){v16El(id)?.classList.add("hidden")}

function abrirPerdaFinal(canteiro=null,id=""){
  if(!canteiros.length){toastMsg("Cadastre um canteiro primeiro.");return}
  const l=id?lancamentos.find(x=>x.id===id):null;
  v16El("perdaEditIdFinal").value=l?.id||"";
  v16El("perdaTitleFinal").textContent=l?"Editar perda":"Registrar perda";
  popularCanteirosFinal(v16El("perdaBedFinal"),l?.canteiro??canteiro??"");
  v16El("perdaQtyFinal").value=l?.quantidade||"";
  v16El("perdaMotivoFinal").value=l?.motivo||"Mortalidade";
  v16El("perdaDataFinal").value=l?.data?.slice(0,10)||v16Hoje();
  v16El("perdaObsFinal").value=l?.obs||"";
  v16El("modalPerdaFinal").classList.remove("hidden");
}
function salvarPerdaFinal(){
  const edit=v16El("perdaEditIdFinal").value,id=Number(v16El("perdaBedFinal").value),qtd=Number(v16El("perdaQtyFinal").value||0);
  const l=edit?lancamentos.find(x=>x.id===edit):null,r=calculoCanteiro(id,edit||null);
  if(!r||qtd<=0){toastMsg("Informe canteiro e quantidade.");return}
  if(qtd>r.existentes){toastMsg(`Existem ${fmt(r.existentes)} mudas nesse canteiro.`);return}
  backupAutomatico();const agora=Date.now();
  const obj={id:l?.id||novoId(),tipo:"perda",canteiro:id,quantidade:qtd,motivo:v16El("perdaMotivoFinal").value,
    obs:v16El("perdaObsFinal").value.trim(),destino:"",data:(v16El("perdaDataFinal").value||v16Hoje())+"T12:00:00",
    inicial:false,createdAt:l?.createdAt||agora,updatedAt:agora};
  if(l)Object.assign(l,obj);else lancamentos.push(obj);
  v16Audit(l?"Perda editada":"Perda registrada",`Canteiro ${id} • ${qtd}`,"perda");
  salvar();fecharModalFinal("modalPerdaFinal");renderTudo();toastMsg("Perda registrada.");
}

function abrirTransferFinal(origem=null,id=""){
  if(canteiros.length<2){toastMsg("É necessário ter pelo menos dois canteiros.");return}
  const l=id?lancamentos.find(x=>x.id===id):null;
  v16El("transferEditIdFinal").value=l?.id||"";
  v16El("transferTitleFinal").textContent=l?"Editar transferência":"Transferir mudas";
  popularCanteirosFinal(v16El("transferOrigemFinal"),l?.canteiro??origem??"");
  popularCanteirosFinal(v16El("transferDestinoFinal"),l?.destinoCanteiro??"");
  if(!l&&origem!=null){
    const outro=canteiros.find(c=>c.id!==Number(origem));if(outro)v16El("transferDestinoFinal").value=String(outro.id);
  }
  v16El("transferQtyFinal").value=l?.quantidade||"";
  v16El("transferDataFinal").value=l?.data?.slice(0,10)||v16Hoje();
  v16El("transferObsFinal").value=l?.obs||"";
  v16El("modalTransferFinal").classList.remove("hidden");
}
function salvarTransferFinal(){
  const edit=v16El("transferEditIdFinal").value,orig=Number(v16El("transferOrigemFinal").value),dest=Number(v16El("transferDestinoFinal").value);
  const qtd=Number(v16El("transferQtyFinal").value||0),l=edit?lancamentos.find(x=>x.id===edit):null;
  if(orig===dest){toastMsg("Origem e destino precisam ser diferentes.");return}
  const ro=calculoCanteiro(orig,edit||null),rd=calculoCanteiro(dest,edit||null);
  if(!ro||!rd||qtd<=0){toastMsg("Confira os dados da transferência.");return}
  if(qtd>ro.disponiveis){toastMsg(`Há ${fmt(ro.disponiveis)} mudas livres na origem.`);return}
  if(qtd>rd.falta){toastMsg(`O canteiro de destino comporta mais ${fmt(rd.falta)} mudas.`);return}
  backupAutomatico();const agora=Date.now();
  const obj={id:l?.id||novoId(),tipo:"transferencia",canteiro:orig,destinoCanteiro:dest,quantidade:qtd,destino:"",
    obs:v16El("transferObsFinal").value.trim(),data:(v16El("transferDataFinal").value||v16Hoje())+"T12:00:00",
    inicial:false,createdAt:l?.createdAt||agora,updatedAt:agora};
  if(l)Object.assign(l,obj);else lancamentos.push(obj);
  v16Audit(l?"Transferência editada":"Transferência registrada",`Canteiro ${orig} → ${dest} • ${qtd}`,"transferencia");
  salvar();fecharModalFinal("modalTransferFinal");renderTudo();toastMsg("Transferência registrada.");
}
function editarMovimentacaoFinal(id){
  const l=lancamentos.find(x=>x.id===id);if(!l)return;
  if(l.tipo==="perda")abrirPerdaFinal(null,id);
  if(l.tipo==="transferencia")abrirTransferFinal(null,id);
}

/* -------------------------- reservas -------------------------- */
function abrirReservaFinal(id="",canteiro=null){
  const r=id?reservas.find(x=>x.id===id):null;
  v16El("reservaEditIdFinal").value=r?.id||"";
  v16El("reservaTitleFinal").textContent=r?"Editar reserva":"Nova reserva";
  popularCanteirosFinal(v16El("reservaBedFinal"),r?.canteiro??canteiro??"");
  v16El("reservaQtyFinal").value=r?.quantidade||"";
  v16El("reservaClienteFinal").value=r?.cliente||"";
  v16El("reservaTelefoneFinal").value=r?.telefone||"";
  v16El("reservaDataFinal").value=r?.dataPrevista||"";
  v16El("reservaStatusFinal").value=r?.status==="cancelada"?"cancelada":"pendente";
  v16El("reservaObsFinal").value=r?.obs||"";
  v16El("modalReservaFinal").classList.remove("hidden");
}
function salvarReservaFinal(){
  const edit=v16El("reservaEditIdFinal").value,id=Number(v16El("reservaBedFinal").value),qtd=Number(v16El("reservaQtyFinal").value||0);
  const atual=edit?reservas.find(x=>x.id===edit):null,r=calculoCanteiro(id);
  if(!r||qtd<=0){toastMsg("Informe canteiro e quantidade.");return}
  const livre=r.disponiveis+(atual?.status==="pendente"&&atual.canteiro===id?Number(atual.quantidade||0):0);
  if(v16El("reservaStatusFinal").value==="pendente"&&qtd>livre){toastMsg(`Há ${fmt(livre)} mudas livres para reserva.`);return}
  const cliente=v16El("reservaClienteFinal").value.trim();if(!cliente){toastMsg("Informe o cliente ou destino.");return}
  backupAutomatico();const agora=Date.now();
  const obj={id:atual?.id||novoId(),canteiro:id,quantidade:qtd,cliente,telefone:v16El("reservaTelefoneFinal").value.trim(),
    dataPrevista:v16El("reservaDataFinal").value,status:v16El("reservaStatusFinal").value,obs:v16El("reservaObsFinal").value.trim(),
    createdAt:atual?.createdAt||agora,updatedAt:agora};
  if(atual)Object.assign(atual,obj);else reservas.push(obj);
  v16Audit(atual?"Reserva editada":"Reserva criada",`${cliente} • ${qtd} mudas`,"reserva");
  salvar();fecharModalFinal("modalReservaFinal");renderTudo();toastMsg("Reserva salva.");
}
function entregarReservaFinal(id){
  const r=reservas.find(x=>x.id===id);if(!r||r.status!=="pendente")return;
  const calc=calculoCanteiro(r.canteiro),outras=reservasCanteiroFinal(r.canteiro,r.id);
  const livreParaEsta=Math.max(0,calc.existentes-outras);
  if(Number(r.quantidade)>livreParaEsta){toastMsg(`Estoque insuficiente. Existem ${fmt(livreParaEsta)} mudas para esta reserva.`);return}
  if(!confirm(`Registrar saída de ${fmt(r.quantidade)} mudas para ${r.cliente}?`))return;
  backupAutomatico();
  const agora=Date.now();
  lancamentos.push({id:novoId(),tipo:"saida",canteiro:r.canteiro,quantidade:Number(r.quantidade),destino:r.cliente,
    telefone:r.telefone||"",responsavel:"",obs:r.obs||"Saída gerada por reserva",data:new Date().toISOString(),inicial:false,
    reservaId:r.id,createdAt:agora,updatedAt:agora});
  r.status="entregue";r.entregueEm=new Date().toISOString();r.updatedAt=agora;
  v16Audit("Reserva entregue",`${r.cliente} • ${r.quantidade} mudas`,"reserva");
  salvar();renderTudo();toastMsg("Reserva entregue e saída registrada.");
}
function excluirReservaFinal(id){
  const r=reservas.find(x=>x.id===id);if(!r)return;
  if(!confirm("Mover esta reserva para a lixeira?"))return;
  enviarLixeiraFinal("reserva",r,r.id,`${r.cliente} • ${r.quantidade} mudas`);
  reservas=reservas.filter(x=>x.id!==id);salvar();renderTudo();
}

/* -------------------------- manejo -------------------------- */
function abrirManejoFinal(id=""){
  const m=id?manejos.find(x=>x.id===id):null;
  v16El("manejoEditIdFinal").value=m?.id||"";
  v16El("manejoTitleFinal").textContent=m?"Editar manejo":"Novo manejo";
  v16El("manejoDataFinal").value=m?.data||v16Hoje();
  popularCanteirosFinal(v16El("manejoBedFinal"),m?.canteiro??"",true);
  v16El("manejoTipoFinal").value=m?.tipo||"Irrigação";
  v16El("manejoStatusFinal").value=m?.status||"programado";
  popularInsumosFinal(v16El("manejoInsumoFinal"),m?.insumoId||"",true);
  v16El("manejoQtdInsumoFinal").value=m?.qtdInsumo||"";
  v16El("manejoObsFinal").value=m?.obs||"";
  v16El("modalManejoFinal").classList.remove("hidden");
}
function salvarManejoFinal(){
  const edit=v16El("manejoEditIdFinal").value,atual=edit?manejos.find(x=>x.id===edit):null;
  const status=v16El("manejoStatusFinal").value,insumoId=v16El("manejoInsumoFinal").value,qtd=Number(v16El("manejoQtdInsumoFinal").value||0);
  if(status==="concluido"&&insumoId&&qtd>0&&!atual?.estoqueBaixado){
    if(qtd>saldoInsumoFinal(insumoId)){toastMsg("Estoque insuficiente do insumo selecionado.");return}
  }
  backupAutomatico();const agora=Date.now();
  const obj={id:atual?.id||novoId(),data:v16El("manejoDataFinal").value||v16Hoje(),canteiro:v16El("manejoBedFinal").value?Number(v16El("manejoBedFinal").value):null,
    tipo:v16El("manejoTipoFinal").value,status,insumoId,qtdInsumo:qtd,obs:v16El("manejoObsFinal").value.trim(),
    createdAt:atual?.createdAt||agora,updatedAt:agora,estoqueBaixado:atual?.estoqueBaixado||false};
  if(status==="concluido"&&insumoId&&qtd>0&&!obj.estoqueBaixado){
    movimentosInsumos.push({id:novoId(),insumoId,tipo:"saida",quantidade:qtd,custoUnitario:custoMedioInsumoFinal(insumoId),
      data:obj.data,obs:`Manejo: ${obj.tipo}`,manejoId:obj.id,createdAt:agora,updatedAt:agora});
    obj.estoqueBaixado=true;
  }
  if(atual)Object.assign(atual,obj);else manejos.push(obj);
  v16Audit(atual?"Manejo editado":"Manejo registrado",`${obj.tipo} • ${obj.data}`,"manejo");
  salvar();fecharModalFinal("modalManejoFinal");renderTudo();toastMsg("Manejo salvo.");
}
function concluirManejoFinal(id){
  const m=manejos.find(x=>x.id===id);if(!m)return;
  abrirManejoFinal(id);v16El("manejoStatusFinal").value="concluido";
}
function excluirManejoFinal(id){
  const m=manejos.find(x=>x.id===id);if(!m)return;
  if(m.estoqueBaixado){toastMsg("Este manejo já gerou baixa de estoque. Edite o registro em vez de excluir.");return}
  if(!confirm("Mover este manejo para a lixeira?"))return;
  enviarLixeiraFinal("manejo",m,m.id,`${m.tipo} • ${m.data}`);manejos=manejos.filter(x=>x.id!==id);salvar();renderTudo();
}

/* -------------------------- insumos -------------------------- */
function saldoInsumoFinal(id){
  return movimentosInsumos.filter(m=>m.insumoId===id).reduce((s,m)=>s+(m.tipo==="saida"?-Number(m.quantidade||0):Number(m.quantidade||0)),0);
}
function custoMedioInsumoFinal(id){
  const xs=movimentosInsumos.filter(m=>m.insumoId===id&&m.tipo==="entrada");
  const q=xs.reduce((s,m)=>s+Number(m.quantidade||0),0),v=xs.reduce((s,m)=>s+Number(m.quantidade||0)*Number(m.custoUnitario||0),0);
  return q>0?v/q:0;
}
function popularInsumosFinal(select,valor="",vazio=false){
  if(!select)return;
  select.innerHTML=(vazio?`<option value="">Sem baixa de estoque</option>`:"")+
    insumos.map(i=>`<option value="${i.id}">${escapeHtml(i.nome)} • ${fmt(saldoInsumoFinal(i.id))} ${escapeHtml(i.unidade)}</option>`).join("");
  if(valor&&[...select.options].some(o=>o.value===valor))select.value=valor;
}
function abrirInsumoFinal(id=""){
  const i=id?insumos.find(x=>x.id===id):null;
  v16El("insumoEditIdFinal").value=i?.id||"";v16El("insumoTitleFinal").textContent=i?"Editar insumo":"Novo insumo";
  v16El("insumoNomeFinal").value=i?.nome||"";v16El("insumoUnidadeFinal").value=i?.unidade||"kg";
  v16El("insumoMinFinal").value=i?.minimo??"";v16El("insumoObsFinal").value=i?.obs||"";
  v16El("modalInsumoFinal").classList.remove("hidden");
}
function salvarInsumoFinal(){
  const id=v16El("insumoEditIdFinal").value,atual=id?insumos.find(x=>x.id===id):null,nome=v16El("insumoNomeFinal").value.trim();
  if(!nome){toastMsg("Informe o nome do produto.");return}
  backupAutomatico();const agora=Date.now(),obj={id:atual?.id||novoId(),nome,unidade:v16El("insumoUnidadeFinal").value,
    minimo:Number(v16El("insumoMinFinal").value||0),obs:v16El("insumoObsFinal").value.trim(),createdAt:atual?.createdAt||agora,updatedAt:agora};
  if(atual)Object.assign(atual,obj);else insumos.push(obj);
  v16Audit(atual?"Insumo editado":"Insumo cadastrado",nome,"insumo");salvar();fecharModalFinal("modalInsumoFinal");renderTudo();toastMsg("Produto salvo.");
}
function abrirMovInsumoFinal(id=""){
  if(!insumos.length){toastMsg("Cadastre um insumo primeiro.");abrirInsumoFinal();return}
  popularInsumosFinal(v16El("movInsumoFinal"),id||insumos[0].id);
  v16El("movTipoFinal").value="entrada";v16El("movQtdFinal").value="";v16El("movCustoFinal").value="";
  v16El("movDataFinal").value=v16Hoje();v16El("movObsFinal").value="";ajustarMovInsumoFinal();v16El("modalMovInsumoFinal").classList.remove("hidden");
}
function ajustarMovInsumoFinal(){
  const id=v16El("movInsumoFinal").value,i=insumos.find(x=>x.id===id),tipo=v16El("movTipoFinal").value;
  v16El("movCustoWrapFinal").classList.toggle("hidden",tipo!=="entrada");
  v16El("movSaldoFinal").textContent=i?`Saldo atual: ${fmt(saldoInsumoFinal(id))} ${i.unidade} • custo médio R$ ${custoMedioInsumoFinal(id).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"";
}
function salvarMovInsumoFinal(){
  const id=v16El("movInsumoFinal").value,i=insumos.find(x=>x.id===id),tipo=v16El("movTipoFinal").value,qtd=Number(v16El("movQtdFinal").value||0);
  if(!i||qtd<=0){toastMsg("Confira produto e quantidade.");return}
  if(tipo==="saida"&&qtd>saldoInsumoFinal(id)){toastMsg(`Estoque insuficiente. Saldo: ${fmt(saldoInsumoFinal(id))} ${i.unidade}.`);return}
  backupAutomatico();const agora=Date.now();
  movimentosInsumos.push({id:novoId(),insumoId:id,tipo,quantidade:qtd,custoUnitario:tipo==="entrada"?Number(v16El("movCustoFinal").value||0):custoMedioInsumoFinal(id),
    data:v16El("movDataFinal").value||v16Hoje(),obs:v16El("movObsFinal").value.trim(),createdAt:agora,updatedAt:agora});
  v16Audit(tipo==="entrada"?"Entrada de insumo":"Saída de insumo",`${i.nome} • ${qtd} ${i.unidade}`,"insumo");
  salvar();fecharModalFinal("modalMovInsumoFinal");renderTudo();toastMsg("Movimentação de estoque registrada.");
}

/* -------------------------- lixeira -------------------------- */
function enviarLixeiraFinal(tipo,item,refId,descricao){
  const agora=Date.now();
  lixeira.push({id:novoId(),tipo,refId:String(refId),descricao,item:structuredClone(item),excluidoEm:agora,updatedAt:agora});
  v16Audit("Enviado para a lixeira",descricao,tipo);
}
removerCanteiro=function(id){
  const c=canteiros.find(x=>x.id===id);if(!c)return;
  const r=calculoCanteiro(id);
  if(!confirm(`Mover o Canteiro ${String(id).padStart(2,"0")} (${c.variedade}) para a lixeira?\n\nDisponíveis: ${fmt(r.disponiveis)}\nPerdas: ${fmt(r.perdas)}\nReservadas: ${fmt(r.reservadas)}\n\nOs registros ligados a ele serão guardados junto para restauração.`))return;
  backupAutomatico();
  const bundle={canteiro:structuredClone(c),
    lancamentos:lancamentos.filter(l=>l.canteiro===id||l.destinoCanteiro===id),
    reservas:reservas.filter(x=>x.canteiro===id),
    manejos:manejos.filter(x=>x.canteiro===id)};
  enviarLixeiraFinal("canteiro",bundle,id,`Canteiro ${id} • ${c.variedade}`);
  canteiros=canteiros.filter(x=>x.id!==id);
  lancamentos=lancamentos.filter(l=>l.canteiro!==id&&l.destinoCanteiro!==id);
  reservas=reservas.filter(x=>x.canteiro!==id);manejos=manejos.filter(x=>x.canteiro!==id);
  salvar();renderTudo();toastMsg("Canteiro movido para a lixeira.");
};
excluirLancamento=function(id){
  const l=lancamentos.find(x=>x.id===id);if(!l||l.inicial)return;
  if(!confirm("Mover esta movimentação para a lixeira?"))return;
  backupAutomatico();enviarLixeiraFinal("lancamento",l,l.id,`${l.tipo} • ${l.quantidade} mudas`);
  lancamentos=lancamentos.filter(x=>x.id!==id);salvar();renderTudo();toastMsg("Movimentação movida para a lixeira.");
};
function restaurarLixeiraFinal(id){
  const t=lixeira.find(x=>x.id===id);if(!t||t.apagadoEm||t.restauradoEm)return;
  const agora=Date.now(),item=structuredClone(t.item);
  if(t.tipo==="canteiro"){
    const b=item;
    if(canteiros.some(c=>String(c.id)===String(b.canteiro.id))){toastMsg("Já existe um canteiro com esse número.");return}
    b.canteiro.updatedAt=agora;canteiros.push(b.canteiro);
    (b.lancamentos||[]).forEach(x=>{x.updatedAt=agora;lancamentos.push(x)});
    (b.reservas||[]).forEach(x=>{x.updatedAt=agora;reservas.push(x)});
    (b.manejos||[]).forEach(x=>{x.updatedAt=agora;manejos.push(x)});
  }else if(t.tipo==="lancamento"){item.updatedAt=agora;lancamentos.push(item)}
  else if(t.tipo==="reserva"){item.updatedAt=agora;reservas.push(item)}
  else if(t.tipo==="manejo"){item.updatedAt=agora;manejos.push(item)}
  else if(t.tipo==="insumo"){item.updatedAt=agora;insumos.push(item)}
  t.restauradoEm=agora;t.updatedAt=agora;
  v16Audit("Registro restaurado",t.descricao,t.tipo);salvar();renderTudo();toastMsg("Registro restaurado.");
}
function apagarLixeiraFinal(id){
  const t=lixeira.find(x=>x.id===id);if(!t)return;
  if(!confirm("Apagar definitivamente este item?"))return;
  t.apagadoEm=Date.now();t.item=null;t.updatedAt=t.apagadoEm;salvar();renderTudo();toastMsg("Item apagado definitivamente.");
}

/* -------------------------- histórico -------------------------- */
renderHistorico=function(){
  const filtro=histFiltro?.value||"todos";
  const vis=lancamentos.filter(l=>!l.inicial&&(filtro==="todos"||l.tipo===filtro))
    .sort((a,b)=>new Date(b.data)-new Date(a.data));
  if(!vis.length){historicoLista.innerHTML=`<div style="padding:18px;color:var(--muted);font-size:13px">Nenhuma movimentação para mostrar.</div>`;return}
  const mapa={plantio:["Plantio","＋","type-plantio"],saida:["Saída","↗","type-saida"],perda:["Perda","!",""],transferencia:["Transferência","⇄",""]};
  historicoLista.innerHTML=vis.map(l=>{
    const [txt,icon,cls]=mapa[l.tipo]||[l.tipo,"•",""],c=canteiros.find(x=>x.id===l.canteiro);
    const dest=l.tipo==="transferencia"?canteiros.find(x=>x.id===l.destinoCanteiro):null;
    let detalhe="";
    if(l.tipo==="saida"&&l.destino)detalhe=` • Destino: ${escapeHtml(l.destino)}`;
    if(l.tipo==="perda"&&l.motivo)detalhe=` • ${escapeHtml(l.motivo)}`;
    if(l.tipo==="transferencia")detalhe=` • para Canteiro ${String(l.destinoCanteiro).padStart(2,"0")} ${dest?("• "+escapeHtml(dest.variedade)):""}`;
    const editar=(l.tipo==="plantio"||l.tipo==="saida")?`abrirEdicaoLancamento('${l.id}')`:`editarMovimentacaoFinal('${l.id}')`;
    return `<div class="history-item">
      <div class="history-icon ${l.tipo==="plantio"?"plantio":l.tipo==="saida"?"saida":""}">${icon}</div>
      <div><div class="history-main ${cls}">${txt} • Canteiro ${String(l.canteiro).padStart(2,"0")} • ${escapeHtml(c?.variedade||"")}</div>
      <div class="history-meta">${new Date(l.data).toLocaleString("pt-BR")}${detalhe}</div>
      ${l.obs?`<div class="history-meta">Obs.: ${escapeHtml(l.obs)}</div>`:""}
      <div class="history-actions"><button class="secondary" onclick="${editar}">Editar</button>
      ${l.tipo==="saida"?`<button class="secondary" onclick="comprovanteSaidaFinal('${l.id}')">Comprovante</button>`:""}
      <button class="danger" onclick="excluirLancamento('${l.id}')">Lixeira</button></div></div>
      <div class="history-qty">${l.tipo==="plantio"||l.tipo==="transferencia"?"+":"-"}${fmt(l.quantidade)}</div></div>`;
  }).join("");
};

function comprovanteSaidaFinal(id){
  const l=lancamentos.find(x=>x.id===id);if(!l||l.tipo!=="saida")return;
  const c=canteiros.find(x=>x.id===l.canteiro);
  const w=window.open("","_blank");if(!w){toastMsg("Permita pop-ups para gerar o comprovante.");return}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Comprovante de saída</title><style>body{font-family:system-ui;padding:32px;color:#18231d}h1{font-size:24px}table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:10px;border-bottom:1px solid #ddd}small{color:#777}</style></head><body>
    <h1>Viveiro Café</h1><small>Comprovante de saída de mudas</small><table>
    <tr><td>Data</td><td>${new Date(l.data).toLocaleString("pt-BR")}</td></tr>
    <tr><td>Canteiro</td><td>${String(l.canteiro).padStart(2,"0")} • ${escapeHtml(c?.variedade||"")}</td></tr>
    <tr><td>Quantidade</td><td>${fmt(l.quantidade)} mudas</td></tr>
    <tr><td>Destino / Cliente</td><td>${escapeHtml(l.destino||"—")}</td></tr>
    <tr><td>Telefone</td><td>${escapeHtml(l.telefone||"—")}</td></tr>
    <tr><td>Responsável</td><td>${escapeHtml(l.responsavel||"—")}</td></tr>
    <tr><td>Observação</td><td>${escapeHtml(l.obs||"—")}</td></tr></table>
    <p style="margin-top:50px">_________________________________<br>Responsável</p>
    <script>setTimeout(()=>window.print(),300)<\/script></body></html>`);w.document.close();
}

/* -------------------------- gestão render -------------------------- */
function renderGestaoFinal(){
  garantirEstruturaFinal();
  const hoje=v16Hoje();
  const pend=reservas.filter(r=>r.status==="pendente");
  const man=manejos.filter(m=>m.status==="programado");
  const baixos=insumos.filter(i=>Number(i.minimo||0)>0&&saldoInsumoFinal(i.id)<=Number(i.minimo||0));
  const lixo=lixeira.filter(x=>!x.apagadoEm&&!x.restauradoEm);
  v16El("v16KpiReservas").textContent=String(pend.length);
  v16El("v16KpiManejos").textContent=String(man.length);
  v16El("v16KpiInsumos").textContent=String(baixos.length);
  v16El("v16KpiLixeira").textContent=String(lixo.length);

  v16El("v16ReservasLista").innerHTML=reservas.length?reservas.slice().sort((a,b)=>(a.dataPrevista||"9999").localeCompare(b.dataPrevista||"9999")).map(r=>{
    const c=canteiros.find(x=>x.id===r.canteiro),atrasada=r.status==="pendente"&&r.dataPrevista&&r.dataPrevista<hoje;
    return `<div class="v16-row"><div class="v16-row-main"><strong>${escapeHtml(r.cliente)} ${atrasada?"• ATRASADA":""}</strong>
      <small>Canteiro ${String(r.canteiro).padStart(2,"0")} • ${escapeHtml(c?.variedade||"")} • retirada ${formatDataFinal(r.dataPrevista)} • ${escapeHtml(r.status)}</small>
      <div class="v16-row-actions"><button class="secondary" onclick="abrirReservaFinal('${r.id}')">Editar</button>
      ${r.status==="pendente"?`<button class="primary" onclick="entregarReservaFinal('${r.id}')">Entregar</button>`:""}
      <button class="danger" onclick="excluirReservaFinal('${r.id}')">Lixeira</button></div></div>
      <div class="v16-row-value">${fmt(r.quantidade)}<br><small>mudas</small></div></div>`;
  }).join(""):`<div class="note">Nenhuma reserva cadastrada.</div>`;

  v16El("v16ManejosLista").innerHTML=manejos.length?manejos.slice().sort((a,b)=>(a.data||"").localeCompare(b.data||"")).map(m=>{
    const c=m.canteiro?canteiros.find(x=>x.id===m.canteiro):null,atrasado=m.status==="programado"&&m.data<hoje;
    return `<div class="v16-row"><div class="v16-row-main"><strong>${escapeHtml(m.tipo)} ${atrasado?"• ATRASADO":""}</strong>
      <small>${formatDataFinal(m.data)} • ${c?`Canteiro ${String(c.id).padStart(2,"0")} • ${escapeHtml(c.variedade)}`:"Viveiro inteiro"} • ${m.status==="concluido"?"Concluído":"Programado"}</small>
      ${m.obs?`<small>${escapeHtml(m.obs)}</small>`:""}
      <div class="v16-row-actions"><button class="secondary" onclick="abrirManejoFinal('${m.id}')">Editar</button>
      ${m.status==="programado"?`<button class="primary" onclick="concluirManejoFinal('${m.id}')">Concluir</button>`:""}
      <button class="danger" onclick="excluirManejoFinal('${m.id}')">Lixeira</button></div></div></div>`;
  }).join(""):`<div class="note">Nenhum manejo cadastrado.</div>`;

  v16El("v16InsumosLista").innerHTML=insumos.length?insumos.map(i=>{
    const saldo=saldoInsumoFinal(i.id),low=Number(i.minimo||0)>0&&saldo<=Number(i.minimo||0);
    return `<div class="v16-stock-card ${low?"low":""}"><h3>${escapeHtml(i.nome)}</h3><small>${low?"Estoque baixo • ":""}mínimo ${fmt(i.minimo||0)} ${escapeHtml(i.unidade)}</small>
      <div class="v16-stock-balance">${fmt(saldo)} ${escapeHtml(i.unidade)}</div>
      <small>Custo médio: R$ ${custoMedioInsumoFinal(i.id).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}</small>
      <div class="v16-row-actions"><button class="primary" onclick="abrirMovInsumoFinal('${i.id}')">Movimentar</button><button class="secondary" onclick="abrirInsumoFinal('${i.id}')">Editar</button></div></div>`;
  }).join(""):`<div class="note">Nenhum insumo cadastrado.</div>`;

  v16El("v16LixeiraLista").innerHTML=lixo.length?lixo.slice().sort((a,b)=>b.excluidoEm-a.excluidoEm).map(t=>`
    <div class="v16-row"><div class="v16-row-main"><strong>${escapeHtml(t.descricao||t.tipo)}</strong>
    <small>${escapeHtml(t.tipo)} • ${new Date(t.excluidoEm).toLocaleString("pt-BR")}</small>
    <div class="v16-row-actions"><button class="primary" onclick="restaurarLixeiraFinal('${t.id}')">Restaurar</button><button class="danger" onclick="apagarLixeiraFinal('${t.id}')">Apagar definitivamente</button></div></div></div>`).join("")
    :`<div class="note">A lixeira está vazia.</div>`;
}

/* -------------------------- relatório -------------------------- */
const gerarRelatorioBaseFinal=gerarRelatorio;
gerarRelatorio=function(){
  gerarRelatorioBaseFinal();
  const filtrados=obterCanteirosRelatorio();
  let base=0,perdas=0,resv=0,disp=0;
  filtrados.forEach(c=>{const r=calculoCanteiro(c.id);base+=r.plantadas+r.transferenciasEntrada;perdas+=r.perdas;resv+=r.reservadas;disp+=r.disponiveis});
  const surv=base>0?(base-perdas)/base*100:100;
  v16El("v16RDisponiveis").textContent=fmt(disp);v16El("v16RReservadas").textContent=fmt(resv);
  v16El("v16RPerdas").textContent=fmt(perdas);v16El("v16RSobrevivencia").textContent=surv.toFixed(1).replace(".",",")+"%";
};

exportarRelatorioCSV=function(){
  const linhas=[["Canteiro","Variedade","Lote","Fase","Capacidade","Plantadas","Saidas","Perdas","Reservadas","Disponiveis","Faltam","Sobrevivencia","Previsao pronta"]];
  obterCanteirosRelatorio().forEach(c=>{const r=calculoCanteiro(c.id);linhas.push([c.id,c.variedade,c.lote||"",faseTextoFinal(c.fase),r.capacidade,r.plantadas,r.saidas,r.perdas,r.reservadas,r.disponiveis,r.falta,r.sobrevivencia.toFixed(1),c.previsaoPronta||""])});
  baixarArquivo("\uFEFF"+linhas.map(l=>l.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(";")).join("\n"),"relatorio-viveiro-completo.csv","text/csv;charset=utf-8;");
};

/* -------------------------- busca -------------------------- */
function abrirBuscaFinal(){
  v16El("buscaGlobalFinal").value="";renderBuscaFinal();v16El("modalBuscaFinal").classList.remove("hidden");
  setTimeout(()=>v16El("buscaGlobalFinal").focus(),80);
}
function renderBuscaFinal(){
  const q=(v16El("buscaGlobalFinal").value||"").trim().toLowerCase();
  const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const nq=norm(q),out=[];
  canteiros.forEach(c=>out.push({t:"C",title:`Canteiro ${String(c.id).padStart(2,"0")} • ${c.variedade}`,sub:`Lote ${c.lote||"—"} • ${faseTextoFinal(c.fase)}`,txt:`${c.id} ${c.variedade} ${c.lote} ${c.origem}`,a:()=>{fecharModalFinal("modalBuscaFinal");irAbaFinal("canteiros");setTimeout(()=>abrirCanteiro(c.id),80)}}));
  reservas.forEach(r=>out.push({t:"R",title:r.cliente,sub:`Reserva ${r.quantidade} mudas • ${formatDataFinal(r.dataPrevista)}`,txt:`${r.cliente} ${r.telefone} ${r.obs}`,a:()=>{fecharModalFinal("modalBuscaFinal");irAbaFinal("gestao");setTimeout(()=>abrirReservaFinal(r.id),80)}}));
  manejos.forEach(m=>out.push({t:"M",title:m.tipo,sub:`${formatDataFinal(m.data)} • ${m.status}`,txt:`${m.tipo} ${m.obs}`,a:()=>{fecharModalFinal("modalBuscaFinal");irAbaFinal("gestao");setTimeout(()=>abrirManejoFinal(m.id),80)}}));
  insumos.forEach(i=>out.push({t:"I",title:i.nome,sub:`Saldo ${fmt(saldoInsumoFinal(i.id))} ${i.unidade}`,txt:`${i.nome} ${i.obs}`,a:()=>{fecharModalFinal("modalBuscaFinal");irAbaFinal("gestao");setTimeout(()=>abrirInsumoFinal(i.id),80)}}));
  lancamentos.filter(l=>!l.inicial).forEach(l=>{const c=canteiros.find(x=>x.id===l.canteiro);out.push({t:"H",title:`${l.tipo} • ${fmt(l.quantidade)} mudas`,sub:`Canteiro ${l.canteiro} • ${c?.variedade||""} • ${new Date(l.data).toLocaleDateString("pt-BR")}`,txt:`${l.tipo} ${l.destino} ${l.obs} ${c?.variedade}`,a:()=>{fecharModalFinal("modalBuscaFinal");irAbaFinal("historico")}})});
  const xs=(nq?out.filter(x=>norm(`${x.title} ${x.sub} ${x.txt}`).includes(nq)):out).slice(0,50);
  window.__v16Search=xs;
  v16El("buscaResultadosFinal").innerHTML=xs.length?xs.map((x,i)=>`<button class="v16-search-result" onclick="executarBuscaFinal(${i})"><span>${x.t}</span><div><strong>${escapeHtml(x.title)}</strong><small>${escapeHtml(x.sub)}</small></div></button>`).join(""):`<div class="note">Nenhum resultado encontrado.</div>`;
}
function executarBuscaFinal(i){window.__v16Search?.[i]?.a?.()}

/* -------------------------- FAB / navegação -------------------------- */
function abrirMenuAdicionarFinal(){v16El("v16FabMenu").classList.remove("hidden");v16El("v16FabBackdrop").classList.remove("hidden")}
function fecharMenuAdicionarFinal(){v16El("v16FabMenu").classList.add("hidden");v16El("v16FabBackdrop").classList.add("hidden")}
function acaoFabFinal(a){
  fecharMenuAdicionarFinal();
  if(a==="plantio")abrirModalPlantio();
  if(a==="saida")abrirModalSaida();
  if(a==="perda")abrirPerdaFinal();
  if(a==="transferencia")abrirTransferFinal();
  if(a==="reserva")abrirReservaFinal();
  if(a==="manejo")abrirManejoFinal();
  if(a==="canteiro")abrirAdicionarCanteiro();
  if(a==="insumo")abrirInsumoFinal();
}
function irAbaFinal(tab){
  const b=document.querySelector(`.navbtn[data-nav="${tab}"]`);if(b)trocarAba(tab,b);
}
trocarAba=function(tab,btn){
  ["resumo","canteiros","historico","relatorio","gestao"].forEach(t=>v16El("tab-"+t)?.classList.toggle("hidden",t!==tab));
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.remove("active"));btn?.classList.add("active");
  if(tab==="historico")renderHistorico();if(tab==="canteiros")renderCanteiros();if(tab==="relatorio")gerarRelatorio();if(tab==="gestao")renderGestaoFinal();
  window.scrollTo({top:0,behavior:"smooth"});
};

/* -------------------------- backup final -------------------------- */
criarSnapshot=function(){
  garantirEstruturaFinal();
  return {versao:"16-final",canteiros:structuredClone(canteiros),lancamentos:structuredClone(lancamentos),
    reservas:structuredClone(reservas),manejos:structuredClone(manejos),insumos:structuredClone(insumos),
    movimentosInsumos:structuredClone(movimentosInsumos),lixeira:structuredClone(lixeira),auditoria:structuredClone(auditoria),
    salvoEm:new Date().toISOString()};
};
backupAutomatico=function(){
  localStorage.setItem(v16Key("ultimo_backup"),JSON.stringify(criarSnapshot()));atualizarStatusBackup();
};
atualizarStatusBackup=function(){
  const el=v16El("backupStatus");if(!el)return;
  const raw=localStorage.getItem(v16Key("ultimo_backup"));
  if(!raw){el.textContent="Nenhum backup automático ainda";return}
  try{el.textContent="Último automático: "+new Date(JSON.parse(raw).salvoEm).toLocaleString("pt-BR")}catch{el.textContent="Backup local encontrado"}
};
salvarBackupArquivo=function(){
  baixarArquivo(JSON.stringify(criarSnapshot(),null,2),`backup-viveiro-v16-${v16Hoje()}.json`,"application/json");toastMsg("Backup completo salvo.");
};
exportarBackup=salvarBackupArquivo;
restaurarUltimoBackup=function(){
  const raw=localStorage.getItem(v16Key("ultimo_backup"));if(!raw){toastMsg("Ainda não existe backup automático.");return}
  if(!confirm("Restaurar o último backup automático?"))return;
  try{aplicarSnapshotFinal(JSON.parse(raw));salvar();renderTudo();toastMsg("Backup restaurado.")}catch(e){console.error(e);toastMsg("Não foi possível restaurar o backup.")}
};
function aplicarSnapshotFinal(bk){
  if(!Array.isArray(bk.canteiros)||!Array.isArray(bk.lancamentos))throw new Error("Backup inválido");
  canteiros=structuredClone(bk.canteiros);lancamentos=structuredClone(bk.lancamentos);
  reservas=structuredClone(bk.reservas||[]);manejos=structuredClone(bk.manejos||[]);insumos=structuredClone(bk.insumos||[]);
  movimentosInsumos=structuredClone(bk.movimentosInsumos||[]);lixeira=structuredClone(bk.lixeira||[]);auditoria=structuredClone(bk.auditoria||[]);
  garantirEstruturaFinal();
}
importarBackupArquivo=function(event){
  const arquivo=event.target.files?.[0];if(!arquivo)return;
  const leitor=new FileReader();leitor.onload=()=>{try{const bk=JSON.parse(leitor.result);if(!confirm("Importar este backup? Os dados atuais serão substituídos.")){event.target.value="";return}
    backupAutomatico();aplicarSnapshotFinal(bk);salvar();renderTudo();toastMsg("Backup importado.")}catch(e){console.error(e);toastMsg("Arquivo de backup inválido.")}event.target.value=""};leitor.readAsText(arquivo);
};

/* -------------------------- merge de sincronização -------------------------- */
function mergeArrayFinal(a=[],b=[]){
  const map=new Map();
  [...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])].forEach(x=>{
    if(!x||x.id==null)return;const k=String(x.id),ant=map.get(k);
    if(!ant||v16Meta(x)>=v16Meta(ant))map.set(k,structuredClone(x));
  });
  return [...map.values()];
}
function lixeiraAtivaFinal(t){return t&&!t.restauradoEm&&(!t.apagadoEm||t.apagadoEm>=t.excluidoEm)}
function mesclarEstadoFinal(remoto={},local={}){
  const out={
    canteiros:mergeArrayFinal(remoto.canteiros,local.canteiros),
    lancamentos:mergeArrayFinal(remoto.lancamentos,local.lancamentos),
    reservas:mergeArrayFinal(remoto.reservas,local.reservas),
    manejos:mergeArrayFinal(remoto.manejos,local.manejos),
    insumos:mergeArrayFinal(remoto.insumos,local.insumos),
    movimentosInsumos:mergeArrayFinal(remoto.movimentosInsumos,local.movimentosInsumos),
    lixeira:mergeArrayFinal(remoto.lixeira,local.lixeira),
    auditoria:mergeArrayFinal(remoto.auditoria,local.auditoria).sort((a,b)=>v16Meta(b)-v16Meta(a)).slice(0,250)
  };
  out.lixeira.filter(lixeiraAtivaFinal).forEach(t=>{
    if(t.tipo==="canteiro"){
      const ref=String(t.refId);out.canteiros=out.canteiros.filter(c=>String(c.id)!==ref);
      out.lancamentos=out.lancamentos.filter(l=>String(l.canteiro)!==ref&&String(l.destinoCanteiro)!==ref);
      out.reservas=out.reservas.filter(r=>String(r.canteiro)!==ref);out.manejos=out.manejos.filter(m=>String(m.canteiro)!==ref);
    }
    if(t.tipo==="lancamento")out.lancamentos=out.lancamentos.filter(x=>String(x.id)!==String(t.refId));
    if(t.tipo==="reserva")out.reservas=out.reservas.filter(x=>String(x.id)!==String(t.refId));
    if(t.tipo==="manejo")out.manejos=out.manejos.filter(x=>String(x.id)!==String(t.refId));
    if(t.tipo==="insumo")out.insumos=out.insumos.filter(x=>String(x.id)!==String(t.refId));
  });
  return out;
}
window.viveiroFinalState={mesclarEstado:mesclarEstadoFinal};

/* Auth bridge expandido antes do módulo Firebase capturá-lo */
const authBridgeBaseFinal=window.viveiroAuthBridge;
window.viveiroAuthBridge={
  ...authBridgeBaseFinal,
  obterDadosLocais(){
    garantirEstruturaFinal();
    return {canteiros:structuredClone(canteiros),lancamentos:structuredClone(lancamentos),reservas:structuredClone(reservas),
      manejos:structuredClone(manejos),insumos:structuredClone(insumos),movimentosInsumos:structuredClone(movimentosInsumos),
      lixeira:structuredClone(lixeira),auditoria:structuredClone(auditoria)};
  },
  aplicarDadosDoUsuario(estado){
    if(!estado||!Array.isArray(estado.canteiros)||!Array.isArray(estado.lancamentos))throw new Error("Dados inválidos");
    canteiros=structuredClone(estado.canteiros);lancamentos=structuredClone(estado.lancamentos);
    reservas=structuredClone(estado.reservas||[]);manejos=structuredClone(estado.manejos||[]);insumos=structuredClone(estado.insumos||[]);
    movimentosInsumos=structuredClone(estado.movimentosInsumos||[]);lixeira=structuredClone(estado.lixeira||[]);auditoria=structuredClone(estado.auditoria||[]);
    garantirEstruturaFinal();salvarFinalLocal();renderTudo();
  },
  criarDadosIniciais(){return {canteiros:[],lancamentos:[],reservas:[],manejos:[],insumos:[],movimentosInsumos:[],lixeira:[],auditoria:[]}},
  limparDadosDaSessaoLocal(){
    canteiros=[];lancamentos=[];reservas=[];manejos=[];insumos=[];movimentosInsumos=[];lixeira=[];auditoria=[];
    ["viveiro_v2_canteiros","viveiro_v2_lancamentos","viveiro_last_modified","viveiro_cloud_last_sync"].forEach(k=>localStorage.removeItem(k));
    renderTudo();
  }
};

/* render geral final */
const renderTudoBaseFinal=renderTudo;
renderTudo=function(){
  garantirEstruturaFinal();renderTudoBaseFinal();renderGestaoFinal();
};

/* Eventos */
document.addEventListener("change",e=>{if(e.target?.id==="movInsumoFinal")ajustarMovInsumoFinal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){fecharMenuAdicionarFinal();document.querySelectorAll(".modal:not(.hidden)").forEach(m=>m.classList.add("hidden"))}});

garantirEstruturaFinal();

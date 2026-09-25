(() => {
  "use strict";
  function parseIPv4(value){
    const parts=String(value||"").trim().split(".");
    if(parts.length!==4||parts.some(p=>! /^(0|[1-9][0-9]{0,2})$/.test(p)||Number(p)>255))
      throw new Error("IPv4 inválido. Informe quatro octetos entre 0 e 255.");
    return parts.map(Number);
  }
  const toUint=octets=>((octets[0]<<24)>>>0 | octets[1]<<16 | octets[2]<<8 | octets[3])>>>0;
  const toIPv4=value=>[value>>>24,(value>>>16)&255,(value>>>8)&255,value&255].join(".");
  function subnet(ip,cidr){
    const prefix=Number(cidr);
    if(!Number.isInteger(prefix)||prefix<0||prefix>32)throw new Error("O prefixo CIDR deve estar entre 0 e 32.");
    const addr=toUint(parseIPv4(ip));
    const mask=prefix===0?0:(0xffffffff<<(32-prefix))>>>0;
    const net=(addr&mask)>>>0,broadcast=(net|(~mask>>>0))>>>0;
    const pointToPoint=prefix===31,single=prefix===32;
    const first=single?net:pointToPoint?net:net+1;
    const last=single?net:pointToPoint?broadcast:broadcast-1;
    return Object.freeze({
      address:toIPv4(addr),prefix,mask:toIPv4(mask),network:toIPv4(net),
      broadcast:prefix>=31?"Não aplicável":toIPv4(broadcast),
      first:toIPv4(first>>>0),last:toIPv4(last>>>0),
      hosts:single?1:pointToPoint?2:Math.pow(2,32-prefix)-2,
      note:single?"Rota de host /32: somente um endereço.":
        pointToPoint?"RFC 3021: ambos os endereços de /31 podem ser usados em enlaces ponto a ponto.":""
    });
  }
  window.PROXITI_TOOL_CORE=Object.freeze({subnet});
})();

(()=>{
"use strict";
window.PROXITI_ACADEMY_CURRICULUM=Object.freeze({
  "version": "2026-09-v1",
  "name": "Fundamentos Operacionais PROXITI",
  "description": "Capacitação interna em suporte, redes, atendimento, infraestrutura, segurança preventiva e privacidade.",
  "rules": {
    "courses": 16,
    "quizQuestions": 4,
    "quizPassing": 75,
    "examQuestions": 24,
    "examPassing": 75,
    "overallPassing": 80,
    "quizWeight": 0.6,
    "examWeight": 0.4,
    "criticalRequired": true,
    "certificateType": "Certificado de Conclusão Interna — UniProxiti"
  },
  "tracks": [
    {
      "id": "atendimento",
      "title": "Atendimento e conduta",
      "subtitle": "Escuta, diagnóstico autorizado e comunicação responsável.",
      "color": "#457eb6",
      "image": "assets/academy-visuals/atendimento.svg",
      "source": "Procedimentos internos PROXITI"
    },
    {
      "id": "computadores",
      "title": "Computadores e notebooks",
      "subtitle": "Triagem, manutenção preventiva e documentação.",
      "color": "#478e86",
      "image": "assets/academy-visuals/computadores.svg",
      "source": "Microsoft Learn e procedimentos internos"
    },
    {
      "id": "redes",
      "title": "Redes e Wi-Fi",
      "subtitle": "Conectividade, roteadores e isolamento de falhas.",
      "color": "#5575b9",
      "image": "assets/academy-visuals/redes.svg",
      "source": "Microsoft Learn e CISA"
    },
    {
      "id": "seguranca",
      "title": "Segurança digital preventiva",
      "subtitle": "Identificação de golpes, contas e dispositivos protegidos.",
      "color": "#7a70b6",
      "image": "assets/academy-visuals/seguranca.svg",
      "source": "CISA"
    },
    {
      "id": "backup",
      "title": "Backup e continuidade",
      "subtitle": "Cópias recuperáveis, restauração e proteção de dados.",
      "color": "#418d96",
      "image": "assets/academy-visuals/backup.svg",
      "source": "CISA e procedimentos internos"
    },
    {
      "id": "infraestrutura",
      "title": "Infraestrutura e instalações",
      "subtitle": "Ambientes organizados, equipamento identificado e prevenção.",
      "color": "#98744e",
      "image": "assets/academy-visuals/infraestrutura.svg",
      "source": "Procedimentos internos PROXITI"
    },
    {
      "id": "privacidade",
      "title": "Privacidade e autorização",
      "subtitle": "Minimização de dados, acesso autorizado e incidentes.",
      "color": "#5e85ad",
      "image": "assets/academy-visuals/privacidade.svg",
      "source": "ANPD"
    },
    {
      "id": "operacao",
      "title": "Operação residencial e empresarial",
      "subtitle": "Chamados, relatórios, continuidade e orientação final.",
      "color": "#647d97",
      "image": "assets/academy-visuals/operacao.svg",
      "source": "Procedimentos internos PROXITI"
    }
  ],
  "courses": [
    {
      "id": "at-01",
      "track": "atendimento",
      "title": "Primeiro contato e autorização",
      "minutes": 15,
      "level": "Fundamentos",
      "objectives": [
        "Coletar sintomas sem presumir a causa.",
        "Definir o que será acessado e obter autorização verificável.",
        "Registrar uma hipótese, não uma promessa de solução."
      ],
      "sections": [
        [
          "Escutar antes de executar",
          "Comece pedindo ao cliente que descreva o problema com suas próprias palavras: quando começou, o que mudou e qual atividade foi interrompida. Perguntas abertas revelam contexto sem induzir respostas. Depois, confirme com suas palavras o que entendeu e diferencie sintoma observado de causa ainda não verificada.",
          "Anote equipamento, sistema, conexão, horário aproximado, impacto e tentativas anteriores. Evite pedir documentos, senhas ou imagens com informações pessoais quando não forem indispensáveis. Se houver urgência, registre o impacto, mas não dispense o diagnóstico."
        ],
        [
          "Autorização e limites do acesso",
          "Antes de uma conexão remota, manutenção ou inspeção de arquivos, explique a finalidade, a ferramenta, o escopo, as alterações previstas e os riscos relevantes. Peça autorização expressa e registre no chamado, respeitando o procedimento institucional. Uma autorização para diagnosticar a rede não autoriza abrir fotos, mensagens ou documentos particulares.",
          "Se o problema exigir ampliar o escopo, pare, explique o motivo e obtenha nova autorização. Se a pessoa não puder autorizar ou tiver dúvidas, registre a limitação e ofereça alternativas. Não solicite que o cliente diga sua senha; quando necessário, ele mesmo deve digitá-la."
        ],
        [
          "Encerrar a triagem com próximo passo",
          "Separe o que foi relatado do que foi confirmado por teste e deixe clara a próxima ação: coleta de evidências, orçamento, visita ou orientação. Informe que prazo e preço dependem da avaliação e das condições aceitas pelo cliente. Use a Central para registrar o próximo responsável e o retorno combinado."
        ]
      ],
      "practice": {
        "title": "Caso: computador da família",
        "context": "A cliente relata lentidão e deixa a sessão de e-mail aberta ao lado da pasta de fotos pessoais.",
        "response": "Limite-se aos indicadores necessários para investigar desempenho. Não abra e-mail ou fotos. Confirme a autorização para cada inspeção e documente somente evidências técnicas pertinentes."
      },
      "checklist": [
        "Problema e impacto descritos sem conclusões antecipadas.",
        "Escopo e autorização registrados.",
        "Nenhuma senha ou arquivo pessoal solicitado sem necessidade.",
        "Próximo passo e responsável definidos."
      ],
      "references": []
    },
    {
      "id": "at-02",
      "track": "atendimento",
      "title": "Comunicação, prazos e orientação final",
      "minutes": 15,
      "level": "Fundamentos",
      "objectives": [
        "Explicar diagnóstico sem jargões desnecessários.",
        "Distinguir hipótese, orçamento e serviço autorizado.",
        "Encerrar o atendimento com validação e orientações úteis."
      ],
      "sections": [
        [
          "Comunicar o diagnóstico com evidências",
          "Descreva o sintoma, os testes feitos, o resultado e as limitações. Dizer que 'a máquina está ruim' não ajuda; explicar que o disco apresentou sinais de falha durante a avaliação ajuda o cliente a decidir. Evite afirmar causa definitiva quando faltam testes ou quando outras hipóteses ainda são plausíveis.",
          "Adapte a linguagem: para um usuário residencial, descreva o efeito no uso diário; para a pessoa responsável por uma pequena empresa, explique impacto e possíveis períodos de indisponibilidade. Não prometa recuperação de dados ou desempenho específico sem evidência."
        ],
        [
          "Prazos, custos e mudanças de escopo",
          "Antes de executar trabalho adicional, apresente opções proporcionais ao problema e solicite aprovação de escopo e valores conforme o procedimento comercial real da PROXITI. Um reparo aparentemente simples pode revelar riscos maiores; registre a descoberta, interrompa alterações não autorizadas e informe os próximos passos.",
          "Quando o prazo depender de peça, disponibilidade do cliente ou fornecedor, informe essa dependência. Se a execução puder interromper serviços, combine janela e possibilidade de reversão. Evite esconder atrasos para transmitir falsa segurança."
        ],
        [
          "Validação e instruções ao cliente",
          "Ao concluir, repita o teste que demonstrava o problema e peça ao cliente que valide a funcionalidade relevante. Registre o que foi feito, o que não foi feito e riscos remanescentes. Uma orientação curta e específica tem mais valor que uma lista genérica de 'boas práticas'.",
          "Entregue instruções compreensíveis sobre atualização, cópia de segurança, cuidados físicos ou contato de retorno, conforme o caso. Não declare concluído um item de checklist que não foi executado. Diferencie 'resolvido na verificação' de garantia de que a falha nunca retornará."
        ]
      ],
      "practice": {
        "title": "Caso: conserto mais caro que o previsto",
        "context": "Durante a avaliação surge uma possível falha do SSD, e a troca não constava da autorização inicial.",
        "response": "Interrompa a alteração de hardware, explique achados e riscos aos dados, apresente opções e só avance após autorização documentada."
      },
      "checklist": [
        "Resultado dos testes comunicado sem exagero.",
        "Mudanças de escopo aprovadas antes da execução.",
        "Validação realizada com o cliente quando possível.",
        "Relatório e orientações finais registrados."
      ],
      "references": []
    },
    {
      "id": "pc-01",
      "track": "computadores",
      "title": "Diagnóstico de lentidão e travamentos",
      "minutes": 15,
      "level": "Fundamentos",
      "objectives": [
        "Diferenciar sinais de software, armazenamento, temperatura e memória.",
        "Começar por verificações reversíveis e não destrutivas.",
        "Registrar evidências antes de recomendar intervenção."
      ],
      "sections": [
        [
          "Triagem sem formatar por impulso",
          "Pergunte quando a lentidão ocorre: sempre, apenas ao iniciar, sob carga ou durante acesso a arquivos. Verifique capacidade livre, uso de memória e disco, processos em execução, histórico de atualizações e programas que iniciam automaticamente. Uma porcentagem isolada de CPU não estabelece diagnóstico.",
          "Considere armazenamento degradado, temperatura excessiva, falta de memória, software mal configurado e malware como hipóteses distintas. Relacione cada hipótese a um teste seguro. Não use limpadores milagrosos, ferramentas de procedência duvidosa ou comandos destrutivos."
        ],
        [
          "Preservar dados e segurança do equipamento",
          "Antes de mudanças com risco de perda de dados, confirme se há cópia recuperável e autorização. Se o armazenamento apresenta sinais de falha, priorize preservação e reduza gravações desnecessárias. Abrir notebook, remover bateria interna ou mexer em fonte elétrica exige qualificação e procedimento seguro; encaminhe quando estiver fora da sua competência.",
          "Fotografe apenas elementos técnicos necessários, como uma mensagem de erro sem dados pessoais. Não publique telas com nomes de usuário, números de série completos ou documentos do cliente em canais inadequados."
        ],
        [
          "Conclusão baseada em comparação",
          "Anote condição inicial e teste após a intervenção: tempo de inicialização aproximado, mensagem de erro, carga observada ou estabilidade em uma tarefa representativa. Um SSD pode melhorar acessos a disco, mas não resolve temperatura ruim ou falhas de rede.",
          "Explique a diferença entre manutenção preventiva, reparo, atualização de componente e substituição do equipamento. Evite prometer ganhos numéricos sem medição consistente."
        ]
      ],
      "practice": {
        "title": "Caso: demora para abrir arquivos",
        "context": "O disco faz ruídos incomuns e o cliente quer formatar imediatamente porque o computador está lento.",
        "response": "Pare operações desnecessárias, informe o possível risco aos dados, discuta cópias e diagnóstico do armazenamento antes de qualquer formatação."
      },
      "checklist": [
        "Sintomas e alterações recentes registrados.",
        "Indicadores relevantes coletados sem exposição de dados.",
        "Cópia de segurança avaliada antes de mudanças arriscadas.",
        "Resultado da intervenção comparado com a condição inicial."
      ],
      "references": [
        "https://learn.microsoft.com/pt-br/windows/client-management/troubleshoot-startup-issues"
      ]
    },
    {
      "id": "pc-02",
      "track": "computadores",
      "title": "Manutenção preventiva e atualizações",
      "minutes": 15,
      "level": "Fundamentos",
      "objectives": [
        "Planejar atualizações com compatibilidade e reversão.",
        "Reconhecer limites de segurança física e elétrica.",
        "Entregar checklist de manutenção verificável."
      ],
      "sections": [
        [
          "Atualizar com critério",
          "Confirme versão do sistema, fabricante, disponibilidade de atualizações de segurança e requisitos de compatibilidade. Priorize canais oficiais do fornecedor. Crie ponto de reversão quando aplicável e confirme o estado do backup antes de atualizar firmware, BIOS ou alterar partições.",
          "Não substitua drivers de fabricante por pacotes aleatórios. Quando uma versão está fora do suporte, explique que a ausência de atualizações de segurança eleva o risco e apresente opções de migração viáveis para o hardware."
        ],
        [
          "Cuidados físicos proporcionais",
          "Verifique ventilação, excesso de poeira externa, cabos danificados, superaquecimento e sinais de bateria estufada. Não abra ou manipule baterias danificadas; isole o equipamento e encaminhe a serviço qualificado. Desligue e desconecte o aparelho antes de manutenção interna permitida.",
          "Use ferramentas adequadas, cuide da eletricidade estática conforme o procedimento do equipamento e jamais aplique líquidos diretamente em placas energizadas. A limpeza não pode colocar a garantia, os dados ou a integridade física em risco."
        ],
        [
          "Checklist e validação",
          "Registre o que foi inspecionado, o que foi atualizado, o que não foi possível concluir e recomendações por prioridade. Após uma atualização, confira inicialização, conectividade e a tarefa que motivou a intervenção.",
          "Explique ao cliente a diferença entre manutenção preventiva e garantia de ausência de falhas. Oriente sobre armazenamento, ventilação e atualizações sem recomendar gastos desproporcionais."
        ]
      ],
      "practice": {
        "title": "Caso: BIOS recém-publicada",
        "context": "Uma atualização de firmware está disponível, mas o notebook funciona e não existe cópia atual dos dados.",
        "response": "Não atualize automaticamente. Verifique necessidade, compatibilidade, energia estável, risco, cópia e autorização antes de planejar a execução."
      },
      "checklist": [
        "Atualização oficial e compatível confirmada.",
        "Cópia e plano de recuperação considerados.",
        "Risco elétrico e térmico verificado.",
        "Resultados e limitações entregues ao cliente."
      ],
      "references": [
        "https://www.microsoft.com/pt-br/windows/end-of-support"
      ]
    },
    {
      "id": "re-01",
      "track": "redes",
      "title": "Diagnóstico de internet e Wi-Fi",
      "minutes": 15,
      "level": "Fundamentos",
      "objectives": [
        "Separar falha de sinal, roteador, provedor e dispositivo.",
        "Executar testes em sequência sem alterar a rede de imediato.",
        "Documentar localização, horário e dispositivos afetados."
      ],
      "sections": [
        [
          "A pergunta que economiza tempo",
          "Descubra se a falha ocorre em um dispositivo ou em todos, por Wi-Fi ou cabo, em um ambiente ou no imóvel inteiro. Identifique se o aparelho perde a conexão sem fio, permanece conectado sem internet ou não acessa apenas um site. Essas três situações têm causas prováveis diferentes.",
          "Verifique LEDs e estado do roteador sem concluir que determinada luz prova acesso à internet. Teste com outro aparelho, confira interrupções informadas pelo provedor e, com autorização, compare cabo e Wi-Fi."
        ],
        [
          "Testes graduais",
          "Confira endereço IP, gateway e servidor DNS. Um endereço automático inesperado pode indicar problema no DHCP; conectividade por IP com falha por nome sugere investigar DNS. Ping pode ser bloqueado por firewall, portanto ausência de resposta sozinha não prova indisponibilidade.",
          "Antes de reiniciar roteador de empresa pequena, avalie impacto em caixa, câmeras, telefonia ou sistemas. Mudanças de configuração exigem credenciais do responsável e plano de reversão."
        ],
        [
          "Registrar evidências e devolver orientação",
          "Use mapa simples do ambiente, dispositivos afetados, intensidade de sinal observada e horários da falha. Se o problema estiver fora do escopo, documente os testes e direcione ao provedor ou administrador responsável.",
          "Explique medidas proporcionais, como reposicionamento, revisão do canal ou avaliação de cobertura, sem prometer alcance absoluto em metros."
        ]
      ],
      "practice": {
        "title": "Caso: apenas a sala dos fundos falha",
        "context": "O modem permanece conectado; computadores próximos funcionam, mas o notebook longe do roteador perde sinal.",
        "response": "Investigue cobertura, obstáculos, interferência e frequência antes de abrir chamado com o provedor ou trocar equipamentos."
      },
      "checklist": [
        "Dispositivos afetados identificados.",
        "Wi-Fi e acesso ao provedor diferenciados.",
        "Testes e horário registrados.",
        "Mudanças disruptivas autorizadas."
      ],
      "references": [
        "https://learn.microsoft.com/pt-br/troubleshoot/windows-client/networking/wireless-network-connectivity-issues-troubleshooting"
      ]
    },
    {
      "id": "re-02",
      "track": "redes",
      "title": "Roteadores e rede de pequenos negócios",
      "minutes": 15,
      "level": "Intermediário",
      "objectives": [
        "Configurar Wi-Fi com separação e proteção proporcionais.",
        "Planejar mudanças sem interromper operações críticas.",
        "Diferenciar rede interna, convidados e dispositivos conectados."
      ],
      "sections": [
        [
          "Inventário antes da configuração",
          "Identifique provedor, modelo do equipamento, conexão WAN, faixa interna, DHCP, serviços dependentes e acesso administrativo legítimo. Confirme se o cliente é o responsável pela rede. Não restaure o roteador às configurações de fábrica sem cópia da configuração, autorização e plano para reconfigurar serviços.",
          "Faça inventário de câmeras, impressoras, terminais de pagamento e pontos de acesso para reconhecer consequências de trocar senha, endereço da rede ou faixa DHCP."
        ],
        [
          "Cobertura e segurança",
          "Compare 2,4 GHz e 5 GHz pelas características do ambiente: a primeira costuma atingir melhor alguns obstáculos, a segunda oferece mais capacidade em distâncias menores, dependendo do equipamento. Use autenticação forte suportada pelos dispositivos, altere credenciais administrativas padrão e desative recursos desnecessários.",
          "Uma rede de convidados separada ajuda a reduzir acesso indevido a recursos internos, mas sua eficácia depende da configuração real do equipamento. Atualize firmware por fonte oficial e durante janela combinada."
        ],
        [
          "Teste e documentação final",
          "Após a mudança, valide acesso dos dispositivos essenciais, impressão, sistemas de trabalho e isolamento esperado entre redes. Registre configuração autorizada sem guardar senhas em relatórios comuns. Documente forma de recuperação sob responsabilidade do cliente.",
          "Se a rede exigir VLANs, firewall avançado ou projeto de alta disponibilidade, dimensione o escopo antes de afirmar que uma configuração simples resolve todas as necessidades."
        ]
      ],
      "practice": {
        "title": "Caso: Wi-Fi de clientes no comércio",
        "context": "Uma loja quer fornecer internet a visitantes sem expor o computador do caixa e a impressora administrativa.",
        "response": "Planeje rede de convidados com isolamento adequado, confirme suporte do roteador e teste que visitantes não acessam recursos internos."
      },
      "checklist": [
        "Responsável da rede e autorização confirmados.",
        "Serviços críticos identificados.",
        "Rede de convidados testada, não presumida.",
        "Configuração e resultados documentados."
      ],
      "references": [
        "https://www.cisa.gov/secure-our-world"
      ]
    },
    {
      "id": "se-01",
      "track": "seguranca",
      "title": "Phishing, senhas e MFA",
      "minutes": 15,
      "level": "Fundamentos",
      "objectives": [
        "Reconhecer abordagens de engenharia social.",
        "Orientar MFA sem pedir códigos ou senhas.",
        "Conter um clique suspeito de forma proporcional."
      ],
      "sections": [
        [
          "Golpes exploram urgência",
          "Mensagens que criam pressão por pagamento, senha, atualização de cadastro ou prêmio inesperado merecem verificação por canal independente. Observe o domínio real, o contexto e a solicitação; um logotipo conhecido não autentica a mensagem. Não clique para 'ver se é golpe'.",
          "Se houver suspeita, confirme com o titular ou organização por contato já conhecido. Preserve apenas a evidência necessária, como cabeçalhos ou endereço, sem redistribuir dados pessoais."
        ],
        [
          "Senhas e autenticação adicional",
          "Oriente senhas longas e exclusivas, gerenciador confiável e autenticação multifator onde disponível. MFA reduz o risco de acesso com senha roubada, mas não torna qualquer solicitação legítima. Nunca peça código de verificação, senha de uso único ou recuperação ao cliente.",
          "Explique passkeys e métodos resistentes a phishing quando suportados, mantendo alternativa de recuperação segura. Proteja contas administrativas separadamente e retire acessos quando deixarem de ser necessários."
        ],
        [
          "Se a conta pode ter sido comprometida",
          "Interrompa o uso de links suspeitos, avalie sessões ativas e solicite que o proprietário altere senhas pelos canais oficiais em um dispositivo confiável. Escale incidentes além da atuação preventiva ao responsável adequado. Não prometa recuperar dinheiro nem eliminação completa de malware sem análise."
        ]
      ],
      "practice": {
        "title": "Caso: cobrança urgente por e-mail",
        "context": "O cliente recebe mensagem com logotipo do fornecedor, pedindo pagamento imediato e senha para impedir bloqueio.",
        "response": "Verifique por canal conhecido e oriente o cliente a não abrir o link nem fornecer senha ou código. Registre o incidente sem espalhar dados."
      },
      "checklist": [
        "Origem verificada por canal independente.",
        "Nenhuma senha ou código solicitado.",
        "MFA orientado por canal oficial.",
        "Suspeita documentada e escalada quando necessário."
      ],
      "references": [
        "https://www.cisa.gov/secure-our-world"
      ]
    },
    {
      "id": "se-02",
      "track": "seguranca",
      "title": "Proteção de dispositivos e resposta inicial",
      "minutes": 15,
      "level": "Intermediário",
      "objectives": [
        "Aplicar medidas preventivas sem prometer perícia.",
        "Reconhecer evento que exige contenção e encaminhamento.",
        "Priorizar atualizações e princípio do menor privilégio."
      ],
      "sections": [
        [
          "A superfície de ataque cotidiana",
          "Sistemas sem suporte, aplicativos de origem desconhecida, contas administrativas usadas no dia a dia e serviços remotos expostos aumentam risco. Verifique atualização oficial, proteção ativa, permissões e cópias recuperáveis. Não instale antivírus adicional sem avaliar compatibilidade e política do cliente.",
          "Crie conta de uso comum quando adequado e limite elevação administrativa às tarefas autorizadas. Para suporte remoto, use ferramenta aprovada, identificação do técnico e sessão encerrada ao terminar."
        ],
        [
          "Suspeita de comprometimento",
          "Se houver indício consistente de ataque, evite ações que destruam evidências sem entender o contexto. Em ambiente empresarial, comunique a pessoa responsável e siga plano de incidente; isolamento de rede e restauração devem ser autorizados conforme impacto. Não apague logs por conveniência.",
          "A PROXITI atua em prevenção e suporte dentro do escopo contratado; resposta forense, investigação criminal ou recuperação especializada requer avaliação e, quando necessário, encaminhamento a especialistas."
        ],
        [
          "Retorno controlado à operação",
          "Valide que atualizações foram aplicadas, contas expostas tratadas, serviços essenciais testados e orientações entregues. Documente limitações e recomendações pendentes; 'escaneamento sem detecção' não equivale a garantia de segurança."
        ]
      ],
      "practice": {
        "title": "Caso: antivírus encontrou ameaça",
        "context": "O sistema isolou um arquivo suspeito, mas o responsável quer apagar tudo e reiniciar o servidor imediatamente.",
        "response": "Avalie impacto, preserve evidências relevantes, comunique o responsável e execute contenção autorizada antes de qualquer ação destrutiva."
      },
      "checklist": [
        "Medidas preventivas e versões verificadas.",
        "Escopo e responsável pelo incidente definidos.",
        "Evidências preservadas quando necessário.",
        "Recomendações de segurança registradas sem garantia absoluta."
      ],
      "references": [
        "https://www.cisa.gov/secure-our-world"
      ]
    },
    {
      "id": "bk-01",
      "track": "backup",
      "title": "Cópias de segurança que realmente recuperam",
      "minutes": 15,
      "level": "Fundamentos",
      "objectives": [
        "Distinguir sincronização de backup.",
        "Planejar cópias em locais e meios diferentes.",
        "Definir prioridade e periodicidade com o cliente."
      ],
      "sections": [
        [
          "Backup não é só pasta sincronizada",
          "Sincronização replica alterações, inclusive exclusões e arquivos criptografados, conforme a configuração. Backup deve preservar versões ou cópias independentes e permitir recuperar um estado anterior. Combine frequência com o quanto o cliente pode tolerar perder em caso de falha.",
          "Uma estratégia 3-2-1 é uma referência prática: três cópias dos dados, em dois tipos de mídia ou destinos, com uma cópia externa ou isolada. A implementação adequada depende do valor dos dados, orçamento e risco."
        ],
        [
          "Definir escopo de proteção",
          "Identifique documentos realmente críticos, localização, proprietários, necessidade de retenção e quem pode restaurar. Não copie fotos, bases comerciais ou dados pessoais fora do escopo autorizado. Criptografe cópias sensíveis quando indicado e proteja chaves de recuperação.",
          "O armazenamento externo usado em backup não deve permanecer exposto continuamente a todos os riscos do computador de origem. Verifique se a cópia é recente, íntegra e acessível ao responsável legítimo."
        ],
        [
          "Conferência básica",
          "Verifique log ou estado da tarefa, tamanho plausível, amostras representativas e controle de versões. Isso não substitui restauração, mas ajuda a detectar falha de execução. Registre o horário da última cópia e possíveis lacunas."
        ]
      ],
      "practice": {
        "title": "Caso: nuvem sincronizada",
        "context": "O usuário diz ter backup porque a pasta de trabalho sincroniza com a nuvem, mas não sabe restaurar arquivos apagados.",
        "response": "Verifique histórico de versões e recuperação, identifique lacunas e planeje cópia independente antes de declarar os dados protegidos."
      },
      "checklist": [
        "Dados prioritários e retenção definidos.",
        "Cópias independentes planejadas.",
        "Acesso e chaves protegidos.",
        "Periodicidade e última execução registradas."
      ],
      "references": [
        "https://www.cisa.gov/secure-our-world"
      ]
    },
    {
      "id": "bk-02",
      "track": "backup",
      "title": "Teste de restauração e continuidade",
      "minutes": 15,
      "level": "Intermediário",
      "objectives": [
        "Demonstrar recuperação antes de confiar no backup.",
        "Evitar sobrescrever dados bons durante teste.",
        "Registrar tempo e limites do procedimento."
      ],
      "sections": [
        [
          "A prova está na restauração",
          "Selecione um arquivo de teste ou uma amostra autorizada e restaure em local separado. Compare conteúdo, estrutura, permissões e versão esperada. Uma tarefa que apresenta 'sucesso' no aplicativo de backup ainda pode conter arquivos corrompidos, incompletos ou inacessíveis.",
          "Não realize testes destrutivos no único exemplar dos dados. Se um serviço precisa ser interrompido, planeje janela e comunicação com os responsáveis."
        ],
        [
          "Prioridade por impacto",
          "Para residência, documentos, fotos e configurações importantes podem ter prioridade distinta. Para microempresa, avalie base de clientes, financeiro, documentos fiscais, sistemas e tempo de parada tolerável. Estabeleça ordem de recuperação e dependências reais.",
          "Tempo para restaurar depende do tamanho dos dados, da conexão, do destino e de testes realizados. Não prometa recuperação em prazo não verificado."
        ],
        [
          "Entregar autonomia sem exposição",
          "Registre passo a passo de restauração adequado ao responsável, canal de suporte e localização do backup sem incluir senhas. Explique ao cliente a necessidade de testar periodicamente e de atualizar a estratégia quando surgirem novos dispositivos ou serviços."
        ]
      ],
      "practice": {
        "title": "Caso: restauração que sobrescreve",
        "context": "O cliente pede que o técnico teste o backup diretamente sobre os documentos atuais da empresa.",
        "response": "Use área separada e arquivos de teste autorizados; não sobrescreva dados de produção apenas para demonstrar que a cópia funciona."
      },
      "checklist": [
        "Restauração executada em ambiente separado.",
        "Arquivo restaurado validado.",
        "Tempo e falhas observados registrados.",
        "Plano de recuperação documentado."
      ],
      "references": [
        "https://www.cisa.gov/secure-our-world"
      ]
    },
    {
      "id": "in-01",
      "track": "infraestrutura",
      "title": "Instalações, cabos e segurança física",
      "minutes": 15,
      "level": "Fundamentos",
      "objectives": [
        "Reconhecer riscos elétricos e de ventilação.",
        "Organizar cabos e identificação sem alterar circuitos.",
        "Registrar condições para manutenção futura."
      ],
      "sections": [
        [
          "Inspeção antes da instalação",
          "Verifique tomada, localização, ventilação, obstáculos, cabos aparentes e acesso físico. Não intervenha em instalação elétrica fixa sem qualificação e autorização apropriadas. Fontes danificadas, cheiro de queimado e aquecimento anormal exigem interromper o uso e encaminhar para avaliação segura.",
          "Evite improvisos como adaptadores sobrecarregados, extensões em cascata ou equipamentos apoiados sobre saídas de ar. Não energize componentes que apresentem sinais de dano."
        ],
        [
          "Organização e rastreabilidade",
          "Separe energia e dados conforme as boas práticas do ambiente, identifique cabos nas duas extremidades e mantenha folga adequada sem dobras que prejudiquem conectores. Registre portas e equipamentos com nomenclatura compreensível para a equipe.",
          "Ao instalar roteadores, switches e computadores, garanta acesso para manutenção e circulação de ar. Para pequenos negócios, documente onde estão o equipamento do provedor, as tomadas e os pontos críticos, sem expor informações em área pública."
        ],
        [
          "Validação segura",
          "Teste funcionamento do equipamento, conectividade e organização final sem deixar cabos atravessando passagens. Registre condição anterior, melhorias realizadas e pendências que dependam de profissional de elétrica, obra ou equipamento adicional."
        ]
      ],
      "practice": {
        "title": "Caso: régua elétrica sobrecarregada",
        "context": "Computador, impressora, aquecedor e roteador estão conectados a adaptadores em cascata de origem desconhecida.",
        "response": "Não acrescente equipamentos. Oriente a suspender a configuração arriscada e solicitar avaliação elétrica qualificada antes de ampliar a instalação."
      },
      "checklist": [
        "Riscos físicos e elétricos identificados.",
        "Equipamentos bem ventilados.",
        "Cabos e portas identificados.",
        "Limites do serviço registrados."
      ],
      "references": []
    },
    {
      "id": "in-02",
      "track": "infraestrutura",
      "title": "Inventário e continuidade de pequeno escritório",
      "minutes": 15,
      "level": "Intermediário",
      "objectives": [
        "Mapear dispositivos e dependências de serviço.",
        "Planejar janelas de alteração e retorno.",
        "Documentar ativos sem coletar dados excessivos."
      ],
      "sections": [
        [
          "O inventário útil",
          "Registre equipamento, função, localização aproximada, responsável e dependências operacionais. Identificadores técnicos podem ser necessários, mas não publique números de série completos ou inventários de rede em documentos de circulação descontrolada.",
          "Diferencie ativo de rede, dispositivo de usuário, periférico e serviço contratado. Uma pequena empresa pode depender de um único roteador ou computador: reconheça o ponto único de falha antes de iniciar intervenção."
        ],
        [
          "Planejamento de mudanças",
          "Combine período de menor movimento e plano de reversão para alterações de rede, roteador ou compartilhamentos. Verifique que existem backups e contatos do responsável. Em ambiente comercial, a parada de caixa ou internet pode ter impacto maior que o tempo de execução técnica.",
          "Organize etapas por risco: observar, documentar, preparar cópia, aplicar alteração autorizada, testar e devolver operação. Se surgir dependência não prevista, suspenda e renegocie o escopo."
        ],
        [
          "Entrega e acompanhamento",
          "Atualize inventário, esquema simples de ligação, recomendação de manutenção e pendências prioritárias. Não prometa disponibilidade contínua quando há um único link ou equipamento sem redundância."
        ]
      ],
      "practice": {
        "title": "Caso: único roteador do comércio",
        "context": "A loja precisa de atualização de firmware durante horário de funcionamento, mas depende da rede para vendas.",
        "response": "Negocie janela, mantenha configuração recuperável, avalie alternativas de conexão e não faça a mudança de risco sem confirmação do responsável."
      },
      "checklist": [
        "Dependências de negócio registradas.",
        "Janela e plano de reversão acordados.",
        "Teste de serviços críticos concluído.",
        "Inventário atualizado com acesso restrito."
      ],
      "references": []
    },
    {
      "id": "pr-01",
      "track": "privacidade",
      "title": "LGPD, minimização e autorização prática",
      "minutes": 15,
      "level": "Fundamentos",
      "objectives": [
        "Coletar apenas dados técnicos necessários.",
        "Distinguir autorização de suporte de acesso irrestrito.",
        "Registrar tratamento de dados com cuidado e propósito."
      ],
      "sections": [
        [
          "Necessidade antes de coleta",
          "O suporte pode envolver dados pessoais em nomes de arquivos, mensagens, histórico de navegação, endereços e documentos. Defina finalidade específica, limite acesso ao necessário e evite reproduzir dados em prints, notas ou relatórios. A autorização técnica é importante, mas não substitui automaticamente uma hipótese legal para todo tratamento de dados.",
          "Pequenas operações também devem considerar segurança e direitos do titular. O procedimento exato depende do papel da empresa em cada atendimento e da finalidade dos dados; dúvidas jurídicas devem ser avaliadas por responsável apropriado."
        ],
        [
          "Acesso limitado e transparente",
          "Explique a ferramenta de suporte, quem pode acompanhar a sessão, quais ações serão executadas e como encerrar o acesso. Se um dado particular aparecer incidentalmente, não o explore. Não use informações do cliente para treinar modelos, divulgar casos ou criar portfólio sem base adequada.",
          "Proteja evidências com acesso restrito e período de retenção definido. Ao compartilhar capturas com outro técnico, elimine identificadores desnecessários, mantendo contexto suficiente para resolver o incidente."
        ],
        [
          "Concluir com mínimo necessário",
          "Entregue relatório com diagnóstico e intervenções, não uma cópia desnecessária dos documentos pessoais encontrados. Oriente sobre canais legítimos para solicitar acesso, correção ou eliminação de dados, sem prometer exclusão imediata quando houver obrigações legais aplicáveis."
        ]
      ],
      "practice": {
        "title": "Caso: captura com dados pessoais",
        "context": "A tela de erro inclui nome, endereço e documentos do cliente que não são necessários ao diagnóstico.",
        "response": "Recorte ou redija a captura para preservar o erro técnico; evite armazenar ou enviar dados pessoais extras e registre apenas o necessário."
      },
      "checklist": [
        "Finalidade e escopo definidos.",
        "Dados e evidências minimizados.",
        "Acesso técnico autorizado e limitado.",
        "Retenção e compartilhamento proporcionais."
      ],
      "references": [
        "https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes",
        "https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022"
      ]
    },
    {
      "id": "pr-02",
      "track": "privacidade",
      "title": "Suporte remoto seguro e incidentes de dados",
      "minutes": 15,
      "level": "Intermediário",
      "objectives": [
        "Conduzir sessão remota com controle do cliente.",
        "Reconhecer vazamento potencial sem ocultar evidências.",
        "Encaminhar incidentes conforme responsabilidades e procedimentos."
      ],
      "sections": [
        [
          "Sessão remota com presença e controle",
          "Use ferramenta aprovada, autentique a identidade do atendimento, confirme objetivo e informe como o cliente acompanha ou encerra a sessão. Se precisar executar operação privilegiada, explique antes. Não habilite acesso persistente sem necessidade e autorização específica.",
          "Ao terminar, encerre sessão, remova acessos temporários conforme procedimento e registre intervenções. O cliente não deve entregar senha em chat nem código de autenticação ao técnico."
        ],
        [
          "Suspeita de exposição",
          "Envio de relatório ao destinatário errado, pasta compartilhada com acesso amplo ou computador perdido podem indicar incidente. Registre o que foi percebido, interrompa exposição adicional quando autorizado e informe imediatamente o responsável definido. Não apague arquivos ou logs para 'resolver' a ocorrência.",
          "Comunicação a titulares ou autoridade, quando cabível, depende de avaliação do controlador e das normas aplicáveis; o técnico não deve prometer prazos jurídicos sem esse enquadramento."
        ],
        [
          "Recuperação e lições",
          "Revise permissões, contas temporárias, canais de transferência e procedimentos que contribuíram para o problema. Documente correções e recomendações preservando confidencialidade do cliente."
        ]
      ],
      "practice": {
        "title": "Caso: acesso remoto continua após visita",
        "context": "O técnico percebe que a ferramenta foi configurada para acesso permanente, embora a autorização fosse apenas para uma sessão.",
        "response": "Desative a persistência de forma autorizada, confirme encerramento e documente o ajuste. Não mantenha acesso por conveniência."
      },
      "checklist": [
        "Identidade e finalidade da sessão confirmadas.",
        "Acesso remoto temporário e acompanhado.",
        "Incidente escalado, sem destruição de evidências.",
        "Sessão e permissões revisadas no encerramento."
      ],
      "references": [
        "https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes"
      ]
    },
    {
      "id": "op-01",
      "track": "operacao",
      "title": "Chamados, agenda e relatórios PROXITI",
      "minutes": 15,
      "level": "Fundamentos",
      "objectives": [
        "Manter o histórico operacional de cada atendimento.",
        "Distinguir nota interna de relatório ao cliente.",
        "Planejar, confirmar e concluir compromissos de forma coerente."
      ],
      "sections": [
        [
          "O chamado é a fonte da verdade operacional",
          "Registre sintomas, autorizador, diagnóstico, evidências técnicas e decisões. Mantenha cada atualização vinculada ao atendimento correto. Notas internas podem conter contexto operacional, mas não devem ser copiadas automaticamente para o relatório entregue ao cliente.",
          "Use checklists de acordo com o serviço, marque etapas efetivamente feitas e justifique não aplicáveis. Não marque como 'feito' apenas para melhorar um indicador. Arquivos devem seguir as regras de tamanho e privacidade da Central."
        ],
        [
          "Agenda: três situações diferentes",
          "Planejado significa intenção de horário. Confirmado significa que o cliente realmente concordou e o canal foi registrado. Concluído significa que o compromisso aconteceu; o chamado técnico pode precisar de etapas posteriores. Ao reagendar, a confirmação anterior não vale para o novo dia.",
          "Antes de resolver ou encerrar o chamado, trate os compromissos pendentes. Evite informar ao cliente que a plataforma enviou convite automático: essa função só existe quando comprovadamente integrada e testada."
        ],
        [
          "Relatório e encerramento",
          "O relatório descreve contexto, testes, trabalho executado, resultado e recomendações, sem expor dados desnecessários. Revise a versão final e oriente o cliente antes do encerramento. Históricos encerrados são registros, não um lugar para continuar alterando atendimento concluído."
        ]
      ],
      "practice": {
        "title": "Caso: visita não confirmada",
        "context": "O técnico agendou retorno para terça-feira, mas não falou com o cliente e pretende marcar o compromisso como concluído.",
        "response": "Mantenha planejado, contate o cliente por canal legítimo, registre a confirmação e só conclua após a visita realmente ocorrer."
      },
      "checklist": [
        "Chamado e autorização vinculados.",
        "Nota interna separada do relatório.",
        "Compromisso no estado verdadeiro.",
        "Encerramento após validação."
      ],
      "references": []
    },
    {
      "id": "op-02",
      "track": "operacao",
      "title": "Residências, microempresas e pós-atendimento",
      "minutes": 15,
      "level": "Intermediário",
      "objectives": [
        "Adaptar diagnóstico ao impacto do cliente.",
        "Priorizar continuidade e comunicação adequada.",
        "Entregar orientações de manutenção proporcionais."
      ],
      "sections": [
        [
          "Contextos diferentes, mesma ética",
          "Em residência, a prioridade pode ser acesso pessoal, estudos e fotos familiares. Em microempresa, internet, impressão, sistemas de vendas e documentos financeiros podem afetar várias pessoas. Pergunte qual atividade foi interrompida antes de propor mudança.",
          "Não presuma que um serviço 'pequeno' tolera parada. Combine com o responsável a janela e a ordem de testes. Respeite orçamento e capacidade de manutenção do cliente."
        ],
        [
          "Prevenção sem venda forçada",
          "Recomendações devem nascer de riscos observados: backup não testado, Wi-Fi inseguro, equipamento superaquecendo, software sem suporte ou instalação desorganizada. Diferencie necessidade imediata, melhoria futura e opção de conveniência.",
          "Explique vantagens, limitações e custo de alternativas sem criar medo artificial. Se a solução exigir profissional especializado de outra área, indique essa dependência."
        ],
        [
          "Pós-atendimento mensurável",
          "Solicite validação da tarefa que falhou e entregue resumo claro. Oriente sinais que justificam retorno, janela de acompanhamento quando combinada e como abrir novo chamado. Não prometa monitoramento contínuo se o serviço não foi contratado e configurado."
        ]
      ],
      "practice": {
        "title": "Caso: rede da loja e computador residencial",
        "context": "Duas solicitações chegam juntas: um PC doméstico lento e uma loja sem acesso ao sistema de vendas.",
        "response": "Investigue segurança e urgência de ambos, documente prioridades e avalie a indisponibilidade comercial com o responsável, sem abandonar comunicação com o cliente residencial."
      },
      "checklist": [
        "Impacto do ambiente entendido.",
        "Prioridades e janelas combinadas.",
        "Recomendações justificadas por evidências.",
        "Cliente recebeu validação e próximos passos."
      ],
      "references": []
    }
  ]
});
})();

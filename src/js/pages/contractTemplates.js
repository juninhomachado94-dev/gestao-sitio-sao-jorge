export const defaultContractContent = `CONTRATO DE LOCAÇÃO DE ESPAÇO PARA LAZER

Locador: CLAUDIO FRANCISCO MACHADO JUNIOR
Locatário: {{nome_cliente}}
CPF/CNPJ: {{cpf_cliente}}
Telefone: {{telefone_cliente}}
Cidade/Estado: Itatinga / SP

----------------------------------------

1. OBJETO DO CONTRATO
O presente contrato tem como objeto a locação do Sítio São Jorge para lazer, incluindo área externa, piscina e demais espaços, exclusivamente para fins recreativos, sem finalidade comercial, shows ou eventos públicos.

----------------------------------------

2. PERÍODO DA LOCAÇÃO

Tipo de locação: {{tipo_evento}}

Entrada: {{data_entrada}} às {{hora_entrada}}
Saída: {{data_saida}} às {{hora_saida}}

Valor total da locação: R$ {{valor_total}}
Valor de entrada: R$ {{valor_sinal}}
Valor restante: R$ {{valor_restante}}
Forma de pagamento: {{forma_pagamento}}
Status do pagamento: {{status_pagamento}}

----------------------------------------

3. CAPACIDADE MÁXIMA
É permitida a permanência de até 30 (TRINTA) pessoas no imóvel.
Ultrapassar essa quantidade sem autorização acarretará cobrança de multa de R$ 100,00 por pessoa adicional.

----------------------------------------

4. DESLIGAMENTO DE ENERGIA E DEVOLUÇÃO DAS CHAVES
Ao término da locação, o locatário deverá desligar todas as luzes e comunicar o locador para conferência final e devolução das chaves.

----------------------------------------

5. USO DA PISCINA - REGRAS DE SEGURANÇA
É obrigatória a supervisão de adulto responsável para crianças.
É proibido empurrar pessoas, saltar de locais elevados, usar vidro na área da piscina ou remover dispositivos de segurança.

----------------------------------------

6. MOTOR E SISTEMA DA PISCINA
É proibido mexer em bombas, filtros ou registros.
Danos causados serão cobrados integralmente.

----------------------------------------

7. ORGANIZAÇÃO DO IMÓVEL
Não será tolerado:
- guerra de alimentos
- sujeira excessiva
- descarte inadequado de materiais íntimos

Danos serão cobrados.

Uso de som:
- permitido até 20h
- após isso, volume ambiente
- proibido som automotivo e paredão

Descumprimento pode gerar:
- GCM
- Polícia
- multa
- responsabilização

----------------------------------------

8. USO DOS BANHEIROS
Proibido descartar itens no vaso sanitário.
Custos de entupimento serão cobrados.

----------------------------------------

9. FUMO
Proibido fumar dentro da casa.
Multa: R$ 500,00

Bitucas descartadas incorretamente:
Multa: R$ 300,00

----------------------------------------

10. CHAVES
Perda ou não devolução:
Multa: R$ 250,00 + custos.

----------------------------------------

11. HORÁRIO DE SAÍDA
Tolerância: 15 minutos

Multa:
R$ 200,00 por atraso
R$ 200,00 por hora excedente

----------------------------------------

12. RESPONSABILIDADE
O locatário responde por:
- convidados
- danos
- acidentes
- processos

----------------------------------------

13. CANCELAMENTO
Aviso mínimo: 20 dias
Após isso, retenção parcial ou total.

----------------------------------------

14. VISTORIA
Será feita na entrada e saída.

----------------------------------------

15. FORO
Itatinga/SP

----------------------------------------

ASSINATURAS

Locador:
{{assinatura_proprietario}}

Locatário:
{{assinatura_cliente}}

Data:
{{data_assinatura}}

Local:
Itatinga/SP`;

export const contractTemplates = {
  templates: [
    {
      id: "modelo-1",
      name: "Contrato padrão - Sítio São Jorge",
      status: "padrão",
      updatedAt: "2026-04-30",
      content: defaultContractContent,
    },
  ],
};

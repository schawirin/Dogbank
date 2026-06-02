# =============================================================================
# Pipeline de Logs - PDV / PIX
# =============================================================================

resource "datadog_logs_custom_pipeline" "pdv_pix" {
  name       = "PDV - Transacoes PIX"
  is_enabled = true

  filter {
    query = "service:bad-logs"
  }

  # ===========================================================================
  # 1. Grok Parser - Extrai campos estruturados + level
  # ===========================================================================
  processor {
    grok_parser {
      name       = "Parser PDV PIX"
      is_enabled = true
      source     = "message"

      grok {
        support_rules = <<-EOT
          _date %%{date("dd/MM/yyyy HH:mm:ss"):timestamp}
          _pdv \[PDV=%%{integer:pdv.id}\]
          _txid txid=%%{notSpace:pix.txid}
          _e2e endToEndId=%%{notSpace:pix.end_to_end_id}
          _valor_cents valor_cents=%%{integer:pix.valor_cents}
          _rc rc=%%{integer:pix.return_code}
          _erro erro=%%{notSpace:pix.erro}
          _chave chave=%%{notSpace:pix.chave}
          _nsu nsu=%%{integer:pix.nsu}
          _banco banco=%%{notSpace:pix.banco}
          _status status=%%{notSpace:pix.status}
          _err %%{regex("ERROR"):level}:
        EOT

        match_rules = <<-EOT
          pix_pagamento_rejeitado %%{_err} \[%%{_date}\] %%{_pdv}\[PIX\]\[PAGAMENTO\] Pagamento PIX REJEITADO pelo PSP %%{_txid} %%{_e2e} %%{_rc} %%{_erro} msg=%%{data:pix.msg} %%{_valor_cents} banco_pagador=%%{notSpace:pix.banco_pagador}
          pix_dict_falha %%{_err} \[%%{_date}\] %%{_pdv}\[PIX\]\[DICT\] Falha na consulta DICT %%{_chave} %%{_rc} %%{_erro} msg=%%{data:pix.msg}
          pix_transacao_rejeitada %%{_err} \[%%{_date}\] %%{_pdv}\[PIX\]\[TRANSACAO\] Transacao PIX REJEITADA %%{_txid} motivo=%%{notSpace:pix.motivo} %%{_rc} %%{_valor_cents} tentativa=%%{notSpace:pix.tentativa}
          pix_transacao_bloqueada %%{_err} \[%%{_date}\] %%{_pdv}\[PIX\]\[TRANSACAO\] Transacao PIX BLOQUEADA %%{_txid} motivo=%%{notSpace:pix.motivo} %%{_rc} %%{_valor_cents}
          pix_transacao_falhou %%{_err} \[%%{_date}\] %%{_pdv}\[PIX\]\[TRANSACAO\] Transacao PIX FALHOU %%{_txid} motivo=%%{notSpace:pix.motivo} %%{_rc} %%{_valor_cents} tentativa=%%{data:pix.tentativa}
          pix_timeout %%{_err} \[%%{_date}\] %%{_pdv}\[PIX\]\[TIMEOUT\] Transacao PIX EXPIRADA %%{_txid} tempo_espera_seg=%%{integer:pix.tempo_espera_seg} %%{_status} %%{_valor_cents} %%{_chave} msg=%%{data:pix.msg}
          pix_devolucao_falha %%{_err} \[%%{_date}\] %%{_pdv}\[PIX\]\[DEVOLUCAO\] Falha na devolucao PIX %%{_txid} devolucaoId=%%{notSpace:pix.devolucao_id} %%{_rc} %%{_erro} msg=%%{data:pix.msg}
          pix_antifraude %%{_err} \[%%{_date}\] %%{_pdv}\[PIX\]\[ANTIFRAUDE\] %%{data:pix.antifraude_detail}
          pix_psp_erro %%{_err} \[%%{_date}\] %%{_pdv}\[PIX\]\[PSP\] %%{data:pix.psp_detail}
          pix_conciliacao_erro %%{_err} \[%%{_date}\] %%{_pdv}\[PIX\]\[CONCILIACAO\] Divergencia encontrada %%{_txid} valor_pix_cents=%%{integer:pix.valor_pix_cents} valor_venda_cents=%%{integer:pix.valor_venda_cents} diferenca_cents=%%{integer:pix.diferenca_cents} tipo=%%{notSpace:pix.tipo_divergencia}
          pix_devolucao_solicitacao \[%%{_date}\] %%{_pdv}\[PIX\]\[DEVOLUCAO\] Solicitacao de devolucao PIX %%{_txid} %%{_e2e} valor_devolucao_cents=%%{integer:pix.valor_devolucao_cents} motivo=%%{notSpace:pix.motivo} devolucaoId=%%{notSpace:pix.devolucao_id}
          pix_pagamento_confirmado \[%%{_date}\] %%{_pdv}\[PIX\]\[PAGAMENTO\] Confirmacao recebida %%{_txid} %%{_e2e} %%{_valor_cents} %%{_status}
          pix_dict_ok \[%%{_date}\] %%{_pdv}\[PIX\]\[DICT\] Consulta DICT %%{_chave} resultado=%%{notSpace:pix.dict_resultado} nome_beneficiario=%%{data:pix.beneficiario} ispb=%%{notSpace:pix.ispb} %%{_banco}
          pix_qrcode \[%%{_date}\] %%{_pdv}\[PIX\]\[QRCODE\] QR Code gerado com sucesso %%{_txid} tipo=%%{notSpace:pix.qr_tipo} %%{_valor_cents} expiracao_seg=%%{integer:pix.expiracao_seg}
          pix_inicio \[%%{_date}\] %%{_pdv}\[PIX\] Iniciando transacao PIX valor=%%{integer:pix.valor} %%{_chave} %%{_txid} %%{_nsu}
          pix_conciliacao_inicio \[%%{_date}\] %%{_pdv}\[PIX\]\[CONCILIACAO\] Inicio conciliacao PIX %%{data:pix.conciliacao_info}
          pix_conciliacao_resultado \[%%{_date}\] %%{_pdv}\[PIX\]\[CONCILIACAO\] Resultado total_transacoes=%%{integer:pix.total_transacoes} conciliadas_ok=%%{integer:pix.conciliadas_ok} divergencias=%%{integer:pix.divergencias} valor_total_pix_cents=%%{integer:pix.valor_total_pix_cents} valor_total_vendas_cents=%%{integer:pix.valor_total_vendas_cents}
          venda_finalizada \[%%{_date}\] %%{_pdv}\[VENDA\]\[FINALIZADA\] COO=%%{integer:venda.coo} valor_total_cents=%%{integer:venda.valor_total_cents} forma_pagamento=%%{notSpace:venda.forma_pagamento} %%{_nsu} cupom_fiscal=%%{notSpace:venda.cupom_fiscal}
          venda_cancelada \[%%{_date}\] %%{_pdv}\[VENDA\]\[CANCELADA\] COO=%%{integer:venda.coo} motivo=%%{notSpace:venda.motivo} %%{_valor_cents}
          operador_msg \[%%{_date}\] %%{_pdv}\[OPERADOR\] Msg='%%{data:operador.mensagem}' \| Opcoes=%%{notSpace:operador.opcoes}
          pix_gateway_recursos \[%%{_date}\] Analise de recursos PIX Gateway%%{data:gateway.raw}
        EOT
      }

      samples = [
        "ERROR: [06/03/2026 13:42:33] [PDV=005][PIX][PAGAMENTO] Pagamento PIX REJEITADO pelo PSP txid=PIX202603061342336266005 endToEndId=E6070119000000000000000006266 rc=-22 erro=LIMITE_DIARIO_EXCEDIDO msg=Conta do pagador com restricao valor_cents=1111400 banco_pagador=Santander",
        "[06/03/2026 13:42:33] [PDV=003][PIX] Iniciando transacao PIX valor=7361 chave=cpf:666.555.444-33 txid=PIX202603061342336265003 nsu=891559",
        "[06/03/2026 13:42:33] [PDV=003][VENDA][FINALIZADA] COO=6227 valor_total_cents=3821100 forma_pagamento=PIX nsu=891554 cupom_fiscal=OK",
        "ERROR: [06/03/2026 16:52:07] [PDV=005][PIX][TRANSACAO] Transacao PIX BLOQUEADA txid=PIX202603061652076827005 motivo=ANTIFRAUDE rc=-99 valor_cents=7101600"
      ]
    }
  }

  # ===========================================================================
  # 2. Status Remapper - Usa level extraido pelo grok
  # ===========================================================================
  processor {
    status_remapper {
      name       = "Status Remapper"
      is_enabled = true
      sources    = ["level"]
    }
  }

  # ===========================================================================
  # 3. Category Processor - Tipo do Evento
  # ===========================================================================
  processor {
    category_processor {
      name       = "Tipo do Evento PIX"
      is_enabled = true
      target     = "evt.name"

      category {
        name = "pix.pagamento.rejeitado"
        filter { query = "@pix.banco_pagador:*" }
      }
      category {
        name = "pix.antifraude"
        filter { query = "@pix.antifraude_detail:*" }
      }
      category {
        name = "pix.psp.erro"
        filter { query = "@pix.psp_detail:*" }
      }
      category {
        name = "pix.dict.falha"
        filter { query = "@pix.erro:(TIMEOUT_COMUNICACAO OR DICT_*)" }
      }
      category {
        name = "pix.transacao.rejeitada"
        filter { query = "@pix.motivo:* @pix.tentativa:*" }
      }
      category {
        name = "pix.transacao.bloqueada"
        filter { query = "@pix.motivo:ANTIFRAUDE -@pix.tentativa:*" }
      }
      category {
        name = "pix.timeout"
        filter { query = "@pix.tempo_espera_seg:>0" }
      }
      category {
        name = "pix.devolucao.falha"
        filter { query = "@pix.devolucao_id:* @pix.return_code:<0" }
      }
      category {
        name = "pix.devolucao.solicitacao"
        filter { query = "@pix.valor_devolucao_cents:>0" }
      }
      category {
        name = "pix.conciliacao.divergencia"
        filter { query = "@pix.tipo_divergencia:*" }
      }
      category {
        name = "pix.pagamento.confirmado"
        filter { query = "@pix.status:CONCLUIDA" }
      }
      category {
        name = "pix.dict.ok"
        filter { query = "@pix.dict_resultado:OK" }
      }
      category {
        name = "pix.qrcode.gerado"
        filter { query = "@pix.qr_tipo:*" }
      }
      category {
        name = "pix.inicio"
        filter { query = "@pix.valor:>0 @pix.nsu:>0" }
      }
      category {
        name = "venda.finalizada"
        filter { query = "@venda.cupom_fiscal:*" }
      }
      category {
        name = "venda.cancelada"
        filter { query = "@venda.motivo:*" }
      }
      category {
        name = "operador.mensagem"
        filter { query = "@operador.mensagem:*" }
      }
      category {
        name = "gateway.status"
        filter { query = "@gateway.raw:*" }
      }
    }
  }

  # ===========================================================================
  # 4. String Builder - Service
  # ===========================================================================
  processor {
    string_builder_processor {
      name               = "Set Service pdv-pix"
      is_enabled         = true
      target             = "service"
      template           = "pdv-pix"
      is_replace_missing = true
    }
  }

  # ===========================================================================
  # 5. Service Remapper
  # ===========================================================================
  processor {
    service_remapper {
      name       = "Service Remapper"
      is_enabled = true
      sources    = ["service"]
    }
  }

  # ===========================================================================
  # 6. Date Remapper
  # ===========================================================================
  processor {
    date_remapper {
      name       = "Date Remapper"
      is_enabled = true
      sources    = ["timestamp"]
    }
  }
}

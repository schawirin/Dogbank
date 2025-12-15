import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import authService from '../services/authService'
import accountService from '../services/accountService'
import pixService from '../services/pixService'
import Card from '../components/common/Card'
import Input from '../components/common/Input'
import Button from '../components/common/Button'
import Alert from '../components/common/Alert'

const PixTransferForm = ({ onConfirm }) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pixKey, setPixKey] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [amountError, setAmountError] = useState('')
  const [pixKeyError, setPixKeyError] = useState('')
  const [generalError, setGeneralError] = useState('')
  const [loading, setLoading] = useState(false)
  const [validatingKey, setValidatingKey] = useState(false)
  const [accountData, setAccountData] = useState(null)
  const [recipientInfo, setRecipientInfo] = useState(null)

  useEffect(() => {
    const fetchAccountData = async () => {
      try {
        if (user?.cpf) {
          const info = await accountService.getAccountInfo(user.cpf)
          setAccountData(info)
        }
      } catch (err) {
        console.error(err)
        setGeneralError('Não foi possível carregar os dados da sua conta.')
      }
    }
    fetchAccountData()
  }, [user])

  // ⚠️ CHAMA O ENDPOINT VULNERÁVEL A SQL INJECTION
  const validatePixKey = async () => {
    if (!pixKey.trim()) {
      setPixKeyError('Digite uma chave PIX válida')
      return false
    }
    
    try {
      setValidatingKey(true)
      
      // 🔥 ENDPOINT VULNERÁVEL - PERMITE SQL INJECTION
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8084'
      const response = await fetch(
        `${API_BASE_URL}/api/transactions/validate-pix-key?pixKey=${encodeURIComponent(pixKey)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      
      const data = await response.json()
      
      console.log('🔍 Validação PIX Response:', data)
      
      if (data.valid) {
        // Dados do destinatário retornados pelo backend
        setRecipientInfo({
          nome: data.nome || 'N/A',
          banco: data.banco || 'DogBank',
          cpf: data.cpf || 'N/A',
          email: data.email || 'N/A'
        })
        setPixKeyError('')
        return true
      } else {
        setPixKeyError(data.message || data.error || 'Chave PIX inválida')
        setRecipientInfo(null)
        return false
      }
      
    } catch (error) {
      console.error('❌ Erro ao validar PIX:', error)
      setPixKeyError('Erro ao validar a chave PIX.')
      setRecipientInfo(null)
      return false
    } finally {
      setValidatingKey(false)
    }
  }

  const validateAmount = () => {
    const num = parseFloat(amount.replace(/\./g, '').replace(',', '.'))
    if (isNaN(num) || num <= 0) {
      setAmountError('Valor inválido')
      return false
    }
    if (accountData && num > accountData.saldo) {
      setAmountError('Saldo insuficiente')
      return false
    }
    setAmountError('')
    return true
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setGeneralError('')
    const okAmount = validateAmount()
    const okKey = await validatePixKey()
    if (!okAmount || !okKey) return

    setLoading(true)
    try {
      const numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'))
      const payload = {
        pixKey,
        amount: numericAmount,
        description: description.trim(),
        recipientInfo,
        sourceAccountId: accountData.id
      }

      // Se veio onConfirm, delega a quem chamou
      if (typeof onConfirm === 'function') {
        onConfirm(payload)
      } else {
        // fluxo antigo (único)
        const resp = await pixService.transfer({
          pixKeyDestination: pixKey,
          amount: numericAmount,
          description: description.trim(),
          accountOriginId: accountData.id
        })
        navigate('/app/dashboard', {
          state: { transferSuccess: true, message: 'Transferência realizada com sucesso!' }
        })
      }
    } catch (err) {
      console.error(err)
      setGeneralError('Erro ao processar sua transferência.')
    } finally {
      setLoading(false)
    }
  }

  const handleAmountChange = e => {
    let v = e.target.value.replace(/[^\d,]/g, '')
    // simples: só mantém dígitos e vírgula
    setAmount(v)
  }

  // Validar ao sair do campo (onBlur)
  const handlePixKeyBlur = () => {
    if (pixKey.trim()) {
      validatePixKey()
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold mb-6">Transferência PIX</h2>
      {generalError && <Alert type="error" message={generalError} onClose={() => setGeneralError('')} />}
      {accountData && (
        <div className="mb-6 bg-neutral-50 p-4 rounded">
          <p>Saldo disponível</p>
          <p className="font-semibold">R$ {accountData.saldo.toFixed(2)}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Chave PIX"
          placeholder="CPF, e-mail, telefone ou chave aleatória"
          value={pixKey}
          onChange={e => setPixKey(e.target.value)}
          onBlur={handlePixKeyBlur}
          error={pixKeyError}
          disabled={loading || validatingKey}
        />
        {validatingKey && (
          <div className="text-sm text-gray-500">
            🔍 Validando chave PIX...
          </div>
        )}
        {recipientInfo && (
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <p className="font-semibold text-green-800">✅ Destinatário encontrado:</p>
            <p className="text-sm mt-2"><strong>Nome:</strong> {recipientInfo.nome}</p>
            <p className="text-sm"><strong>Banco:</strong> {recipientInfo.banco}</p>
            <p className="text-sm"><strong>CPF:</strong> {recipientInfo.cpf}</p>
          </div>
        )}
        <Input
          label="Valor"
          placeholder="0,00"
          value={amount}
          onChange={handleAmountChange}
          error={amountError}
          disabled={loading}
        />
        <Input
          label="Descrição (opcional)"
          placeholder="Ex: Pagamento do aluguel"
          value={description}
          onChange={e => setDescription(e.target.value)}
          disabled={loading}
        />

        <Button type="submit" fullWidth disabled={loading || validatingKey || !recipientInfo}>
          {loading ? 'Processando...' : 'Continuar'}
        </Button>
      </form>
    </Card>
  )
}

export default PixTransferForm
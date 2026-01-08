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

  const validatePixKey = async () => {
    if (!pixKey.trim()) {
      setPixKeyError('Digite uma chave PIX válida')
      return false
    }
    try {
      setValidatingKey(true)
      const resp = await authService.validatePix(pixKey)
      if (resp.valid) {
        setRecipientInfo(resp.user)
        setPixKeyError('')
        return true
      } else {
        setPixKeyError(resp.message || 'Chave PIX inválida')
        return false
      }
    } catch {
      setPixKeyError('Erro ao validar a chave PIX.')
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
        navigate('/dashboard', {
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
          value={pixKey}
          onChange={e => setPixKey(e.target.value)}
          error={pixKeyError}
          disabled={loading || validatingKey}
        />
        {recipientInfo && (
          <div className="p-2 bg-primary-50 rounded">
            <p>Destinatário: {recipientInfo.nome}</p>
            <p>Banco: {recipientInfo.banco}</p>
          </div>
        )}
        <Input
          label="Valor"
          value={amount}
          onChange={handleAmountChange}
          error={amountError}
          disabled={loading}
        />
        <Input
          label="Descrição (opcional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          disabled={loading}
        />

        <Button type="submit" fullWidth disabled={loading || validatingKey}>
          {loading ? 'Processando...' : 'Continuar'}
        </Button>
      </form>
    </Card>
  )
}

export default PixTransferForm

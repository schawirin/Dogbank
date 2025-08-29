/**
 * Utilitários para formatação de valores
 */

/**
 * Formata um CPF: 12345678900 -> 123.456.789-00
 * @param {string|number} cpf - CPF a ser formatado (apenas números)
 * @returns {string} - CPF formatado
 */
export const formatCPF = (cpf) => {
    if (!cpf) return '';
    
    // Garantir que o CPF seja uma string e tenha 11 dígitos
    const cpfText = String(cpf).padStart(11, '0');
    
    // Remover caracteres não numéricos e aplicar máscara
    return cpfText
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };
  
  /**
   * Formata um valor monetário: 1000.50 -> R$ 1.000,50
   * @param {number} value - Valor a ser formatado
   * @returns {string} - Valor formatado como moeda
   */
  export const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  
  /**
   * Formata uma data e hora: 2023-05-15T14:30:00 -> 15/05/2023 14:30
   * @param {string|Date} dateString - Data a ser formatada
   * @returns {string} - Data formatada
   */
  export const formatDate = (dateString) => {
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  /**
   * Formata um número de conta: 00019 -> 0001-9
   * @param {string|number} accountNumber - Número da conta a ser formatado
   * @returns {string} - Número da conta formatado
   */
  export const formatAccountNumber = (accountNumber) => {
    if (!accountNumber) return '';
    
    // Garantir que é uma string e remover caracteres não numéricos
    const cleaned = String(accountNumber).replace(/\D/g, '');
    const length = cleaned.length;
    
    // Formatar como XXXX-X (considerando o último dígito como verificador)
    if (length > 1) {
      const digits = cleaned.slice(0, length - 1);
      const check = cleaned.slice(length - 1);
      return `${digits}-${check}`;
    }
    
    return String(accountNumber);
  };
  
  /**
   * Formata um valor de entrada do usuário para formato de moeda brasileiro
   * @param {string} input - Valor digitado pelo usuário
   * @returns {string} - Valor formatado
   */
  export const formatCurrencyInput = (input) => {
    // Remover caracteres não numéricos, exceto vírgula e ponto
    const numericInput = input.replace(/[^\d,\.]/g, '');
    
    // Separar a parte inteira da decimal
    const parts = numericInput.split(/[,\.]/);
    
    if (parts.length === 1) {
      // Não tem separador decimal
      return parts[0];
    } else {
      // Tem separador decimal
      const integerPart = parts[0];
      // Limitar a parte decimal a 2 dígitos
      const decimalPart = parts.slice(1).join('').slice(0, 2);
      return `${integerPart},${decimalPart}`;
    }
  };
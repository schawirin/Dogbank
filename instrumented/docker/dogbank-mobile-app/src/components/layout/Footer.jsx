import React from 'react';
import dogbankLogo from '../../assets/images/dogbank-logo.png';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-neutral-100 text-neutral-600 py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <img src={dogbankLogo} alt="DogBank" className="h-12 w-auto object-contain mb-4" />
            <p className="text-sm">
              DogBank é um projeto de simulação bancária que oferece serviços financeiros fictícios.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">Links Rápidos</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/dashboard" className="hover:text-primary-500 transition-colors">Início</a></li>
              <li><a href="/pix" className="hover:text-primary-500 transition-colors">PIX</a></li>
              <li><a href="/about" className="hover:text-primary-500 transition-colors">Sobre nós</a></li>
              <li><a href="/faq" className="hover:text-primary-500 transition-colors">FAQ</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">Contato</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                <span>contato@dogbank.com</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                </svg>
                <span>(11) 1234-5678</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-neutral-200 mt-8 pt-4 text-center text-sm">
          <p>&copy; {currentYear} DogBank. Todos os direitos reservados.</p>
          <p className="mt-1 text-xs text-neutral-500">
            Este é um projeto de demonstração. Não é um banco real e não realiza operações financeiras de verdade.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

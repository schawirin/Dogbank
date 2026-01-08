import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Shield, Zap, Lock, CreditCard, Smartphone, TrendingUp, Star, ArrowRight } from 'lucide-react';
import dogbankLogo from '../assets/images/dogbank-logo.png';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setIsVisible(true);
    
    const handleMouseMove = (e) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleLoginClick = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 relative overflow-hidden">
      {/* Animated Background Gradient */}
      <div 
        className="absolute inset-0 opacity-30 transition-all duration-1000 ease-out"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)`,
        }}
      />

      {/* Animated Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

      {/* Floating Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl animate-pulse-slow animation-delay-4000" />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="floating-particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${15 + Math.random() * 20}s`,
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <nav className={`relative z-20 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={dogbankLogo} alt="DogBank" className="h-10 w-auto" />
              <span className="text-xl font-bold text-white">DogBank</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-white/70 hover:text-white transition-colors">Recursos</a>
              <a href="#security" className="text-white/70 hover:text-white transition-colors">Segurança</a>
              <a href="#about" className="text-white/70 hover:text-white transition-colors">Sobre</a>
            </div>
            <button
              onClick={handleLoginClick}
              className="px-6 py-2.5 bg-white/10 backdrop-blur-sm text-white rounded-full font-medium hover:bg-white/20 transition-all border border-white/20 hover:border-white/40"
            >
              Entrar
            </button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative z-10 pt-16 pb-32">
        <div className="container mx-auto px-6">
          <div className={`max-w-5xl mx-auto text-center transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 backdrop-blur-sm rounded-full border border-purple-500/20 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              <span className="text-purple-300 text-sm font-medium">PIX Instantâneo 24h</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight">
              <span className="text-white">Seu banco</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
                do futuro
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-xl md:text-2xl text-white/60 mb-12 max-w-2xl mx-auto leading-relaxed">
              Transferências PIX instantâneas, seguras e sem complicação.
              Experiência bancária reimaginada para a era digital.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleLoginClick}
                className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-2xl font-semibold text-lg overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(139,92,246,0.5)] hover:scale-105"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-purple-400 to-violet-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center gap-2">
                  Começar agora
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <button className="inline-flex items-center justify-center px-8 py-4 bg-white/5 backdrop-blur-sm text-white rounded-2xl font-semibold text-lg border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                Saiba mais
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 mt-20 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">500K+</div>
                <div className="text-white/50 text-sm">Usuários ativos</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">R$ 2B+</div>
                <div className="text-white/50 text-sm">Transacionados</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">99.9%</div>
                <div className="text-white/50 text-sm">Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="relative z-10 py-24">
        <div className="container mx-auto px-6">
          <div className={`text-center mb-16 transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Tudo que você precisa
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Recursos poderosos para simplificar sua vida financeira
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Feature Card 1 */}
            <div className="group relative p-8 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-purple-500/50 transition-all duration-500 hover:bg-white/10 hover:-translate-y-2">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">PIX Instantâneo</h3>
                <p className="text-white/60 leading-relaxed">
                  Transferências em segundos, 24 horas por dia, 7 dias por semana. Sem limites, sem complicação.
                </p>
              </div>
            </div>

            {/* Feature Card 2 */}
            <div className="group relative p-8 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-purple-500/50 transition-all duration-500 hover:bg-white/10 hover:-translate-y-2">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Segurança Total</h3>
                <p className="text-white/60 leading-relaxed">
                  Proteção avançada com criptografia de ponta e autenticação em múltiplos fatores.
                </p>
              </div>
            </div>

            {/* Feature Card 3 */}
            <div className="group relative p-8 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-purple-500/50 transition-all duration-500 hover:bg-white/10 hover:-translate-y-2">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <CreditCard className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Cartão Virtual</h3>
                <p className="text-white/60 leading-relaxed">
                  Cartão virtual gratuito para compras online com controle total pelo app.
                </p>
              </div>
            </div>

            {/* Feature Card 4 */}
            <div className="group relative p-8 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-purple-500/50 transition-all duration-500 hover:bg-white/10 hover:-translate-y-2">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Smartphone className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">100% Digital</h3>
                <p className="text-white/60 leading-relaxed">
                  Abra sua conta em minutos, sem burocracia. Tudo pelo celular.
                </p>
              </div>
            </div>

            {/* Feature Card 5 */}
            <div className="group relative p-8 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-purple-500/50 transition-all duration-500 hover:bg-white/10 hover:-translate-y-2">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Investimentos</h3>
                <p className="text-white/60 leading-relaxed">
                  Faça seu dinheiro render com opções de investimento simplificadas.
                </p>
              </div>
            </div>

            {/* Feature Card 6 */}
            <div className="group relative p-8 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-purple-500/50 transition-all duration-500 hover:bg-white/10 hover:-translate-y-2">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Lock className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Zero Tarifas</h3>
                <p className="text-white/60 leading-relaxed">
                  Conta digital gratuita. Sem taxas escondidas, sem surpresas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="relative z-10 py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="flex justify-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <blockquote className="text-2xl md:text-3xl text-white font-medium mb-6 leading-relaxed">
                "O DogBank revolucionou a forma como eu gerencio meu dinheiro. 
                PIX instantâneo e uma interface incrível!"
              </blockquote>
              <div className="flex items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-bold">
                  R
                </div>
                <div className="text-left">
                  <div className="text-white font-semibold">Renato Silva</div>
                  <div className="text-white/50 text-sm">Cliente desde 2024</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="relative z-10 py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="relative p-12 md:p-16 rounded-[2.5rem] bg-gradient-to-br from-purple-600/20 to-violet-600/20 backdrop-blur-sm border border-purple-500/20 overflow-hidden">
              {/* Glow Effect */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/30 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-violet-500/30 rounded-full blur-3xl" />
              
              <div className="relative text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Pronto para começar?
                </h2>
                <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
                  Abra sua conta em menos de 5 minutos e descubra uma nova forma de cuidar do seu dinheiro.
                </p>
                <button
                  onClick={handleLoginClick}
                  className="group inline-flex items-center justify-center px-10 py-5 bg-white text-purple-600 rounded-2xl font-bold text-lg hover:bg-white/90 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                >
                  Criar conta grátis
                  <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/10 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={dogbankLogo} alt="DogBank" className="h-8 w-auto opacity-80" />
              <span className="text-white/60 text-sm">© 2025 DogBank. Todos os direitos reservados.</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-white/50 hover:text-white text-sm transition-colors">Termos</a>
              <a href="#" className="text-white/50 hover:text-white text-sm transition-colors">Privacidade</a>
              <a href="#" className="text-white/50 hover:text-white text-sm transition-colors">Contato</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

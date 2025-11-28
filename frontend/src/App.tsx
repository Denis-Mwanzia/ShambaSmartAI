import { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Send, Leaf, Cloud, TrendingUp, AlertCircle, 
  Sparkles, Phone, X, Bot, User, Loader2, 
  Zap, Shield, Globe, ArrowRight
} from 'lucide-react';
import axios from 'axios';
import { FormattedMessage } from './components/FormattedMessage';
import './App.css';

interface Message {
  id: string;
  content: string;
  timestamp: Date;
  direction: 'inbound' | 'outbound';
}

const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD 
    ? 'https://shambasmart-ai-896121198699.us-central1.run.app'
    : 'http://localhost:8080');

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  // Load phone number from localStorage on mount
  const [phoneNumber, setPhoneNumber] = useState(() => {
    const saved = localStorage.getItem('shambasmart_phone');
    return saved || '';
  });
  const [phoneInput, setPhoneInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [locationRequested, setLocationRequested] = useState(false);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const [language, setLanguage] = useState<'en' | 'sw'>(() => {
    const saved = localStorage.getItem('shambasmart_language');
    return (saved as 'en' | 'sw') || 'en';
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Language labels
  const labels = {
    en: {
      title: 'ShambaSmart AI',
      subtitle: "Kenya's Agricultural Advisor",
      welcome: 'Welcome to ShambaSmart AI',
      poweredBy: 'Powered by Google Vertex AI',
      companion: 'Your intelligent farming companion',
      enterPhone: 'Enter your Kenyan phone number',
      getStarted: 'Get Started',
      invalidPhone: 'Please enter a valid Kenyan phone number (e.g., +254700000000)',
      quickActions: 'Quick Actions',
      cropAdvice: 'Crop Advice',
      weather: 'Weather',
      marketPrices: 'Market Prices',
      pestHelp: 'Pest Help',
      secure: 'Secure & Private',
      available: 'Available 24/7',
      activeSession: 'Active Session',
      online: 'Online',
      startConversation: 'Start Your Conversation',
      askAnything: 'Ask me anything about farming, crops, livestock, weather, or market prices.',
      askPlaceholder: 'Ask your farming question...',
      send: 'Send',
      aiGenerated: 'Responses are AI-generated',
      footer: 'Empowering Kenyan Farmers with AI Technology',
    },
    sw: {
      title: 'ShambaSmart AI',
      subtitle: 'Mshauri wa Kilimo wa Kenya',
      welcome: 'Karibu ShambaSmart AI',
      poweredBy: 'Inayoendeshwa na Google Vertex AI',
      companion: 'Mwenzako wa kilimo mwenye akili',
      enterPhone: 'Ingiza nambari yako ya simu ya Kenya',
      getStarted: 'Anza Sasa',
      invalidPhone: 'Tafadhali ingiza nambari sahihi ya simu ya Kenya (mfano, +254700000000)',
      quickActions: 'Vitendo vya Haraka',
      cropAdvice: 'Ushauri wa Mazao',
      weather: 'Hali ya Hewa',
      marketPrices: 'Bei za Soko',
      pestHelp: 'Msaada wa Wadudu',
      secure: 'Salama & Faragha',
      available: 'Inapatikana 24/7',
      activeSession: 'Kipindi Kinachoendelea',
      online: 'Mtandaoni',
      startConversation: 'Anza Mazungumzo Yako',
      askAnything: 'Niulize chochote kuhusu kilimo, mazao, mifugo, hali ya hewa, au bei za soko.',
      askPlaceholder: 'Uliza swali lako la kilimo...',
      send: 'Tuma',
      aiGenerated: 'Majibu yanatengenezwa na AI',
      footer: 'Kuwawezesha Wakulima wa Kenya kwa Teknolojia ya AI',
    },
  };

  const t = labels[language];

  // Validate phone number format
  const isValidPhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^\+254\d{9}$/;
    return phoneRegex.test(phone.trim());
  };

  useEffect(() => {
    if (phoneNumber) {
      loadChatHistory();
      // Request location on first visit
      if (!locationRequested) {
        requestUserLocation();
        setLocationRequested(true);
      }
    }
  }, [phoneNumber]);

  const requestUserLocation = async () => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Send location to backend
          await axios.post(`${API_URL}/api/user/location`, {
            phoneNumber,
            latitude,
            longitude,
          });
        } catch (error) {
          console.error('Error updating location:', error);
        }
      },
      () => {
        // Location access denied or error - silently fail
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (phoneNumber && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phoneNumber, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/chat/history`, {
        params: { phoneNumber },
        timeout: 10000,
      });
      const messages = response.data.messages || [];
      const formattedMessages = messages.map((msg: any) => {
        let timestamp: Date;
        
        // Handle different timestamp formats
        if (msg.timestamp instanceof Date) {
          timestamp = msg.timestamp;
        } else if (msg.timestamp && typeof msg.timestamp === 'object') {
          // Firestore Timestamp format - check both with and without underscore
          const seconds = msg.timestamp.seconds || msg.timestamp._seconds;
          const nanoseconds = msg.timestamp.nanoseconds || msg.timestamp._nanoseconds || 0;
          
          if (seconds) {
            // Convert seconds to milliseconds and add nanoseconds (converted to milliseconds)
            timestamp = new Date(seconds * 1000 + Math.floor(nanoseconds / 1000000));
          } else {
            // Fallback to current date if no seconds found
            timestamp = new Date();
          }
        } else if (msg.timestamp && typeof msg.timestamp === 'string') {
          // ISO string or other string format
          timestamp = new Date(msg.timestamp);
        } else if (msg.timestamp && typeof msg.timestamp === 'number') {
          // Unix timestamp (milliseconds or seconds)
          timestamp = new Date(msg.timestamp > 1000000000000 ? msg.timestamp : msg.timestamp * 1000);
        } else {
          // Fallback to current date if invalid
          timestamp = new Date();
        }
        
        // Validate the date
        if (isNaN(timestamp.getTime())) {
          timestamp = new Date();
        }
        
        return {
          ...msg,
          timestamp,
        };
      });
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading chat history:', error);
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !phoneNumber.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      timestamp: new Date(),
      direction: 'inbound',
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = input;
    setInput('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const response = await axios.post(`${API_URL}/api/chat`, {
        phoneNumber,
        message: messageToSend,
        language,
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.data.response,
        timestamp: new Date(),
        direction: 'outbound',
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error processing your request. Please try again in a moment.',
        timestamp: new Date(),
        direction: 'outbound',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleStartChat = () => {
    const trimmedPhone = phoneInput.trim();
    if (isValidPhoneNumber(trimmedPhone)) {
      // Save to localStorage
      localStorage.setItem('shambasmart_phone', trimmedPhone);
      setIsPageTransitioning(true);
      setTimeout(() => {
        setPhoneNumber(trimmedPhone);
        setPhoneInput('');
        setIsPageTransitioning(false);
      }, 300);
    }
  };
  const quickActions = [
    { 
      icon: Leaf, 
      label: t.cropAdvice, 
      query: language === 'en' ? 'I need advice on growing maize' : 'Ninahitaji ushauri wa kupanda mahindi',
      gradient: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600'
    },
    { 
      icon: Cloud, 
      label: t.weather, 
      query: language === 'en' ? 'What is the weather forecast for my area?' : 'Hali ya hewa itakuwaje eneo langu?',
      gradient: 'from-blue-500 to-cyan-500',
      bg: 'bg-blue-50',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    { 
      icon: TrendingUp, 
      label: t.marketPrices, 
      query: language === 'en' ? 'What are the current market prices for maize?' : 'Bei za soko za mahindi ni zipi sasa?',
      gradient: 'from-purple-500 to-pink-500',
      bg: 'bg-purple-50',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600'
    },
    { 
      icon: AlertCircle, 
      label: t.pestHelp, 
      query: language === 'en' ? 'I have a pest problem on my crops, can you help?' : 'Nina tatizo la wadudu kwenye mazao yangu, unaweza kusaidia?',
      gradient: 'from-orange-500 to-red-500',
      bg: 'bg-orange-50',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600'
    },
  ];

  const handleLanguageChange = (lang: 'en' | 'sw') => {
    setLanguage(lang);
    localStorage.setItem('shambasmart_language', lang);
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/20 transition-all duration-300 ${isPageTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      {/* Premium Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-xl blur-lg opacity-50"></div>
                <div className="relative bg-gradient-to-br from-emerald-500 to-teal-500 p-2.5 rounded-xl shadow-lg">
                  <Leaf className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  {t.title}
                </h1>
                <p className="text-xs text-gray-500">{t.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Language Selector */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleLanguageChange('en')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    language === 'en' 
                      ? 'bg-white text-emerald-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => handleLanguageChange('sw')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    language === 'sw' 
                      ? 'bg-white text-emerald-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  SW
                </button>
              </div>
            {phoneNumber && (
                <button
                onClick={() => {
                  localStorage.removeItem('shambasmart_phone');
                  setPhoneNumber('');
                  setMessages([]);
                  setIsPageTransitioning(true);
                  setTimeout(() => setIsPageTransitioning(false), 300);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all transform hover:scale-110 active:scale-95"
                aria-label="Change phone number"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!phoneNumber ? (
          // Premium Welcome Screen
          <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all duration-500 hover:shadow-3xl">
              {/* Hero */}
              <div className="relative bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 px-8 py-16 sm:px-12 sm:py-20 text-white overflow-hidden animate-gradient-shift">
                <div className="absolute inset-0 opacity-20 animate-float" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }}></div>
                {/* Floating particles */}
                <div className="absolute inset-0 overflow-hidden">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-2 h-2 bg-white/30 rounded-full animate-float"
                      style={{
                        left: `${20 + i * 15}%`,
                        top: `${30 + (i % 3) * 20}%`,
                        animationDelay: `${i * 0.5}s`,
                        animationDuration: `${15 + i * 2}s`,
                      }}
                    />
                  ))}
                </div>
                <div className="relative text-center">
                  <div className="inline-flex items-center justify-center mb-6 animate-bounce-slow">
                    <div className="absolute inset-0 bg-white/20 rounded-full blur-2xl animate-pulse"></div>
                    <div className="relative bg-white/10 backdrop-blur-sm p-6 rounded-full border border-white/20 transform hover:scale-110 transition-transform duration-300">
                      <Leaf className="w-12 h-12 text-white animate-spin-slow" />
                    </div>
                  </div>
                  <h2 className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight animate-slide-in">
                    {t.welcome}
                  </h2>
                  <p className="text-xl text-white/90 mb-2 animate-fade-in" style={{ animationDelay: '0.2s' }}>{t.poweredBy}</p>
                  <p className="text-white/80 animate-fade-in" style={{ animationDelay: '0.4s' }}>{t.companion}</p>
                </div>
              </div>
              
              {/* Input Section */}
              <div className="p-8 sm:p-10">
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-emerald-600" />
                    {t.enterPhone}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="tel"
                      placeholder="+254 700 000 000"
                      value={phoneInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (value.startsWith('+') && /^\+?[0-9]*$/.test(value))) {
                          setPhoneInput(value);
                        }
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && isValidPhoneNumber(phoneInput)) {
                          handleStartChat();
                        }
                      }}
                      className="flex-1 px-5 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-base font-medium placeholder:text-gray-400 hover:border-gray-300"
                      autoFocus
                    />
                    <button
                      onClick={handleStartChat}
                      disabled={!isValidPhoneNumber(phoneInput)}
                      className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 disabled:transform-none flex items-center justify-center gap-2 min-h-[56px] relative overflow-hidden group"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        {t.getStarted}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </button>
                  </div>
                  {phoneInput && !isValidPhoneNumber(phoneInput) && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{t.invalidPhone}</span>
                    </div>
                  )}
                </div>
                
                {/* Quick Actions */}
                <div className="border-t border-gray-200 pt-8">
                  <p className="text-sm font-semibold text-gray-700 text-center mb-6 uppercase tracking-wide">{t.quickActions}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {quickActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setPhoneInput('+254');
                          if (inputRef.current) inputRef.current.focus();
                        }}
                        className={`${action.bg} p-5 rounded-xl border border-gray-100 hover:border-gray-200 transition-all group cursor-pointer text-left transform hover:scale-105 active:scale-95 hover:shadow-lg animate-slide-in`}
                        style={{ animationDelay: `${idx * 0.1}s` }}
                      >
                        <div className={`${action.iconBg} inline-flex p-3 rounded-lg mb-3 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                          <action.icon className={`w-5 h-5 ${action.iconColor} group-hover:animate-bounce`} />
                        </div>
                        <p className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">{action.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trust Indicators */}
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <span>{t.secure}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-600" />
                      <span>{t.poweredBy}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-600" />
                      <span>{t.available}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Premium Chat Interface
          <div className="space-y-4 animate-fade-in">
            {/* User Info */}
            <div className="bg-white rounded-2xl shadow-lg p-4 border border-gray-100 transform transition-all duration-300 hover:shadow-xl hover:scale-[1.01] animate-slide-in">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-500 p-2.5 rounded-xl shadow-md transform hover:scale-110 transition-transform duration-300 animate-bounce-slow">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t.activeSession}</p>
                  <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    {phoneNumber}
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full animate-pulse">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                      {t.online}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h3 className="font-bold mb-4 text-gray-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-600" />
                {t.quickActions}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(action.query);
                      setTimeout(() => sendMessage(), 100);
                    }}
                    disabled={isLoading}
                    className={`${action.bg} p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-300 transition-all text-left group transform hover:scale-[1.05] active:scale-[0.95] disabled:opacity-50 disabled:cursor-not-allowed min-h-[100px] flex flex-col hover:shadow-xl animate-slide-in relative overflow-hidden`}
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className={`${action.iconBg} inline-flex p-2.5 rounded-lg mb-2 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 relative z-10`}>
                      <action.icon className={`w-5 h-5 ${action.iconColor} group-hover:animate-bounce`} />
                    </div>
                    <p className="text-sm font-bold text-gray-800 group-hover:text-gray-900 transition-colors relative z-10">{action.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Container */}
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: '500px', maxHeight: '800px' }}>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-gray-50/30 via-white to-gray-50/30">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-emerald-200 rounded-full blur-2xl opacity-50"></div>
                      <div className="relative bg-gradient-to-br from-emerald-500 to-teal-500 p-8 rounded-full shadow-xl">
                        <MessageCircle className="w-16 h-16 text-white" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">{t.startConversation}</h3>
                    <p className="text-gray-600 max-w-md text-base leading-relaxed mb-6">
                      {t.askAnything}
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {['🌾 Crop Advice', '🌤️ Weather', '💰 Market Prices', '🐛 Pest Help'].map((tag, i) => (
                        <span key={i} className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium border border-emerald-200">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((message) => {
                    return (
                      <div key={message.id} className={`flex ${message.direction === 'outbound' ? 'justify-start' : 'justify-end'} mb-4`}>
                        {message.direction === 'outbound' ? (
                          // Bot Message
                          <div className="flex items-start gap-3 max-w-[85%]">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                              <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100">
                              <div className="text-gray-800 text-sm leading-relaxed">
                                <FormattedMessage content={message.content} direction={message.direction} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          // User Message
                          <div className="flex items-start gap-3 max-w-[80%] flex-row-reverse">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                              <User className="w-5 h-5 text-white" />
                            </div>
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-2xl px-5 py-4 shadow-sm">
                              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                
                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex justify-start mb-4">
                    <div className="flex items-start gap-3 max-w-[85%]">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100">
                        <div className="flex gap-1.5">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 bg-white p-5">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={t.askPlaceholder}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-base font-medium placeholder:text-gray-400 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gray-50 focus:bg-white"
                      disabled={isLoading}
                    />
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim()}
                    className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl transform hover:scale-110 active:scale-95 disabled:transform-none min-h-[56px] relative overflow-hidden group"
                    aria-label="Send message"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                    <span className="relative z-10 flex items-center gap-2">
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        <span className="hidden sm:inline">{t.send}</span>
                      </>
                    )}
                    </span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  {t.poweredBy} • {t.aiGenerated}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-gray-200 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <p className="font-semibold text-gray-700">Powered by Google Vertex AI & Gemini</p>
          </div>
          <p className="text-sm text-gray-500">© {new Date().getFullYear()} ShambaSmart AI - {t.footer}</p>
        </div>
      </footer>
    </div>
  );
}

export default App;

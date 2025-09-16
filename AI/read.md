**This is the md file that has the instructions of what to make, below ill be providing the details of what to make , but make sure to alwasys follow the rules **

*RULES*
1. **never run database migration scripts by your own **
2. *always document the changes ,updates,fixes,how did you fix and what problems caused the erros in USERREAD.md file*

project

**we have dev.env and will run it using npm run dev for dev and npm run build then npm run start for production , but i want you to ensure that we build a production ready build that can also run using run dev but when actually deploying can be de
1️⃣ Target Platform
- Web-based only (desktop and mobile browsers), responsive design.
- Future-ready for dedicated mobile and desktop apps.

2️⃣ Pages / Modules
- Login Page
  - Merchant login
  - Admin login
  - Limited access for additional users
- Landing Page / Dashboard
  - Interactive, moderate-weight, fast-loading
  - Displays revenue, orders, profit charts (bar/line/pie as industry standard)
  - Filter by channel (POS, WhatsApp, Marketplace, Website)
  - Dark mode toggle switch
- Orders Page
  - POS Orders: manual single entry and bulk upload (CSV/Excel)
  - WhatsApp Orders: 
      - Customer uploads image
      - Placeholder for AI matching with inventory
      - Checks stock, seeks customer confirmation
      - Payment initiation placeholder
      - Upon confirmation, updates backend inventory
      - PDF invoice generation placeholder
  - Real-time status updates: Processing, Completed, Failed (via WebSocket / polling)
  - Search, filter, and sorting for all orders
- Inventory Management
  - Single entry and bulk entry
  - Categories/tags for products
  - Low stock visual indicator; admin-defined thresholds
  - Daily email notification placeholder for low-stock items
  - Search, filter, and sorting
- Merchant Profile / Settings
  - Edit profile, change password
  - User management (admin + 5 limited users)
  - Role-based access: only admin sees reports, others can place orders/update inventory
  - Password reset (admin manually reset in DB)
- Reports Page
  - Daily/monthly revenue, orders, profit
  - Charts/graphs
  - Filterable by channel (POS, WhatsApp, Marketplace, Website)
  - Export as CSV/Excel
- Invoice Management
  - Generate PDF invoices per order
  - Include logo, merchant name, order summary, tax, payment details
  - For POS orders, provide SMS link placeholder to PDF
  - For WhatsApp orders, provide PDF link placeholder until API integration
  - Store historical invoices for 2 years, auto-purge afterward

3️⃣ UI/UX
-landing page - import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Truck, BarChart3, ShoppingCart, Globe, Users, X, Menu, Box, ArrowRight, Play } from "lucide-react";
import { Button } from "../components/ui/button";
import { Link, useLocation } from "wouter"; 

export default function LandingNew() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [_, setLocation] = useLocation();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);

  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    // Loading sequence with 3D effects
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsLoaded(true), 500);
          return 100;
        }
        return prev + 3;
      });
    }, 50);

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Enhanced 3D Loading Screen
  const LoadingScreen = () => (
    <motion.div
      className="fixed inset-0 bg-black flex items-center justify-center z-50"
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1 }}
    >
      {/* Particle System */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"
            style={{
              left: ${Math.random() * 100}%,
              top: ${Math.random() * 100}%,
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 2, 0],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.1,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* 3D Loading Ring */}
      <div className="relative">
        <motion.div
          className="w-64 h-64 relative"
          animate={{ rotateY: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Multiple rotating rings */}
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className={absolute inset-${i * 4} rounded-full border-4 border-transparent}
              style={{
                borderTopColor: i === 0 ? '#17d406ff' : i === 1 ? '#8b5cf6' : '#f59e0b',
                borderRightColor: i === 0 ? '#3b82f6' : i === 1 ? '#ec4899' : '#ef4444',
                borderBottomColor: i === 0 ? '#d4f63bff' : i === 1 ? '#ec4899' : '#ef4444',
                borderLeftColor: i === 0 ? '#d40633ff' : i === 1 ? '#8b5cf6' : '#f59e0b'
          
              }}
              animate={{ 
                rotateX: 360,
                rotateZ: i % 2 === 0 ? 360 : -360
              }}
              transition={{ 
                duration: 2 + i, 
                repeat: Infinity, 
                ease: "linear" 
              }}
            />
          ))}
          
          {/* Center Content */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <motion.div
                className="text-xl tracking-wide font-black text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text mb-4"
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotateY: [360, 10, -10, 0]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Ecomमित्र
              </motion.div>
              <motion.div
                className="text-cyan-400 text-1xl font-bold"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {Math.round(loadingProgress)}%
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Orbital Progress Indicators */}
        <div className="absolute -inset-16">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{
                top: '50%',
                left: '50%',
                transformOrigin: '0 0',
                background: linear-gradient(45deg, #06b6d4, #8b5cf6, #f59e0b),
              }}
              animate={{
                rotate: i * 30,
                x: loadingProgress > i * 8.33 ? '100px' : '70px',
                opacity: loadingProgress > i * 8.33 ? 1 : 0.2,
                scale: loadingProgress > i * 8.33 ? 1.5 : 1,
              }}
              transition={{ duration: 0.8 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );

  const features = [
    {
      icon: ShoppingCart,
      title: "Order Management",
      description: "Streamline orders across all channels with real-time tracking and automated workflows.",
      color: "bg-gradient-to-br from-blue-500 to-blue-600",
    },
    {
      icon: Package,
      title: "Warehouse Management",
      description: "Optimize inventory with smart allocation, picking, and packing systems.",
      color: "bg-gradient-to-br from-green-500 to-green-600",
    },
    {
      icon: Truck,
      title: "Logistics Integration",
      description: "Connect with 100+ courier partners for seamless shipping and delivery.",
      color: "bg-gradient-to-br from-purple-500 to-purple-600",
    },
    {
      icon: BarChart3,
      title: "Analytics & Reports",
      description: "Get insights with real-time dashboards and comprehensive reporting.",
      color: "bg-gradient-to-br from-yellow-500 to-yellow-600",
    },
    {
      icon: Globe,
      title: "Omnichannel Retail",
      description: "Unify online and offline sales with smart routing and inventory sync.",
      color: "bg-gradient-to-br from-emerald-500 to-emerald-600",
    },
    {
      icon: Users,
      title: "Multi-Tenant Platform",
      description: "Serve multiple clients with isolated data and customizable workflows.",
      color: "bg-gradient-to-br from-indigo-500 to-indigo-600",
    },
  ];

  const platformFeatures = [
    { 
      title: "Unified Dashboard", 
      description: "Single view of all orders, warehouses, pending items, and current status across your entire operation",
      icon: BarChart3,
      feature: "All-in-One View",
      color: "from-blue-500 to-cyan-500"
    },
    { 
      title: "Bulk Operations", 
      description: "CSV upload for orders, inventory, payments - streamline data entry across all modules",
      icon: Package,
      feature: "Bulk Upload",
      color: "from-emerald-500 to-green-500"
    },
    { 
      title: "Live Shipping Tracking", 
      description: "Real-time updates: ready to ship, in-transit, failed deliveries with instant notifications",
      icon: Truck,
      feature: "Live Updates",
      color: "from-purple-500 to-violet-500"
    },
    { 
      title: "Smart Returns Management", 
      description: "Track return ID, order details, customer info, refund amounts, and RTO items in one place",
      icon: ShoppingCart,
      feature: "Return Tracking",
      color: "from-orange-500 to-red-500"
    },
  ];

  const businessFeatures = [
    {
      title: "Channel Performance Analytics",
      description: "Monitor sales across Shopify, Amazon, Flipkart with detailed performance metrics",
      icon: "📊",
      highlight: "Multi-Channel Insights"
    },
    {
      title: "Payment Reconciliation", 
      description: "Automated matching of payments, settlements, and gateway transactions with detailed reporting",
      icon: "💳",
      highlight: "Auto-Reconciliation"
    },
    {
      title: "Warehouse Management",
      description: "Multi-location inventory tracking, stock alerts, and automated reorder points",
      icon: "🏭",
      highlight: "Multi-Location Support"
    },
    {
      title: "Team Management",
      description: "Role-based access control, user permissions, and activity tracking for your team",
      icon: "👥",
      highlight: "Role-Based Access"
    }
  ];

  const handleStartFreeTrial = () => {
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black text-slate-100 overflow-hidden">

      {/* Enhanced 3D CTA Section */}
      <section className="py-32 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 opacity-90" />
        
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-br from-purple-400/20 to-pink-500/20 rounded-full blur-3xl"
          />
        </div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
            className="text-5xl md:text-6xl font-black mb-6 text-white"
          >
            Ready to be a part of our Family?!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-2xl mb-12 text-indigo-100"
          >
            Join thousands of Indian businesses already using...<span className="ml-1.3xl tracking-wide font-bold">Ecomमित्र</span>
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-8 justify-center items-center"
          >
            {/* 3D Start Free Trial Button */}
            <motion.button
              whileHover={{ 
                scale: 1.1,
                rotateY: 5,
                rotateX: -5,
                boxShadow: "0 25px 50px -12px rgba(59, 130, 246, 0.5)"
              }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="relative px-10 py-5 bg-gradient-to-r from-white to-slate-100 text-indigo-600 rounded-2xl font-bold text-lg overflow-hidden group"
              onClick={handleStartFreeTrial}
            >
              <span className="relative z-10">Start Free Trial</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </motion.button>
            
            {/* 3D Book Demo Button */}
            <motion.button
              whileHover={{ 
                scale: 1.1,
                rotateY: -5,
                rotateX: 5,
                boxShadow: "0 25px 50px -12px rgba(255, 255, 255, 0.3)"
              }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="relative px-10 py-5 border-4 border-white text-white rounded-2xl font-bold text-lg overflow-hidden group"
            >
              <span className="relative z-10">Book Demo</span>
              <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
              <span className="absolute inset-0 flex items-center justify-center text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Book Demo
              </span>
            </motion.button>
          </motion.div>
        </div>
      </section>
      {/* Enhanced 3D Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Main gradient layers with mouse parallax */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 30% 40%, rgba(139, 92, 246, 0.15) 0%, transparent 60%),
              radial-gradient(circle at 70% 60%, rgba(59, 130, 246, 0.12) 0%, transparent 50%),
              radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.08) 0%, transparent 45%)
            `,
            filter: 'blur(80px)',
            transform: translate3d(${mousePosition.x * 30}px, ${mousePosition.y * 30}px, 0) rotateX(${mousePosition.y * 5}deg) rotateY(${mousePosition.x * 5}deg),
          }}
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 10, 0],
          }}
          transition={{ duration: 15, repeat: Infinity }}
        />

        {/* Secondary flowing layer */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 80% 20%, rgba(236, 72, 153, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 40% 90%, rgba(251, 146, 60, 0.08) 0%, transparent 40%)
            `,
            filter: 'blur(60px)',
            transform: translate3d(${mousePosition.x * -20}px, ${mousePosition.y * -20}px, 0) rotateX(${mousePosition.y * -3}deg),
          }}
          animate={{
            scale: [0.8, 1.3, 0.8],
            rotate: [0, -15, 0],
          }}
          transition={{ duration: 20, repeat: Infinity }}
        />

        {/* 3D Floating Particles */}
        {[...Array(25)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"
            style={{
              left: ${15 + (i * 3.5) % 70}%,
              top: ${15 + (i * 4.5) % 70}%,
            }}
            animate={{
              y: [-30, -100, -30],
              x: [0, Math.sin(i) * 50, 0],
              opacity: [0.2, 1, 0.2],
              scale: [1, 2, 1],
              rotateY: [0, 180, 360],
              rotateX: [0, 90, 0],
            }}
            transition={{
              duration: 6 + (i % 4),
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeInOut"
            }}
          />
        ))}

        {/* Large 3D geometric shapes */}
        <motion.div
          className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-3xl"
          style={{
            transformStyle: "preserve-3d",
            transform: translate3d(${mousePosition.x * 15}px, ${mousePosition.y * 15}px, 0) rotateX(${mousePosition.y * 10}deg) rotateY(${mousePosition.x * 10}deg),
          }}
          animate={{
            rotateZ: [0, 360],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />

        <motion.div
          className="absolute bottom-20 right-20 w-24 h-24 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-2xl"
          style={{
            transformStyle: "preserve-3d",
            transform: translate3d(${mousePosition.x * -10}px, ${mousePosition.y * -10}px, 0) rotateX(${mousePosition.y * -8}deg) rotateY(${mousePosition.x * -8}deg),
          }}
          animate={{
            rotateX: [0, 180, 360],
            rotateY: [0, 180, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Preloader */}
      <AnimatePresence>
        {!isLoaded && <LoadingScreen />}
      </AnimatePresence>

      {/* Navigation */}
      {isLoaded && (
      <motion.nav 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center py-6">
            <motion.div 
              className="flex items-center space-x-5"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
            

                
              {/* Logo */}
              <span className="ml-1 tracking-center text-2xl font-black bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Ecomमित्र
              </span>
            </motion.div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <motion.a 
                href="#features" 
                className="font-semibold text-slate-300 hover:text-white transition-colors relative group"
                whileHover={{ y: -2 }}
              >
                Features
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 group-hover:w-full transition-all duration-300" />
              </motion.a>
              <motion.a 
                href="#about" 
                className="font-semibold text-slate-300 hover:text-white transition-colors relative group"
                whileHover={{ y: -2 }}
              >
                About
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 group-hover:w-full transition-all duration-300" />
              </motion.a>
              <Link href="/login">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white font-semibold">
                    Sign In
                  </Button>
                </motion.div>
              </Link>
              <motion.div
                whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(99, 102, 241, 0.5)" }}
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  onClick={handleStartFreeTrial}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold px-6 py-2 rounded-xl shadow-lg"
                >
                  Start Free Trial
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            </div>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              className="md:hidden text-slate-300"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </motion.nav>
       )}

      {/* Hero Section with Enhanced 3D Showcase */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* 3D Floating Elements */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            animate={{ 
              rotateY: [0, 360],
              rotateX: [0, 15, 0],
              z: [0, 100, 0]
            }}
            transition={{ 
              duration: 25, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-r from-blue-500/40 to-cyan-500/40 rounded-3xl blur-sm"
          />
          <motion.div
            animate={{ 
              rotateY: [360, 0],
              rotateZ: [0, 180, 0],
              scale: [1, 1.2, 1]
            }}
            transition={{ 
              duration: 30, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="absolute top-40 right-32 w-24 h-24 bg-gradient-to-r from-purple-500/40 to-pink-500/40 rounded-2xl blur-sm"
          />
          <motion.div
            animate={{ 
              rotateX: [0, 360],
              y: [0, -50, 0],
              scale: [1, 0.8, 1]
            }}
            transition={{ 
              duration: 20, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="absolute bottom-32 left-1/3 w-20 h-20 bg-gradient-to-r from-emerald-500/40 to-green-500/40 rounded-full blur-sm"
          />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="mb-8"
          >
            <motion.div 
              className="inline-block mb-8"
              whileHover={{ 
                scale: 1.1, 
                rotateY: 15,
                rotateX: 10,
                boxShadow: "0 25px 50px -12px rgba(99, 102, 241, 0.5)"
              }}
              animate={{
                rotateY: [0, 5, 0, -5, 0],
                rotateX: [0, 2, 0, -2, 0]
              }}
              transition={{ 
                duration: 8,
                repeat: Infinity,
              }}
            >
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-6 rounded-2xl shadow-2xl shadow-indigo-500/25 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent animate-pulse" />
                <span className="text-xl tracking-wide font-extrabold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent relative z-10 select-none">Ecomमित्र</span>
              </div>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, scale: 0.5, rotateX: -90 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0 }}
              transition={{ duration: 1.2, delay: 0.4, type: "spring", stiffness: 100 }}
              className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
              style={{
                transformStyle: "preserve-3d",
                transform: rotateY(${mousePosition.x * 0.003}deg) rotateX(${mousePosition.y * 0.002}deg)
              }}
            >
               With pride in our roots and love for every individual, we stand by small businesses — because you matter, and your dreams deserve to thrive!
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="text-xl md:text-2xl text-slate-300 max-w-4xl mx-auto mb-12 leading-relaxed"
            >
              You dont ponder on something big, You make it !
              <br className="hidden md:block" />
              <span className="text-indigo-400 font-semibold">Built for Scale, Designed for Success</span>
            </motion.p>
          </motion.div>
          
          {/* Enhanced Feature Showcase Cards */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
          >
            {platformFeatures.map((feature, index: number) => {
              const IconComponent = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30, rotateX: -15 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ duration: 0.6, delay: 0.9 + index * 0.1 }}
                  whileHover={{ 
                    y: -10, 
                    rotateY: 5,
                    scale: 1.05,
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                  }}
                  className="relative group"
                >
                  <div className={bg-gradient-to-br ${feature.color} p-1 rounded-2xl shadow-2xl}>
                    <div className="bg-slate-900/90 backdrop-blur-xl p-6 rounded-xl border border-slate-700/50 h-full">
                      <motion.div
                        animate={{ 
                          rotateY: [0, 360],
                          scale: [1, 1.1, 1]
                        }}
                        transition={{ 
                          duration: 10, 
                          repeat: Infinity, 
                          ease: "easeInOut",
                          delay: index * 2
                        }}
                        className={w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 shadow-lg}
                      >
                        <IconComponent className="w-6 h-6 text-white" />
                      </motion.div>
                      <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                      <p className="text-slate-300 text-sm mb-3 leading-relaxed">{feature.description}</p>
                      <div className={inline-block px-3 py-1 bg-gradient-to-r ${feature.color} rounded-full text-xs font-semibold text-white}>
                        {feature.feature}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* India-First Solutions Section */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="mb-16"
          >
            <motion.h2
              className="text-4xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent"
              whileHover={{ scale: 1.05 }}
            >
              🇮🇳 Built for Business
            </motion.h2>
            <p className="text-xl text-slate-400 text-center mb-12 max-w-3xl mx-auto">
              Comprehensive tools to manage and grow your e-commerce business
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {businessFeatures.map((feature, index: number) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  transition={{ duration: 0.6, delay: 1.4 + index * 0.1 }}
                  whileHover={{ 
                    scale: 1.05, 
                    rotateY: 5,
                    boxShadow: "0 20px 40px -12px rgba(251, 146, 60, 0.3)"
                  }}
                  className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-md border border-orange-500/20 shadow-xl hover:border-orange-500/40 transition-all duration-300"
                >
                  <motion.div
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ 
                      duration: 6, 
                      repeat: Infinity, 
                      ease: "easeInOut",
                      delay: index * 1.5
                    }}
                    className="text-4xl mb-4 text-center"
                  >
                    {feature.icon}
                  </motion.div>
                  <h3 className="text-lg font-bold text-white mb-2 text-center">{feature.title}</h3>
                  <p className="text-slate-300 text-sm mb-3 text-center leading-relaxed">{feature.description}</p>
                  <div className="text-center">
                    <span className="inline-block px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full text-xs font-semibold text-white">
                      {feature.highlight}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.8 }}
            className="flex flex-col sm:flex-row gap-6 justify-center items-center"
          >
            <motion.div
              whileHover={{ 
                scale: 1.05, 
                boxShadow: "0 25px 50px -12px rgba(99, 102, 241, 0.5)"
              }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                size="lg"
                onClick={handleStartFreeTrial}
                className="text-xl px-12 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-2xl shadow-indigo-500/25 border-0"
              >
                START FREE TRIAL
                <ArrowRight className="w-6 h-6 ml-3" />
              </Button>
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="outline"
                size="lg"
                className="text-xl px-12 py-6 border-2 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white font-semibold rounded-2xl"
              >
                <Play className="w-5 h-5 mr-3" />
                Watch Demo
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {/* Floating Elements */}
        <motion.div
          animate={{ 
            y: [0, -20, 0],
            rotate: [0, 5, 0]
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="absolute top-20 left-10 bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-2xl shadow-2xl shadow-purple-500/25"
        >
          <Box className="h-8 w-8 text-white" />
        </motion.div>
        
        <motion.div
          animate={{ 
            y: [0, 20, 0],
            rotate: [0, -5, 0]
          }}
          transition={{ 
            duration: 3, 
            repeat: Infinity, 
            ease: "easeInOut",
            delay: 1
          }}
          className="absolute bottom-20 right-10 bg-gradient-to-br from-emerald-500 to-cyan-500 p-4 rounded-2xl shadow-2xl shadow-emerald-500/25"
        >
          <Globe className="h-8 w-8 text-white" />
        </motion.div>
      </section>


      {/* Enhanced 3D Features Section */}
      <section id="features" className="py-32 bg-gradient-to-br from-slate-900 to-slate-800 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-5xl md:text-6xl font-black mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                POWERFUL FEATURES FOR
              </span>
              <br />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                MODERN E-COMMERCE
              </span>
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
              Everything you need to manage orders, inventory, and logistics at scale
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50, rotateX: -15 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ 
                  y: -15, 
                  scale: 1.05,
                  rotateX: 5,
                  rotateY: 5,
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                }}
                className="relative group bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-md border border-slate-700/30 rounded-3xl p-8 hover:border-cyan-400/50 transition-all duration-500"
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* 3D Card Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Icon Container with 3D Effect */}
                <motion.div
                  whileHover={{ rotateY: 360 }}
                  transition={{ duration: 0.6 }}
                  className={w-20 h-20 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-all duration-500}
                >
                  <feature.icon className="h-8 w-8 text-white" />
                </motion.div>
                
                <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-cyan-300 transition-colors duration-300">{feature.title}</h3>
                <p className="text-slate-300 leading-relaxed text-lg group-hover:text-slate-200 transition-colors duration-300">{feature.description}</p>
                
                {/* Hover Glow Effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-3xl opacity-0 group-hover:opacity-30 blur transition-opacity duration-500" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
index.html- <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content="Ultimate E-commerce Management Platform for Indian market. Handle millions of orders with 99.999% uptime. Order management, warehouse, logistics, and analytics." />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Architects+Daughter&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Fira+Code:wght@300..700&family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=IBM+Plex+Sans:ital,wght@0,100..700;1,100..700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400..700;1,400..700&family=Merriweather:ital,opsz,wght@0,18..144,300..900;1,18..144,300..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Outfit:wght@100..900&family=Oxanium:wght@200..800&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Roboto+Mono:ital,wght@0,100..700;1,100..700&family=Roboto:ital,wght@0,100..900;1,100..900&family=Source+Code+Pro:ital,wght@0,200..900;1,200..900&family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&family=Space+Grotesk:wght@300..700&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>

  </body>
</html>
dashboard.tsx- // import { useState } from "react"; // Unused for now
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Plus, TrendingUp, Package, AlertCircle, Eye, LayoutDashboard, BarChart3 } from "lucide-react";
import { getAuthHeaders } from "../lib/auth";
import { useToast } from "../hooks/use-toast";

export default function Dashboard() {
  // const [selectedWarehouse, setSelectedWarehouse] = useState("all"); // Unused for now
  const { toast } = useToast();

  const { data: metrics } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/metrics", {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      const response = await fetch("/api/orders?limit=5", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["/api/warehouses"],
    queryFn: async () => {
      const response = await fetch("/api/warehouses", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'new-order':
        window.location.href = '/orders';
        break;
      case 'inventory-check':
        window.location.href = '/inventory';
        break;
      case 'sync-integrations':
        toast({ title: "Success", description: "Integrations synced successfully" });
        break;
      default:
        toast({ title: "Info", description: ${action} action triggered });
    }
  };

  const handleViewAll = (section: string) => {
    switch (section) {
      case 'orders':
        window.location.href = '/orders';
        break;
      case 'inventory':
        window.location.href = '/inventory';
        break;
      default:
        break;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center">
            <LayoutDashboard className="w-10 h-10 mr-3 text-blue-400" />
            Dashboard
          </h1>
          <p className="text-slate-300 mt-2">Monitor your operations and key metrics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card-3d bg-gradient-to-br from-slate-800 to-slate-700 p-6 rounded-xl border border-slate-600">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Package className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{metrics?.todayOrders || 0}</p>
              <p className="text-sm text-slate-300">Today's Orders</p>
              <div className="flex items-center mt-1">
                <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                <span className="text-xs text-green-400">+12%</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="card-3d bg-gradient-to-br from-slate-800 to-slate-700 p-6 rounded-xl border border-slate-600">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <AlertCircle className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{metrics?.pendingAllocation || 0}</p>
              <p className="text-sm text-slate-300">Pending Allocation</p>
              <div className="flex items-center mt-1">
                <span className="text-xs text-orange-400">Needs attention</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card-3d bg-gradient-to-br from-slate-800 to-slate-700 p-6 rounded-xl border border-slate-600">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{metrics?.pickAccuracy || 0}%</p>
              <p className="text-sm text-slate-300">Pick Accuracy</p>
              <div className="flex items-center mt-1">
                <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                <span className="text-xs text-green-400">Excellent</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card-3d bg-gradient-to-br from-slate-800 to-slate-700 p-6 rounded-xl border border-slate-600">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">₹</span>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">₹{(metrics?.todayRevenue || 0).toLocaleString()}</p>
              <p className="text-sm text-slate-300">Today's Revenue</p>
              <div className="flex items-center mt-1">
                <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                <span className="text-xs text-green-400">+8%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <Card className="card-3d bg-gradient-to-br from-slate-800 to-slate-700 border-slate-600">
            <CardHeader className="border-b border-slate-600">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center">
                  <Package className="w-5 h-5 mr-2 text-blue-400" />
                  Recent Orders
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleViewAll('orders')}
                  className="text-blue-400 hover:text-blue-300"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700/50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-slate-300">Order</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-300">Customer</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-300">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-slate-300">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 5).map((order: any) => (
                      <tr key={order.id} className="border-b border-slate-600 hover:bg-slate-700/30">
                        <td className="p-4 font-medium text-white">{order.orderNumber}</td>
                        <td className="p-4 text-white">{order.customerName}</td>
                        <td className="p-4">
                          <Badge className={${order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'} border}>
                            {order.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-white">₹{parseFloat(order.totalAmount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Warehouse Status */}
        <div>
          <Card className="card-3d bg-gradient-to-br from-slate-800 to-slate-700 border-slate-600">
            <CardHeader className="border-b border-slate-600">
              <CardTitle className="text-white flex items-center">
                <Package className="w-5 h-5 mr-2 text-green-400" />
                Warehouses
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {warehouses.slice(0, 3).map((warehouse: any) => (
                  <div key={warehouse.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{warehouse.name}</p>
                      <p className="text-sm text-slate-300">{warehouse.city}</p>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="card-3d bg-gradient-to-br from-slate-800 to-slate-700 border-slate-600">
        <CardHeader className="border-b border-slate-600">
          <CardTitle className="text-white flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-purple-400" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              className="btn-3d bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 h-20 flex-col"
              onClick={() => handleQuickAction('new-order')}
            >
              <Plus className="w-6 h-6 mb-2" />
              New Order
            </Button>
            <Button 
              className="btn-3d bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 h-20 flex-col"
              onClick={() => handleQuickAction('inventory-check')}
            >
              <Package className="w-6 h-6 mb-2" />
              Check Inventory
            </Button>
            <Button 
              className="btn-3d bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 h-20 flex-col"
              onClick={() => handleQuickAction('sync-integrations')}
            >
              <TrendingUp className="w-6 h-6 mb-2" />
              Sync Integrations
            </Button>
            <Button 
              className="btn-3d bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 h-20 flex-col"
              onClick={() => handleQuickAction('generate-report')}
            >
              <BarChart3 className="w-6 h-6 mb-2" />
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

login.tsx- import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EyeOff, Eye, Package } from "lucide-react";
import { useLogin } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { devLog } from "@/utils/secure-logging";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    devLog("handleSubmit triggered", { username });
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: "Error",
        description: "Please enter both username and password.",
        variant: "destructive",
      });
      return;
    }

    try {
      await loginMutation.mutateAsync({ username, password });
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: "Login Failed",
        description: "Invalid username or password.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center border-2 border-foreground shadow-[4px_4px_0px_0px_#000000]">
              <Package className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-black uppercase tracking-tight">
            Ecomमित्र
          </CardTitle>
          <p className="text-muted-foreground">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                data-testid="input-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  data-testid="input-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Button
                variant="link"
                className="p-0 h-auto font-medium"
                onClick={() => setLocation("/signup")}
              >
                Sign up
              </Button>
            </p>
          </div>
          
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Demo Credentials:</p>
            <div className="text-xs space-y-1">
              <p><strong>Admin:</strong> admin / password123</p>
              <p><strong>Manager:</strong> john.manager / password123</p>
              <p><strong>Picker:</strong> ramesh.picker / password123</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

these are the basic ideas of how the pages are made ,
- Toggleable dark mode
- Optimized for slow networks (~1–2 Mbps)

4️⃣ *Integrations / 
- WebSocket or polling for real-time updates
- WhatsApp API integration placeholder for order confirmation
- CSV/Excel upload and download for orders and reports

5️⃣ Additional Features
- Activity logs (optional, placeholder)
- Role-based permission enforcement in frontend

6️⃣ Performance & Best Practices
- Component-based pages for Dashboard, Orders, Inventory, Reports
- Lazy-loading modules to improve speed
- Proper error handling and notifications for users
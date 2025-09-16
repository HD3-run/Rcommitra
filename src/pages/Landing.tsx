import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Menu } from "lucide-react";
import { useLocation } from "wouter";

export default function LandingNew() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [_, setLocation] = useLocation();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  // const [isLoaded, setIsLoaded] = useState(false);
  // const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    // Loading sequence with 3D effects
    // const interval = setInterval(() => {
    //   setLoadingProgress(prev => {
    //     if (prev >= 100) {
    //       clearInterval(interval);
    //       setTimeout(() => setIsLoaded(true), 500);
    //       return 100;
    //     }
    //     return prev + 3;
    //   });
    // }, 50);

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      // clearInterval(interval);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // const LoadingScreen = () => (
  //   <motion.div
  //     className="fixed inset-0 bg-black flex items-center justify-center z-50"
  //     exit={{ opacity: 0, scale: 1.1 }}
  //     transition={{ duration: 1 }}
  //   >
  //     {/* Particle System */}
  //     <div className="absolute inset-0 overflow-hidden">
  //       {[...Array(30)].map((_, i) => (
  //         <motion.div
  //           key={i}
  //           className="absolute w-1 h-1 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"
  //           style={{
  //             left: `${Math.random() * 100}%`,
  //             top: `${Math.random() * 100}%`,
  //           }}
  //           animate={{
  //             opacity: [0, 1, 0],
  //             scale: [0, 2, 0],
  //             rotate: [0, 180, 360],
  //           }}
  //           transition={{
  //             duration: 3,
  //             repeat: Infinity,
  //             delay: i * 0.1,
  //             ease: "easeInOut"
  //           }}
  //         />
  //       ))}
  //     </div>

  //     {/* 3D Loading Ring */}
  //     <div className="relative">
  //       <motion.div
  //         className="w-64 h-64 relative"
  //         animate={{ rotateY: 360 }}
  //         transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
  //         style={{ transformStyle: "preserve-3d" }}
  //       >
  //         {/* Multiple rotating rings */}
  //         {[...Array(3)].map((_, i) => (
  //           <motion.div
  //             key={i}
  //             className={`absolute inset-${i * 4} rounded-full border-4 border-transparent`}
  //             style={{
  //               borderTopColor: i === 0 ? '#17d406ff' : i === 1 ? '#8b5cf6' : '#f59e0b',
  //               borderRightColor: i === 0 ? '#3b82f6' : i === 1 ? '#ec4899' : '#ef4444',
  //               borderBottomColor: i === 0 ? '#d4f63bff' : i === 1 ? '#ec4899' : '#ef4444',
  //               borderLeftColor: i === 0 ? '#d40633ff' : i === 1 ? '#8b5cf6' : '#f59e0b'
  //             }}
  //             animate={{
  //               rotateX: 360,
  //               rotateZ: i % 2 === 0 ? 360 : -360
  //             }}
  //             transition={{
  //               duration: 2 + i,
  //               repeat: Infinity,
  //               ease: "linear"
  //             }}
  //           />
  //         ))}

  //         {/* Center Content */}
  //         <div className="absolute inset-0 flex items-center justify-center">
  //           <div className="text-center">
  //             <motion.div
  //               className="text-xl tracking-wide font-black text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text mb-4"
  //               animate={{
  //                 scale: [1, 1.1, 1],
  //                 rotateY: [360, 10, -10, 0]
  //               }}
  //               transition={{ duration: 2, repeat: Infinity }}
  //             >
  //               Ecomमित्र
  //             </motion.div>
  //             <motion.div
  //               className="text-cyan-400 text-1xl font-bold"
  //               animate={{ opacity: [0.5, 1, 0.5] }}
  //               transition={{ duration: 1.5, repeat: Infinity }}
  //             >
  //               {Math.round(loadingProgress)}%
  //             </motion.div>
  //           </div>
  //         </div>
  //       </motion.div>

  //       {/* Orbital Progress Indicators */}
  //       <div className="absolute -inset-16">
  //         {[...Array(12)].map((_, i) => (
  //           <motion.div
  //             key={i}
  //             className="absolute w-3 h-3 rounded-full"
  //             style={{
  //               top: '50%',
  //               left: '50%',
  //               transformOrigin: '0 0',
  //               background: "linear-gradient(45deg, #06b6d4, #8b5cf6, #f59e0b)",
  //             }}
  //             animate={{
  //               rotate: i * 30,
  //               x: loadingProgress > i * 8.33 ? '100px' : '70px',
  //               opacity: loadingProgress > i * 8.33 ? 1 : 0.2,
  //               scale: loadingProgress > i * 8.33 ? 1.5 : 1,
  //             }}
  //             transition={{ duration: 0.8 }}
  //           />
  //         ))}
  //       </div>
  //     </div>
  //   </motion.div>
  // );

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
              onClick={() => setLocation("/login")}
            >
              Login
              <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
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
          }}
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 10, 0],
            x: mousePosition.x * 0.03,
            y: mousePosition.y * 0.03,
            rotateX: mousePosition.y * 0.05,
            rotateY: mousePosition.x * 0.05,
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
          }}
          animate={{
            scale: [0.8, 1.3, 0.8],
            rotate: [0, -15, 0],
            x: mousePosition.x * -0.02,
            y: mousePosition.y * -0.02,
            rotateX: mousePosition.y * -0.03,
          }}
          transition={{ duration: 20, repeat: Infinity }}
        />

        {/* 3D Floating Particles */}
        {[...Array(25)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"
            style={{
              left: `${15 + (i * 3.5) % 70}%`,
              top: `${15 + (i * 4.5) % 70}%`,
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
          }}
          animate={{
            rotateZ: [0, 360],
            scale: [1, 1.1, 1],
            x: mousePosition.x * 0.015,
            y: mousePosition.y * 0.015,
            rotateX: mousePosition.y * 0.01,
            rotateY: mousePosition.x * 0.01,
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />

        <motion.div
          className="absolute bottom-20 right-20 w-24 h-24 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-2xl"
          style={{
            transformStyle: "preserve-3d",
          }}
          animate={{
            rotateX: [0, 180, 360],
            rotateY: [0, 180, 0],
            x: mousePosition.x * -0.01,
            y: mousePosition.y * -0.01,
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Preloader */}
      {/* <AnimatePresence>
        {!isLoaded && <LoadingScreen />}
      </AnimatePresence> */}

      {/* Navigation */}
      {/* {isLoaded && ( */}
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
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-white transition-all duration-300 group-hover:w-full"></span>
              </motion.a>
              <motion.a
                href="#pricing"
                className="font-semibold text-slate-300 hover:text-white transition-colors relative group"
                whileHover={{ y: -2 }}
              >
                Pricing
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-white transition-all duration-300 group-hover:w-full"></span>
              </motion.a>
              <motion.a
                href="#contact"
                className="font-semibold text-slate-300 hover:text-white transition-colors relative group"
                whileHover={{ y: -2 }}
              >
                Contact
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-white transition-all duration-300 group-hover:w-full"></span>
              </motion.a>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-slate-300 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden overflow-hidden"
            >
              <div className="pt-2 pb-4 space-y-1">
                <a
                  href="#features"
                  className="block px-3 py-2 text-base font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </a>
                <a
                  href="#pricing"
                  className="block px-3 py-2 text-base font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </a>
                <a
                  href="#contact"
                  className="block px-3 py-2 text-base font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Contact
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
      {/* )} */}
    </div>
  );
}